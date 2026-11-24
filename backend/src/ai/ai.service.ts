import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiAccount } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_DAILY, AiDailyJob, BENCHMARK } from './ai-daily.job.js';
import { EXIT_LABEL, SETUP_LABEL } from './strategy.js';

const day = (d: Date) => d.toISOString().slice(0, 10);
/** 신호 목록은 최근 이만큼의 장 날짜만 */
const SIGNAL_DAYS = 5;
/** 나란히 돌리는 규칙 버전 */
export const RULE_VERSIONS = ['v1', 'v2'] as const;
const VERSION_LABEL: Record<string, string> = { v1: 'AI v1 추세 추종', v2: 'AI v2 원칙 강화' };

/** 고점 대비 가장 크게 빠진 비율 (%) */
function maxDrawdown(values: number[]): number | null {
  if (values.length < 2) return null;
  let peak = values[0];
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, (v - peak) / peak);
  }
  return worst * 100;
}

/** AI 대결 화면 (docs/ai-duel.md). 응답 모양은 packages/contracts의 AiDuelResponse */
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly job: AiDailyJob,
  ) {}

  /** v1·v2 계좌를 같은 시작 자금으로 새로 연다. 이전 계좌들은 기록으로만 남는다 */
  async startAccounts(raw: unknown) {
    const startCapital = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof startCapital !== 'number' || !Number.isFinite(startCapital) || startCapital < 100) {
      throw new BadRequestException('시작 자금은 $100 이상이어야 해요');
    }
    const latest = await this.prisma.priceBar.findFirst({ where: { symbol: BENCHMARK }, orderBy: { date: 'desc' } });
    await this.prisma.aiAccount.updateMany({ where: { active: true }, data: { active: false } });
    const created = await Promise.all(
      RULE_VERSIONS.map((ruleVersion) =>
        this.prisma.aiAccount.create({
          data: { ruleVersion, startCapital, cash: startCapital, lastProcessedDate: latest?.date ?? null },
        }),
      ),
    );
    return { startCapital, accounts: created.map((a) => ({ id: a.id, ruleVersion: a.ruleVersion })) };
  }

  /** 지금 한 번 돌린다. 스캔에 몇 분 걸려서 기다리지 않는다 */
  trigger() {
    void this.job.run();
    return { accepted: AI_DAILY };
  }

  private async closes(symbols: string[]) {
    const out = new Map<string, number>();
    for (const symbol of new Set(symbols)) {
      const bar = await this.prisma.priceBar.findFirst({ where: { symbol }, orderBy: { date: 'desc' } });
      if (bar) out.set(symbol, bar.close);
    }
    return out;
  }

  private async names(symbols: string[]) {
    const rows = await this.prisma.symbol.findMany({
      where: { symbol: { in: [...new Set(symbols)] } },
      select: { symbol: true, nameEn: true, nameKo: true },
    });
    return new Map(rows.map((r) => [r.symbol, r]));
  }

  async duel() {
    const accounts = await this.prisma.aiAccount.findMany({ where: { active: true }, orderBy: { ruleVersion: 'asc' } });
    const lastRun = await this.prisma.run.findFirst({
      where: { kind: AI_DAILY },
      orderBy: { startedAt: 'desc' },
      select: { status: true, startedAt: true, finishedAt: true, error: true },
    });
    const capitalRow = await this.prisma.setting.findUnique({ where: { key: 'capital' } });
    const capital = typeof capitalRow?.value === 'number' ? capitalRow.value : null;
    const runView = lastRun && {
      status: lastRun.status,
      startedAt: lastRun.startedAt.toISOString(),
      finishedAt: lastRun.finishedAt?.toISOString() ?? null,
      error: lastRun.error,
    };
    if (!accounts.length) return { capital, accounts: [], me: null, benchmarkPct: null, series: [], lastRun: runView };

    // 대결 시작일 = 가장 이른 계좌의 시작 처리일
    const startDate = accounts.map((a) => a.lastProcessedDate ?? a.startedAt).reduce((a, b) => (a < b ? a : b));
    const holdings = await this.prisma.holding.findMany();
    const views = await Promise.all(accounts.map((a) => this.accountView(a)));
    const closes = await this.closes(holdings.map((h) => h.symbol));

    // 내 성적 (총 투자금이 있어야 비교할 수 있다)
    let me = null;
    const myEquity = await this.prisma.myEquity.findMany({ where: { date: { gte: startDate } }, orderBy: { date: 'asc' } });
    if (capital) {
      const [realizedAll, sells] = await Promise.all([
        this.prisma.trade.aggregate({ _sum: { realizedPnl: true } }),
        this.prisma.trade.findMany({ where: { side: 'sell', date: { gte: startDate } } }),
      ]);
      const unrealized = holdings.reduce((sum, h) => sum + ((closes.get(h.symbol) ?? h.avgCost) - h.avgCost) * h.shares, 0);
      const myNow = capital + (realizedAll._sum.realizedPnl ?? 0) + unrealized;
      // 대결 시작 시점의 내 계좌 가치를 기준으로 수익률을 잰다
      const base = myEquity[0]?.equity ?? myNow;
      me = {
        startCapital: base,
        equity: myNow,
        returnPct: (myNow / base - 1) * 100,
        realizedPnl: sells.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0),
        trades: sells.length,
        winRate: sells.length ? (sells.filter((t) => (t.realizedPnl ?? 0) > 0).length / sells.length) * 100 : null,
        maxDrawdownPct: maxDrawdown([...myEquity.map((e) => e.equity), myNow]),
        openPositions: holdings.length,
      };
    }

    // 벤치마크와 수익률 곡선 (대결 시작 = 0%)
    const spy = await this.prisma.priceBar.findMany({ where: { symbol: BENCHMARK, date: { gte: startDate } }, orderBy: { date: 'asc' } });
    const spyBase = spy[0]?.close;
    const benchmarkPct = spyBase && spy.length ? (spy.at(-1)!.close / spyBase - 1) * 100 : null;
    const meBase = myEquity[0]?.equity;
    const meByDate = new Map(myEquity.map((e) => [day(e.date), meBase ? (e.equity / meBase - 1) * 100 : null]));
    const series = spy.map((b) => ({
      date: day(b.date),
      v1: views.find((v) => v.version === 'v1')?.equityByDate.get(day(b.date)) ?? null,
      v2: views.find((v) => v.version === 'v2')?.equityByDate.get(day(b.date)) ?? null,
      me: meByDate.get(day(b.date)) ?? null,
      spy: spyBase ? (b.close / spyBase - 1) * 100 : null,
    }));

    return {
      capital,
      accounts: views.map((v) => ({ ...v, equityByDate: undefined })),
      me,
      benchmarkPct,
      series,
      lastRun: runView,
    };
  }

  /** 계좌 하나의 성적·보유·지난 거래·신호 */
  private async accountView(account: AiAccount) {
    const [positions, equity] = await Promise.all([
      this.prisma.aiPosition.findMany({ where: { accountId: account.id }, orderBy: { entryDate: 'desc' } }),
      this.prisma.aiEquity.findMany({ where: { accountId: account.id }, orderBy: { date: 'asc' } }),
    ]);
    const dates = await this.prisma.aiSignal.findMany({
      where: { accountId: account.id },
      distinct: ['date'],
      orderBy: { date: 'desc' },
      select: { date: true },
      take: SIGNAL_DAYS,
    });
    const signals = dates.length
      ? await this.prisma.aiSignal.findMany({
          where: { accountId: account.id, date: { gte: dates.at(-1)!.date } },
          orderBy: [{ date: 'desc' }, { side: 'desc' }, { verdict: 'asc' }],
        })
      : [];

    const symbols = [...positions.map((p) => p.symbol), ...signals.map((s) => s.symbol)];
    const [closes, names] = await Promise.all([this.closes(symbols), this.names(symbols)]);
    const name = (symbol: string) => ({ nameEn: names.get(symbol)?.nameEn ?? symbol, nameKo: names.get(symbol)?.nameKo ?? null });

    const closed = positions.filter((p) => p.status === 'closed');
    const open = positions.filter((p) => p.status === 'open');
    const equityNow = account.cash + open.reduce((sum, p) => sum + (closes.get(p.symbol) ?? p.entryPrice) * p.shares, 0);

    return {
      version: account.ruleVersion as 'v1' | 'v2',
      label: VERSION_LABEL[account.ruleVersion] ?? account.ruleVersion,
      account: {
        id: account.id,
        startCapital: account.startCapital,
        cash: account.cash,
        startedAt: account.startedAt.toISOString(),
        lastProcessedDate: account.lastProcessedDate ? day(account.lastProcessedDate) : null,
      },
      score: {
        startCapital: account.startCapital,
        equity: equityNow,
        returnPct: (equityNow / account.startCapital - 1) * 100,
        realizedPnl: closed.reduce((sum, p) => sum + (p.pnl ?? 0), 0),
        trades: closed.length,
        winRate: closed.length ? (closed.filter((p) => (p.pnl ?? 0) > 0).length / closed.length) * 100 : null,
        maxDrawdownPct: maxDrawdown([account.startCapital, ...equity.map((e) => e.equity), equityNow]),
        openPositions: open.length,
      },
      equityByDate: new Map(equity.map((e) => [day(e.date), (e.equity / account.startCapital - 1) * 100])),
      positions: open.map((p) => {
        const last = closes.get(p.symbol) ?? null;
        return {
          id: p.id,
          symbol: p.symbol,
          ...name(p.symbol),
          shares: p.shares,
          entryDate: day(p.entryDate),
          entryPrice: p.entryPrice,
          stopPrice: p.stopPrice,
          targetPrice: p.targetPrice,
          breakeven: p.breakeven,
          lastClose: last,
          pnl: last != null ? (last - p.entryPrice) * p.shares : null,
          pnlPct: last != null ? (last / p.entryPrice - 1) * 100 : null,
          pendingExit: p.pendingExit,
        };
      }),
      closed: closed.slice(0, 30).map((p) => ({
        id: p.id,
        symbol: p.symbol,
        ...name(p.symbol),
        shares: p.shares,
        entryDate: day(p.entryDate),
        entryPrice: p.entryPrice,
        exitDate: p.exitDate ? day(p.exitDate) : null,
        exitPrice: p.exitPrice,
        exitReason: p.exitReason,
        pnl: p.pnl,
        pnlPct: p.exitPrice != null ? (p.exitPrice / p.entryPrice - 1) * 100 : null,
      })),
      signals: signals.map((s) => ({
        id: s.id,
        date: day(s.date),
        symbol: s.symbol,
        ...name(s.symbol),
        side: s.side,
        setups: s.setups,
        setupLabels: s.setups.map((x) => (s.side === 'sell' ? EXIT_LABEL[x] : SETUP_LABEL[x]) ?? x),
        verdict: s.verdict,
        status: s.status,
        checks: s.checks,
        closePrice: s.closePrice,
        stopPrice: s.stopPrice,
        targetPrice: s.targetPrice,
        shares: s.shares,
        riskAmount: s.riskAmount,
        reasonKo: s.reasonKo,
        exitPlanKo: s.exitPlanKo,
        commentKo: s.commentKo,
        note: s.note,
        lastClose: closes.get(s.symbol) ?? null,
      })),
    };
  }
}
