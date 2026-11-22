import { Module } from '@nestjs/common';
import { SkillRunnerService } from '../skills/skill-runner.service.js';
import { BackfillUptrendJob } from './backfill-uptrend.job.js';
import { MarketDailyJob } from './market-daily.job.js';

@Module({
  providers: [SkillRunnerService, MarketDailyJob, BackfillUptrendJob],
  exports: [MarketDailyJob, BackfillUptrendJob],
})
export class JobsModule {}
