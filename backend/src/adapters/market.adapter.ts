// 스킬 원본 JSON → 정규화 테이블 값. 스킬 출력 형식이 바뀌면 이 파일만 고친다.
// 필드가 없으면 null로 두고, 화면에서 해당 값만 "데이터 없음"으로 보인다.

export type ConditionValue = 'clear' | 'cloudy' | 'rain';

export interface MarketFields {
  marketScore: number | null;
  breadthZone: string | null;
  uptrendRatio: number | null;
  uptrendScore: number | null;
  uptrendZone: string | null;
  exposureCeiling: number | null;
  recommendation: string | null;
  condition: ConditionValue | null;
}

export interface SectorRow {
  sector: string;
  rank: number;
  uptrendRatio: number;
  trend: string | null;
  slope: number | null;
  status: string | null;
}

/** exposure-coach recommendation → 날씨 */
const CONDITION: Record<string, ConditionValue> = {
  NEW_ENTRY_ALLOWED: 'clear',
  REDUCE_ONLY: 'cloudy',
  CASH_PRIORITY: 'rain',
};

export function adaptMarket(raw: {
  breadth?: unknown;
  uptrend?: unknown;
  exposure?: unknown;
}): MarketFields {
  const recommendation = str(get(raw.exposure, 'recommendation'));
  return {
    marketScore: num(get(raw.breadth, 'composite', 'composite_score')),
    breadthZone: str(get(raw.breadth, 'composite', 'zone')),
    uptrendRatio: num(get(raw.uptrend, 'components', 'market_breadth', 'ratio')),
    uptrendScore: num(get(raw.uptrend, 'composite', 'composite_score')),
    uptrendZone: str(get(raw.uptrend, 'composite', 'zone')),
    exposureCeiling: int(get(raw.exposure, 'exposure_ceiling_pct')),
    recommendation,
    condition: recommendation ? (CONDITION[recommendation] ?? null) : null,
  };
}

export function adaptSectors(raw: unknown): SectorRow[] {
  const ranking = get(raw, 'ranking');
  if (!Array.isArray(ranking)) return [];
  return ranking.flatMap((r: unknown) => {
    const sector = str(get(r, 'sector'));
    const rank = int(get(r, 'rank'));
    const ratio = num(get(r, 'ratio'));
    if (!sector || rank === null || ratio === null) return [];
    return [
      {
        sector,
        rank,
        uptrendRatio: ratio,
        trend: str(get(r, 'trend')),
        slope: num(get(r, 'slope')),
        status: str(get(r, 'status')),
      },
    ];
  });
}

/**
 * 원본 데이터의 거래일(YYYY-MM-DD, 뉴욕 장 날짜).
 * 실행일이 아니라 데이터 날짜로 저장해야 같은 장을 두 번 받아도 한 줄로 합쳐진다.
 */
export function pickTradeDate(raw: {
  breadth?: unknown;
  uptrend?: unknown;
  sector?: unknown;
}): string | null {
  const candidates = [
    get(raw.breadth, 'data_provenance', 'as_of'),
    get(raw.breadth, 'metadata', 'data_freshness', 'latest_date'),
    get(raw.uptrend, 'data_provenance', 'as_of'),
    get(raw.uptrend, 'metadata', 'latest_data_date'),
    get(raw.sector, 'meta', 'freshness', 'date'),
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
  }
  return null;
}

function get(obj: unknown, ...path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
