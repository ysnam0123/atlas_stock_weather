import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptSectors } from './market.adapter.js';
import { adaptUptrendTimeseries } from './uptrend-history.adapter.js';

// 실제 CSV에서 2026-11-19, 11-20 두 날과 산업별 한 줄을 뽑은 샘플
const csv = readFileSync(
  join(__dirname, '../../test/fixtures/uptrend_ratio_timeseries.sample.csv'),
  'utf8',
);

describe('adaptUptrendTimeseries', () => {
  const history = adaptUptrendTimeseries(csv);

  it('전체 시장 비율을 날짜순으로 뽑는다', () => {
    expect(history.market.map((m) => m.date)).toEqual(['2026-11-19', '2026-11-20']);
    expect(history.market[1].uptrendRatio).toBeCloseTo(0.06877, 5);
  });

  it('섹터 순위가 sector-analyst 스킬 출력과 같다', () => {
    const skill = JSON.parse(
      readFileSync(join(__dirname, '../../test/fixtures/skills/sector-analyst.json'), 'utf8'),
    ) as unknown;
    const fromSkill = adaptSectors(skill).map((r) => [r.rank, r.sector, r.trend]);
    const day = history.sectors.find((s) => s.date === '2026-11-20');
    // 비율이 같은 섹터(Energy·Basic Materials 0%)는 순서가 갈릴 수 있어 상위 9개만 비교
    expect(day?.rows.map((r) => [r.rank, r.sector, r.trend]).slice(0, 9)).toEqual(fromSkill.slice(0, 9));
  });

  it('산업별(ind_*) 줄은 건너뛴다', () => {
    const all = history.sectors.flatMap((s) => s.rows.map((r) => r.sector));
    expect(all).not.toContain('Steel');
    expect(history.sectors.every((s) => s.rows.length === 11)).toBe(true);
  });

  it('11개가 다 없는 날은 섹터 순위를 만들지 않는다', () => {
    const partial = 'worksheet,date,count,total,ratio,ma_10,slope,trend\nsec_energy,2024-01-02,1,10,0.1,,,up\n';
    expect(adaptUptrendTimeseries(partial).sectors).toEqual([]);
  });

  it('헤더가 다르면 멈춘다', () => {
    expect(() => adaptUptrendTimeseries('a,b,c\n1,2,3')).toThrow('예상과 다른 CSV 헤더');
  });
});
