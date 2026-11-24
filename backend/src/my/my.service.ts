import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PricesService } from '../jobs/prices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { stopOptions } from '../holdings/stop-options.js';
import { BENCHMARK } from '../ai/ai-daily.job.js';
import type { Bar, Condition } from '../ai/strategy.js';
import { evaluateBuyV2 } from '../ai/strategy-v2.js';

interface ScanHit {
  symbol: string;
  setups: string[];
  rsi?: number | null;
  close_date: string;
}

interface ScanContext {
  hits: Map<string, ScanHit>;
  spy: Bar[];
  condition: Condition | null;
}

const SEARCH_LIMIT = 20;
/** 손절가 계산·등락에 쓰는 일봉 기간 */
const BAR_DAYS = 120;

const day = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

const CAPITAL_KEY = 'capital';

export interface HoldingInput {
  /** 산 날짜 YYYY-MM-DD (보유 일수용). 없으면 처음 저장한 날 */
  openedAt?: string | null;
  shares: number;
  avgCost: number;
  stopPrice?: number | null;
  stopMethod?: string | null;
  targetPrice?: number | null;
  note?: string | null;
}

/** 숫자 칸 검사. 화면에서 막더라도 API에서 한 번 더 본다 */
function positive(name: string, v: unknown, allowZero = false): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    throw new BadRequestException(`${name}: 0보다 큰 숫자여야 해요`);
  }
  return n;
}

function optionalPositive(name: string, v: unknown): number | null {
  return v == null || v === '' ? null : positive(name, v);
}

/**
 * 종목 검색, 보유·관심 종목, 손절가 제안 (docs/architecture.md API 표).
 * 응답 모양은 packages/contracts의 SymbolHit, MyResponse, StopOptionsResponse.
 */
