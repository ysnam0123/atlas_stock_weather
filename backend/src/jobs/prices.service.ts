import { Injectable, Logger } from '@nestjs/common';
import { yahooTicker } from '../adapters/symbols.adapter.js';
import { adaptYahooChart, yahooChartUrl } from '../adapters/yahoo-chart.adapter.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const PRICES_DAILY = 'prices_daily';

/** 야후에 한꺼번에 몰아 요청하지 않도록 종목 사이에 둔다 */
const GAP_MS = 400;

/**
 * 보유·관심 종목의 1년치 일봉을 야후에서 받아 price_bars에 넣는다.
 * 실패한 종목은 건너뛰고 나머지를 계속한다 (절대 규칙 4).
 */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 보유·관심 종목 전부. 워커가 매일 시장 날씨와 같은 시각에 부른다 */
  async runDaily() {
    const run = await this.prisma.run.create({ data: { kind: PRICES_DAILY, market: 'us' } });
    const [holdings, watch] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
    ]);
    const symbols = [...new Set([...holdings, ...watch].map((s) => s.symbol))];
    const result = await this.refresh(symbols);
    const status = result.failed.length === 0 ? 'success' : result.ok.length ? 'partial' : 'failed';
    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: symbols.length === 0 ? 'success' : status,
        finishedAt: new Date(),
        error: result.failed.length ? `실패: ${result.failed.join(', ')}` : null,
      },
    });
    return { runId: run.id, ...result };
  }

  async refresh(symbols: string[]) {
    const ok: string[] = [];
    const failed: string[] = [];
    for (const [i, symbol] of symbols.entries()) {
      if (i) await new Promise((r) => setTimeout(r, GAP_MS));
      try {
        const res = await fetch(yahooChartUrl(yahooTicker(symbol)), {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bars = adaptYahooChart(await res.json());
        if (!bars.length) throw new Error('일봉 없음');

        const day = (d: string) => new Date(`${d}T00:00:00Z`);
        // 받은 기간은 통째로 바꾼다 (배당·분할로 과거 값이 조정될 수 있다)
        await this.prisma.$transaction([
          this.prisma.priceBar.deleteMany({ where: { symbol, date: { gte: day(bars[0].date) } } }),
          this.prisma.priceBar.createMany({ data: bars.map((b) => ({ symbol, ...b, date: day(b.date) })) }),
        ]);
        ok.push(symbol);
      } catch (err) {
        failed.push(symbol);
        this.logger.warn(`${symbol} 일봉 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { ok, failed };
  }
}
