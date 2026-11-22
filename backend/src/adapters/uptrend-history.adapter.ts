// TraderMonty uptrend_ratio_timeseries.csv → 과거 시장·섹터 상승추세 비율.
// 값은 원본 그대로 쓰고, 섹터 순위만 그날 비율 내림차순으로 매긴다.
import type { SectorRow } from './market.adapter.js';

export const UPTREND_TIMESERIES_URL =
  'https://raw.githubusercontent.com/tradermonty/uptrend-dashboard/main/data/uptrend_ratio_timeseries.csv';

// vendor/claude-trading-skills/skills/uptrend-analyzer/scripts/data_fetcher.py와 같은 매핑
const SECTOR_NAMES: Record<string, string> = {
  sec_basicmaterials: 'Basic Materials',
  sec_communicationservices: 'Communication Services',
  sec_consumercyclical: 'Consumer Cyclical',
  sec_consumerdefensive: 'Consumer Defensive',
  sec_energy: 'Energy',
  sec_financial: 'Financial',
  sec_healthcare: 'Healthcare',
  sec_industrials: 'Industrials',
  sec_realestate: 'Real Estate',
  sec_technology: 'Technology',
  sec_utilities: 'Utilities',
};
const SECTOR_COUNT = Object.keys(SECTOR_NAMES).length;

export interface UptrendHistory {
  market: { date: string; uptrendRatio: number }[];
  /** 11개 섹터가 모두 있는 날만. 빠진 날에 순위를 매기면 왜곡된다. */
  sectors: { date: string; rows: SectorRow[] }[];
  dateRange: [string, string] | null;
}

export function adaptUptrendTimeseries(csv: string): UptrendHistory {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(',');
  const at = (name: string) => cols.indexOf(name);
  const [iSheet, iDate, iRatio, iSlope, iTrend] = ['worksheet', 'date', 'ratio', 'slope', 'trend'].map(at);
  if ([iSheet, iDate, iRatio].some((i) => i < 0)) {
    throw new Error(`예상과 다른 CSV 헤더: ${header}`);
  }

  const market: UptrendHistory['market'] = [];
  const byDate = new Map<string, Omit<SectorRow, 'rank'>[]>();

  for (const line of lines) {
    const f = line.split(',');
    const date = f[iDate];
    const ratio = Number(f[iRatio]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || f[iRatio] === '' || !Number.isFinite(ratio)) continue;

    const sheet = f[iSheet];
    if (sheet === 'all') {
      market.push({ date, uptrendRatio: ratio });
      continue;
    }
    const sector = SECTOR_NAMES[sheet];
    if (!sector) continue; // ind_* 산업별은 아직 저장하지 않는다

    const slope = iSlope >= 0 && f[iSlope] !== '' ? Number(f[iSlope]) : null;
    const trend = iTrend >= 0 && f[iTrend] ? capitalize(f[iTrend]) : null;
    const list = byDate.get(date) ?? [];
    list.push({ sector, uptrendRatio: ratio, trend, slope, status: null });
    byDate.set(date, list);
  }

  const sectors = [...byDate.entries()]
    .filter(([, list]) => list.length === SECTOR_COUNT)
    .map(([date, list]) => ({
      date,
      rows: [...list]
        .sort((a, b) => b.uptrendRatio - a.uptrendRatio)
        .map((r, i) => ({ ...r, rank: i + 1 })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  market.sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...market.map((m) => m.date), ...sectors.map((s) => s.date)].sort();
  return {
    market,
    sectors,
    dateRange: dates.length ? [dates[0], dates[dates.length - 1]] : null,
  };
}

/** 스킬 출력(sector_summary.csv)은 'Up'/'Down' 표기라 맞춘다 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
