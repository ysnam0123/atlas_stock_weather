import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** uptrend-analyzer 섹터 이름 → 대표 섹터 ETF (SPDR). 일봉은 prices_daily가 받는다 */
export const SECTOR_ETFS: Record<string, string> = {
  Technology: 'XLK',
  'Communication Services': 'XLC',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  Healthcare: 'XLV',
  Financial: 'XLF',
  'Financial Services': 'XLF',
  Industrials: 'XLI',
  Energy: 'XLE',
  'Basic Materials': 'XLB',
  'Real Estate': 'XLRE',
  Utilities: 'XLU',
};
export const SECTOR_ETF_SYMBOLS = [...new Set(Object.values(SECTOR_ETFS)), 'SPY'];

/** 1주·1개월·3개월 = 5·21·63거래일 */
const PERIODS = { w1: 5, m1: 21, m3: 63 } as const;
const YEAR = 252;

const day = (d: Date) => d.toISOString().slice(0, 10);

/** 오래된 순 값에서 n거래일 전 대비 변화율. 이력이 모자라면 null */
function change(values: number[], n: number): number | null {
  if (values.length <= n) return null;
  const from = values[values.length - 1 - n];
  return from ? values[values.length - 1] / from - 1 : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 섹터 지도 (docs/frontend.md). 섹터 안 종목 중 상승추세인 비율(uptrend-analyzer)과 섹터 ETF 수익률을 같이 본다.
 * 국면은 비율의 높낮이(11개 섹터 가운데값 기준)와 최근 1개월 방향으로 나눈다. 전부 계산이고 판단이 아니다.
 */
@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const dates = (
      await this.prisma.sectorSnapshot.findMany({
        where: { market: 'us' },
        distinct: ['tradeDate'],
        orderBy: { tradeDate: 'desc' },
        select: { tradeDate: true },
        take: YEAR,
      })
    )
      .map((d) => d.tradeDate)
      .reverse();
    if (!dates.length) return { tradeDate: null, dates: [], spy: null, sectors: [] };

    const rows = await this.prisma.sectorSnapshot.findMany({
      where: { market: 'us', tradeDate: { in: dates } },
      select: { tradeDate: true, sector: true, rank: true, uptrendRatio: true, trend: true, status: true },
    });
    const index = new Map(dates.map((d, i) => [d.getTime(), i]));
    const bySector = new Map<string, { ratios: (number | null)[]; ranks: (number | null)[]; trend: string | null; status: string | null }>();
    for (const r of rows) {
      const e = bySector.get(r.sector) ?? { ratios: dates.map(() => null), ranks: dates.map(() => null), trend: null, status: null };
      const i = index.get(r.tradeDate.getTime())!;
      e.ratios[i] = r.uptrendRatio;
      e.ranks[i] = r.rank;
      if (i === dates.length - 1) {
        e.trend = r.trend;
        e.status = r.status;
      }
      bySector.set(r.sector, e);
    }

    const etfReturns = new Map<string, { close: number; w1: number | null; m1: number | null; m3: number | null }>();
    for (const symbol of SECTOR_ETF_SYMBOLS) {
      const bars = await this.prisma.priceBar.findMany({ where: { symbol }, orderBy: { date: 'asc' }, select: { close: true } });
      const closes = bars.map((b) => b.close);
      if (!closes.length) continue;
      etfReturns.set(symbol, {
        close: closes.at(-1)!,
        w1: change(closes, PERIODS.w1),
        m1: change(closes, PERIODS.m1),
        m3: change(closes, PERIODS.m3),
      });
    }
    const spy = etfReturns.get('SPY') ?? null;

    const last = dates.length - 1;
    const ago = (values: (number | null)[], n: number) => (last - n >= 0 ? values[last - n] : null);
    const items = [...bySector.entries()]
      .filter(([, e]) => e.ratios[last] != null)
      .map(([sector, e]) => {
        const now = e.ratios[last]!;
        const m1 = ago(e.ratios, PERIODS.m1);
        const symbol = SECTOR_ETFS[sector] ?? null;
        const etf = symbol ? etfReturns.get(symbol) : undefined;
        return {
          sector,
          rank: e.ranks[last]!,
          uptrendRatio: now,
          /** 상승추세 비율의 변화 (비율 차이, 0.03 = 3%p) */
          change1w: ago(e.ratios, PERIODS.w1) != null ? now - ago(e.ratios, PERIODS.w1)! : null,
          change1m: m1 != null ? now - m1 : null,
          rank1m: ago(e.ranks, PERIODS.m1),
          trend: e.trend,
          status: e.status,
          median1y: median(e.ratios.filter((x): x is number => x != null)),
          history: e.ratios,
          etf: symbol && etf ? { symbol, ...etf, rs3m: etf.m3 != null && spy?.m3 != null ? etf.m3 - spy.m3 : null } : null,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    // 국면: 높낮이는 오늘 11개 섹터의 가운데값, 방향은 1개월 변화
    const mid = median(items.map((s) => s.uptrendRatio)) ?? 0;
    const phase = (s: (typeof items)[number]) => {
      const high = s.uptrendRatio >= mid;
      const rising = (s.change1m ?? 0) >= 0;
      return high ? (rising ? 'leading' : 'weakening') : rising ? 'improving' : 'lagging';
    };

    return {
      tradeDate: day(dates[last]),
      dates: dates.map(day),
      spy: spy && { w1: spy.w1, m1: spy.m1, m3: spy.m3 },
      sectors: items.map((s) => ({ ...s, phase: phase(s) })),
    };
  }
}
