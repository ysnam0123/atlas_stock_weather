import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { adaptFacts } from '../adapters/stock-intel.adapter.js';
import { BENCHMARK } from '../ai/ai-daily.job.js';
import { atr, type Bar, sma } from '../ai/strategy.js';
import { ClaudeService } from '../claude/claude.service.js';
import { MyService } from '../my/my.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkillRunnerService } from '../skills/skill-runner.service.js';
import { swingLevels } from './levels.js';

export const STOCK_REPORT = 'stock_report';

const day = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
const pct = (a: number, b: number) => r2((a / b - 1) * 100);

/** us-stock-analysis 스킬의 리포트 틀(사업·실적·밸류에이션·차트·위험)을 Atlas 규칙에 맞게 줄였다 */
const SYSTEM = `너는 미국 주식 리서치 보조다. 독자는 스윙 매매(몇 주~몇 달)를 하는 한국 직장인 초보다.
입력 JSON의 숫자는 Atlas 스크립트가 계산한 값이다. 이 숫자를 바꾸거나 새로 계산하지 말고 그대로 인용한다.
{web}
지켜야 할 것:
- 예측하지 않는다. "오를 것", "전망", "확률", "목표 주가" 같은 말을 쓰지 않는다. 지금 상태와 근거만 쓴다.
- 사라·팔라고 하지 않는다. 고르는 건 독자다.
- 지지·저항 가격은 입력의 levels만 쓴다.
- 쉬운 한국어, 문장마다 짧게. 해요체.`;

const WEB_ON = '웹 검색은 최대 3번, 사업 내용·밸류에이션(PER 등)·최근 가이던스처럼 입력에 없는 것만 찾는다. 찾은 값에는 기준 시점을 붙인다.';
const WEB_OFF = '웹 검색은 쓸 수 없다. 사업 내용은 아는 범위에서 일반적인 것만 쓰고, 밸류에이션(valuation)과 출처(sources)는 빈 배열로 둔다.';

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: '지금 이 종목의 상태 한 줄 (40자 안)' },
    business: { type: 'array', items: { type: 'string' }, description: '무슨 회사인지, 돈을 어디서 버는지 2~3줄' },
    growth: { type: 'array', items: { type: 'string' }, description: '분기 실적 숫자로 본 성장과 수익성 2~4줄' },
    valuation: { type: 'array', items: { type: 'string' }, description: '밸류에이션·가이던스 1~3줄 (웹 검색, 기준 시점 포함)' },
    chart: { type: 'array', items: { type: 'string' }, description: '추세·이동평균·지지·저항·거래량 3~4줄 (입력 숫자 인용)' },
    risks: { type: 'array', items: { type: 'string' }, description: '조심할 점 2~4줄' },
    watch: { type: 'array', items: { type: 'string' }, description: '앞으로 확인할 것 2~4줄 (가격이나 날짜를 구체적으로)' },
    sources: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'], additionalProperties: false },
      description: '웹 검색 출처 (최대 5)',
    },
  },
  required: ['headline', 'business', 'growth', 'valuation', 'chart', 'risks', 'watch', 'sources'],
  additionalProperties: false,
};

export interface StockReportOutput {
  headline: string;
  business: string[];
  growth: string[];
  valuation: string[];
  chart: string[];
  risks: string[];
  watch: string[];
  sources: { title: string; url: string }[];
}

/**
 * 깊게 분석 (Phase 6). 종목 페이지에서 버튼을 누를 때만 돈다 (매일 자동 아님).
 * 스크립트가 계산한 값(이동평균·지지·저항·분기 실적·규칙 판정)을 넣고, Claude는 설명과 웹 검색(밸류에이션)만 한다.
 */
@Injectable()
export class StockReportService {
  private readonly logger = new Logger(StockReportService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly my: MyService,
    private readonly skills: SkillRunnerService,
  ) {}

