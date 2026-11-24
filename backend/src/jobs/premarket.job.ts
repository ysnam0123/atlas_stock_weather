import { Injectable, Logger } from '@nestjs/common';
import { yahooTicker } from '../adapters/symbols.adapter.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const PREMARKET_SNAPSHOT = 'premarket_snapshot';

/** 시장 분위기용. 내 종목과 함께 받는다 */
export const PREMARKET_INDEXES = ['SPY', 'QQQ'];
const GAP_MS = 400;

interface YahooChart {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; currentTradingPeriod?: { pre?: { start: number; end: number } } };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
}

/** 야후 차트(장 전·후 포함, 5분봉)에서 프리마켓 마지막 체결가. 장 전 체결이 없으면 null */
export function adaptPremarket(json: unknown): { price: number; priceAt: Date; prevClose: number } | null {
  const r = (json as YahooChart)?.chart?.result?.[0];
  const pre = r?.meta?.currentTradingPeriod?.pre;
  const prevClose = r?.meta?.regularMarketPrice;
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  if (!pre || typeof prevClose !== 'number') return null;
  for (let i = ts.length - 1; i >= 0; i--) {
    const c = closes[i];
    if (ts[i] >= pre.start && ts[i] < pre.end && typeof c === 'number') {
      return { price: c, priceAt: new Date(ts[i] * 1000), prevClose };
    }
  }
  return null;
}

/**
 * 저녁 프리마켓 스냅샷 (Phase 7). 한국 저녁 = 미국 장 시작 전. 하루 한 번만 찍고 기준 시각을 같이 보여준다.
 * 실시간이 아니다 (절대 규칙 6). 판단은 여전히 정규장 종가로 하고, 이건 "오늘 밤 분위기"를 보는 용도다.
 */
@Injectable()
export class PremarketJob {
  private readonly logger = new Logger(PremarketJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async run() {
    const run = await this.prisma.run.create({ data: { kind: PREMARKET_SNAPSHOT, market: 'us' } });
    const [holdings, watch] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
    ]);
    const symbols = [...new Set([...PREMARKET_INDEXES, ...holdings.map((h) => h.symbol), ...watch.map((w) => w.symbol)])];
    // 한국 저녁의 날짜 = 오늘 밤 열릴 뉴욕 장 날짜
    const sessionDate = new Date(new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10) + 'T00:00:00Z');
    const takenAt = new Date();
    const ok: string[] = [];
    const none: string[] = [];
    for (const [i, symbol] of symbols.entries()) {
      if (i) await new Promise((r) => setTimeout(r, GAP_MS));
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(symbol))}?range=1d&interval=5m&includePrePost=true`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snap = adaptPremarket(await res.json());
        if (!snap) {
          none.push(symbol);
          continue;
        }
        await this.prisma.premarketSnapshot.upsert({
          where: { symbol_sessionDate: { symbol, sessionDate } },
          create: { symbol, sessionDate, takenAt, ...snap },
          update: { takenAt, ...snap },
        });
        ok.push(symbol);
      } catch (err) {
        none.push(symbol);
        this.logger.warn(`${symbol} 프리마켓 실패: ${String(err).slice(0, 120)}`);
      }
    }
    const note = `프리마켓 ${ok.length}종목${none.length ? `, 체결 없음·실패 ${none.join(', ')}` : ''}`;
    await this.prisma.run.update({
      where: { id: run.id },
      data: { status: ok.length ? 'success' : 'failed', finishedAt: new Date(), error: note },
    });
    return { runId: run.id, note };
  }
}
