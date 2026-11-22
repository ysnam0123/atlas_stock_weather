import { Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { MARKET_DAILY, MarketDailyJob } from '../jobs/market-daily.job.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('runs')
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDaily: MarketDailyJob,
  ) {}

  @Get()
  list() {
    return this.prisma.run.findMany({
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: { skillOutputs: { select: { skillId: true, status: true, error: true, durationMs: true } } },
    });
  }

  @Get('latest')
  latest() {
    return this.prisma.run.findFirst({ orderBy: { startedAt: 'desc' } });
  }

  /** 수동 실행. 끝날 때까지 기다리지 않는다 (웹 요청 안에서 Python을 기다리지 않는다). */
  @Post(':kind')
  @HttpCode(202)
  trigger(@Param('kind') kind: string) {
    if (kind !== MARKET_DAILY) throw new NotFoundException(`알 수 없는 작업: ${kind}`);
    void this.marketDaily.run();
    return { accepted: kind };
  }
}
