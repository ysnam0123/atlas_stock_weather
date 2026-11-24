import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { AiAccount, Prisma } from '../generated/prisma/client.js';
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
  sizePosition,
  sma,
  stepPosition,
} from './strategy.js';
import { ema, evaluateBuyV2, riskPctV2, RULES_V2, sizePositionV2, stepPositionV2 } from './strategy-v2.js';

export const AI_DAILY = 'ai_daily';

/** 스캐너 결과 중 일봉을 받아 판단할 종목 수 */
const MAX_CANDIDATES = 30;
/** 벤치마크 */
export const BENCHMARK = 'SPY';
const PLAIN_TICKER = /^[A-Z]{1,5}(\.[A-Z])?$/;
/** 변동성 상품(ETN)은 주식이 아니라 추세 추종 대상에서 뺀다 */
const NOT_STOCK = /\b(ETN|iPath|Exchange Traded Notes?|VIX)\b/i;
const TREND_SETUPS = new Set(['breakout_20d', 'bull_flag']);
const DAY_MS = 86_400_000;

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
 * AI 모의 계좌 하루 처리 (docs/ai-duel.md). 규칙 버전(v1, v2)마다 계좌가 따로 있고 같은 스캔 결과를 쓴다.
 * 계좌마다: 1) 어제 낸 매수 신호를 오늘 시가에 체결  2) 새 봉으로 손절·청산  3) 계좌 가치
 * 공통: 4) 스캐너로 셋업 찾기 → 계좌마다 자기 규칙으로 판단·계획  5) 내 보유 종목 매도 신호  6) 내 계좌 가치
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
      const accounts = await this.prisma.aiAccount.findMany({ where: { active: true }, orderBy: { ruleVersion: 'asc' } });
      const weather = await this.prisma.marketSnapshot.findFirst({
        where: { market: 'us', condition: { not: null } },
        orderBy: { tradeDate: 'desc' },
      });
      const condition = (weather?.condition ?? null) as Condition | null;

      if (!accounts.length) notes.push('AI 계좌가 없어 체결·신호를 건너뜀');

      // 1~3) 계좌마다 체결·청산·계좌 가치
      const symbols = new Set<string>([BENCHMARK]);
      for (const a of accounts) {
        const [open, planned] = await Promise.all([
          this.prisma.aiPosition.findMany({ where: { accountId: a.id, status: 'open' }, select: { symbol: true } }),
          this.prisma.aiSignal.findMany({ where: { accountId: a.id, status: 'planned' }, select: { symbol: true } }),
        ]);
        for (const x of [...open, ...planned]) symbols.add(x.symbol);
      }
      await this.prices.refresh([...symbols]);
      for (const a of accounts) {
        await this.fill(a);
        await this.manage(a);
        await this.snapshot(a.id);
      }

      // 4) 새 셋업 (스캔은 한 번, 판단은 계좌마다)
      if (accounts.length) {
        try {
          const found = await this.scan(run.id, accounts, condition, weather?.exposureCeiling ?? null);
          notes.push(`셋업 ${found}개 판단 (${accounts.map((a) => a.ruleVersion).join(', ')})`);
        } catch (err) {
          notes.push(`스캔 실패: ${String(err)}`);
          this.logger.warn(`스캔 실패: ${String(err)}`);
        }
      }

      // 5) 내 종목 매도 신호, 6) 내 계좌 가치
      for (const a of accounts) await this.myHoldingSignals(a);
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

  /** 계획된 매수 신호를 신호 다음 거래일 시가에 체결한다. v2는 3% 넘는 갭 상승을 추격하지 않는다 */
  private async fill(account: AiAccount) {
    const planned = await this.prisma.aiSignal.findMany({
      where: { accountId: account.id, status: 'planned' },
      orderBy: { date: 'asc' },
    });
    for (const s of planned) {
      const bars = await this.bars(s.symbol);
      const next = bars.find((b) => b.date > day(s.date));
      if (!next) continue; // 아직 다음 날 봉이 없다
      const { cash } = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: account.id } });
      const shares = Math.min(s.shares ?? 0, Math.floor(cash / next.open));

      let skip: string | null = null;
      if (s.stopPrice == null || next.open <= s.stopPrice) skip = `시가 $${next.open.toFixed(2)}가 이미 손절가 아래라 사지 않음`;
      else if (account.ruleVersion === 'v2' && next.open > s.closePrice * (1 + RULES_V2.maxGapPct)) {
        skip = `시가 $${next.open.toFixed(2)}가 신호 종가보다 ${((next.open / s.closePrice - 1) * 100).toFixed(1)}% 높아 추격하지 않음`;
      } else if (account.ruleVersion === 'v1' && s.targetPrice == null) skip = '목표가가 없어 사지 않음';
      else if (shares <= 0) skip = '현금이 모자라 사지 않음';
      if (skip) {
        await this.prisma.aiSignal.update({ where: { id: s.id }, data: { status: 'skipped', note: skip } });
        continue;
      }

      const position = await this.prisma.aiPosition.create({
        data: {
          accountId: account.id,
          signalId: s.id,
          symbol: s.symbol,
          shares,
          entryDate: toDate(next.date),
          entryPrice: next.open,
          stopPrice: s.stopPrice!,
          targetPrice: s.targetPrice,
          status: 'open',
        },
      });
      await this.prisma.$transaction([
        this.prisma.aiAccount.update({ where: { id: account.id }, data: { cash: { decrement: shares * next.open } } }),
        this.prisma.aiSignal.update({
          where: { id: s.id },
          data: { status: 'filled', positionId: position.id, note: `${next.date} 시가 $${next.open.toFixed(2)}에 ${shares}주 체결` },
        }),
      ]);
    }
  }

  /**
   * 보유 포지션에 아직 처리하지 않은 봉(마지막 처리일 다음부터)을 하나씩 적용한다.
   * 새로 체결된 포지션은 체결일 봉부터. 같은 봉을 두 번 적용하지 않아 v2의 본전 보호 상태가 유지된다.
   */
  private async manage(account: AiAccount) {
    const positions = await this.prisma.aiPosition.findMany({ where: { accountId: account.id, status: 'open' } });
    const processed = account.lastProcessedDate ? day(account.lastProcessedDate) : '';
    for (const p of positions) {
      const bars = await this.bars(p.symbol);
      const entryIdx = bars.findIndex((b) => b.date >= day(p.entryDate));
      if (entryIdx < 0) continue;
      let stop = p.stopPrice;
      let breakeven = p.breakeven;
      let pending = p.pendingExit;

      for (let i = entryIdx; i < bars.length; i++) {
        const bar = bars[i];
        // 이미 처리한 봉은 건너뛴다. 새로 체결된 포지션의 체결일은 늘 마지막 처리일 뒤라 여기서 걸리지 않는다
        if (bar.date <= processed) continue;
        const closes = bars.slice(0, i + 1).map((b) => b.close);
        const barsHeld = i - entryIdx;
        // 체결일에는 전날 정한 대기 청산이 있을 수 없다
        const pend = i === entryIdx ? null : pending;

        const step =
          account.ruleVersion === 'v2'
            ? stepPositionV2(
                // 본전 보호 전에는 손절가가 처음 정한 값 그대로라 1R 계산에 그대로 쓴다 (보호 뒤에는 1R을 보지 않는다)
                { entryPrice: p.entryPrice, stopPrice: stop, initialStop: stop, breakeven, pendingExit: pend },
                bar,
                { ma50: sma(closes, 50), ema21: ema(closes, RULES_V2.emaPeriod) },
                barsHeld,
              )
            : stepPosition(
                { entryPrice: p.entryPrice, stopPrice: stop, targetPrice: p.targetPrice ?? Number.POSITIVE_INFINITY, pendingExit: pend },
                bar,
                sma(closes, 50),
                barsHeld,
              );

        if (step.kind === 'exit') {
          const pnl = (step.price - p.entryPrice) * p.shares;
          await this.prisma.$transaction([
            this.prisma.aiPosition.update({
              where: { id: p.id },
              data: { status: 'closed', exitDate: toDate(bar.date), exitPrice: step.price, exitReason: step.reason, pnl, pendingExit: null, stopPrice: stop, breakeven },
            }),
            this.prisma.aiAccount.update({ where: { id: account.id }, data: { cash: { increment: step.price * p.shares } } }),
          ]);
          pending = null;
          break;
        }
        if (step.kind === 'breakeven') {
          stop = step.stop;
          breakeven = true;
          pending = null;
          continue;
        }
        pending = step.kind === 'pending' ? step.reason : null;
      }
      await this.prisma.aiPosition.updateMany({
        where: { id: p.id, status: 'open' },
        data: { pendingExit: pending, stopPrice: stop, breakeven },
      });
    }
  }

  /** 마지막 종가 기준 AI 계좌 가치. 처리한 날짜도 여기서 앞으로 민다 */
  private async snapshot(accountId: string) {
    const account = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: accountId } });
    const positions = await this.prisma.aiPosition.findMany({ where: { accountId, status: 'open' } });
    const date = (await this.bars(BENCHMARK)).at(-1)?.date;
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

  /** trader-scanner로 셋업을 찾고(한 번), 계좌마다 자기 규칙으로 판단한다 */
  private async scan(runId: string, accounts: AiAccount[], condition: Condition | null, ceiling: number | null) {
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

    const candidates: { hit: ScanHit; bars: Bar[]; daysToEarnings: number | null }[] = [];
    const earnings = await this.prisma.calendarEvent.findMany({
      where: { type: 'earnings', symbol: { in: ranked.map((h) => h.symbol) }, date: { gte: new Date(Date.now() - DAY_MS) } },
      orderBy: { date: 'asc' },
    });
    for (const hit of ranked) {
      const bars = await this.bars(hit.symbol);
      if (bars.length < 30 || bars.at(-1)!.date !== hit.close_date) continue;
      const next = earnings.find((e) => e.symbol === hit.symbol);
      const daysToEarnings = next ? Math.round((next.date.getTime() - toDate(hit.close_date).getTime()) / DAY_MS) : null;
      candidates.push({ hit, bars, daysToEarnings });
    }
    const spy = await this.bars(BENCHMARK);

    for (const account of accounts) await this.judge(account, candidates, spy, condition, ceiling);
    return candidates.length;
  }

  /** 한 계좌의 규칙으로 후보를 판단하고, 매수면 수량까지 계획한다 */
  private async judge(
    account: AiAccount,
    candidates: { hit: ScanHit; bars: Bar[]; daysToEarnings: number | null }[],
    spy: Bar[],
    condition: Condition | null,
    ceiling: number | null,
  ) {
    const v2 = account.ruleVersion === 'v2';
    const fresh = await this.prisma.aiAccount.findUniqueOrThrow({ where: { id: account.id } });
    const latestEquity = await this.prisma.aiEquity.findFirst({ where: { accountId: account.id }, orderBy: { date: 'desc' } });
    const equity = latestEquity?.equity ?? fresh.cash;
    let invested = latestEquity?.positionsValue ?? 0;
    let cash = fresh.cash;
    let openCount = await this.prisma.aiPosition.count({ where: { accountId: account.id, status: 'open' } });
    const recent = await this.prisma.aiPosition.findMany({
      where: { accountId: account.id, status: 'closed' },
      orderBy: { exitDate: 'desc' },
      take: RULES_V2.lossStreak,
      select: { exitReason: true },
    });
    const riskPct = v2 ? riskPctV2(recent.map((r) => r.exitReason ?? '')) : RULES.riskPct;
    const maxNew = v2 ? RULES_V2.maxNewPerDay : RULES.maxNewPerDay;
    let newBuys = 0;

    for (const { hit, bars, daysToEarnings } of candidates) {
      const e = v2
        ? evaluateBuyV2({ setups: hit.setups, rsi: hit.rsi ?? null, bars, benchmark: spy, condition, daysToEarnings })
        : evaluateBuy({ setups: hit.setups, rsi: hit.rsi ?? null, bars, condition });

      let status: string = e.verdict === 'buy' ? 'planned' : e.verdict === 'hold' ? 'held' : 'watch';
      let shares: number | null = null;
      let note: string | null = null;
      if (e.verdict === 'buy' && e.stopPrice != null) {
        // 권장 비중 상한 안에서만 산다
        const room = ceiling != null ? Math.max(0, (equity * ceiling) / 100 - invested) : equity;
        const sized = v2
          ? sizePositionV2({ equity, cash, entry: e.closePrice, stop: e.stopPrice, riskPct })
          : sizePosition({ equity, cash, entry: e.closePrice, stop: e.stopPrice });
        shares = Math.min(sized, Math.floor(room / e.closePrice));
        if (newBuys >= maxNew) {
          status = 'skipped';
          note = `하루 ${maxNew}종목까지만 삽니다`;
        } else if (v2 && openCount >= RULES_V2.maxPositions) {
          status = 'skipped';
          note = `보유 ${RULES_V2.maxPositions}종목이 꽉 차서 사지 않음`;
        } else if (shares <= 0) {
          status = 'skipped';
          note = '권장 비중 상한 또는 현금 때문에 살 수량이 없음';
        } else {
          newBuys++;
          openCount++;
          cash -= shares * e.closePrice;
          invested += shares * e.closePrice;
          if (v2 && riskPct < RULES_V2.riskPct) note = `최근 ${RULES_V2.lossStreak}번 연속 손절이라 위험을 ${riskPct * 100}%로 줄임`;
        }
      }

      await this.prisma.aiSignal.upsert({
        where: { accountId_date_symbol_side: { accountId: account.id, date: toDate(hit.close_date), symbol: hit.symbol, side: 'buy' } },
        create: {
          accountId: account.id,
          date: toDate(hit.close_date),
          symbol: hit.symbol,
          side: 'buy',
          setups: hit.setups,
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
  }

  /**
   * 내 보유 종목을 그 계좌의 규칙으로 본다. 팔 자리면 매도 신호를 남긴다 (선택은 사용자).
   * v2는 손절가가 없으면 평단가 −8%를 손절가로 본다 (오닐 원칙).
   */
  private async myHoldingSignals(account: AiAccount) {
    const holdings = await this.prisma.holding.findMany();
    for (const h of holdings) {
      const bars = await this.bars(h.symbol);
      const last = bars.at(-1);
      if (!last) continue;
      const stop = h.stopPrice ?? (account.ruleVersion === 'v2' ? h.avgCost * (1 - RULES_V2.maxLossPct) : null);
      const sell = evaluateHolding({ bars, stopPrice: stop });
      if (!sell) continue;
      const detail =
        sell.reason === 'stop' && h.stopPrice == null ? `${sell.detail} (평단 $${h.avgCost.toFixed(2)}의 −8%)` : sell.detail;
      await this.prisma.aiSignal.upsert({
        where: { accountId_date_symbol_side: { accountId: account.id, date: toDate(last.date), symbol: h.symbol, side: 'sell' } },
        create: {
          accountId: account.id,
          date: toDate(last.date),
          symbol: h.symbol,
          side: 'sell',
          setups: [sell.reason],
          verdict: 'sell',
          status: 'done',
          checks: [{ key: sell.reason, label: EXIT_LABEL[sell.reason], pass: false, detail }] as Prisma.InputJsonValue,
          closePrice: last.close,
          reasonKo: `내 보유 종목이에요. ${detail}. AI 규칙이라면 다음 거래일 시가에 정리합니다.`,
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
    const date = (await this.bars(BENCHMARK)).at(-1)?.date;
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
