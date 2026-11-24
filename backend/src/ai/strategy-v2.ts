// AI 규칙 v2 "원칙 강화 스윙". v1과 같은 자금으로 나란히 돌려 비교한다 (docs/ai-duel.md).
// 근거: 미너비니 추세 템플릿, 오닐 CANSLIM(7~8% 손절, 돌파 거래량, 주도주), 추세 추종의 "이익은 길게".
// 전부 결정론적 계산이다 (절대 규칙 2).

import { atr, type Bar, type Check, type Condition, SETUP_LABEL, sma, type Step } from './strategy.js';

export const RULES_V2 = {
  riskPct: 0.01,
  /** 3번 연속 손절이면 다음 매수 위험을 줄인다 */
  reducedRiskPct: 0.005,
  lossStreak: 3,
  maxPositionPct: 0.2,
  maxPositions: 6,
  maxNewPerDay: 3,
  atrMult: 2,
  /** 손절은 ATR×2와 −8% 중 가까운 쪽 (최대 손실 8%) */
  maxLossPct: 0.08,
  volumeMult: 1.5,
  rsiMax: 75,
  /** 52주 저점보다 30% 이상 위, 52주 고점에서 25% 안 */
  aboveLowPct: 0.3,
  nearHighPct: 0.25,
  /** 200일선이 한 달(21거래일) 전보다 높아야 한다 */
  ma200RisingDays: 21,
  /** 상대 강도: 최근 126거래일(약 6개월) 수익률이 S&P 500보다 높아야 한다 */
  rsDays: 126,
  /** 시가가 신호 종가보다 이만큼 넘게 높으면 추격하지 않는다 */
  maxGapPct: 0.03,
  /** 실적 발표까지 이 거래일 안이면 사지 않는다 (달력일로 7일) */
  earningsDays: 7,
  emaPeriod: 21,
  /** +1R을 못 넘은 채 이 거래일이 지나면 정리 */
  timeStopDays: 15,
} as const;

