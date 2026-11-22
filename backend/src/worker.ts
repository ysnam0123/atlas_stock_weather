import './common/env.js';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

// 스케줄러 + 분석 워커. HTTP 서버 없이 계속 떠 있는다.
const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
