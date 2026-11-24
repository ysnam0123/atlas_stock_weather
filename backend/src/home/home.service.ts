import { Injectable } from '@nestjs/common';
import type { Market } from '../generated/prisma/client.js';
import { congressFlows } from '../jobs/congress-members.js';
import { MARKET_DAILY } from '../jobs/market-daily.job.js';
import { PREMARKET_INDEXES } from '../jobs/premarket.job.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MARKET_DAILY_SLOT } from '../scheduler/scheduler.service.js';
import { nextSlot } from '../scheduler/slots.js';
import { lastNightHoliday, US_EARLY_CLOSES } from '../scheduler/us-market-calendar.js';

/** 흐름 차트: 최근 1년(거래일 기준) */
const HISTORY_DAYS = 260;
/** 프리마켓 스냅샷은 찍고 12시간까지만 보여준다 (다음 날 종가 분석이 오면 의미가 없다) */
const PREMARKET_FRESH_MS = 12 * 60 * 60 * 1000;
const WEEK_DAYS = 5;
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
    const [weather, history, sectors, sectorHistory, run, earnings, intel, premarket, week] = await Promise.all([
      this.weather(market),
      this.history(market),
      this.sectors(market),
      this.sectorHistory(market),
      this.prisma.run.findFirst({
        where: { kind: MARKET_DAILY, market },
        orderBy: { startedAt: 'desc' },
        select: { status: true, startedAt: true, finishedAt: true },
      }),
      this.earnings(),
      this.intel(),
      this.premarket(),
      this.week(market),
    ]);
    const holiday = lastNightHoliday();
    const sessionNote = holiday
      ? { kind: 'holiday' as const, ...holiday }
      : weather && US_EARLY_CLOSES.has(weather.tradeDate)
        ? { kind: 'early' as const, date: weather.tradeDate, name: '조기 폐장' }
        : null;
    return {
      market,
      weather,
      history,
      sectors,
      sectorHistory,
      run,
      earnings,
      intel,
      sessionNote,
      premarket,
      week,
      nextRunAt: nextSlot(MARKET_DAILY_SLOT),
    };
  }

  /**
   * 오늘 밤 프리마켓 스냅샷 (21:30 KST 한 번). 찍은 지 PREMARKET_FRESH_MS 안일 때만 보여준다.
   * 내 보유 종목은 손절가 아래에서 거래되는지도 같이 본다
   */
  private async premarket() {
    const latest = await this.prisma.premarketSnapshot.findFirst({ orderBy: { takenAt: 'desc' } });
    if (!latest || Date.now() - latest.takenAt.getTime() > PREMARKET_FRESH_MS) return null;
    const [rows, holdings, watch] = await Promise.all([
      this.prisma.premarketSnapshot.findMany({ where: { sessionDate: latest.sessionDate } }),
      this.prisma.holding.findMany({ select: { symbol: true, stopPrice: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
    ]);
    const stop = new Map(holdings.map((h) => [h.symbol, h.stopPrice]));
    const watched = new Set(watch.map((w) => w.symbol));
    const names = await this.prisma.symbol.findMany({
      where: { symbol: { in: rows.map((r) => r.symbol) } },
      select: { symbol: true, nameEn: true, nameKo: true },
    });
    const nameOf = new Map(names.map((n) => [n.symbol, n]));
    const kind = (symbol: string) =>
      PREMARKET_INDEXES.includes(symbol) ? ('index' as const) : stop.has(symbol) ? ('holding' as const) : watched.has(symbol) ? ('watch' as const) : null;
    const order = { index: 0, holding: 1, watch: 2 };
    const items = rows
      .map((r) => ({ r, tracked: kind(r.symbol) }))
      .filter((x): x is { r: (typeof rows)[number]; tracked: 'index' | 'holding' | 'watch' } => x.tracked != null)
      .sort((a, b) => order[a.tracked] - order[b.tracked] || PREMARKET_INDEXES.indexOf(a.r.symbol) - PREMARKET_INDEXES.indexOf(b.r.symbol))
      .map(({ r, tracked }) => {
        const stopPrice = stop.get(r.symbol) ?? null;
        return {
          symbol: r.symbol,
          nameEn: nameOf.get(r.symbol)?.nameEn ?? r.symbol,
          nameKo: nameOf.get(r.symbol)?.nameKo ?? null,
          tracked,
          price: r.price,
          prevClose: r.prevClose,
          changePct: (r.price / r.prevClose - 1) * 100,
          priceAt: r.priceAt.toISOString(),
          stopPrice,
          belowStop: stopPrice != null && r.price < stopPrice,
        };
      });
    return { sessionDate: day(latest.sessionDate), takenAt: latest.takenAt.toISOString(), items };
  }

  /** 이번 주 정리 (주말 홈): 최근 5거래일의 날씨, S&P 500, 섹터 변화, 내 매매·AI 매매 */
  private async week(market: Market) {
    const days = await this.prisma.marketSnapshot.findMany({
      where: { market },
      orderBy: { tradeDate: 'desc' },
      take: WEEK_DAYS + 1,
      select: { tradeDate: true, condition: true },
    });
    if (days.length < 2) return null;
    const week = days.slice(0, WEEK_DAYS).reverse();
    const before = days[WEEK_DAYS] ?? null;
    const from = week[0].tradeDate;
    const to = week.at(-1)!.tradeDate;

    const spyBars = await this.prisma.priceBar.findMany({
      where: { symbol: 'SPY', date: { lte: to } },
      orderBy: { date: 'desc' },
      take: WEEK_DAYS + 1,
      select: { close: true },
    });
    const spyPct = spyBars.length === WEEK_DAYS + 1 ? (spyBars[0].close / spyBars[WEEK_DAYS].close - 1) * 100 : null;

    let sectorMoves: { sector: string; change: number }[] = [];
    if (before) {
      const [now, then] = await Promise.all([
        this.prisma.sectorSnapshot.findMany({ where: { market, tradeDate: to } }),
        this.prisma.sectorSnapshot.findMany({ where: { market, tradeDate: before.tradeDate } }),
      ]);
      const prev = new Map(then.map((x) => [x.sector, x.uptrendRatio]));
      sectorMoves = now
        .filter((x) => prev.has(x.sector))
        .map((x) => ({ sector: x.sector, change: x.uptrendRatio - prev.get(x.sector)! }))
        .sort((a, b) => b.change - a.change);
    }

    const range = { gte: from, lte: to };
    const [trades, aiOpened, aiClosed] = await Promise.all([
      this.prisma.trade.findMany({ where: { date: range }, select: { side: true, realizedPnl: true } }),
      this.prisma.aiPosition.count({ where: { entryDate: range, account: { active: true } } }),
      this.prisma.aiPosition.findMany({ where: { exitDate: range, account: { active: true } }, select: { pnl: true } }),
    ]);

    return {
      from: day(from),
      to: day(to),
      days: week.map((d) => ({ date: day(d.tradeDate), condition: d.condition })),
      spyPct,
      best: sectorMoves[0] ?? null,
      worst: sectorMoves.at(-1) ?? null,
      my: {
        buys: trades.filter((t) => t.side === 'buy').length,
        sells: trades.filter((t) => t.side === 'sell').length,
        realizedPnl: trades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0),
      },
      ai: { opened: aiOpened, closed: aiClosed.length, realizedPnl: aiClosed.reduce((sum, p) => sum + (p.pnl ?? 0), 0) },
    };
  }

  /**
   * 내 보유·관심 종목의 중요한 새 소식(3일)과 의원 거래 쏠림(신고일 30일).
   * 의원 거래는 신고가 늦어 한 건씩은 홈에 두지 않는다. 서로 다른 의원 여럿이 한쪽으로 몰릴 때만 알린다.
   */
  private async intel() {
    const [h, w] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
    ]);
    const kind = new Map<string, 'holding' | 'watch'>();
    for (const x of w) kind.set(x.symbol, 'watch');
    for (const x of h) kind.set(x.symbol, 'holding');
    const symbols = [...kind.keys()];
    if (!symbols.length) return { news: [], congressFlows: [] };
    const since = (days: number) => new Date(Date.now() - days * 86_400_000);
    const [news, trades, names] = await Promise.all([
      this.prisma.newsItem.findMany({
        where: { symbol: { in: symbols }, importance: 'high', publishedAt: { gte: since(3) } },
        orderBy: { publishedAt: 'desc' },
        take: 6,
      }),
      this.prisma.congressTrade.findMany({
        where: { ticker: { in: symbols }, doc: { filed: { gte: since(30) } } },
        include: { doc: { select: { member: true } } },
      }),
      this.prisma.symbol.findMany({ where: { symbol: { in: symbols } }, select: { symbol: true, nameEn: true, nameKo: true } }),
    ]);
    const nameOf = new Map(names.map((n) => [n.symbol, n]));
    const name = (s: string) => ({ nameEn: nameOf.get(s)?.nameEn ?? s, nameKo: nameOf.get(s)?.nameKo ?? null });
    return {
      news: news.map((n) => ({
        id: n.id,
        symbol: n.symbol,
        ...name(n.symbol),
        tracked: kind.get(n.symbol)!,
        kind: n.kind,
        title: n.titleKo ?? n.title,
        url: n.url,
        publishedAt: n.publishedAt.toISOString(),
      })),
      congressFlows: congressFlows(trades.map((t) => ({ symbol: t.ticker!, member: t.doc.member, type: t.type }))).map((f) => ({
        ...f,
        ...name(f.symbol),
        tracked: kind.get(f.symbol)!,
      })),
    };
  }

  /** 내 보유·관심·AI 보유 종목의 다가오는 실적 발표 (미국 날짜) */
  private async earnings() {
    const [h, w, a] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
      this.prisma.aiPosition.findMany({ where: { status: 'open' }, select: { symbol: true } }),
    ]);
    const kind = new Map<string, 'holding' | 'watch' | 'ai'>();
    for (const x of a) kind.set(x.symbol, 'ai');
    for (const x of w) kind.set(x.symbol, 'watch');
    for (const x of h) kind.set(x.symbol, 'holding');
    if (!kind.size) return [];
    // 미국 날짜 기준 오늘 (뉴욕은 한국보다 하루 늦을 수 있어 하루 여유)
    const since = new Date(Date.now() - 86_400_000);
    const rows = await this.prisma.calendarEvent.findMany({
      where: { type: 'earnings', symbol: { in: [...kind.keys()] }, date: { gte: new Date(day(since)) } },
      orderBy: { date: 'asc' },
    });
    const names = await this.prisma.symbol.findMany({
      where: { symbol: { in: rows.map((r) => r.symbol) } },
      select: { symbol: true, nameEn: true, nameKo: true },
    });
    const byName = new Map(names.map((n) => [n.symbol, n]));
    return rows.map((r) => ({
      symbol: r.symbol,
      nameEn: byName.get(r.symbol)?.nameEn ?? r.symbol,
      nameKo: byName.get(r.symbol)?.nameKo ?? null,
      date: day(r.date),
      tracked: kind.get(r.symbol)!,
    }));
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
      commentary: await this.prisma.commentary
        .findUnique({ where: { market_tradeDate: { market, tradeDate: latest.tradeDate } } })
        .then((c) => (c ? { headline: c.headline, summary: c.summary, why: c.why } : null)),
      topRiskScore: latest.topRiskScore,
      topRiskZone: latest.topRiskZone,
      regime: latest.regime,
      ftdState: latest.ftdState,
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
