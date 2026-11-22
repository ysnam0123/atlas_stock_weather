// 진입점(main, worker, job)에서 가장 먼저 import한다. .env는 레포 루트 하나만 쓴다.
import { join } from 'node:path';
import { config } from 'dotenv';
import { repoRoot } from './paths.js';

config({ path: join(repoRoot(), '.env'), quiet: true });
process.env.TZ ??= 'Asia/Seoul';
