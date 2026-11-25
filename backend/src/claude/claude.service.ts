import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';

export interface ClaudeResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  /** Claude가 주고받은 횟수. 도구 없이 정상이면 2 (답 + 구조화 출력) */
  turns: number;
  /** 금지 표현 때문에 다시 쓰게 했으면 그 표현 */
  rewrote?: string[];
}

const TIMEOUT_MS = 180_000;
/** 도구 없는 호출이 스키마 검증 재시도로 길어지는 걸 막는다 (2026-11-25 신호 해설이 평소 7배 토큰) */
const MAX_TURNS_NO_TOOLS = 4;

export interface ClaudeInput {
  system: string;
  prompt: string;
  schema: object;
  tools?: 'WebSearch'[];
  timeoutMs?: number;
}

/**
 * 예측·지시 표현 (절대 규칙 7). Claude 출력에 섞이면 다시 쓰게 하고, 또 섞이면 버린다.
 * 사라·팔라는 지시도 막는다. 선택은 사용자 몫이다.
 */
const FORBIDDEN = [
  '예보',
  '확률',
  '전망',
  '오를 것',
  '오를 거',
  '오를 가능성',
  '떨어질 것',
  '떨어질 거',
  '떨어질 가능성',
  '상승할 것',
  '하락할 것',
  '반등할 것',
  '사세요',
  '파세요',
  '매수하세요',
  '매도하세요',
];

/** 문자열 어디든(중첩 객체·배열 포함) 금지 표현이 있으면 찾아서 돌려준다 */
export function findForbidden(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const word of FORBIDDEN) if (v.includes(word)) found.add(word);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

/**
 * Claude Code 헤드리스(`claude -p`) 호출 (CLAUDE_MODE=code, 구독 계정).
 * - 출력은 --json-schema로 강제한다 (절대 규칙 3)
 * - 도구는 기본으로 모두 끈다. 필요한 값은 프롬프트에 다 넣어 준다. 깊게 분석만 WebSearch를 켠다 (허용 목록 Read·Glob·WebSearch 안)
 * - 레포 밖 빈 폴더에서 돌려 CLAUDE.md·프로젝트 설정을 읽지 않는다
 * - 시스템 프롬프트를 우리 것으로 바꿔 기본 프롬프트 토큰을 아낀다
 */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  get model() {
    return process.env.CLAUDE_MODEL || 'sonnet';
  }

  /**
   * tools: 켤 도구. 허용 목록(절대 규칙 3) 중 WebSearch만 쓴다. 기본은 전부 끔.
   * timeoutMs: 웹 검색을 하면 오래 걸린다
   */
  async structured<T>(input: ClaudeInput): Promise<ClaudeResult<T>> {
    if ((process.env.CLAUDE_MODE ?? 'code') !== 'code') {
      throw new Error(`CLAUDE_MODE=${process.env.CLAUDE_MODE}는 아직 지원하지 않아요 (code만)`);
    }
    const cwd = join(tmpdir(), 'atlas-claude');
    await mkdir(cwd, { recursive: true });

    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(input.schema),
      '--tools',
      (input.tools ?? []).join(','),
      ...(input.tools?.length ? ['--allowedTools', input.tools.join(',')] : ['--max-turns', String(MAX_TURNS_NO_TOOLS)]),
      '--system-prompt',
      input.system,
      '--no-session-persistence',
      '--model',
      this.model,
    ];

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, { cwd, env: process.env });
      let out = '';
      let err = '';
      const timeoutMs = input.timeoutMs ?? TIMEOUT_MS;
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`claude 시간 초과 (${timeoutMs / 1000}초)`));
      }, timeoutMs);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`claude 종료 코드 ${code}: ${(err || out).slice(0, 300)}`));
      });
      child.stdin.end(input.prompt);
    });

    const res = JSON.parse(stdout) as {
      is_error?: boolean;
      result?: string;
      structured_output?: T;
      total_cost_usd?: number;
      num_turns?: number;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    if (res.is_error || res.structured_output == null) {
      throw new Error(`claude 응답 오류: ${String(res.result ?? '구조화 출력 없음').slice(0, 300)}`);
    }
    const u = res.usage ?? {};
    return {
      data: res.structured_output,
      model: this.model,
      inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      outputTokens: u.output_tokens ?? 0,
      costUsd: res.total_cost_usd ?? null,
      turns: res.num_turns ?? 0,
    };
  }

  /** 금지 표현이 나오면 한 번 다시 쓰게 한다. 그래도 나오면 에러 */
  async structuredChecked<T>(input: ClaudeInput): Promise<ClaudeResult<T>> {
    const first = await this.structured<T>(input);
    const bad = findForbidden(first.data);
    if (!bad.length) return first;
    this.logger.warn(`금지 표현 ${bad.join(', ')} → 다시 쓰기`);
    const second = await this.structured<T>({
      ...input,
      prompt: `${input.prompt}\n\n주의: 앞선 답에 쓰면 안 되는 표현(${bad.join(', ')})이 있었어요. 이 표현 없이 다시 써 주세요.`,
    });
    const bad2 = findForbidden(second.data);
    if (bad2.length) throw new Error(`금지 표현이 계속 나옴: ${bad2.join(', ')}`);
    return {
      ...second,
      inputTokens: first.inputTokens + second.inputTokens,
      outputTokens: first.outputTokens + second.outputTokens,
      costUsd: (first.costUsd ?? 0) + (second.costUsd ?? 0),
      turns: first.turns + second.turns,
      rewrote: bad,
    };
  }
}