@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PricesService,
  ) {}

  /** 정렬: 티커 정확히 일치 → 티커 앞글자 → 이름 앞글자 → 이름 부분 일치 → 별칭 */
  async search(q: string) {
    const query = q.trim();
    if (!query) return [];
    const upper = query.toUpperCase();
    const rows = await this.prisma.symbol.findMany({
      where: {
        OR: [
          { symbol: { startsWith: upper } },
          { nameEn: { contains: query, mode: 'insensitive' } },
          { nameKo: { contains: query } },
          { aliases: { has: query } },
        ],
      },
      take: 200,
      include: { holding: { select: { symbol: true } }, watchItem: { select: { symbol: true } } },
    });

    const lower = query.toLowerCase();
    const rank = (r: (typeof rows)[number]) => {
      if (r.symbol === upper) return 0;
      if (r.symbol.startsWith(upper)) return 1 + r.symbol.length / 100;
      if (r.nameKo?.startsWith(query) || r.nameEn.toLowerCase().startsWith(lower)) return 2;
      if (r.nameKo?.includes(query) || r.nameEn.toLowerCase().includes(lower)) return 3;
      return 4;
    };

    return rows
      .sort((a, b) => rank(a) - rank(b) || (a.type === b.type ? 0 : a.type === 'stock' ? -1 : 1))
      .slice(0, SEARCH_LIMIT)
      .map((r) => ({
        symbol: r.symbol,
        exchange: r.exchange,
        nameEn: r.nameEn,
        nameKo: r.nameKo,
        type: r.type,
        tracked: r.holding ? ('holding' as const) : r.watchItem ? ('watch' as const) : null,
      }));
  }

  /** 종목별 최근 종가 두 개 (전일 대비 등락용) */
  private async lastCloses(symbols: string[]) {
    if (!symbols.length) return new Map<string, { date: string; close: number; prevClose: number | null }>();
    const since = new Date(Date.now() - 14 * 86_400_000);
    const bars = await this.prisma.priceBar.findMany({
      where: { symbol: { in: symbols }, date: { gte: since } },
      orderBy: { date: 'desc' },
      select: { symbol: true, date: true, close: true },
    });
    const out = new Map<string, { date: string; close: number; prevClose: number | null }>();
    for (const b of bars) {
      const cur = out.get(b.symbol);
      if (!cur) out.set(b.symbol, { date: day(b.date), close: b.close, prevClose: null });
      else if (cur.prevClose == null) cur.prevClose = b.close;
    }
    return out;
  }

  async capital(): Promise<number | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: CAPITAL_KEY } });
    return typeof row?.value === 'number' ? row.value : null;
  }

  /** 총 투자금(달러). 내 주식 비중 = 보유 평가금 ÷ 총 투자금. null이면 지운다 */
  async setCapital(raw: unknown) {
    if (raw == null || raw === '') {
      await this.prisma.setting.deleteMany({ where: { key: CAPITAL_KEY } });
      return { capital: null };
    }
    const capital = positive('총 투자금', raw);
    await this.prisma.setting.upsert({
      where: { key: CAPITAL_KEY },
      create: { key: CAPITAL_KEY, value: capital },
      update: { value: capital },
    });
    return { capital };
  }

  async my() {
    const [holdings, watch, capital] = await Promise.all([
      this.prisma.holding.findMany({ include: { info: true }, orderBy: { openedAt: 'asc' } }),
      this.prisma.watchItem.findMany({ include: { info: true }, orderBy: { addedAt: 'asc' } }),
      this.capital(),
    ]);
    const closes = await this.lastCloses([...holdings, ...watch].map((x) => x.symbol));
    const weather = await this.prisma.marketSnapshot.findFirst({
      where: { market: 'us', condition: { not: null } },
      orderBy: { tradeDate: 'desc' },
    });
    const scan: ScanContext = {
      hits: watch.length ? await this.latestScan() : new Map(),
      spy: watch.length ? await this.bars(BENCHMARK) : [],
      condition: (weather?.condition ?? null) as Condition | null,
    };

    const price = (symbol: string) => {
      const c = closes.get(symbol);
      return {
        lastClose: c?.close ?? null,
        lastDate: c?.date ?? null,
        changePct: c && c.prevClose ? ((c.close - c.prevClose) / c.prevClose) * 100 : null,
      };
    };
    const names = (info: { nameEn: string; nameKo: string | null; type: string; exchange: string }) => ({
      nameEn: info.nameEn,
      nameKo: info.nameKo,
      type: info.type,
      exchange: info.exchange,
    });

    const rows = holdings.map((h) => {
        const p = price(h.symbol);
        const marketValue = p.lastClose != null ? p.lastClose * h.shares : null;
        return {
          symbol: h.symbol,
          ...names(h.info),
          shares: h.shares,
          avgCost: h.avgCost,
          stopPrice: h.stopPrice,
          stopMethod: h.stopMethod,
          targetPrice: h.targetPrice,
          note: h.note,
          ...p,
          /** 종가가 손절가보다 몇 % 위인지. 0 이하면 손절가 아래로 마감 */
          stopDistancePct: p.lastClose != null && h.stopPrice ? ((p.lastClose - h.stopPrice) / p.lastClose) * 100 : null,
          pnlPct: p.lastClose != null ? ((p.lastClose - h.avgCost) / h.avgCost) * 100 : null,
          pnl: p.lastClose != null ? (p.lastClose - h.avgCost) * h.shares : null,
          marketValue,
          /** 지금 종가에서 손절가까지 떨어지면 잃는 돈. 손절가가 없으면 null (위험을 모른다) */
          openRisk:
            p.lastClose != null && h.stopPrice != null ? Math.max(0, (p.lastClose - h.stopPrice) * h.shares) : null,
          openedAt: day(h.openedAt),
          daysHeld: Math.max(0, Math.floor((Date.now() - h.openedAt.getTime()) / DAY_MS)),
        };
      });

    const marketValue = rows.reduce((sum, r) => sum + (r.marketValue ?? r.avgCost * r.shares), 0);
    return {
      capital,
      summary: {
        marketValue,
        costBasis: rows.reduce((sum, r) => sum + r.avgCost * r.shares, 0),
        openRisk: rows.reduce((sum, r) => sum + (r.openRisk ?? 0), 0),
        noStopCount: rows.filter((r) => r.stopPrice == null).length,
        /** 총 투자금 대비 주식 비중 (%). 총 투자금을 넣지 않았으면 null */
        exposurePct: capital ? (marketValue / capital) * 100 : null,
      },
      holdings: rows,
      watchlist: await Promise.all(
        watch.map(async (w) => ({
          symbol: w.symbol,
          ...names(w.info),
          note: w.note,
          addedAt: w.addedAt.toISOString(),
          ...price(w.symbol),
          readiness: await this.readiness(w.symbol, scan),
        })),
      ),
    };
  }

  /** 가장 최근 trader-scanner 원본 출력의 종목별 셋업·RSI (ai_daily가 저장한 것) */
  private async latestScan(): Promise<Map<string, ScanHit>> {
    const out = await this.prisma.skillOutput.findFirst({
      where: { skillId: 'trader-scanner', status: 'success' },
      orderBy: { createdAt: 'desc' },
      select: { rawJson: true },
    });
    const hits = ((out?.rawJson as { hits?: ScanHit[] } | null)?.hits ?? []).filter((h) => h.symbol);
    return new Map(hits.map((h) => [h.symbol, h]));
  }

  private async bars(symbol: string): Promise<Bar[]> {
    const rows = await this.prisma.priceBar.findMany({ where: { symbol }, orderBy: { date: 'asc' } });
    return rows.map((r) => ({ date: day(r.date), open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
  }

  /**
   * 관심 종목을 AI v2 매수 규칙으로 본다 (계산은 전부 스크립트, 절대 규칙 2).
   * 셋업은 그날 스캔 결과에서 가져오고, 스캔에 없으면 셋업 없음으로 본다.
   */
  private async readiness(symbol: string, scan: ScanContext) {
    const bars = await this.bars(symbol);
    if (bars.length < 30) return null;
    const last = bars.at(-1)!;
    const hit = scan.hits.get(symbol);
    const sameDay = hit?.close_date === last.date;
    const earnings = await this.prisma.calendarEvent.findFirst({
      where: { type: 'earnings', symbol, date: { gte: new Date(`${last.date}T00:00:00Z`) } },
      orderBy: { date: 'asc' },
    });
    const e = evaluateBuyV2({
      setups: sameDay ? hit.setups : [],
      rsi: sameDay ? (hit.rsi ?? null) : null,
      bars,
      benchmark: scan.spy,
      condition: scan.condition,
      daysToEarnings: earnings ? Math.round((earnings.date.getTime() - new Date(`${last.date}T00:00:00Z`).getTime()) / DAY_MS) : null,
    });
    // 스캔에 없던 종목은 "셋업 없음"으로 보여준다
    const checks = e.checks.map((c) => (c.key === 'setup' && !c.detail ? { ...c, detail: '오늘 찾은 셋업 없음' } : c));
    return { date: last.date, verdict: e.verdict, checks, reasonKo: e.reasonKo, stopPrice: e.stopPrice };
  }

  private async requireSymbol(symbol: string) {
    const found = await this.prisma.symbol.findUnique({ where: { symbol } });
    if (!found) throw new NotFoundException(`종목을 찾을 수 없어요: ${symbol}`);
    return found;
  }

  /** 새로 추적하는 종목은 일봉을 바로 받는다. 응답은 기다리지 않는다 */
  private fetchBarsInBackground(symbol: string) {
    void this.prices.refresh([symbol]).catch((err) => this.logger.warn(String(err)));
  }

  async addWatch(symbol: string, note?: string | null) {
    await this.requireSymbol(symbol);
    const holding = await this.prisma.holding.findUnique({ where: { symbol } });
    if (holding) throw new BadRequestException('이미 보유 종목이에요');
    await this.prisma.watchItem.upsert({
      where: { symbol },
      create: { symbol, note: note ?? null },
      update: { note: note ?? undefined },
    });
    this.fetchBarsInBackground(symbol);
    return { symbol };
  }

  async removeWatch(symbol: string) {
    await this.prisma.watchItem.deleteMany({ where: { symbol } });
    return { symbol };
  }

  /** 보유 정보 저장. 수량 0이면 보유에서 빼고 관심 종목으로 돌린다 (docs/frontend.md 편집 시트) */
  async saveHolding(symbol: string, input: HoldingInput) {
    await this.requireSymbol(symbol);
    const shares = positive('수량', input.shares, true);
    if (shares === 0) {
      await this.prisma.$transaction([
        this.prisma.holding.deleteMany({ where: { symbol } }),
        this.prisma.watchItem.upsert({ where: { symbol }, create: { symbol }, update: {} }),
      ]);
      return { symbol, movedTo: 'watch' as const };
    }
    const stopPrice = optionalPositive('손절가', input.stopPrice);
    const openedAt = input.openedAt ? new Date(`${input.openedAt}T00:00:00Z`) : undefined;
    if (openedAt && Number.isNaN(openedAt.getTime())) throw new BadRequestException('산 날짜 형식이 맞지 않아요');
    const data = {
      ...(openedAt ? { openedAt } : {}),
      shares,
      avgCost: positive('평단가', input.avgCost),
      stopPrice,
      stopMethod: stopPrice == null ? null : (input.stopMethod ?? 'manual'),
      targetPrice: optionalPositive('목표가', input.targetPrice),
      note: input.note?.trim() || null,
    };
    const isNew = !(await this.prisma.holding.findUnique({ where: { symbol } }));
    await this.prisma.$transaction([
      this.prisma.holding.upsert({ where: { symbol }, create: { symbol, ...data }, update: data }),
      this.prisma.watchItem.deleteMany({ where: { symbol } }),
    ]);
    if (isNew) this.fetchBarsInBackground(symbol);
    return { symbol, movedTo: 'holding' as const };
  }

  async removeHolding(symbol: string) {
    await this.prisma.holding.deleteMany({ where: { symbol } });
    return { symbol };
  }

  async stopOptions(symbol: string, avgCostRaw: unknown, sharesRaw: unknown) {
    await this.requireSymbol(symbol);
    const avgCost = positive('평단가', avgCostRaw);
    const shares = sharesRaw == null || sharesRaw === '' ? null : positive('수량', sharesRaw, true) || null;

    let bars = await this.prisma.priceBar.findMany({
      where: { symbol },
      orderBy: { date: 'desc' },
      take: BAR_DAYS,
    });
    // 아직 일봉이 없으면 (처음 추가하는 종목) 지금 받아 온다
    if (bars.length < 20) {
      await this.prices.refresh([symbol]);
      bars = await this.prisma.priceBar.findMany({ where: { symbol }, orderBy: { date: 'desc' }, take: BAR_DAYS });
    }
    bars.reverse();
    const last = bars.at(-1);
    return {
      symbol,
      avgCost,
      shares,
      lastClose: last?.close ?? null,
      lastDate: last ? day(last.date) : null,
      options: stopOptions(bars, avgCost, shares),
    };
  }

  // ── 매매 기록 ("샀음/팔았음"). 기록하면 보유 종목이 따라 바뀐다 ──

  async trades() {
    const rows = await this.prisma.trade.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 200 });
    const names = await this.prisma.symbol.findMany({
      where: { symbol: { in: [...new Set(rows.map((r) => r.symbol))] } },
      select: { symbol: true, nameEn: true, nameKo: true },
    });
    const byName = new Map(names.map((n) => [n.symbol, n]));
    return rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      nameEn: byName.get(r.symbol)?.nameEn ?? r.symbol,
      nameKo: byName.get(r.symbol)?.nameKo ?? null,
      side: r.side,
      date: day(r.date),
      price: r.price,
      shares: r.shares,
      realizedPnl: r.realizedPnl,
      note: r.note,
    }));
  }

  /**
   * 샀음: 보유 수량을 늘리고 평단가를 다시 계산한다 (관심에 있으면 보유로 옮긴다).
   * 팔았음: 보유 수량을 줄이고 그 시점 평단가 기준 실현 손익을 남긴다. 다 팔면 관심으로 돌린다.
   */
  async addTrade(input: { symbol: string; side: string; date: string; price: unknown; shares: unknown; note?: string | null }) {
    const symbol = input.symbol;
    await this.requireSymbol(symbol);
    if (input.side !== 'buy' && input.side !== 'sell') throw new BadRequestException('샀음 또는 팔았음을 골라 주세요');
    const price = positive('가격', input.price);
    const shares = positive('수량', input.shares);
    const date = new Date(`${input.date}T00:00:00Z`);
    if (!input.date || Number.isNaN(date.getTime())) throw new BadRequestException('날짜 형식이 맞지 않아요');
    const note = input.note?.trim() || null;
    const holding = await this.prisma.holding.findUnique({ where: { symbol } });

    if (input.side === 'buy') {
      const newShares = (holding?.shares ?? 0) + shares;
      const avgCost = holding ? (holding.shares * holding.avgCost + shares * price) / newShares : price;
      await this.prisma.$transaction([
        this.prisma.trade.create({ data: { symbol, side: 'buy', date, price, shares, note } }),
        this.prisma.holding.upsert({
          where: { symbol },
          create: { symbol, shares: newShares, avgCost, openedAt: date },
          update: { shares: newShares, avgCost },
        }),
        this.prisma.watchItem.deleteMany({ where: { symbol } }),
      ]);
      if (!holding) this.fetchBarsInBackground(symbol);
      return { symbol, shares: newShares, avgCost };
    }

    if (!holding) throw new BadRequestException('보유하지 않은 종목은 팔았음을 기록할 수 없어요');
    if (shares > holding.shares + 1e-9) throw new BadRequestException(`보유 수량(${holding.shares}주)보다 많이 팔 수 없어요`);
    const realizedPnl = (price - holding.avgCost) * shares;
    const left = holding.shares - shares;
    await this.prisma.$transaction([
      this.prisma.trade.create({ data: { symbol, side: 'sell', date, price, shares, realizedPnl, note } }),
      ...(left <= 1e-9
        ? [
            this.prisma.holding.delete({ where: { symbol } }),
            this.prisma.watchItem.upsert({ where: { symbol }, create: { symbol }, update: {} }),
          ]
        : [this.prisma.holding.update({ where: { symbol }, data: { shares: left } })]),
    ]);
    return { symbol, shares: left, realizedPnl };
  }

  /** 기록만 지운다. 보유 수량은 되돌리지 않으니 필요하면 편집 시트에서 고친다 */
  async deleteTrade(id: string) {
    await this.prisma.trade.deleteMany({ where: { id } });
    return { id };
  }

  // ── 종목 소식 (Phase 3): 뉴스·공시, 분기 실적, 의원 거래 신고 ──

  async intel(symbol: string) {
    await this.requireSymbol(symbol);
    const since = (days: number) => new Date(Date.now() - days * DAY_MS);
    const [news, facts, trades] = await Promise.all([
      this.prisma.newsItem.findMany({ where: { symbol, publishedAt: { gte: since(30) } }, orderBy: { publishedAt: 'desc' }, take: 30 }),
      this.prisma.earningsFact.findMany({ where: { symbol }, orderBy: { periodEnd: 'desc' }, take: 6 }),
      this.prisma.congressTrade.findMany({
        where: { ticker: symbol, doc: { filed: { gte: since(120) } } },
        include: { doc: { select: { member: true, filed: true } } },
        orderBy: { doc: { filed: 'desc' } },
        take: 30,
      }),
    ]);
    return {
      symbol,
      news: news.map((n) => ({
        id: n.id,
        kind: n.kind,
        source: n.source,
        title: n.title,
        titleKo: n.titleKo,
        importance: n.importance,
        url: n.url,
        publishedAt: n.publishedAt.toISOString(),
      })),
      earnings: facts.map((f) => ({
        fiscal: f.fiscal,
        periodEnd: day(f.periodEnd),
        derived: f.derived,
        revenue: f.revenue,
        revenueYoy: f.revenueYoy,
        operatingMargin: f.operatingMargin,
        netMargin: f.netMargin,
        epsDiluted: f.epsDiluted,
        epsYoy: f.epsYoy,
      })),
      congress: trades.map((t) => ({
        member: t.doc.member.replace(/^Hon\.\s*/, ''),
        type: t.type,
        typeName: t.typeName,
        amount: t.amount,
        tradeDate: t.tradeDate ? day(t.tradeDate) : null,
        filed: day(t.doc.filed),
        owner: t.owner,
      })),
    };
  }
}
