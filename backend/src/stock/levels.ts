// 지지·저항 가격대: 최근 일봉의 스윙 고점·저점을 모아 가까운 것끼리 묶는다. 전부 결정론적 계산 (절대 규칙 2).
// 깊게 분석에서 Claude는 이 값을 설명만 하고, 화면의 가격대는 이 계산 결과를 그대로 쓴다.

import type { Bar } from '../ai/strategy.js';

export interface Level {
  price: number;
  kind: 'support' | 'resistance';
  /** 이 가격대에서 꺾인 횟수 */
  touches: number;
  /** 마지막으로 꺾인 날 */
  lastDate: string;
}

/** 양옆 이만큼의 봉보다 높으면(낮으면) 스윙 고점(저점) */
const SWING = 5;
/** 이 % 안의 꼭짓점은 같은 가격대로 묶는다 */
const MERGE_PCT = 0.02;
const LOOKBACK = 250;
const PER_SIDE = 3;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function swingLevels(bars: Bar[]): Level[] {
  const recent = bars.slice(-LOOKBACK);
  const last = recent.at(-1);
  if (!last || recent.length < SWING * 2 + 1) return [];

  const points: { price: number; date: string }[] = [];
  for (let i = SWING; i < recent.length - SWING; i++) {
    const around = [...recent.slice(i - SWING, i), ...recent.slice(i + 1, i + 1 + SWING)];
    if (around.every((b) => b.high < recent[i].high)) points.push({ price: recent[i].high, date: recent[i].date });
    if (around.every((b) => b.low > recent[i].low)) points.push({ price: recent[i].low, date: recent[i].date });
  }

  // 가격순으로 놓고 2% 안이면 한 묶음. 묶음 가격은 평균
  points.sort((a, b) => a.price - b.price);
  const groups: { prices: number[]; lastDate: string }[] = [];
  for (const p of points) {
    const g = groups.at(-1);
    if (g && p.price <= g.prices[0] * (1 + MERGE_PCT)) {
      g.prices.push(p.price);
      if (p.date > g.lastDate) g.lastDate = p.date;
    } else groups.push({ prices: [p.price], lastDate: p.date });
  }

  const levels = groups.map((g) => {
    const price = round2(g.prices.reduce((a, b) => a + b, 0) / g.prices.length);
    return { price, kind: price < last.close ? ('support' as const) : ('resistance' as const), touches: g.prices.length, lastDate: g.lastDate };
  });
  // 종가에서 가까운 순으로 위아래 세 개씩
  const below = levels.filter((l) => l.kind === 'support').sort((a, b) => b.price - a.price).slice(0, PER_SIDE);
  const above = levels.filter((l) => l.kind === 'resistance').sort((a, b) => a.price - b.price).slice(0, PER_SIDE);
  return [...above.reverse(), ...below];
}
