import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SchedulerService } from './scheduler/scheduler.service.js';

@Module({
  imports: [PrismaModule, JobsModule, ScheduleModule.forRoot()],
  providers: [SchedulerService],
})
export class WorkerModule {}
