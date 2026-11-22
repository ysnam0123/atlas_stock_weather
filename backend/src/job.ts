import './common/env.js';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BACKFILL_UPTREND, BackfillUptrendJob } from './jobs/backfill-uptrend.job.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MARKET_DAILY, MarketDailyJob } from './jobs/market-daily.job.js';
import { PrismaModule } from './prisma/prisma.module.js';

// 작업 하나를 지금 바로 실행하고 끝낸다: pnpm --filter backend job market_daily
@Module({ imports: [PrismaModule, JobsModule] })
class JobCliModule {}

const kind = process.argv[2];
const app = await NestFactory.createApplicationContext(JobCliModule, { logger: ['log', 'warn', 'error'] });

const jobs: Record<string, () => Promise<unknown>> = {
  [MARKET_DAILY]: () => app.get(MarketDailyJob).run(),
  [BACKFILL_UPTREND]: () => app.get(BackfillUptrendJob).run(),
};

try {
  const job = kind ? jobs[kind] : undefined;
  if (job) {
    Logger.log(JSON.stringify(await job()), 'job');
  } else {
    Logger.error(`알 수 없는 작업: ${kind ?? '(없음)'}. 가능한 값: ${Object.keys(jobs).join(', ')}`, 'job');
    process.exitCode = 1;
  }
} finally {
  await app.close();
}
