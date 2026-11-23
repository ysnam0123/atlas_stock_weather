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
  exposureScore: number | null;
  exposureConfidence: string | null;
  exposureMissing: string[] | null;
  breadthComponents: { key: string; score: number }[] | null;
  uptrendPercentile: number | null;
  uptrendMedian: number | null;
  topRiskScore: number | null;
  topRiskZone: string | null;
  regime: string | null;
  ftdState: string | null;
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
  topRisk?: unknown;
  regime?: unknown;
  ftd?: unknown;
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
    exposureScore: num(get(raw.exposure, 'composite_score')),
    exposureConfidence: str(get(raw.exposure, 'confidence')),
    exposureMissing: strings(get(raw.exposure, 'inputs_missing')),
    breadthComponents: breadthComponents(get(raw.breadth, 'components')),
    uptrendPercentile: num(get(raw.uptrend, 'components', 'historical_context', 'percentile')),
    uptrendMedian: num(get(raw.uptrend, 'components', 'historical_context', 'historical_median')),
    topRiskScore: num(get(raw.topRisk, 'composite', 'composite_score')),
    topRiskZone: str(get(raw.topRisk, 'composite', 'zone')),
    regime: str(get(raw.regime, 'regime', 'current_regime')),
    ftdState: str(get(raw.ftd, 'market_state', 'combined_state')),
  };
}

/** 시장 점수를 이루는 항목별 점수. 순서는 스킬 출력 순서(가중치 큰 것부터) */
function breadthComponents(raw: unknown): { key: string; score: number }[] | null {
  if (raw === null || typeof raw !== 'object') return null;
  const rows = Object.entries(raw as Record<string, unknown>).flatMap(([key, v]) => {
    const score = num(get(v, 'score'));
    return score === null || get(v, 'data_available') === false ? [] : [{ key, score }];
  });
  return rows.length ? rows : null;
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

function strings(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
