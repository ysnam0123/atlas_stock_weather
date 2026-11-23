// AI 모의 계좌의 매매 규칙 "추세 추종 스윙 v1". 전부 결정론적 계산이다 (절대 규칙 2).
// 스캐너(trader-scanner)가 찾은 셋업 → 이 규칙이 판단·계획 → ai_daily가 다음 날 시가에 모의 체결.
// 규칙을 바꾸면 docs/ai-duel.md와 화면 문구도 같이 바꾼다.

export interface Bar {
  date: string; // 뉴욕 장 날짜
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Condition = 'clear' | 'cloudy' | 'rain';

export const RULES = {
  /** 한 종목에서 손절되면 계좌의 1%를 잃도록 수량을 정한다 (position-sizer 고정 비율 방식) */
  riskPct: 0.01,
  /** 한 종목에 계좌의 20%까지만 */
  maxPositionPct: 0.2,
  /** 하루 새로 사는 종목 수 */
  maxNewPerDay: 3,
  atrPeriod: 14,
  /** 손절가 = 신호 종가 − ATR × 2 */
  atrMult: 2,
  /** 목표가 = 신호 종가 + 위험폭 × 2 (손익비 2) */
  rewardRisk: 2,
  /** 거래량이 50일 평균의 이 배수 이상이면 돌파 확인 */
  volumeMult: 1.2,
  /** RSI가 이 이상이면 과열로 본다 */
  rsiMax: 75,
  /** 이 거래일 안에 +1R을 못 넘으면 정리 */
  timeStopDays: 20,
} as const;

/** 추세 추종에 쓰는 셋업. 나머지(과매도 등)는 역추세라 관찰만 한다 */
const STRONG_SETUPS = new Set(['breakout_20d', 'bull_flag']);

export const SETUP_LABEL: Record<string, string> = {
  breakout_20d: '20일 종가 신고가 돌파',
  bull_flag: '깃발형 (급등 뒤 좁은 횡보)',
  reclaim_ma20: '20일선 회복',
  oversold: '과매도 (RSI 30 미만)',
  oversold_bounce: '과매도 반등',
};

export const EXIT_LABEL: Record<string, string> = {
  stop: '손절가 도달',
  target: '목표가 도달',
  ma50: '종가 50일선 이탈',
  time: '시간 손절 (20거래일 안에 +1R 미달)',
};

export interface Check {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export const sma = (values: number[], n: number): number | null =>
  values.length < n ? null : values.slice(-n).reduce((a, b) => a + b, 0) / n;

export function atr(bars: Bar[], period: number = RULES.atrPeriod): number | null {
  if (bars.length < period + 1) return null;
  const recent = bars.slice(-(period + 1));
  let sum = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].close;
    const { high, low } = recent[i];
    sum += Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev));
  }
  return sum / period;
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BuyEvaluation {
  verdict: 'buy' | 'hold' | 'watch';
  checks: Check[];
  closePrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  reasonKo: string;
  exitPlanKo: string | null;
}

/**
 * 셋업 하나를 판단한다. 종목 조건(셋업·추세·거래량·과열)을 다 통과하면 강한 신호,
 * 그중 시장이 맑을 때만 매수(buy), 맑지 않으면 보류(hold), 종목 조건이 모자라면 관찰(watch).
 */
export function evaluateBuy(input: {
  setups: string[];
  rsi: number | null;
  bars: Bar[];
  condition: Condition | null;
}): BuyEvaluation {
  const { bars, setups, rsi, condition } = input;
  const last = bars[bars.length - 1];
  const closes = bars.map((b) => b.close);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const avgVol50 = sma(bars.slice(0, -1).map((b) => b.volume), 50);
  const a = atr(bars);

  const strong = setups.filter((s) => STRONG_SETUPS.has(s));
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
      label: '50일선 위',
      pass: ma50 != null && last.close > ma50,
      detail: ma50 == null ? '일봉이 50일보다 적어요' : `종가 ${usd(last.close)}, 50일선 ${usd(ma50)}`,
    },
    {
      key: 'longTrend',
      label: '50일선이 200일선 위',
      // 200일 이력이 없으면 막지 않는다 (상장 1년 미만)
      pass: ma50 == null || ma200 == null || ma50 > ma200,
      detail: ma200 == null || ma50 == null ? '200일 이력 부족, 건너뜀' : `50일선 ${usd(ma50)}, 200일선 ${usd(ma200)}`,
    },
    {
      key: 'volume',
      label: '거래량 확인',
      pass: avgVol50 != null && last.volume >= avgVol50 * RULES.volumeMult,
      detail: avgVol50 == null ? '거래량 이력 부족' : `50일 평균의 ${(last.volume / avgVol50).toFixed(1)}배 (기준 ${RULES.volumeMult}배)`,
    },
    {
      key: 'notHot',
      label: '과열 아님',
      pass: rsi == null || rsi < RULES.rsiMax,
      detail: rsi == null ? 'RSI 없음' : `RSI ${rsi.toFixed(0)} (기준 ${RULES.rsiMax} 미만)`,
    },
  ];

  const stockOk = checks.filter((c) => c.key !== 'market').every((c) => c.pass);
  const verdict: BuyEvaluation['verdict'] = !stockOk ? 'watch' : condition === 'clear' ? 'buy' : 'hold';

  let stopPrice: number | null = null;
  let targetPrice: number | null = null;
  let exitPlanKo: string | null = null;
  if (a != null && a > 0) {
    stopPrice = round2(last.close - a * RULES.atrMult);
    const risk = last.close - stopPrice;
    targetPrice = round2(last.close + risk * RULES.rewardRisk);
    exitPlanKo = exitPlan(last.close, stopPrice, targetPrice);
  }

  // 셋업 이름은 화면에 따로 나오므로 판단 문장에서는 되풀이하지 않는다
  const failed = checks.filter((c) => !c.pass && c.key !== 'market').map((c) => c.label);
  const reasonKo =
    verdict === 'buy'
      ? '종목 조건을 모두 통과했고 시장도 맑아서 다음 거래일 시가에 삽니다.'
      : verdict === 'hold'
        ? '종목 조건은 모두 통과했지만 시장이 맑지 않아 보류합니다. 맑아진 날 같은 신호가 나오면 삽니다.'
        : `${failed.join(', ')} 조건에서 걸려 관찰만 합니다.`;

  return { verdict, checks, closePrice: last.close, stopPrice, targetPrice, reasonKo, exitPlanKo };
}

