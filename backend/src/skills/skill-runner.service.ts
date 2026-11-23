import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { repoRoot } from '../common/paths.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadRegistry, type SkillDef, type SkillRegistry } from './skill-registry.js';

const run = promisify(execFile);

export interface SkillResult {
  skillId: string;
  status: 'success' | 'failed' | 'skipped';
  json?: unknown;
  jsonPath?: string;
  error?: string;
}

@Injectable()
export class SkillRunnerService {
  private readonly logger = new Logger(SkillRunnerService.name);
  private registry: SkillRegistry = loadRegistry();
  private certFile?: Promise<string | undefined>;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 스킬 하나를 실행하고 결과를 skill_outputs에 저장한다.
   * 실패해도 throw하지 않는다 (절대 규칙 4). 호출한 쪽은 status만 보면 된다.
   */
  async run(
    runId: string,
    skillId: string,
    upstream: Record<string, SkillResult> = {},
  ): Promise<SkillResult> {
    const def = this.registry.skills[skillId];
    if (!def) throw new Error(`skills-registry.yaml에 없는 스킬: ${skillId}`);

    const started = Date.now();
    const outputDir = join(repoRoot(), 'reports', runId, skillId);
    let result: SkillResult;
    let rawMd: string | undefined;

    try {
      await mkdir(outputDir, { recursive: true });
      const args = this.buildArgs(def, { outputDir, runId }, upstream);
      const [cmd, cmdArgs] = this.command(def, args);
      await run(cmd, cmdArgs, {
        cwd: repoRoot(),
        timeout: def.timeoutSec * 1000,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, ...(await this.sslEnv()) },
      });

      const jsonPath = await this.findOutput(outputDir, def.output);
      if (!jsonPath) throw new Error(`출력 파일을 찾지 못함: ${def.output}`);
      const json: unknown = JSON.parse(await readFile(jsonPath, 'utf8'));
      const mdPath = jsonPath.replace(/\.json$/, '.md');
      if (existsSync(mdPath)) rawMd = await readFile(mdPath, 'utf8');
      result = { skillId, status: 'success', json, jsonPath };
    } catch (err) {
      result = { skillId, status: 'failed', error: describe(err) };
      this.logger.warn(`${skillId} 실패: ${result.error}`);
    }

    await this.prisma.skillOutput.create({
      data: {
        runId,
        skillId,
        status: result.status,
        rawJson: (result.json ?? undefined) as Prisma.InputJsonValue | undefined,
        rawMd,
        error: result.error,
        durationMs: Date.now() - started,
      },
    });
    return result;
  }

  /** 앞선 스킬이 하나도 없어서 돌릴 수 없을 때 기록만 남긴다 */
  async skip(runId: string, skillId: string, reason: string): Promise<SkillResult> {
    await this.prisma.skillOutput.create({
      data: { runId, skillId, status: 'skipped', error: reason },
    });
    return { skillId, status: 'skipped', error: reason };
  }

  private buildArgs(
    def: SkillDef,
    vars: { outputDir: string; runId: string },
    upstream: Record<string, SkillResult>,
  ): string[] {
    const args = def.args.map((a) =>
      a.replace('{outputDir}', vars.outputDir).replace('{runId}', vars.runId),
    );
    for (const [flag, fromSkill] of Object.entries(def.inputs ?? {})) {
      const path = upstream[fromSkill]?.jsonPath;
      if (path) args.push(flag, path);
    }
    return args;
  }

  private command(def: SkillDef, args: string[]): [string, string[]] {
    if (def.runtime === 'uv') {
      const { project, extras = [] } = this.registry.runtimes.uv;
      const extraArgs = extras.flatMap((e) => ['--extra', e]);
      return ['uv', ['run', '--project', join(repoRoot(), project), ...extraArgs, 'python', def.script, ...args]];
    }
    return ['python3', [def.script, ...args]];
  }

  private async findOutput(dir: string, pattern: string): Promise<string | undefined> {
    const re = new RegExp(
      '^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
    );
    const files = (await readdir(dir)).filter((f) => re.test(f));
    if (files.length === 0) return undefined;
    const withTime = await Promise.all(
      files.map(async (f) => ({ f, t: (await stat(join(dir, f))).mtimeMs })),
    );
    withTime.sort((a, b) => b.t - a.t);
    return join(dir, withTime[0].f);
  }

  /**
   * python.org 맥 빌드의 urllib은 시스템 인증서를 못 찾는다 (sector-analyst SSL 오류).
   * uv 환경의 certifi 번들을 SSL_CERT_FILE로 넘긴다.
   */
  private sslEnv(): Promise<Record<string, string>> {
    this.certFile ??= run(
      'uv',
      [
        'run',
        '--project',
        join(repoRoot(), this.registry.runtimes.uv.project),
        'python',
        '-c',
        'import certifi; print(certifi.where())',
      ],
      { cwd: repoRoot() },
    )
      .then(({ stdout }) => stdout.trim() || undefined)
      .catch(() => undefined);
    return this.certFile.then((f): Record<string, string> => (f ? { SSL_CERT_FILE: f } : {}));
  }
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'stderr' in err) {
    const e = err as { message: string; stderr?: string; killed?: boolean };
    if (e.killed) return '타임아웃';
    const tail = (e.stderr ?? '').trim().split('\n').slice(-5).join('\n');
    return tail || e.message;
  }
  return err instanceof Error ? err.message : String(err);
}
