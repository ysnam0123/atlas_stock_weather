import './common/env.js';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AI_DAILY, AiDailyJob } from './ai/ai-daily.job.js';
import { BACKFILL_UPTREND, BackfillUptrendJob } from './jobs/backfill-uptrend.job.js';
import { COMMENTARY_DAILY, CommentaryJob } from './claude/commentary.job.js';
import { EARNINGS_CALENDAR, EarningsCalendarJob } from './jobs/earnings-calendar.job.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MARKET_DAILY, MarketDailyJob } from './jobs/market-daily.job.js';
import { PRICES_DAILY, PricesService } from './jobs/prices.service.js';
import { STOCK_INTEL, StockIntelJob } from './jobs/stock-intel.job.js';
import { SYMBOLS_WEEKLY, SymbolsWeeklyJob } from './jobs/symbols-weekly.job.js';
import { PrismaModule } from './prisma/prisma.module.js';

// 작업 하나를 지금 바로 실행하고 끝낸다: pnpm --filter backend job market_daily
@Module({ imports: [PrismaModule, JobsModule] })
class JobCliModule {}

const kind = process.argv[2];
const app = await NestFactory.createApplicationContext(JobCliModule, { logger: ['log', 'warn', 'error'] });

const jobs: Record<string, () => Promise<unknown>> = {
  [MARKET_DAILY]: () => app.get(MarketDailyJob).run(),
  [BACKFILL_UPTREND]: () => app.get(BackfillUptrendJob).run(),
  [SYMBOLS_WEEKLY]: () => app.get(SymbolsWeeklyJob).run(),
  [PRICES_DAILY]: () => app.get(PricesService).runDaily(),
  [AI_DAILY]: () => app.get(AiDailyJob).run(),
  [EARNINGS_CALENDAR]: () => app.get(EarningsCalendarJob).run(),
  [COMMENTARY_DAILY]: () => app.get(CommentaryJob).run(),
  [STOCK_INTEL]: () => app.get(StockIntelJob).run(),
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
