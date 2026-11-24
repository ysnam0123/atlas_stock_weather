import type { Bar } from './strategy.js';
import { ema, evaluateBuyV2, riskPctV2, RULES_V2, sizePositionV2, stepPositionV2 } from './strategy-v2.js';

/** 꾸준히 오르는 일봉 (마지막 날 거래량 배수 조절) */
function uptrend(n = 260, slope = 0.3, lastVolumeMult = 2): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 50 + i * slope;
    return { date: `d${i}`, open: close - 0.2, high: close + 0.5, low: close - 0.5, close, volume: i === n - 1 ? 1_000_000 * lastVolumeMult : 1_000_000 };
  });
}
const spyFlat = uptrend(260, 0.01, 1);

describe('evaluateBuyV2', () => {
  it('추세 템플릿·상대 강도·거래량을 다 통과하고 맑으면 매수, 손절은 최대 −8%', () => {
    const e = evaluateBuyV2({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(), benchmark: spyFlat, condition: 'clear', daysToEarnings: null });
    expect(e.checks.filter((c) => !c.pass)).toEqual([]);
    expect(e.verdict).toBe('buy');
    expect(e.targetPrice).toBeNull();
    expect(e.stopPrice!).toBeGreaterThanOrEqual(e.closePrice * (1 - RULES_V2.maxLossPct) - 0.01);
  });

  it('S&P 500보다 약하면 관찰', () => {
    const strongSpy = uptrend(260, 2, 1);
    const e = evaluateBuyV2({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(), benchmark: strongSpy, condition: 'clear', daysToEarnings: null });
    expect(e.verdict).toBe('watch');
    expect(e.reasonKo).toContain('S&P 500보다 강함');
  });

  it('실적 발표가 임박하면 관찰, 거래량 1.5배 미만도 관찰', () => {
    expect(
      evaluateBuyV2({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(), benchmark: spyFlat, condition: 'clear', daysToEarnings: 3 }).verdict,
    ).toBe('watch');
    expect(
      evaluateBuyV2({ setups: ['breakout_20d'], rsi: 60, bars: uptrend(260, 0.3, 1.3), benchmark: spyFlat, condition: 'clear', daysToEarnings: null }).verdict,
    ).toBe('watch');
  });

  it('시장이 비면 보류', () => {
    expect(
      evaluateBuyV2({ setups: ['bull_flag'], rsi: 60, bars: uptrend(), benchmark: spyFlat, condition: 'rain', daysToEarnings: null }).verdict,
    ).toBe('hold');
  });
});

describe('stepPositionV2', () => {
  const base = { entryPrice: 100, stopPrice: 92, initialStop: 92, breakeven: false, pendingExit: null };
  const bar = (o: number, h: number, l: number, c: number): Bar => ({ date: 'x', open: o, high: h, low: l, close: c, volume: 1 });

  it('+1R(108) 넘으면 손절가를 본전으로', () => {
    expect(stepPositionV2(base, bar(105, 109, 104, 108.5), { ma50: 90, ema21: 100 }, 3)).toEqual({ kind: 'breakeven', stop: 100 });
  });

  it('본전 보호 뒤에는 목표 없이 21일 지수선 이탈에 판다', () => {
    const be = { ...base, stopPrice: 100, breakeven: true };
    expect(stepPositionV2(be, bar(130, 140, 129, 139), { ma50: 110, ema21: 125 }, 30)).toEqual({ kind: 'hold' });
    expect(stepPositionV2(be, bar(126, 127, 120, 121), { ma50: 110, ema21: 125 }, 31)).toEqual({ kind: 'pending', reason: 'ema21' });
    // 본전 아래로 빠지면 본전에 손절
    expect(stepPositionV2(be, bar(103, 104, 99, 101), { ma50: 90, ema21: 95 }, 32)).toEqual({ kind: 'exit', price: 100, reason: 'stop' });
  });

  it('+1R 전에는 50일선·시간 손절', () => {
    expect(stepPositionV2(base, bar(100, 101, 97, 98), { ma50: 99, ema21: 99 }, 2)).toEqual({ kind: 'pending', reason: 'ma50' });
    expect(stepPositionV2(base, bar(100, 102, 99, 101), { ma50: 95, ema21: 99 }, RULES_V2.timeStopDays)).toEqual({ kind: 'pending', reason: 'time' });
  });
});

describe('위험·수량', () => {
  it('3번 연속 손절이면 위험 0.5%', () => {
    expect(riskPctV2(['stop', 'stop', 'stop', 'ema21'])).toBe(0.005);
    expect(riskPctV2(['stop', 'ema21', 'stop'])).toBe(0.01);
  });

  it('수량은 위험·종목 상한·현금 중 작은 값', () => {
    expect(sizePositionV2({ equity: 10_000, cash: 10_000, entry: 100, stop: 92, riskPct: 0.01 })).toBe(12);
    expect(sizePositionV2({ equity: 10_000, cash: 10_000, entry: 100, stop: 92, riskPct: 0.005 })).toBe(6);
  });

  it('ema', () => {
    expect(ema(Array.from({ length: 50 }, () => 10), 21)).toBeCloseTo(10);
    expect(ema([1, 2, 3], 21)).toBeNull();
  });
});
