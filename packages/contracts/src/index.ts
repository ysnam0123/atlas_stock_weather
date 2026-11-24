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
  /** 내 보유·관심 종목의 중요한 새 소식(3일)과 의원 거래 신고(30일) */
  intel: { news: HomeIntelNews[]; congress: HomeIntelCongress[] };
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
  /** AI v2 매수 규칙으로 본 관심 종목 상태. 스캔·일봉이 없으면 null */
  readiness: WatchReadiness | null;
}

/** 관심 종목이 왜 매수 대기인지: AI v2 매수 규칙 체크리스트 (docs/ai-duel.md) */
export interface WatchReadiness {
  /** 판단한 장 날짜 (뉴욕) */
  date: string;
  /** buy 모두 통과, hold 종목은 통과했지만 시장이 맑지 않음, watch 종목 조건에서 걸림 */
  verdict: 'buy' | 'hold' | 'watch';
  checks: AiCheck[];
  reasonKo: string;
  /** 지금 산다면 규칙상 손절가 */
  stopPrice: number | null;
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
  /** v2는 +1R을 넘으면 본전으로 올라간다 */
  stopPrice: number;
  /** v1 고정 목표가. v2는 목표가 없이 추세 이탈로 판다 */
  targetPrice: number | null;
  breakeven: boolean;
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

export type AiRuleVersion = 'v1' | 'v2';

/** 규칙 버전 하나의 모의 계좌 */
export interface AiAccountView {
  version: AiRuleVersion;
  label: string;
  account: { id: string; startCapital: number; cash: number; startedAt: string; lastProcessedDate: string | null };
  score: AiScore;
  positions: AiPositionRow[];
  closed: AiClosedRow[];
  signals: AiSignal[];
}

export interface AiDuelResponse {
  /** 내 총 투자금. 없으면 내 성적을 잴 수 없다 */
  capital: number | null;
  /** v1, v2 순. 계좌가 없으면 빈 배열 */
  accounts: AiAccountView[];
  me: AiScore | null;
  benchmarkPct: number | null;
  /** 대결 시작 = 0%. 날짜별 수익률 */
  series: { date: string; v1: number | null; v2: number | null; me: number | null; spy: number | null }[];
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

// ── Phase 3 종목 소식 ──────────────────────────────────────────────

export interface HomeIntelNews {
  id: string;
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  tracked: 'holding' | 'watch';
  kind: 'headline' | 'sec';
  /** 한국어 번역이 있으면 번역 */
  title: string;
  url: string;
  publishedAt: string;
}

/** 현직 하원 의원 정보 (공개 데이터). 전직이거나 아직 못 받았으면 null */
export interface CongressMemberInfo {
  /** 공화당, 민주당, 무소속 */
  party: string;
  /** "오하이오 6구" */
  seat: string;
  /** 상임위원회 한국어 이름 */
  committees: string[];
}

export interface HomeIntelCongress {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  tracked: 'holding' | 'watch';
  member: string;
  memberInfo: CongressMemberInfo | null;
  /** P 매수, S 매도, S (partial) 일부 매도, E 교환 */
  type: string;
  amount: string;
  tradeDate: string | null;
  filed: string;
}

export interface StockIntel {
  symbol: string;
  news: {
    id: string;
    kind: 'headline' | 'sec';
    source: string;
    title: string;
    titleKo: string | null;
    importance: 'high' | 'normal' | null;
    url: string;
    publishedAt: string;
  }[];
  earnings: {
    fiscal: string;
    periodEnd: string;
    /** 4분기는 연간 − 3개 분기로 만든 값 */
    derived: boolean;
    revenue: number | null;
    revenueYoy: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    epsDiluted: number | null;
    epsYoy: number | null;
  }[];
  congress: {
    member: string;
    memberInfo: CongressMemberInfo | null;
    type: string;
    typeName: string;
    amount: string;
    tradeDate: string | null;
    filed: string;
    owner: string | null;
  }[];
}
