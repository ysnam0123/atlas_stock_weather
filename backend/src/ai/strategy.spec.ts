import { type Bar, evaluateBuy, evaluateHolding, RULES, sizePosition, stepPosition } from './strategy.js';

/** 꾸준히 오르다 마지막 날 거래량이 터지는 일봉 */
function uptrend(n = 220, lastVolumeMult = 2): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 50 + i * 0.25;
    return {
      date: `d${i}`,
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: i === n - 1 ? 1_000_000 * lastVolumeMult : 1_000_000,
    };
  });
}

describe('evaluateBuy', () => {
  it('종목 조건을 다 통과하고 시장이 맑으면 매수, 계획까지', () => {
    const e = evaluateBuy({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(), condition: 'clear' });
    expect(e.verdict).toBe('buy');
    expect(e.checks.every((c) => c.pass)).toBe(true);
    expect(e.stopPrice).toBeLessThan(e.closePrice);
    // 손익비 2
    expect(e.targetPrice! - e.closePrice).toBeCloseTo((e.closePrice - e.stopPrice!) * RULES.rewardRisk, 1);
    expect(e.exitPlanKo).toContain('50일선');
  });

  it('시장이 비면 같은 셋업도 보류', () => {
    const e = evaluateBuy({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(), condition: 'rain' });
    expect(e.verdict).toBe('hold');
    expect(e.checks.find((c) => c.key === 'market')!.pass).toBe(false);
  });

  it('역추세 셋업이나 거래량 부족이면 관찰', () => {
    expect(evaluateBuy({ setups: ['oversold'], rsi: 25, bars: uptrend(), condition: 'clear' }).verdict).toBe('watch');
    const weak = evaluateBuy({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(220, 1), condition: 'clear' });
    expect(weak.verdict).toBe('watch');
    expect(weak.reasonKo).toContain('거래량 확인');
  });
});

describe('sizePosition', () => {
  it('계좌 1% 위험, 종목당 20%, 현금 중 가장 작은 값', () => {
    // 위험폭 $5 → 1% of 10,000 = $100 → 20주. 20% 상한 = $2,000 / $100 = 20주
    expect(sizePosition({ equity: 10_000, cash: 10_000, entry: 100, stop: 95 })).toBe(20);
    // 위험폭이 작으면 종목당 상한이 막는다
    expect(sizePosition({ equity: 10_000, cash: 10_000, entry: 100, stop: 99.5 })).toBe(20);
    expect(sizePosition({ equity: 10_000, cash: 500, entry: 100, stop: 95 })).toBe(5);
  });
});

describe('stepPosition', () => {
  const pos = { entryPrice: 100, stopPrice: 95, targetPrice: 110, pendingExit: null };
  const bar = (o: number, h: number, l: number, c: number): Bar => ({ date: 'x', open: o, high: h, low: l, close: c, volume: 1 });

  it('손절가·목표가에 닿으면 그 가격, 갭이면 시가', () => {
    expect(stepPosition(pos, bar(100, 101, 94, 96), 90, 1)).toEqual({ kind: 'exit', price: 95, reason: 'stop' });
    expect(stepPosition(pos, bar(93, 94, 92, 93), 90, 1)).toEqual({ kind: 'exit', price: 93, reason: 'stop' });
    expect(stepPosition(pos, bar(105, 111, 104, 109), 90, 1)).toEqual({ kind: 'exit', price: 110, reason: 'target' });
  });

  it('같은 날 둘 다 닿으면 손절 먼저', () => {
    expect(stepPosition(pos, bar(100, 111, 94, 100), 90, 1)).toMatchObject({ reason: 'stop' });
  });

  it('50일선 아래 마감·시간 손절은 다음 날 시가에', () => {
    expect(stepPosition(pos, bar(100, 101, 99, 99.5), 100, 1)).toEqual({ kind: 'pending', reason: 'ma50' });
    expect(stepPosition(pos, bar(100, 102, 99, 101), 90, RULES.timeStopDays)).toEqual({ kind: 'pending', reason: 'time' });
    expect(stepPosition({ ...pos, pendingExit: 'ma50' }, bar(98, 99, 97, 98), 100, 2)).toEqual({ kind: 'exit', price: 98, reason: 'ma50' });
  });
});

describe('evaluateHolding', () => {
  it('손절가 아래 또는 50일선 아래면 매도 신호', () => {
    const down = uptrend().map((b, i, all) => (i === all.length - 1 ? { ...b, close: 40 } : b));
    expect(evaluateHolding({ bars: down, stopPrice: 45 })!.reason).toBe('stop');
    expect(evaluateHolding({ bars: down, stopPrice: null })!.reason).toBe('ma50');
    expect(evaluateHolding({ bars: uptrend(), stopPrice: null })).toBeNull();
  });
});
