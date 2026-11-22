import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

let cached: string | undefined;

/** pnpm-workspace.yaml이 있는 레포 루트. backend에서 실행해도 루트 기준 경로를 쓴다. */
export function repoRoot(): string {
  if (cached) return cached;
  let dir = process.cwd();
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('레포 루트(pnpm-workspace.yaml)를 찾지 못했습니다');
    dir = parent;
  }
  cached = dir;
  return dir;
}
