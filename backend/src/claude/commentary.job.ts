import { Injectable, Logger } from '@nestjs/common';
import { SETUP_LABEL } from '../ai/strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClaudeService } from './claude.service.js';

export const COMMENTARY_DAILY = 'commentary_daily';

/** 관찰 신호는 다 설명하지 않는다. 조건에 가장 가까웠던 몇 개만 */
const WATCH_LIMIT = 10;

const day = (d: Date) => d.toISOString().slice(0, 10);
const pct1 = (r: number | null | undefined) => (r == null ? null : Math.round(r * 1000) / 10);

const CONDITION_KO: Record<string, string> = { clear: '맑음', cloudy: '흐림', rain: '비' };
const BREADTH_KO: Record<string, string> = {
  breadth_level_trend: '참여 종목 수준',
  ma_crossover: '단기·장기 평균선',
  cycle_position: '상승·하락 사이클',
  bearish_signal: '하락 경고',
  historical_percentile: '과거 대비 위치',
  divergence: '지수와 같은 방향인지',
};
const SECTOR_KO: Record<string, string> = {
  Technology: '기술',
  'Communication Services': '커뮤니케이션',
  'Consumer Cyclical': '경기소비재',
  'Consumer Defensive': '필수소비재',
  Healthcare: '헬스케어',
  'Financial Services': '금융',
  Financial: '금융',
  Industrials: '산업재',
  Energy: '에너지',
  'Basic Materials': '소재',
  'Real Estate': '부동산',
  Utilities: '유틸리티',
};

const COMMON_RULES = `규칙:
- 입력 JSON에 있는 숫자와 사실만 쓴다. 없는 숫자를 지어내지 않는다.
- 앞으로 오를지 내릴지 말하지 않는다. 확률, 전망, 예보 같은 말을 쓰지 않는다. 지금 상태와 달라진 점만 말한다.
- 사라, 팔라고 지시하지 않는다. 선택은 독자 몫이다.
- 주식을 잘 모르는 직장인이 읽는다. 전문 용어는 풀어 쓴다 (예: 상승추세 비율 → 오르는 흐름에 있는 종목의 비율).
- 말투는 "~예요", "~해요". 한 줄은 60자 안팎.`;

const MARKET_SYSTEM = `너는 Atlas의 미국 주식 시장 해설가다. 매일 아침 어젯밤 미국 시장의 "현재 상태"를 쉬운 말로 정리한다.
${COMMON_RULES}
- headline: 오늘 시장을 한 문장으로 (25자 안팎).
- summary: 3줄. 1) 시장 전체 상태 2) 전 거래일과 달라진 점 3) 버틴 섹터와 약한 섹터.
- why: 3줄. 날씨(맑음·흐림·비)가 이렇게 나온 가장 큰 이유 3가지. 숫자를 붙인다.`;

const SIGNAL_SYSTEM = `너는 Atlas AI 모의 계좌의 해설가다. 규칙이 낸 신호마다 왜 그런 판단이 나왔는지 쉬운 말 한 줄로 설명한다.
${COMMON_RULES}
- 판단(verdict)은 바꾸지 않는다. buy=다음 거래일 시가에 모의 매수, hold=종목 조건은 통과했지만 시장 때문에 보류, watch=종목 조건에서 걸려 관찰, sell=내 보유 종목을 AI 매도 규칙으로 본 결과.
- 한 줄 70자 안팎. 무엇이 바뀌면 판단이 달라지는지도 짧게 넣는다 (예: "시장이 맑아지면 매수 후보예요").
- sell은 독자가 직접 들고 있는 종목이다. AI가 판다고 쓰지 말고 "AI 규칙으로는 정리할 자리예요"처럼 쓴다.`;

const MARKET_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    why: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
  },
  required: ['headline', 'summary', 'why'],
  additionalProperties: false,
};

const SIGNAL_SCHEMA = {
  type: 'object',
  properties: {
    comments: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, comment: { type: 'string' } },
        required: ['id', 'comment'],
        additionalProperties: false,
      },
    },
  },
  required: ['comments'],
  additionalProperties: false,
};

/**
 * Phase 4 Claude 해설. 장 날짜마다 한 번 (이미 있으면 건너뛴다).
 * 1) 시장 해설 + "왜 이런 날씨인가" 3줄  2) 그날 AI 신호 한 줄 해설 (매수·보류·매도 전부 + 관찰 상위 10개)
 * 실패해도 화면은 해설 없이 그대로 보인다 (절대 규칙 4).
 */