export function exitPlan(entry: number, stop: number, target: number): string {
  const risk = entry - stop;
  return [
    `손절: ${usd(stop)} (−${(((entry - stop) / entry) * 100).toFixed(1)}%)에 닿으면 그 가격에 정리`,
    `목표: ${usd(target)} (+${(((target - entry) / entry) * 100).toFixed(1)}%)에 닿으면 정리`,
    '종가가 50일선 아래로 마감하면 다음 날 시가에 정리',
    `${RULES.timeStopDays}거래일 안에 ${usd(entry + risk)}(+1R)을 못 넘으면 다음 날 시가에 정리`,
  ].join('\n');
}

/** 계좌 가치와 위험폭으로 수량을 정한다. 현금과 종목당 상한을 넘지 않는다 */
export function sizePosition(input: { equity: number; cash: number; entry: number; stop: number }): number {
  const risk = input.entry - input.stop;
  if (risk <= 0 || input.entry <= 0) return 0;
  const byRisk = (input.equity * RULES.riskPct) / risk;
  const byCap = (input.equity * RULES.maxPositionPct) / input.entry;
  const byCash = input.cash / input.entry;
  return Math.max(0, Math.floor(Math.min(byRisk, byCap, byCash)));
}

export interface OpenPosition {
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  pendingExit: string | null;
}

export type Step =
  | { kind: 'exit'; price: number; reason: string }
  | { kind: 'pending'; reason: string }
  | { kind: 'hold' };

/**
 * 보유 중인 AI 포지션에 새 봉 하나를 적용한다.
 * 같은 날 손절가와 목표가가 둘 다 닿으면 손절을 먼저 본다 (보수적으로).
 * 시가가 이미 손절가 아래(갭 하락)면 시가에 판다.
 */
export function stepPosition(pos: OpenPosition, bar: Bar, ma50: number | null, barsHeld: number): Step {
  if (pos.pendingExit) return { kind: 'exit', price: bar.open, reason: pos.pendingExit };
  if (bar.open <= pos.stopPrice) return { kind: 'exit', price: bar.open, reason: 'stop' };
  if (bar.low <= pos.stopPrice) return { kind: 'exit', price: pos.stopPrice, reason: 'stop' };
  if (bar.open >= pos.targetPrice) return { kind: 'exit', price: bar.open, reason: 'target' };
  if (bar.high >= pos.targetPrice) return { kind: 'exit', price: pos.targetPrice, reason: 'target' };
  if (ma50 != null && bar.close < ma50) return { kind: 'pending', reason: 'ma50' };
  const oneR = pos.entryPrice + (pos.entryPrice - pos.stopPrice);
  if (barsHeld >= RULES.timeStopDays && bar.close < oneR) return { kind: 'pending', reason: 'time' };
  return { kind: 'hold' };
}

/** 내 보유 종목을 AI 규칙으로 보면 팔 자리인가. 손절가가 없으면 50일선만 본다 */
export function evaluateHolding(input: { bars: Bar[]; stopPrice: number | null }): { reason: string; detail: string } | null {
  const last = input.bars[input.bars.length - 1];
  if (!last) return null;
  if (input.stopPrice != null && last.close <= input.stopPrice) {
    return { reason: 'stop', detail: `종가 ${usd(last.close)}가 손절가 ${usd(input.stopPrice)} 아래` };
  }
  const ma50 = sma(input.bars.map((b) => b.close), 50);
  if (ma50 != null && last.close < ma50) {
    return { reason: 'ma50', detail: `종가 ${usd(last.close)}가 50일선 ${usd(ma50)} 아래` };
  }
  return null;
}
