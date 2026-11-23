import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repoRoot } from '../common/paths.js';

export interface SkillDef {
  runtime: 'uv' | 'python3';
  script: string;
  args: string[];
  /** 플래그 → 앞선 스킬 id. 그 스킬이 성공했을 때만 경로를 붙인다. */
  inputs?: Record<string, string>;
  /** outputDir 안에서 결과 JSON을 찾는 glob (파일명 패턴, * 만 지원). 'stdout'이면 화면 출력을 JSON으로 읽는다 */
  output: string;
  timeoutSec: number;
}

export interface SkillRegistry {
  runtimes: { uv: { project: string; extras?: string[] } };
  skills: Record<string, SkillDef>;
}

export function loadRegistry(): SkillRegistry {
  const file = join(repoRoot(), 'config', 'skills-registry.yaml');
  return parse(readFileSync(file, 'utf8')) as SkillRegistry;
}
