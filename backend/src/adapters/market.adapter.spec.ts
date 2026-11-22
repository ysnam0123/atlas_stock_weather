import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptMarket, adaptSectors, pickTradeDate } from './market.adapter.js';

// 2026-11-22에 실제로 돌린 스킬 출력 (거래일 2026-11-20)
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '../../test/fixtures/skills', `${name}.json`), 'utf8'));

const breadth = fixture('market-breadth-analyzer');
const uptrend = fixture('uptrend-analyzer');
const sector = fixture('sector-analyst');
const exposure = fixture('exposure-coach');

describe('adaptMarket', () => {
  it('네 스킬 출력에서 시장 값을 뽑는다', () => {
    expect(adaptMarket({ breadth, uptrend, exposure })).toEqual({
      marketScore: 33.5,
      breadthZone: 'Weakening',
      uptrendRatio: expect.closeTo(0.0688, 4),
      uptrendScore: 22.4,
      uptrendZone: 'Cautious',
      exposureCeiling: 2,
      recommendation: 'CASH_PRIORITY',
      condition: 'rain',
      exposureScore: 4,
      exposureConfidence: 'LOW',
      exposureMissing: ['regime', 'top_risk', 'institutional', 'theme', 'ftd'],
      breadthComponents: [
        { key: 'breadth_level_trend', score: 52 },
        { key: 'ma_crossover', score: 35 },
        { key: 'cycle_position', score: 15 },
        { key: 'bearish_signal', score: 25 },
        { key: 'historical_percentile', score: 30 },
        { key: 'divergence', score: 38 },
      ],
      uptrendPercentile: 2.7,
      uptrendMedian: 0.233,
    });
  });

  it('스킬이 실패해 입력이 없으면 해당 값만 null', () => {
    const fields = adaptMarket({ breadth });
    expect(fields.marketScore).toBe(33.5);
    expect(fields.uptrendRatio).toBeNull();
    expect(fields.condition).toBeNull();
  });

  it('recommendation을 날씨로 바꾼다', () => {
    expect(adaptMarket({ exposure: { recommendation: 'NEW_ENTRY_ALLOWED' } }).condition).toBe('clear');
    expect(adaptMarket({ exposure: { recommendation: 'REDUCE_ONLY' } }).condition).toBe('cloudy');
    expect(adaptMarket({ exposure: { recommendation: 'SOMETHING_NEW' } }).condition).toBeNull();
  });
});

describe('adaptSectors', () => {
  it('11개 섹터를 순위대로 뽑는다', () => {
    const rows = adaptSectors(sector);
    expect(rows).toHaveLength(11);
    expect(rows[0]).toMatchObject({ rank: 1, sector: 'Healthcare', trend: 'Down', status: 'Normal' });
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('형식이 다르면 빈 배열', () => {
    expect(adaptSectors(undefined)).toEqual([]);
    expect(adaptSectors({ ranking: [{ sector: 'X' }] })).toEqual([]);
  });
});

describe('pickTradeDate', () => {
  it('실행일이 아니라 데이터 거래일을 쓴다', () => {
    expect(pickTradeDate({ breadth, uptrend, sector })).toBe('2026-11-20');
  });

  it('앞 스킬이 실패하면 다음 스킬에서 찾는다', () => {
    expect(pickTradeDate({ sector })).toBe('2026-11-20');
    expect(pickTradeDate({})).toBeNull();
  });
});
