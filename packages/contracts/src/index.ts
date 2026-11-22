export type MarketCondition = 'clear' | 'cloudy' | 'rain';

export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

/** 날짜만 있는 값은 'YYYY-MM-DD'(뉴욕 장 날짜), 시각은 ISO 문자열(UTC). 화면에서 KST로 바꾼다 */
export interface HomeWeather {
  tradeDate: string;
  /** 스킬이 실패한 값은 null. 화면은 그 자리만 "데이터 없음" */
  condition: MarketCondition | null;
  exposureCeiling: number | null;
  recommendation: string | null;
  summaryKo: string | null;
  score: number | null;
  scoreZone: string | null;
  /** 점수가 있는 직전 거래일. 시장 점수는 과거를 메울 수 없어 처음엔 없다 */
  prevScore: { tradeDate: string; score: number } | null;
  uptrendRatio: number | null;
  prevUptrendRatio: number | null;
  /** 상승추세 비율의 과거 대비 위치 (0~100, 2023-08 이후) */
  uptrendPercentile: number | null;
  uptrendMedian: number | null;
  /** exposure-coach 판정 점수. 30 미만 비, 50 미만 흐림, 그 이상 맑음 */
  exposureScore: number | null;
  exposureConfidence: string | null;
  /** 판정에 빠진 입력. regime·top_risk는 FMP 키가 있어야 채울 수 있다 */
  exposureMissing: string[];
  /** 시장 점수를 이루는 6개 항목 (0~100, 높을수록 건강) */
  breadthComponents: { key: string; score: number }[] | null;
  analyzedAt: string;
}

export interface HomeSector {
  sector: string;
  rank: number;
  uptrendRatio: number;
  prevRank: number | null;
  prevUptrendRatio: number | null;
  trend: string | null;
}

export interface HomeHistoryPoint {
  date: string;
  uptrendRatio: number | null;
  score: number | null;
}

export interface HomeSectorHistory {
  dates: string[];
  /** 마지막 날 순위 순. ranks·ratios는 dates와 같은 길이, 빠진 날은 null */
  sectors: { sector: string; ranks: (number | null)[]; ratios: (number | null)[] }[];
}

export interface HomeResponse {
  market: 'us' | 'kr';
  weather: HomeWeather | null;
  /** 오래된 날부터 최근 1년 */
  history: HomeHistoryPoint[];
  /** 11개 섹터 전부, 순위 순 */
  sectors: { tradeDate: string; items: HomeSector[] } | null;
  sectorHistory: HomeSectorHistory | null;
  run: { status: RunStatus; startedAt: string; finishedAt: string | null } | null;
  nextRunAt: string | null;
}