  async latest(symbol: string) {
    const r = await this.prisma.stockReport.findFirst({ where: { symbol }, orderBy: { createdAt: 'desc' } });
    if (!r) return null;
    const input = r.input as { levels?: unknown; asOf?: string; web?: boolean };
    return {
      id: r.id,
      symbol: r.symbol,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      asOf: input.asOf ?? null,
      web: input.web ?? true,
      levels: input.levels ?? [],
      output: r.output,
      error: r.error,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
  }

  /**
   * 시작만 하고 돌려준다 (1~3분). 같은 종목이 이미 돌고 있으면 그것을 돌려준다.
   * web: 웹 검색(밸류에이션·최근 소식)을 켠다. 검색 결과가 통째로 들어가 입력 토큰이 수십 배 늘어난다 (NVDA 실측 약 22만)
   */
  async start(symbol: string, web = false) {
    if (this.running.has(symbol)) return this.latest(symbol);
    const detail = await this.my.detail(symbol);
    const input = await this.buildInput(detail);
    const report = await this.prisma.stockReport.create({
      data: { symbol, status: 'running', input: { ...input, web } as unknown as Prisma.InputJsonValue },
    });
    this.running.add(symbol);
    void this.run(report.id, input, web).finally(() => this.running.delete(symbol));
    return this.latest(symbol);
  }

  private async run(id: string, input: Awaited<ReturnType<StockReportService['buildInput']>>, web: boolean) {
    try {
      const res = await this.claude.structuredChecked<StockReportOutput>({
        system: SYSTEM.replace('{web}', web ? WEB_ON : WEB_OFF),
        prompt: `이 종목을 분석해 주세요. 입력:\n${JSON.stringify(input)}`,
        schema: SCHEMA,
        tools: web ? ['WebSearch'] : [],
        timeoutMs: web ? 360_000 : 180_000,
      });
      await this.prisma.stockReport.update({
        where: { id },
        data: {
          status: 'success',
          output: res.data as unknown as Prisma.InputJsonValue,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          finishedAt: new Date(),
        },
      });
      this.logger.log(`${input.symbol} 리포트 (입력 ${res.inputTokens}, 출력 ${res.outputTokens} 토큰)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.stockReport.update({ where: { id }, data: { status: 'failed', error: message.slice(0, 500), finishedAt: new Date() } });
      this.logger.warn(`${input.symbol} 리포트 실패: ${message}`);
    }
  }

  /** 분기 실적이 없으면 SEC에서 바로 받는다 (trader-analyst, 보통주만) */
  private async facts(symbol: string, type: string) {
    let rows = await this.prisma.earningsFact.findMany({ where: { symbol }, orderBy: { periodEnd: 'desc' }, take: 6 });
    if (!rows.length && type === 'stock') {
      try {
        const run = await this.prisma.run.create({ data: { kind: STOCK_REPORT, market: 'us' } });
        const r = await this.skills.run(run.id, 'trader-analyst', {}, [symbol]);
        if (r.status === 'success') {
          const facts = adaptFacts(r.json);
          if (facts.length) await this.prisma.earningsFact.createMany({ data: facts, skipDuplicates: true });
        }
        await this.prisma.run.update({ where: { id: run.id }, data: { status: r.status === 'success' ? 'success' : 'failed', finishedAt: new Date() } });
        rows = await this.prisma.earningsFact.findMany({ where: { symbol }, orderBy: { periodEnd: 'desc' }, take: 6 });
      } catch (err) {
        this.logger.warn(`${symbol} 분기 실적 실패: ${String(err).slice(0, 160)}`);
      }
    }
    return rows;
  }

  /** Claude에 넘길 계산값. 전부 스크립트 계산이다 (절대 규칙 2) */
  private async buildInput(d: Awaited<ReturnType<MyService['detail']>>) {
    const bars: Bar[] = d.bars;
    const closes = bars.map((b) => b.close);
    const last = bars.at(-1);
    const year = bars.slice(-252);
    const spy = await this.prisma.priceBar.findMany({ where: { symbol: BENCHMARK }, orderBy: { date: 'asc' }, select: { close: true } });
    const ret = (series: number[], n: number) => (series.length > n ? pct(series.at(-1)!, series[series.length - 1 - n]) : null);
    const a = atr(bars);
    const [facts, news, earnings, weather] = await Promise.all([
      this.facts(d.symbol, d.type),
      this.prisma.newsItem.findMany({ where: { symbol: d.symbol }, orderBy: { publishedAt: 'desc' }, take: 8 }),
      this.prisma.calendarEvent.findFirst({ where: { type: 'earnings', symbol: d.symbol, date: { gte: new Date() } }, orderBy: { date: 'asc' } }),
      this.prisma.marketSnapshot.findFirst({ where: { market: 'us', condition: { not: null } }, orderBy: { tradeDate: 'desc' } }),
    ]);
    return {
      symbol: d.symbol,
      name: d.nameKo ? `${d.nameKo} (${d.nameEn})` : d.nameEn,
      type: d.type,
      asOf: d.lastDate,
      price: last && {
        close: r2(last.close),
        changePct: r2(d.changePct),
        high52w: r2(Math.max(...year.map((b) => b.high))),
        low52w: r2(Math.min(...year.map((b) => b.low))),
        ma50: r2(sma(closes, 50)),
        ma150: r2(sma(closes, 150)),
        ma200: r2(sma(closes, 200)),
        ma200MonthAgo: r2(closes.length > 221 ? sma(closes.slice(0, -21), 200) : null),
        atrPct: a != null ? r2((a / last.close) * 100) : null,
        return1m: ret(closes, 21),
        return3m: ret(closes, 63),
        return6m: ret(closes, 126),
        spyReturn6m: ret(spy.map((s) => s.close), 126),
        volumeVs50d: (() => {
          const avg = sma(bars.slice(0, -1).map((b) => b.volume), 50);
          return avg ? r2(last.volume / avg) : null;
        })(),
      },
      levels: swingLevels(bars),
      market: weather && { condition: weather.condition, exposureCeiling: weather.exposureCeiling },
      rule: d.readiness && {
        verdict: d.readiness.verdict,
        reason: d.readiness.reasonKo,
        checks: d.readiness.checks.map((c) => `${c.pass ? '통과' : '미통과'} ${c.label}: ${c.detail}`),
        vcp: d.readiness.vcp,
      },
      quarters: facts.map((f) => ({
        fiscal: f.fiscal,
        periodEnd: day(f.periodEnd),
        revenue: f.revenue,
        // earnings_facts는 이미 % 단위다
        revenueYoyPct: f.revenueYoy,
        operatingMarginPct: f.operatingMargin,
        netMarginPct: f.netMargin,
        epsDiluted: f.epsDiluted,
        epsYoyPct: f.epsYoy,
      })),
      nextEarnings: earnings ? day(earnings.date) : null,
      recentNews: news.map((n) => ({ date: day(n.publishedAt), title: n.titleKo ?? n.title })),
      myHolding: d.holding,
    };
  }
}