@Injectable()
export class CommentaryJob {
  private readonly logger = new Logger(CommentaryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
  ) {}

  async run() {
    const run = await this.prisma.run.create({ data: { kind: COMMENTARY_DAILY, market: 'us' } });
    const notes: string[] = [];
    let cost = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let failed = 0;

    try {
      const market = await this.marketInput();
      if (!market) {
        notes.push('시장 판정이 없어 건너뜀');
      } else if (await this.prisma.commentary.findUnique({ where: { market_tradeDate: { market: 'us', tradeDate: market.date } } })) {
        notes.push(`${market.input.tradeDate} 시장 해설은 이미 있음`);
      } else {
        try {
          const r = await this.claude.structuredChecked<{ headline: string; summary: string[]; why: string[] }>({
            system: MARKET_SYSTEM,
            prompt: `어젯밤 미국 시장 판정 결과예요. 이 값으로 해설을 써 주세요.\n\n${JSON.stringify(market.input, null, 1)}`,
            schema: MARKET_SCHEMA,
          });
          await this.prisma.commentary.create({
            data: {
              market: 'us',
              tradeDate: market.date,
              headline: r.data.headline.trim(),
              summary: r.data.summary.map((s) => s.trim()),
              why: r.data.why.map((s) => s.trim()),
              model: r.model,
              inputTokens: r.inputTokens,
              outputTokens: r.outputTokens,
              costUsd: r.costUsd,
            },
          });
          cost += r.costUsd ?? 0;
          tokensIn += r.inputTokens;
          tokensOut += r.outputTokens;
          notes.push(`시장 해설 (입력 ${r.inputTokens}, 출력 ${r.outputTokens} 토큰)`);
        } catch (err) {
          failed++;
          notes.push(`시장 해설 실패: ${String(err).slice(0, 200)}`);
        }
      }

      const signals = await this.signalInput(market?.input.weather ?? null);
      if (!signals.length) {
        notes.push('해설할 새 신호 없음');
      } else {
        try {
          const r = await this.claude.structuredChecked<{ comments: { id: string; comment: string }[] }>({
            system: SIGNAL_SYSTEM,
            prompt: `오늘의 AI 신호예요. 각 id마다 한 줄 해설을 써 주세요.\n\n${JSON.stringify(signals, null, 1)}`,
            schema: SIGNAL_SCHEMA,
          });
          const ids = new Set(signals.map((s) => s.id));
          const valid = r.data.comments.filter((c) => ids.has(c.id) && c.comment.trim());
          await this.prisma.$transaction(
            valid.map((c) => this.prisma.aiSignal.update({ where: { id: c.id }, data: { commentKo: c.comment.trim() } })),
          );
          cost += r.costUsd ?? 0;
          tokensIn += r.inputTokens;
          tokensOut += r.outputTokens;
          notes.push(`신호 해설 ${valid.length}개 (입력 ${r.inputTokens}, 출력 ${r.outputTokens} 토큰)`);
        } catch (err) {
          failed++;
          notes.push(`신호 해설 실패: ${String(err).slice(0, 200)}`);
        }
      }

      const status = failed === 0 ? 'success' : failed === 2 ? 'failed' : 'partial';
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status, finishedAt: new Date(), error: notes.join(' / '), claudeCostUsd: cost || null },
      });
      this.logger.log(`끝 ${run.id} ${status}: ${notes.join(' / ')}`);
      return { runId: run.id, status, notes, tokens: { input: tokensIn, output: tokensOut } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.run.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date(), error: message } });
      return { runId: run.id, status: 'failed', error: message };
    }
  }

  /** Claude에게 줄 시장 값. 화면에 보이는 숫자와 같은 출처 (market_snapshots, sector_snapshots) */
  private async marketInput() {
    const latest = await this.prisma.marketSnapshot.findFirst({
      where: { market: 'us', condition: { not: null } },
      orderBy: { tradeDate: 'desc' },
    });
    if (!latest) return null;
    const prev = await this.prisma.marketSnapshot.findFirst({
      where: { market: 'us', tradeDate: { lt: latest.tradeDate } },
      orderBy: { tradeDate: 'desc' },
    });
    const sectorDates = await this.prisma.sectorSnapshot.findMany({
      where: { market: 'us', tradeDate: { lte: latest.tradeDate } },
      distinct: ['tradeDate'],
      orderBy: { tradeDate: 'desc' },
      select: { tradeDate: true },
      take: 2,
    });
    const [today, before] = await Promise.all(
      sectorDates.map((d) => this.prisma.sectorSnapshot.findMany({ where: { market: 'us', tradeDate: d.tradeDate }, orderBy: { rank: 'asc' } })),
    );
    const prevBy = new Map((before ?? []).map((s) => [s.sector, s]));
    const sector = (s: { sector: string; rank: number; uptrendRatio: number }) => ({
      name: SECTOR_KO[s.sector] ?? s.sector,
      rank: s.rank,
      uptrendPct: pct1(s.uptrendRatio),
      prevRank: prevBy.get(s.sector)?.rank ?? null,
      prevUptrendPct: pct1(prevBy.get(s.sector)?.uptrendRatio),
    });
    const components = (latest.breadthComponents as { key: string; score: number }[] | null) ?? [];

    return {
      date: latest.tradeDate,
      input: {
        tradeDate: day(latest.tradeDate),
        weather: CONDITION_KO[latest.condition ?? ''] ?? null,
        recommendedStockSharePct: latest.exposureCeiling,
        judgmentScore: latest.exposureScore,
        judgmentRule: '판정 점수 30 미만 비, 50 미만 흐림, 그 이상 맑음',
        judgmentConfidence: latest.exposureConfidence,
        marketScore: latest.marketScore,
        marketScoreParts: components.map((c) => ({ name: BREADTH_KO[c.key] ?? c.key, score: c.score, note: '0~100, 높을수록 건강' })),
        uptrendStocksPct: pct1(latest.uptrendRatio),
        prevUptrendStocksPct: pct1(prev?.uptrendRatio),
        uptrendHistoricalPercentile: latest.uptrendPercentile,
        uptrendHistoricalMedianPct: pct1(latest.uptrendMedian),
        topRisk: latest.topRiskScore != null ? { score: latest.topRiskScore, zone: latest.topRiskZone, note: '0~100, 높을수록 고점 위험' } : null,
        macroRegime: latest.regime,
        followThroughDay: latest.ftdState,
        strongestSectors: (today ?? []).slice(0, 3).map(sector),
        weakestSectors: (today ?? []).slice(-3).map(sector),
      },
    };
  }

  /** 가장 최근 장의 AI 신호 중 아직 해설이 없는 것 */
  private async signalInput(weather: string | null) {
    const account = await this.prisma.aiAccount.findFirst({ where: { active: true } });
    if (!account) return [];
    const latest = await this.prisma.aiSignal.findFirst({ where: { accountId: account.id }, orderBy: { date: 'desc' } });
    if (!latest) return [];
    const rows = await this.prisma.aiSignal.findMany({ where: { accountId: account.id, date: latest.date } });
    const failedCount = (checks: unknown) => (checks as { key: string; pass: boolean }[]).filter((c) => !c.pass && c.key !== 'market').length;
    // 관찰은 그날 전체에서 조건에 가장 가까운 10개만 정하고, 그중 해설이 없는 것만 (다시 돌아도 늘어나지 않게)
    const important = rows.filter((r) => r.verdict !== 'watch' && !r.commentKo);
    const watch = rows
      .filter((r) => r.verdict === 'watch')
      .sort((a, b) => failedCount(a.checks) - failedCount(b.checks) || a.symbol.localeCompare(b.symbol))
      .slice(0, WATCH_LIMIT)
      .filter((r) => !r.commentKo);
    const names = await this.prisma.symbol.findMany({
      where: { symbol: { in: [...important, ...watch].map((r) => r.symbol) } },
      select: { symbol: true, nameKo: true, nameEn: true },
    });
    const nameOf = new Map(names.map((n) => [n.symbol, n.nameKo ?? n.nameEn]));
    return [...important, ...watch].map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: nameOf.get(r.symbol) ?? r.symbol,
      marketWeather: weather,
      verdict: r.verdict,
      setups: r.setups.map((s) => SETUP_LABEL[s] ?? s),
      checks: r.checks,
      closePrice: r.closePrice,
      stopPrice: r.stopPrice,
      targetPrice: r.targetPrice,
      ruleReason: r.reasonKo,
    }));
  }
}
