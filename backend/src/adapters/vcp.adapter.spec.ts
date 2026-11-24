import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Bar, triggerPrice, vcpActive } from '../ai/strategy.js';
import { adaptVcp } from './vcp.adapter.js';

const fixture = JSON.parse(readFileSync(join(__dirname, '../../test/fixtures/skills/vcp-screener.json'), 'utf8')) as unknown;

describe('adaptVcp', () => {
  it('2026-11-23 실제 출력(vcp_local.py): 피벗·손절가·상태', () => {
    const map = adaptVcp(fixture);
    const aapl = map.get('AAPL')!;
    expect(aapl).toMatchObject({ valid: false, state: 'Pre-breakout', pivot: 351.73, stop: 322.08, contractions: 1 });
    // 수축이 한 번뿐이라 유효한 VCP가 아니다 → 셋업으로 쓰지 않는다
    expect(vcpActive(aapl)).toBe(false);
  });

  it('유효한 돌파 직전 VCP면 조건부 매수가가 피벗 + 1센트', () => {
    const bar: Bar = { date: 'x', open: 99, high: 100, low: 98, close: 99.5, volume: 1 };
    const vcp = { valid: true, state: 'Pre-breakout', rating: 'Good VCP', score: 75, pivot: 103, stop: 95, contractions: 3, distancePct: -3.4 };
    expect(triggerPrice(bar, vcp)).toBe(103.01);
    expect(triggerPrice(bar, { ...vcp, valid: false })).toBe(100.01);
  });

  it('빈 출력이나 이상한 줄은 건너뛴다', () => {
    expect(adaptVcp(null).size).toBe(0);
    expect(adaptVcp({ results: [{ symbol: 'X' }, null] }).size).toBe(0);
  });
});
