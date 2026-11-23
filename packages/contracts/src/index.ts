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
  /** Claude 해설 (Phase 4). 아직 없거나 실패했으면 null */
  commentary: { headline: string; summary: string[]; why: string[] } | null;
  /** FMP 키로 붙는 판정 입력. 스킬이 실패했거나 키가 없으면 null */
  topRiskScore: number | null;
  topRiskZone: string | null;
  regime: string | null;
  ftdState: string | null;
  analyzedAt: string;
}

export interface HomeEarnings {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  /** 미국 날짜 YYYY-MM-DD (발표 시각은 무료 데이터에 없다) */
  date: string;
  tracked: 'holding' | 'watch' | 'ai';
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
  /** 내 보유·관심·AI 보유 종목의 다가오는 실적 발표 */
  earnings: HomeEarnings[];
  nextRunAt: string | null;
}

// ── Phase 2: 종목 검색, 내 종목, 손절가 ──────────────────────────────

export type SymbolType = 'stock' | 'etf';

export interface SymbolHit {
  symbol: string;
  exchange: string;
  nameEn: string;
  nameKo: string | null;
  type: SymbolType;
  /** 이미 내 종목에 있으면 어느 쪽인지 */
  tracked: 'holding' | 'watch' | null;
}

interface PriceFields {
  /** 최근 정규장 종가와 그 장 날짜(뉴욕). 일봉을 아직 못 받았으면 null */
  lastClose: number | null;
  lastDate: string | null;
  changePct: number | null;
}

export interface MyHolding extends PriceFields {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  type: SymbolType;
  exchange: string;
  shares: number;
  avgCost: number;
  stopPrice: number | null;
  stopMethod: StopMethod | 'manual' | null;
  targetPrice: number | null;
  note: string | null;
  /** 종가가 손절가보다 몇 % 위인지. 0 이하면 손절가 아래로 마감 */
  stopDistancePct: number | null;
  pnlPct: number | null;
  pnl: number | null;
  marketValue: number | null;
  /** 종가에서 손절가까지 떨어지면 잃는 돈. 손절가가 없으면 null */
  openRisk: number | null;
  openedAt: string;
  daysHeld: number;
}

export interface MyWatchItem extends PriceFields {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  type: SymbolType;
  exchange: string;
  note: string | null;
  addedAt: string;
}

export interface MySummary {
  marketValue: number;
  costBasis: number;
  openRisk: number;
  noStopCount: number;
  /** 총 투자금 대비 주식 비중 (%). 총 투자금을 넣지 않았으면 null */
  exposurePct: number | null;
}

export interface MyResponse {
  /** 총 투자금 (달러). 설정하지 않았으면 null */
  capital: number | null;
  summary: MySummary;
  holdings: MyHolding[];
  watchlist: MyWatchItem[];
}

export type StopMethod = 'percent' | 'atr' | 'support';

export interface StopOption {
  method: StopMethod;
  stopPrice: number | null;
  lossPct: number | null;
  maxLoss: number | null;
  basis: string;
}

export interface StopOptionsResponse {
  symbol: string;
  avgCost: number;
  shares: number | null;
  lastClose: number | null;
  lastDate: string | null;
  options: StopOption[];
}

export interface HoldingInput {
  /** 산 날짜 YYYY-MM-DD */
  openedAt?: string | null;
  shares: number;
  avgCost: number;
  stopPrice: number | null;
  stopMethod: StopMethod | 'manual' | null;
  targetPrice: number | null;
  note: string | null;
}

// ── AI 대결 (AI 모의 계좌 vs 내 매매 기록) ──────────────────────────────

export interface AiCheck {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface AiSignal {
  id: string;
  /** 신호가 나온 장 날짜 (그날 종가 기준) */
  date: string;
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  side: 'buy' | 'sell';
  setups: string[];
  setupLabels: string[];
  /** buy: 다음 거래일 시가 매수 | hold: 시장 때문에 보류 | watch: 셋업 약함 | sell: 매도 신호 */
  verdict: 'buy' | 'hold' | 'watch' | 'sell';
  /** planned → filled | skipped, held, watch, done(매도 신호) */
  status: 'planned' | 'filled' | 'skipped' | 'held' | 'watch' | 'done';
  checks: AiCheck[];
  closePrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  shares: number | null;
  riskAmount: number | null;
  reasonKo: string;
  /** 줄바꿈으로 나뉜 매도 규칙 */
  exitPlanKo: string | null;
  /** Claude 한 줄 해설. 판단은 규칙 결과 그대로이고 말로 옮기기만 한다 */
  commentKo: string | null;
  note: string | null;
  lastClose: number | null;
}

export interface AiScore {
  startCapital: number;
  equity: number;
  returnPct: number;
  realizedPnl: number;
  trades: number;
  winRate: number | null;
  maxDrawdownPct: number | null;
  openPositions: number;
}

export interface AiPositionRow {
  id: string;
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  shares: number;
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  lastClose: number | null;
  pnl: number | null;
  pnlPct: number | null;
  /** 다음 날 시가에 팔 예정이면 그 이유 (ma50 | time) */
  pendingExit: string | null;
}

export interface AiClosedRow {
  id: string;
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  shares: number;
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  exitReason: string | null;
  pnl: number | null;
  pnlPct: number | null;
}

export interface AiDuelResponse {
  account: { id: string; startCapital: number; cash: number; startedAt: string; lastProcessedDate: string | null } | null;
  /** 내 총 투자금. 없으면 내 성적을 잴 수 없다 */
  capital: number | null;
  score: { ai: AiScore; me: AiScore | null; benchmarkPct: number | null } | null;
  /** 대결 시작 = 0%. 날짜별 수익률 */
  series: { date: string; ai: number | null; me: number | null; spy: number | null }[];
  positions: AiPositionRow[];
  closed: AiClosedRow[];
  signals: AiSignal[];
  lastRun: { status: RunStatus; startedAt: string; finishedAt: string | null; error: string | null } | null;
}

export interface TradeRow {
  id: string;
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  side: 'buy' | 'sell';
  date: string;
  price: number;
  shares: number;
  realizedPnl: number | null;
  note: string | null;
}

export interface TradeInput {
  symbol: string;
  side: 'buy' | 'sell';
  date: string;
  price: number;
  shares: number;
  note: string | null;
}
