import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JobsModule } from './jobs/jobs.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RunsController } from './runs/runs.controller.js';

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [AppController, RunsController],
  providers: [AppService],
})
export class AppModule {}
