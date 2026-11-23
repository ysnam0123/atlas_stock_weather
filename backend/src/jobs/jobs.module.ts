import { Module } from '@nestjs/common';
import { AiDailyJob } from '../ai/ai-daily.job.js';
import { SkillRunnerService } from '../skills/skill-runner.service.js';
import { BackfillUptrendJob } from './backfill-uptrend.job.js';
import { EarningsCalendarJob } from './earnings-calendar.job.js';
import { MarketDailyJob } from './market-daily.job.js';
import { PricesService } from './prices.service.js';
import { SymbolsWeeklyJob } from './symbols-weekly.job.js';

@Module({
  providers: [SkillRunnerService, MarketDailyJob, BackfillUptrendJob, SymbolsWeeklyJob, PricesService, AiDailyJob, EarningsCalendarJob],
  exports: [EarningsCalendarJob, MarketDailyJob, BackfillUptrendJob, SymbolsWeeklyJob, PricesService, AiDailyJob],
})
export class JobsModule {}
