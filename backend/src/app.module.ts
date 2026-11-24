import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AiController } from './ai/ai.controller.js';
import { AiService } from './ai/ai.service.js';
import { AppService } from './app.service.js';
import { HomeController } from './home/home.controller.js';
import { HomeService } from './home/home.service.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MyController } from './my/my.controller.js';
import { MyService } from './my/my.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RunsController } from './runs/runs.controller.js';
import { SectorsController } from './sectors/sectors.controller.js';
import { SectorsService } from './sectors/sectors.service.js';

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [AiController, AppController, HomeController, MyController, RunsController, SectorsController],
  providers: [AiService, AppService, HomeService, MyService, SectorsService],
})
export class AppModule {}
