import type { Bar } from '../ai/strategy.js';
import { swingLevels } from './levels.js';

/** 100과 120 사이를 오가는 박스권: 120 근처가 저항, 100 근처가 지지 */
function range(n = 120): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const phase = (i % 20) / 20;
    const mid = 110 + 9 * Math.sin(phase * 2 * Math.PI);
    return { date: `2026-01-${String(i).padStart(3, '0')}`, open: mid, high: mid + 1, low: mid - 1, close: mid, volume: 1 };
  });
}

describe('swingLevels', () => {
  it('박스권 위아래 꼭짓점을 가격대로 묶는다', () => {
    const bars = range();
    const levels = swingLevels(bars);
    const res = levels.find((l) => l.kind === 'resistance')!;
    const sup = levels.find((l) => l.kind === 'support')!;
    expect(res.price).toBeGreaterThan(118);
    expect(res.touches).toBeGreaterThan(2);
    expect(sup.price).toBeLessThan(102);
  });

  it('저항은 종가 위, 지지는 종가 아래', () => {
    const bars = range();
    const close = bars.at(-1)!.close;
    for (const l of swingLevels(bars)) expect(l.kind === 'support' ? l.price < close : l.price >= close).toBe(true);
  });

  it('봉이 모자라면 빈 목록', () => {
    expect(swingLevels(range(5))).toEqual([]);
  });
});
