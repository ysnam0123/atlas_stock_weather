import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BACKFILL_UPTREND, BackfillUptrendJob } from '../jobs/backfill-uptrend.job.js';
import { MARKET_DAILY, MarketDailyJob } from '../jobs/market-daily.job.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { latestDueSlot, type Slot } from './slots.js';

/**
 * TraderMonty CSV는 한국 시간 11~13시에 전날 미국장 데이터로 갱신된다 (2026-11 확인).
 * 그래서 13:30에 받고, 늦게 올라오는 날을 위해 18:00에 한 번 더 받는다.
 * 같은 거래일은 덮어쓰므로 두 번 돌아도 중복되지 않는다.
 */
const MARKET_DAILY_SLOT: Slot = { days: [2, 3, 4, 5, 6], times: ['13:30', '18:00'] };

/** 워커가 꺼져 있던 날의 상승추세·섹터 값을 주 1회 메운다 (시장 점수는 못 메운다) */
const BACKFILL_UPTREND_SLOT: Slot = { days: [0], times: ['10:00'] };

/** 한 실행 시각에서 실패가 이만큼 쌓이면 다음 시각까지 다시 시도하지 않는다 */
const MAX_ATTEMPTS_PER_SLOT = 3;

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDaily: MarketDailyJob,
    private readonly backfillUptrend: BackfillUptrendJob,
  ) {}

  async onApplicationBootstrap() {
    // 워커가 실행 도중 죽었으면 running으로 남는다. 그대로 두면 그 시각은 영영 보충되지 않는다.
    const { count } = await this.prisma.run.updateMany({
      where: { status: 'running' },
      data: { status: 'failed', finishedAt: new Date(), error: '워커 재시작으로 중단됨' },
    });
    if (count) this.logger.warn(`중단된 실행 ${count}건을 failed로 정리`);

    // 워커를 켜자마자 놓친 실행을 보충한다
    void this.tick();
  }

  /** 정각 크론 대신 10분마다 "밀린 게 있나"를 본다. 맥이 잠들었다 깨어나도 따라잡는다. */
  @Cron('*/10 * * * *', { timeZone: 'Asia/Seoul' })
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.ensure(MARKET_DAILY, MARKET_DAILY_SLOT, () => this.marketDaily.run());
      await this.ensure(BACKFILL_UPTREND, BACKFILL_UPTREND_SLOT, () => this.backfillUptrend.run());
    } catch (err) {
      this.logger.error(err instanceof Error ? err.stack : String(err));
    } finally {
      this.ticking = false;
    }
  }

  private async ensure(kind: string, slot: Slot, job: () => Promise<unknown>) {
    const due = latestDueSlot(slot);
    if (!due) return;

    const since = await this.prisma.run.findMany({
      where: { kind, startedAt: { gte: due } },
      select: { status: true },
    });
    if (since.some((r) => r.status === 'success' || r.status === 'partial' || r.status === 'running')) {
      return;
    }
    if (since.length >= MAX_ATTEMPTS_PER_SLOT) return;

    this.logger.log(`${kind}: ${due.toISOString()} 실행분이 없어 지금 실행`);
    await job();
  }
}
