import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptYahooChart } from '../adapters/yahoo-chart.adapter.js';
import { atr, nearestSupport, stopOptions } from './stop-options.js';

const bar = (low: number, high = low + 2, close = low + 1) => ({ low, high, close });

describe('atr', () => {
  it('15일 미만이면 계산하지 않는다', () => {
    expect(atr(Array.from({ length: 14 }, () => bar(10)))).toBeNull();
  });

  it('진폭이 일정하면 그 값', () => {
    expect(atr(Array.from({ length: 20 }, () => bar(10)))).toBe(2);
  });
});

describe('nearestSupport', () => {
  it('현재가 아래 스윙 저점 중 가장 가까운 것', () => {
    const lows = [20, 18, 15, 18, 20, 19, 17, 19, 21, 22, 23, 24];
    const bars = lows.map((l) => bar(l, l + 2, l + 1));
    // 스윙 저점 15, 17. 현재가 25 아래에서 가장 높은 것은 17
    expect(nearestSupport(bars)).toBe(17);
  });
});

describe('stopOptions', () => {
  it('세 방식과 최대 손실 금액', () => {
    const bars = Array.from({ length: 30 }, (_, i) => bar(95 + (i % 5 === 2 ? -3 : 0)));
    const [percent, atrOpt, support] = stopOptions(bars, 100, 10);
    expect(percent).toMatchObject({ method: 'percent', stopPrice: 92, lossPct: 8, maxLoss: 80 });
    expect(atrOpt.stopPrice).not.toBeNull();
    expect(support.method).toBe('support');
  });

  it('일봉이 없으면 비율형만', () => {
    const [percent, atrOpt, support] = stopOptions([], 50, null);
    expect(percent.stopPrice).toBe(46);
    expect(percent.maxLoss).toBeNull();
    expect(atrOpt.stopPrice).toBeNull();
    expect(support.stopPrice).toBeNull();
  });
});

describe('adaptYahooChart', () => {
  // 2026-11-23 야후 응답 일부 (NVDA)
  const json = JSON.parse(readFileSync(join(__dirname, '../../test/fixtures/yahoo-chart.sample.json'), 'utf8'));

  it('뉴욕 날짜로 바꾸고 빈 값은 버린다', () => {
    const bars = adaptYahooChart(json, new Date('2026-11-23T12:00:00Z'));
    expect(bars.length).toBeGreaterThan(30);
    expect(bars.at(-1)!.date).toBe('2026-11-20');
    expect(bars.every((b) => b.close > 0)).toBe(true);
  });

  it('장중이면 오늘 미완성 봉을 버린다', () => {
    const fake = {
      chart: {
        result: [
          {
            meta: { gmtoffset: -18000, currentTradingPeriod: { regular: { start: 1000, end: 2000 } } },
            timestamp: [500, 1000],
            indicators: { quote: [{ open: [1, 1], high: [2, 2], low: [1, 1], close: [1.5, 1.6], volume: [10, 10] }] },
          },
        ],
      },
    };
    expect(adaptYahooChart(fake, new Date(1500 * 1000))).toHaveLength(1);
    expect(adaptYahooChart(fake, new Date(2500 * 1000))).toHaveLength(2);
  });
});
