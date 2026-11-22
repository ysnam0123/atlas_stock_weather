import { Injectable } from '@nestjs/common';
import type { Market } from '../generated/prisma/client.js';
import { MARKET_DAILY } from '../jobs/market-daily.job.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MARKET_DAILY_SLOT } from '../scheduler/scheduler.service.js';
import { nextSlot } from '../scheduler/slots.js';

/** 흐름 차트: 최근 1년(거래일 기준) */
const HISTORY_DAYS = 260;
/** 섹터 순위 히트맵: 최근 20거래일 (약 한 달) */
const HEATMAP_DAYS = 20;

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * 홈 화면 한 장에 필요한 값을 모은다. 응답 모양은 packages/contracts의 HomeResponse.
 * (백엔드는 rootDir 제약으로 contracts를 직접 import하지 않는다)
 */
@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(market: Market) {
    const [weather, history, sectors, sectorHistory, run] = await Promise.all([
      this.weather(market),
      this.history(market),
      this.sectors(market),
      this.sectorHistory(market),
      this.prisma.run.findFirst({
        where: { kind: MARKET_DAILY, market },
        orderBy: { startedAt: 'desc' },
        select: { status: true, startedAt: true, finishedAt: true },
      }),
    ]);
    return { market, weather, history, sectors, sectorHistory, run, nextRunAt: nextSlot(MARKET_DAILY_SLOT) };
  }

  private async weather(market: Market) {
    const latest = await this.prisma.marketSnapshot.findFirst({
      where: { market },
      orderBy: { tradeDate: 'desc' },
    });
    if (!latest) return null;

    const before = { market, tradeDate: { lt: latest.tradeDate } };
    const [prev, prevScored] = await Promise.all([
      this.prisma.marketSnapshot.findFirst({ where: before, orderBy: { tradeDate: 'desc' } }),
      this.prisma.marketSnapshot.findFirst({
        where: { ...before, marketScore: { not: null } },
        orderBy: { tradeDate: 'desc' },
      }),
    ]);

    return {
      tradeDate: day(latest.tradeDate),
      condition: latest.condition,
      exposureCeiling: latest.exposureCeiling,
      recommendation: latest.recommendation,
      summaryKo: latest.summaryKo,
      score: latest.marketScore,
      scoreZone: latest.breadthZone,
      prevScore:
        prevScored?.marketScore != null
          ? { tradeDate: day(prevScored.tradeDate), score: prevScored.marketScore }
          : null,
      uptrendRatio: latest.uptrendRatio,
      prevUptrendRatio: prev?.uptrendRatio ?? null,
      uptrendPercentile: latest.uptrendPercentile,
      uptrendMedian: latest.uptrendMedian,
      exposureScore: latest.exposureScore,
      exposureConfidence: latest.exposureConfidence,
      exposureMissing: latest.exposureMissing,
      breadthComponents: (latest.breadthComponents as { key: string; score: number }[] | null) ?? null,
      analyzedAt: latest.updatedAt.toISOString(),
    };
  }

  /** 오래된 날부터. 상승추세 비율은 과거까지 채워져 있고, 시장 점수는 수집을 시작한 날부터 있다 */
  private async history(market: Market) {
    const rows = await this.prisma.marketSnapshot.findMany({
      where: { market },
      orderBy: { tradeDate: 'desc' },
      take: HISTORY_DAYS,
      select: { tradeDate: true, uptrendRatio: true, marketScore: true },
    });
    return rows.reverse().map((r) => ({
      date: day(r.tradeDate),
      uptrendRatio: r.uptrendRatio,
      score: r.marketScore,
    }));
  }

  private async sectors(market: Market) {
    const dates = await this.prisma.sectorSnapshot.findMany({
      where: { market },
      distinct: ['tradeDate'],
      orderBy: { tradeDate: 'desc' },
      select: { tradeDate: true },
      take: 2,
    });
    if (!dates.length) return null;

    const [today, prev] = await Promise.all(
      dates.map((d) =>
        this.prisma.sectorSnapshot.findMany({
          where: { market, tradeDate: d.tradeDate },
          orderBy: { rank: 'asc' },
        }),
      ),
    );
    const prevBySector = new Map((prev ?? []).map((s) => [s.sector, s]));

    return {
      tradeDate: day(dates[0].tradeDate),
      items: today.map((s) => {
        const p = prevBySector.get(s.sector);
        return {
          sector: s.sector,
          rank: s.rank,
          uptrendRatio: s.uptrendRatio,
          prevRank: p?.rank ?? null,
          prevUptrendRatio: p?.uptrendRatio ?? null,
          trend: s.trend,
        };
      }),
    };
  }

  /** 섹터 × 최근 20거래일 순위. 섹터 순서는 마지막 날 순위 */
  private async sectorHistory(market: Market) {
    const dates = await this.prisma.sectorSnapshot.findMany({
      where: { market },
      distinct: ['tradeDate'],
      orderBy: { tradeDate: 'desc' },
      select: { tradeDate: true },
      take: HEATMAP_DAYS,
    });
    if (!dates.length) return null;
    const ordered = dates.map((d) => d.tradeDate).reverse();

    const rows = await this.prisma.sectorSnapshot.findMany({
      where: { market, tradeDate: { in: ordered } },
      select: { tradeDate: true, sector: true, rank: true, uptrendRatio: true },
    });
    const index = new Map(ordered.map((d, i) => [d.getTime(), i]));
    const bySector = new Map<string, { ranks: (number | null)[]; ratios: (number | null)[] }>();
    for (const r of rows) {
      const entry = bySector.get(r.sector) ?? {
        ranks: ordered.map(() => null),
        ratios: ordered.map(() => null),
      };
      const i = index.get(r.tradeDate.getTime())!;
      entry.ranks[i] = r.rank;
      entry.ratios[i] = r.uptrendRatio;
      bySector.set(r.sector, entry);
    }
    const last = ordered.length - 1;
    const sectors = [...bySector.entries()]
      .map(([sector, v]) => ({ sector, ...v }))
      .sort((a, b) => (a.ranks[last] ?? 99) - (b.ranks[last] ?? 99));

    return { dates: ordered.map(day), sectors };
  }
}
