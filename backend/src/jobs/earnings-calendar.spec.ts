import { adaptEarnings } from './earnings-calendar.job.js';

describe('adaptEarnings', () => {
  it('날짜·티커가 있는 줄만, 추정치는 숫자일 때만', () => {
    expect(
      adaptEarnings([
        { symbol: 'BILI', date: '2026-11-24', epsEstimated: 0.27, revenueEstimated: 1226094000 },
        { symbol: 'X', date: 'bad' },
        { date: '2026-11-25' },
        { symbol: 'NVDA', date: '2026-11-25', epsEstimated: null },
      ]),
    ).toEqual([
      { symbol: 'BILI', date: '2026-11-24', epsEstimated: 0.27, revenueEstimated: 1226094000 },
      { symbol: 'NVDA', date: '2026-11-25', epsEstimated: null, revenueEstimated: null },
    ]);
    expect(adaptEarnings({ error: 'x' })).toEqual([]);
  });
});
