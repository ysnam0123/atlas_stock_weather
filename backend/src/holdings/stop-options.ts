// 보유 종목 손절가 제안 세 가지 (docs/skills.md "손절가 제안"). 결정론적 계산이라 Claude를 쓰지 않는다.
// 사용자는 셋 중 하나를 고르거나 직접 입력한다.

export interface DailyBar {
  high: number;
  low: number;
  close: number;
}

export type StopMethod = 'percent' | 'atr' | 'support';

export interface StopOption {
  method: StopMethod;
  stopPrice: number | null;
  /** 평단가 대비 손실률 (%) */
  lossPct: number | null;
  /** 수량을 알 때 최대 손실 금액 ($) */
  maxLoss: number | null;
  /** 계산 근거 한 줄, 또는 못 구한 이유 */
  basis: string;
}

/** 오닐 CANSLIM의 7~8% 손절 원칙 */
export const PERCENT_STOP = 0.08;
/** position-sizer ATR 모드 기본 배수 */
export const ATR_MULTIPLE = 2;
const ATR_PERIOD = 14;
/** 지지선은 최근 약 3개월 안에서 찾는다 */
const SUPPORT_LOOKBACK = 60;
/** 지지선 "바로 아래": 저점에서 1% 여유 */
const SUPPORT_BUFFER = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 평균 진폭(ATR). 최근 14일 실제 변동폭의 단순 평균 */
export function atr(bars: DailyBar[], period = ATR_PERIOD): number | null {
  if (bars.length < period + 1) return null;
  const recent = bars.slice(-(period + 1));
  let sum = 0;
  for (let i = 1; i < recent.length; i++) {
    const { high, low } = recent[i];
    const prevClose = recent[i - 1].close;
    sum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  return sum / period;
}

/**
 * 현재가 아래에서 가장 가까운 지지선(스윙 저점: 앞뒤 2일보다 낮은 저점).
 * 최근 봉 2개는 아직 저점으로 확정되지 않아 보지 않는다.
 */
export function nearestSupport(bars: DailyBar[], lookback = SUPPORT_LOOKBACK): number | null {
  if (bars.length < 5) return null;
  const recent = bars.slice(-lookback);
  const lastClose = recent[recent.length - 1].close;
  let best: number | null = null;
  for (let i = 2; i < recent.length - 2; i++) {
    const low = recent[i].low;
    const isSwingLow =
      low < recent[i - 1].low && low < recent[i - 2].low && low <= recent[i + 1].low && low <= recent[i + 2].low;
    if (isSwingLow && low < lastClose && (best == null || low > best)) best = low;
  }
  return best;
}

export function stopOptions(bars: DailyBar[], avgCost: number, shares: number | null): StopOption[] {
  const make = (method: StopMethod, stop: number | null, basis: string): StopOption => {
    if (stop == null || stop <= 0) return { method, stopPrice: null, lossPct: null, maxLoss: null, basis };
    const stopPrice = round2(stop);
    return {
      method,
      stopPrice,
      lossPct: round2(((avgCost - stopPrice) / avgCost) * 100),
      maxLoss: shares ? round2((avgCost - stopPrice) * shares) : null,
      basis,
    };
  };

  const a = atr(bars);
  const support = nearestSupport(bars);
  return [
    make('percent', avgCost * (1 - PERCENT_STOP), `평단가에서 ${PERCENT_STOP * 100}% 아래`),
    a == null
      ? make('atr', null, '일봉이 15일 이상 쌓여야 계산할 수 있어요')
      : make('atr', avgCost - a * ATR_MULTIPLE, `하루 평균 움직임(ATR) $${round2(a)}의 ${ATR_MULTIPLE}배만큼 아래`),
    support == null
      ? make('support', null, '최근 3개월에 현재가 아래 지지선이 없어요')
      : make('support', support * (1 - SUPPORT_BUFFER), `최근 지지선 $${round2(support)} 바로 아래`),
  ];
}
