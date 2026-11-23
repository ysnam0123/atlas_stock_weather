import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { repoRoot } from '../common/paths.js';
import { PricesService } from '../jobs/prices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkillRunnerService } from '../skills/skill-runner.service.js';
import {
  type Bar,
  type Condition,
  EXIT_LABEL,
  evaluateBuy,
  evaluateHolding,
  RULES,
  SETUP_LABEL,
  sizePosition,
  sma,
  stepPosition,
} from './strategy.js';

export const AI_DAILY = 'ai_daily';

/** 스캐너 결과 중 일봉을 받아 판단할 종목 수 (거래대금 큰 순) */
const MAX_CANDIDATES = 30;
/** 벤치마크 */
export const BENCHMARK = 'SPY';
const PLAIN_TICKER = /^[A-Z]{1,5}(\.[A-Z])?$/;
/** 변동성 상품(ETN)은 주식이 아니라 추세 추종 대상에서 뺀다 */
const NOT_STOCK = /\b(ETN|iPath|Exchange Traded Notes?|VIX)\b/i;
const TREND_SETUPS = new Set(['breakout_20d', 'bull_flag']);

const day = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

interface ScanHit {
  symbol: string;
  setups: string[];
  price: number;
  close_date: string;
  rsi?: number | null;
  volume?: number;
}

/**
 * AI 모의 계좌 하루 처리 (docs/ai-duel.md). 순서:
 * 1) 어제 낸 매수 신호를 오늘 시가에 체결  2) 보유 포지션 손절·목표·종가 규칙  3) 계좌 가치 기록
 * 4) 스캐너로 새 셋업 찾기 → 규칙으로 판단·계획  5) 내 보유 종목을 같은 규칙으로 본 매도 신호  6) 내 계좌 가치 기록
 * 실패한 단계는 건너뛰고 나머지를 계속한다 (절대 규칙 4).
 */
@Injectable()
export class AiDailyJob {
  private readonly logger = new Logger(AiDailyJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PricesService,
    private readonly skills: SkillRunnerService,
  ) {}

