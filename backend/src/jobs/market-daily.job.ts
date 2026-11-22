import { Injectable, Logger } from '@nestjs/common';
import { adaptMarket, adaptSectors, pickTradeDate } from '../adapters/market.adapter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkillRunnerService, type SkillResult } from '../skills/skill-runner.service.js';

export const MARKET_DAILY = 'market_daily';

/** 이 시간 안에 시작된 running 실행이 있으면 겹쳐 돌리지 않는다 */
const RUNNING_GUARD_MS = 30 * 60 * 1000;

/**
 * 시장 날씨 수집: 시장 폭·상승추세·섹터 → 노출 판정 → 정규화 테이블.
 * 스킬 하나가 실패해도 나머지는 저장하고 run을 partial로 끝낸다.
 */
@Injectable()
export class MarketDailyJob {
  private readonly logger = new Logger(MarketDailyJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: SkillRunnerService,
  ) {}

  async run(): Promise<{ runId: string; status: string; tradeDate: string | null } | null> {
    const busy = await this.prisma.run.findFirst({
      where: {
        kind: MARKET_DAILY,
        status: 'running',
        startedAt: { gte: new Date(Date.now() - RUNNING_GUARD_MS) },
      },
    });
    if (busy) {
      this.logger.log(`이미 실행 중 (${busy.id}), 건너뜀`);
      return null;
    }

    const run = await this.prisma.run.create({ data: { kind: MARKET_DAILY, market: 'us' } });
    this.logger.log(`시작 ${run.id}`);

    try {
      const [breadth, uptrend, sector] = await Promise.all([
        this.skills.run(run.id, 'market-breadth-analyzer'),
        this.skills.run(run.id, 'uptrend-analyzer'),
        this.skills.run(run.id, 'sector-analyst'),
      ]);
      const upstream = { [breadth.skillId]: breadth, [uptrend.skillId]: uptrend, [sector.skillId]: sector };
      const exposure =
        breadth.status === 'success' || uptrend.status === 'success'
          ? await this.skills.run(run.id, 'exposure-coach', upstream)
          : await this.skills.skip(run.id, 'exposure-coach', '시장 폭·상승추세가 모두 실패');

      const tradeDate = await this.save(run.id, { breadth, uptrend, sector, exposure });

      const results = [breadth, uptrend, sector, exposure];
      const ok = results.filter((r) => r.status === 'success').length;
      const status = !tradeDate || ok === 0 ? 'failed' : ok === results.length ? 'success' : 'partial';
      const failedSkills = results.filter((r) => r.status !== 'success').map((r) => r.skillId);

      await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt: new Date(),
          error: failedSkills.length ? `실패: ${failedSkills.join(', ')}` : null,
        },
      });
      this.logger.log(`끝 ${run.id} ${status} 거래일=${tradeDate ?? '없음'}`);
      return { runId: run.id, status, tradeDate };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), error: message },
      });
      this.logger.error(`실패 ${run.id}: ${message}`);
      return { runId: run.id, status: 'failed', tradeDate: null };
    }
  }

  /** 거래일 기준으로 덮어쓴다. 같은 장을 두 번 받아도 한 줄이다. */
  private async save(
    runId: string,
    r: Record<'breadth' | 'uptrend' | 'sector' | 'exposure', SkillResult>,
  ): Promise<string | null> {
    const json = (x: SkillResult) => (x.status === 'success' ? x.json : undefined);
    const tradeDate = pickTradeDate({
      breadth: json(r.breadth),
      uptrend: json(r.uptrend),
      sector: json(r.sector),
    });
    if (!tradeDate) return null;
    const date = new Date(`${tradeDate}T00:00:00Z`);

    const fields = adaptMarket({
      breadth: json(r.breadth),
      uptrend: json(r.uptrend),
      exposure: json(r.exposure),
    });
    // 오늘 실패한 스킬의 값(null)으로 이전에 받은 값을 지우지 않는다.
    // 새로 만들 때도 null은 빼고 넣는다 (목록·Json 칼럼은 null 대신 기본값을 쓴다)
    const update = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));

    const sectors = r.sector.status === 'success' ? adaptSectors(r.sector.json) : [];

    await this.prisma.$transaction([
      this.prisma.marketSnapshot.upsert({
        where: { market_tradeDate: { market: 'us', tradeDate: date } },
        create: { market: 'us', tradeDate: date, runId, ...update },
        update: { runId, ...update },
      }),
      ...(sectors.length
        ? [
            this.prisma.sectorSnapshot.deleteMany({ where: { market: 'us', tradeDate: date } }),
            this.prisma.sectorSnapshot.createMany({
              data: sectors.map((s) => ({ market: 'us' as const, tradeDate: date, runId, ...s })),
            }),
          ]
        : []),
    ]);
    return tradeDate;
  }
}