const STRONG_SETUPS = new Set(['breakout_20d', 'bull_flag']);
const usd = (n: number) => `$${n.toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** 체크리스트 설명에 실제 대소를 쓴다 (통과하지 못했는데 ">"로 보이지 않게) */
const cmp = (a: number, b: number) => (a > b ? '>' : '<');

/** 지수이동평균 (마지막 값). 기간의 두 배 이상 이력이 있어야 믿을 만하다 */
export function ema(values: number[], period: number): number | null {
  if (values.length < period * 2) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export interface BuyEvaluationV2 {
  verdict: 'buy' | 'hold' | 'watch';
  checks: Check[];
  closePrice: number;
  stopPrice: number | null;
  targetPrice: null;
  reasonKo: string;
  exitPlanKo: string | null;
}

export function evaluateBuyV2(input: {
  setups: string[];
  rsi: number | null;
  bars: Bar[];
  /** 같은 기간 S&P 500(SPY) 일봉. 상대 강도 계산용 */
  benchmark: Bar[];
  condition: Condition | null;
  /** 다음 실적 발표까지 남은 달력일. 모르면 null */
  daysToEarnings: number | null;
}): BuyEvaluationV2 {
  const { bars, setups, rsi, condition, benchmark, daysToEarnings } = input;
  const last = bars[bars.length - 1];
  const closes = bars.map((b) => b.close);
  const ma50 = sma(closes, 50);
  const ma150 = sma(closes, 150);
  const ma200 = sma(closes, 200);
  const ma200Before = closes.length > 200 + RULES_V2.ma200RisingDays ? sma(closes.slice(0, -RULES_V2.ma200RisingDays), 200) : null;
  const year = bars.slice(-252);
  const low52 = Math.min(...year.map((b) => b.low));
  const high52 = Math.max(...year.map((b) => b.high));
  const avgVol50 = sma(bars.slice(0, -1).map((b) => b.volume), 50);
  const a = atr(bars);

  const ret = (series: Bar[]) => {
    if (series.length <= RULES_V2.rsDays) return null;
    const from = series[series.length - 1 - RULES_V2.rsDays].close;
    return series[series.length - 1].close / from - 1;
  };
  const myRet = ret(bars);
  const spyRet = ret(benchmark);

  const strong = setups.filter((s) => STRONG_SETUPS.has(s));
  const trendOk =
    ma50 != null && ma150 != null && ma200 != null && last.close > ma50 && ma50 > ma150 && ma150 > ma200;

  const checks: Check[] = [
    {
      key: 'market',
      label: '시장이 맑음',
      pass: condition === 'clear',
      detail:
        condition === 'clear'
          ? '시장 판정 맑음: 새 매수 허용'
          : `시장 판정 ${condition === 'rain' ? '비' : condition === 'cloudy' ? '흐림' : '없음'}: 새 매수 쉼`,
    },
    {
      key: 'setup',
      label: '추세 추종 셋업',
      pass: strong.length > 0,
      detail: setups.map((s) => SETUP_LABEL[s] ?? s).join(', '),
    },
    {
      key: 'trend',
      label: '이동평균 정배열',
      pass: trendOk,
      detail:
        ma200 == null || ma150 == null || ma50 == null
          ? '일봉이 200일보다 적어요'
          : `종가 ${usd(last.close)} ${cmp(last.close, ma50)} 50일 ${usd(ma50)} ${cmp(ma50, ma150)} 150일 ${usd(ma150)} ${cmp(ma150, ma200)} 200일 ${usd(ma200)}`,
    },
    {
      key: 'ma200Rising',
      label: '200일선 상승 중',
      pass: ma200 != null && ma200Before != null && ma200 > ma200Before,
      detail: ma200 == null || ma200Before == null ? '이력 부족' : `200일선 한 달 전 ${usd(ma200Before)} → 지금 ${usd(ma200)}`,
    },
    {
      key: 'range52',
      label: '52주 고점 근처',
      pass: last.close >= low52 * (1 + RULES_V2.aboveLowPct) && last.close >= high52 * (1 - RULES_V2.nearHighPct),
      detail: `52주 저점 ${usd(low52)}보다 ${((last.close / low52 - 1) * 100).toFixed(0)}% 위, 고점 ${usd(high52)}에서 ${((1 - last.close / high52) * 100).toFixed(0)}% 아래 (기준 30% 위, 25% 안)`,
    },
    {
      key: 'rs',
      label: 'S&P 500보다 강함',
      pass: myRet != null && spyRet != null && myRet > spyRet,
      detail:
        myRet == null || spyRet == null
          ? '6개월 이력 부족'
          : `6개월 수익률 ${(myRet * 100).toFixed(1)}%, S&P 500 ${(spyRet * 100).toFixed(1)}%`,
    },
    {
      key: 'volume',
      label: '돌파 거래량',
      pass: avgVol50 != null && last.volume >= avgVol50 * RULES_V2.volumeMult,
      detail: avgVol50 == null ? '거래량 이력 부족' : `50일 평균의 ${(last.volume / avgVol50).toFixed(1)}배 (기준 ${RULES_V2.volumeMult}배)`,
    },
    {
      key: 'notHot',
      label: '과열 아님',
      pass: rsi == null || rsi < RULES_V2.rsiMax,
      detail: rsi == null ? 'RSI 없음' : `RSI ${rsi.toFixed(0)} (기준 ${RULES_V2.rsiMax} 미만)`,
    },
    {
      key: 'earnings',
      label: '실적 발표 임박 아님',
      // 무료 플랜이라 실적일을 모르는 종목이 많다. 모르면 막지 않는다
      pass: daysToEarnings == null || daysToEarnings > RULES_V2.earningsDays,
      detail: daysToEarnings == null ? '실적일 정보 없음 (막지 않음)' : `다음 실적 발표까지 ${daysToEarnings}일 (기준 ${RULES_V2.earningsDays}일 넘게)`,
    },
  ];

  const stockOk = checks.filter((c) => c.key !== 'market').every((c) => c.pass);
  const verdict: BuyEvaluationV2['verdict'] = !stockOk ? 'watch' : condition === 'clear' ? 'buy' : 'hold';

  let stopPrice: number | null = null;
  let exitPlanKo: string | null = null;
  if (a != null && a > 0) {
    // ATR 손절과 −8% 손절 중 가까운 쪽 (손실이 작은 쪽)
    stopPrice = round2(Math.max(last.close - a * RULES_V2.atrMult, last.close * (1 - RULES_V2.maxLossPct)));
    exitPlanKo = exitPlanV2(last.close, stopPrice);
  }

  const failed = checks.filter((c) => !c.pass && c.key !== 'market').map((c) => c.label);
  const reasonKo =
    verdict === 'buy'
      ? '종목 조건 8개를 모두 통과했고 시장도 맑아서 다음 거래일 시가에 삽니다. 시가가 3% 넘게 뛰면 추격하지 않아요.'
      : verdict === 'hold'
        ? '종목 조건 8개를 모두 통과했지만 시장이 맑지 않아 보류합니다.'
        : `${failed.join(', ')} 조건에서 걸려 관찰만 합니다.`;

  return { verdict, checks, closePrice: last.close, stopPrice, targetPrice: null, reasonKo, exitPlanKo };
}

export function exitPlanV2(entry: number, stop: number): string {
  const risk = entry - stop;
  return [
    `손절: ${usd(stop)} (−${(((entry - stop) / entry) * 100).toFixed(1)}%)에 닿으면 그 가격에 정리 (최대 −8%)`,
    `${usd(entry + risk)}(+1R)을 넘으면 손절가를 산 값으로 올림 (본전 보호)`,
    `그다음엔 목표가 없이 들고 가다가, 종가가 ${RULES_V2.emaPeriod}일 지수이동평균 아래면 다음 날 시가에 정리`,
    `+1R 전에 종가가 50일선 아래면, 또는 ${RULES_V2.timeStopDays}거래일 안에 +1R을 못 넘으면 다음 날 시가에 정리`,
  ].join('\n');
}

export interface OpenPositionV2 {
  entryPrice: number;
  stopPrice: number;
  breakeven: boolean;
  pendingExit: string | null;
  /** 처음 정한 손절가 (1R 계산용) */
  initialStop: number;
}

export type StepV2 = Step | { kind: 'breakeven'; stop: number };

/**
 * v2 보유 포지션에 새 봉 하나. 손절 → (본전 보호 전) 50일선·시간 손절 → +1R이면 본전으로 → (본전 보호 뒤) 21일 지수선 이탈.
 */
export function stepPositionV2(
  pos: OpenPositionV2,
  bar: Bar,
  ma: { ma50: number | null; ema21: number | null },
  barsHeld: number,
): StepV2 {
  if (pos.pendingExit) return { kind: 'exit', price: bar.open, reason: pos.pendingExit };
  if (bar.open <= pos.stopPrice) return { kind: 'exit', price: bar.open, reason: 'stop' };
  if (bar.low <= pos.stopPrice) return { kind: 'exit', price: pos.stopPrice, reason: 'stop' };

  const oneR = pos.entryPrice + (pos.entryPrice - pos.initialStop);
  if (!pos.breakeven) {
    if (bar.close >= oneR) return { kind: 'breakeven', stop: pos.entryPrice };
    if (ma.ma50 != null && bar.close < ma.ma50) return { kind: 'pending', reason: 'ma50' };
    if (barsHeld >= RULES_V2.timeStopDays) return { kind: 'pending', reason: 'time' };
    return { kind: 'hold' };
  }
  if (ma.ema21 != null && bar.close < ma.ema21) return { kind: 'pending', reason: 'ema21' };
  return { kind: 'hold' };
}

/** 최근 끝난 거래가 연속으로 손절이면 위험을 줄인다 */
export function riskPctV2(recentExitReasons: string[]): number {
  const streak = recentExitReasons.slice(0, RULES_V2.lossStreak);
  return streak.length === RULES_V2.lossStreak && streak.every((r) => r === 'stop') ? RULES_V2.reducedRiskPct : RULES_V2.riskPct;
}

export function sizePositionV2(input: { equity: number; cash: number; entry: number; stop: number; riskPct: number }): number {
  const risk = input.entry - input.stop;
  if (risk <= 0 || input.entry <= 0) return 0;
  const byRisk = (input.equity * input.riskPct) / risk;
  const byCap = (input.equity * RULES_V2.maxPositionPct) / input.entry;
  const byCash = input.cash / input.entry;
  return Math.max(0, Math.floor(Math.min(byRisk, byCap, byCash)));
}