  private async bars(symbol: string): Promise<Bar[]> {
    const rows = await this.prisma.priceBar.findMany({ where: { symbol }, orderBy: { date: 'asc' } });
    return rows.map((r) => ({ date: day(r.date), open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
  }

  async run() {
    if (this.running) return { status: 'skipped', reason: '이미 실행 중' };
    this.running = true;
    const run = await this.prisma.run.create({ data: { kind: AI_DAILY, market: 'us' } });
    const notes: string[] = [];
    try {
      const account = await this.prisma.aiAccount.findFirst({ where: { active: true } });
      const weather = await this.prisma.marketSnapshot.findFirst({
        where: { market: 'us', condition: { not: null } },
        orderBy: { tradeDate: 'desc' },
      });
      const condition = (weather?.condition ?? null) as Condition | null;

      if (account) {
        // 1~3) 체결·청산·계좌 가치
        const open = await this.prisma.aiPosition.findMany({ where: { accountId: account.id, status: 'open' } });
        const planned = await this.prisma.aiSignal.findMany({ where: { accountId: account.id, status: 'planned' } });
        await this.prices.refresh([...new Set([...open, ...planned].map((x) => x.symbol).concat(BENCHMARK))]);
        await this.fill(account.id);
        await this.manage(account.id);
        await this.snapshot(account.id);
      } else {
        notes.push('AI 계좌가 없어 체결·신호를 건너뜀');
      }

      // 4) 새 셋업
      if (account) {
        try {
          const found = await this.scan(run.id, account.id, condition, weather?.exposureCeiling ?? null);
          notes.push(`셋업 ${found}개 판단`);
        } catch (err) {
          notes.push(`스캔 실패: ${String(err)}`);
          this.logger.warn(`스캔 실패: ${String(err)}`);
        }
      }

      // 5) 내 종목 매도 신호, 6) 내 계좌 가치
      if (account) await this.myHoldingSignals(account.id);
      await this.mySnapshot();

      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: notes.some((n) => n.includes('실패')) ? 'partial' : 'success', finishedAt: new Date(), error: notes.join(' / ') || null },
      });
      return { runId: run.id, notes };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date(), error: message } });
      this.logger.error(`실패 ${run.id}: ${message}`);
      return { runId: run.id, status: 'failed', error: message };
    } finally {
      this.running = false;
    }
  }

  /** 계획된 매수 신호를 신호 다음 거래일 시가에 체결한다 */
  private async fill(accountId: string) {
    const planned = await this.prisma.aiSignal.findMany({
      where: { accountId, status: 'planned' },
      orderBy: { date: 'asc' },
    });
    for (const s of planned) {
      const bars = await this.bars(s.symbol);
      const next = bars.find((b) => b.date > day(s.date));
      if (!next) continue; // 아직 다음 날 봉이 없다
      const account = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: accountId } });
      const shares = Math.min(s.shares ?? 0, Math.floor(account.cash / next.open));
      if (shares <= 0 || s.stopPrice == null || s.targetPrice == null || next.open <= s.stopPrice) {
        await this.prisma.aiSignal.update({
          where: { id: s.id },
          data: {
            status: 'skipped',
            note: next.open <= (s.stopPrice ?? 0) ? `시가 $${next.open.toFixed(2)}가 이미 손절가 아래라 사지 않음` : '현금이 모자라 사지 않음',
          },
        });
        continue;
      }
      const position = await this.prisma.aiPosition.create({
        data: {
          accountId,
          signalId: s.id,
          symbol: s.symbol,
          shares,
          entryDate: toDate(next.date),
          entryPrice: next.open,
          stopPrice: s.stopPrice,
          targetPrice: s.targetPrice,
          status: 'open',
        },
      });
      await this.prisma.$transaction([
        this.prisma.aiAccount.update({ where: { id: accountId }, data: { cash: { decrement: shares * next.open } } }),
        this.prisma.aiSignal.update({
          where: { id: s.id },
          data: { status: 'filled', positionId: position.id, note: `${next.date} 시가 $${next.open.toFixed(2)}에 ${shares}주 체결` },
        }),
      ]);
    }
  }

  /** 보유 포지션에 체결일부터 새 봉을 하나씩 적용한다 */
  private async manage(accountId: string) {
    const positions = await this.prisma.aiPosition.findMany({ where: { accountId, status: 'open' } });
    for (const p of positions) {
      const bars = await this.bars(p.symbol);
      const entry = day(p.entryDate);
      const startIdx = bars.findIndex((b) => b.date >= entry);
      if (startIdx < 0) continue;
      let pending = p.pendingExit;
      for (let i = startIdx; i < bars.length; i++) {
        const bar = bars[i];
        // 체결일의 시가 이전 규칙(대기 청산)은 체결일에 적용하지 않는다
        const ma50 = sma(bars.slice(0, i + 1).map((b) => b.close), 50);
        const step = stepPosition(
          { entryPrice: p.entryPrice, stopPrice: p.stopPrice, targetPrice: p.targetPrice, pendingExit: i === startIdx ? null : pending },
          bar,
          ma50,
          i - startIdx,
        );
        if (step.kind === 'exit') {
          const pnl = (step.price - p.entryPrice) * p.shares;
          await this.prisma.$transaction([
            this.prisma.aiPosition.update({
              where: { id: p.id },
              data: { status: 'closed', exitDate: toDate(bar.date), exitPrice: step.price, exitReason: step.reason, pnl, pendingExit: null },
            }),
            this.prisma.aiAccount.update({ where: { id: accountId }, data: { cash: { increment: step.price * p.shares } } }),
          ]);
          pending = null;
          break;
        }
        pending = step.kind === 'pending' ? step.reason : null;
      }
      if (pending !== p.pendingExit) {
        await this.prisma.aiPosition.updateMany({ where: { id: p.id, status: 'open' }, data: { pendingExit: pending } });
      }
    }
  }

  /** 마지막 종가 기준 AI 계좌 가치 */
  private async snapshot(accountId: string) {
    const account = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: accountId } });
    const positions = await this.prisma.aiPosition.findMany({ where: { accountId, status: 'open' } });
    const spy = await this.bars(BENCHMARK);
    const date = spy.at(-1)?.date;
    if (!date) return;
    let positionsValue = 0;
    for (const p of positions) {
      const last = (await this.bars(p.symbol)).at(-1);
      positionsValue += (last?.close ?? p.entryPrice) * p.shares;
    }
    const equity = account.cash + positionsValue;
    await this.prisma.aiEquity.upsert({
      where: { accountId_date: { accountId, date: toDate(date) } },
      create: { accountId, date: toDate(date), cash: account.cash, positionsValue, equity },
      update: { cash: account.cash, positionsValue, equity },
    });
    await this.prisma.aiAccount.update({ where: { id: accountId }, data: { lastProcessedDate: toDate(date) } });
  }

  /** trader-scanner로 셋업을 찾고, 거래대금 큰 순으로 판단한다 */
  private async scan(runId: string, accountId: string, condition: Condition | null, ceiling: number | null) {
    const symbols = await this.prisma.symbol.findMany({ where: { type: 'stock' }, select: { symbol: true, nameEn: true } });
    const dir = join(repoRoot(), 'reports', runId, 'trader-scanner');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'universe.txt'),
      symbols
        .filter((s) => PLAIN_TICKER.test(s.symbol) && !NOT_STOCK.test(s.nameEn))
        .map((s) => `${s.symbol}|${s.nameEn}`)
        .join('\n') + '\n',
    );
    const result = await this.skills.run(runId, 'trader-scanner');
    if (result.status !== 'success') throw new Error(result.error ?? '스캐너 실패');
    const hits = ((result.json as { hits?: ScanHit[] })?.hits ?? []).filter((h) => h.setups?.length);

    // 추세 추종 셋업(매수 후보)을 먼저, 남는 자리는 거래대금 큰 순으로 채운다.
    // 거래대금만 보면 폭락장에는 대형주 과매도만 남고 돌파 셋업이 잘린다
    const dollarVolume = (h: ScanHit) => h.price * (h.volume ?? 0);
    const isTrend = (h: ScanHit) => h.setups.some((x) => TREND_SETUPS.has(x));
    const ranked = hits
      .sort((a, b) => Number(isTrend(b)) - Number(isTrend(a)) || dollarVolume(b) - dollarVolume(a))
      .slice(0, MAX_CANDIDATES);
    await this.prices.refresh(ranked.map((h) => h.symbol));

    const account = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: accountId } });
    const latestEquity = await this.prisma.aiEquity.findFirst({ where: { accountId }, orderBy: { date: 'desc' } });
    const equity = latestEquity?.equity ?? account.cash;
    let invested = latestEquity?.positionsValue ?? 0;
    let cash = account.cash;
    let newBuys = 0;

    for (const h of ranked) {
      const bars = await this.bars(h.symbol);
      if (bars.length < 30 || bars.at(-1)!.date !== h.close_date) continue;
      const e = evaluateBuy({ setups: h.setups, rsi: h.rsi ?? null, bars, condition });

      let status: string = e.verdict === 'buy' ? 'planned' : e.verdict === 'hold' ? 'held' : 'watch';
      let shares: number | null = null;
      let note: string | null = null;
      if (e.verdict === 'buy' && e.stopPrice != null) {
        // 권장 비중 상한 안에서만 산다
        const room = ceiling != null ? Math.max(0, (equity * ceiling) / 100 - invested) : equity;
        shares = Math.min(sizePosition({ equity, cash, entry: e.closePrice, stop: e.stopPrice }), Math.floor(room / e.closePrice));
        if (newBuys >= RULES.maxNewPerDay) {
          status = 'skipped';
          note = `하루 ${RULES.maxNewPerDay}종목까지만 삽니다`;
        } else if (shares <= 0) {
          status = 'skipped';
          note = '권장 비중 상한 또는 현금 때문에 살 수량이 없음';
        } else {
          newBuys++;
          cash -= shares * e.closePrice;
          invested += shares * e.closePrice;
        }
      }

      await this.prisma.aiSignal.upsert({
        where: { accountId_date_symbol_side: { accountId, date: toDate(h.close_date), symbol: h.symbol, side: 'buy' } },
        create: {
          accountId,
          date: toDate(h.close_date),
          symbol: h.symbol,
          side: 'buy',
          setups: h.setups,
          verdict: e.verdict,
          status,
          checks: e.checks as unknown as Prisma.InputJsonValue,
          closePrice: e.closePrice,
          stopPrice: e.stopPrice,
          targetPrice: e.targetPrice,
          shares,
          riskAmount: shares && e.stopPrice != null ? shares * (e.closePrice - e.stopPrice) : null,
          reasonKo: e.reasonKo,
          exitPlanKo: e.exitPlanKo,
          note,
        },
        update: {},
      });
    }
    return ranked.length;
  }

  /** 내 보유 종목을 AI 규칙으로 본다. 팔 자리면 매도 신호를 남긴다 (선택은 사용자) */
  private async myHoldingSignals(accountId: string) {
    const holdings = await this.prisma.holding.findMany();
    for (const h of holdings) {
      const bars = await this.bars(h.symbol);
      const last = bars.at(-1);
      if (!last) continue;
      const sell = evaluateHolding({ bars, stopPrice: h.stopPrice });
      if (!sell) continue;
      await this.prisma.aiSignal.upsert({
        where: { accountId_date_symbol_side: { accountId, date: toDate(last.date), symbol: h.symbol, side: 'sell' } },
        create: {
          accountId,
          date: toDate(last.date),
          symbol: h.symbol,
          side: 'sell',
          setups: [sell.reason],
          verdict: 'sell',
          status: 'done',
          checks: [{ key: sell.reason, label: EXIT_LABEL[sell.reason], pass: false, detail: sell.detail }] as Prisma.InputJsonValue,
          closePrice: last.close,
          reasonKo: `내 보유 종목이에요. ${sell.detail}. AI 규칙이라면 다음 거래일 시가에 정리합니다.`,
          note: '내 보유 종목',
        },
        update: {},
      });
    }
  }

  /** 내 계좌 가치 = 총 투자금 + 실현 손익 + (보유 평가금 − 원금). 총 투자금이 없으면 기록하지 않는다 */
  private async mySnapshot() {
    const capital = await this.prisma.setting.findUnique({ where: { key: 'capital' } });
    if (typeof capital?.value !== 'number') return;
    const spy = await this.bars(BENCHMARK);
    const date = spy.at(-1)?.date;
    if (!date) return;
    const [holdings, realized] = await Promise.all([
      this.prisma.holding.findMany(),
      this.prisma.trade.aggregate({ _sum: { realizedPnl: true } }),
    ]);
    let marketValue = 0;
    let cost = 0;
    for (const h of holdings) {
      const last = (await this.bars(h.symbol)).at(-1);
      marketValue += (last?.close ?? h.avgCost) * h.shares;
      cost += h.avgCost * h.shares;
    }
    const realizedPnl = realized._sum.realizedPnl ?? 0;
    const equity = capital.value + realizedPnl + (marketValue - cost);
    await this.prisma.myEquity.upsert({
      where: { date: toDate(date) },
      create: { date: toDate(date), equity, marketValue, realizedPnl },
      update: { equity, marketValue, realizedPnl },
    });
  }
}

export { SETUP_LABEL };
