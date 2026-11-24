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
  intel: { news: HomeIntelNews[]; congressFlows: HomeCongressFlow[] };
  /** 어젯밤 미국장이 휴장이었거나, 화면의 장이 조기 폐장(오후 1시)이었으면. date는 뉴욕 날짜 */
  sessionNote: { kind: 'holiday' | 'early'; date: string; name: string } | null;
  /** 오늘 밤 프리마켓 (21:30 KST 한 번, 12시간 동안만). 실시간 아님 */
  premarket: HomePremarket | null;
  /** 최근 5거래일 정리 (주말 홈) */
  week: HomeWeek | null;
  nextRunAt: string | null;
}

export interface HomePremarket {
  /** 오늘 밤 열릴 뉴욕 장 날짜 */
  sessionDate: string;
  takenAt: string;
  items: {
    symbol: string;
    nameEn: string;
    nameKo: string | null;
    tracked: 'index' | 'holding' | 'watch';
    price: number;
    prevClose: number;
    changePct: number;
    /** 프리마켓 마지막 체결 시각 */
    priceAt: string;
    stopPrice: number | null;
    /** 보유 종목이 프리마켓에서 손절가 아래에 거래되는 중 */
    belowStop: boolean;
  }[];
}

export interface HomeWeek {
  from: string;
  to: string;
  days: { date: string; condition: MarketCondition | null }[];
  /** S&P 500(SPY) 5거래일 수익률 (%) */
  spyPct: number | null;
  /** 상승추세 비율이 가장 많이 오른·내린 섹터 (비율 차이) */
  best: { sector: string; change: number } | null;
  worst: { sector: string; change: number } | null;
  my: { buys: number; sells: number; realizedPnl: number };
  ai: { opened: number; closed: number; realizedPnl: number };
}

// ── Phase 6: 종목 상세 ──────────────────────────────

export interface PriceBarRow {
  /** 뉴욕 장 날짜 */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockDetail {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  type: SymbolType;
  exchange: string;
  lastClose: number | null;
  lastDate: string | null;
  changePct: number | null;
  /** 오래된 순 최대 2년 */
  bars: PriceBarRow[];
  holding: { shares: number; avgCost: number; stopPrice: number | null; targetPrice: number | null; openedAt: string } | null;
  watching: boolean;
  /** AI v2 매수 규칙으로 본 지금 상태 (일봉 30개 미만이면 null) */
  readiness: WatchReadiness | null;
  /** 이 종목의 최근 AI 신호 (두 계좌) */
  signals: {
    date: string;
    version: AiRuleVersion;
    side: 'buy' | 'sell';
    verdict: AiSignal['verdict'];
    status: AiSignal['status'];
    triggerPrice: number | null;
    stopPrice: number | null;
    targetPrice: number | null;
    reasonKo: string;
    note: string | null;
  }[];
  aiPositions: {
    version: AiRuleVersion;
    status: 'open' | 'closed';
    shares: number;
    entryDate: string;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number | null;
    exitDate: string | null;
    exitPrice: number | null;
    exitReason: string | null;
  }[];
  trades: { id: string; date: string; side: 'buy' | 'sell'; shares: number; price: number; realizedPnl: number | null }[];
}

/** 깊게 분석 (버튼을 누를 때만 Claude). 숫자는 스크립트 계산값, Claude는 설명만 */
export interface StockReport {
  id: string;
  symbol: string;
  status: 'running' | 'success' | 'failed';
  createdAt: string;
  finishedAt: string | null;
  /** 분석에 쓴 장 날짜 */
  asOf: string | null;
  /** 웹 검색 포함 여부 */
  web: boolean;
  /** 스크립트가 계산한 지지·저항 (종가 위가 저항) */
  levels: { price: number; kind: 'support' | 'resistance'; touches: number; lastDate: string }[];
  output: {
    headline: string;
    business: string[];
    growth: string[];
    valuation: string[];
    chart: string[];
    risks: string[];
    watch: string[];
    sources: { title: string; url: string }[];
  } | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

// ── Phase 7: 섹터 지도 ──────────────────────────────

/** leading 높고 오르는 중, weakening 높지만 내리는 중, improving 낮지만 오르는 중, lagging 낮고 내리는 중 */
export type SectorPhase = 'leading' | 'weakening' | 'improving' | 'lagging';

export interface SectorRow {
  sector: string;
  rank: number;
  /** 섹터 안 종목 중 상승추세인 비율 (0~1) */
  uptrendRatio: number;
  /** 비율 차이 (0.03 = 3%p). 이력이 모자라면 null */
  change1w: number | null;
  change1m: number | null;
  /** 1개월 전 순위 */
  rank1m: number | null;
  trend: string | null;
  status: string | null;
  /** 최근 1년 가운데값 */
  median1y: number | null;
  /** SectorsResponse.dates와 같은 길이, 빠진 날은 null */
  history: (number | null)[];
  /** 대표 섹터 ETF 수익률 (0.05 = 5%). rs3m은 3개월 수익률 − S&P 500 3개월 수익률 */
  etf: { symbol: string; close: number; w1: number | null; m1: number | null; m3: number | null; rs3m: number | null } | null;
  phase: SectorPhase;
}

export interface SectorsResponse {
  tradeDate: string | null;
  /** 오래된 날부터 최근 1년 */
  dates: string[];
  spy: { w1: number | null; m1: number | null; m3: number | null } | null;
  /** 순위 순 */
  sectors: SectorRow[];
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

/** 규칙으로 계산한 수량 (position-sizer 고정 비율 방식) */
export interface PositionSize {
  shares: number;
  /** 조건부 매수가 × 수량 */
  amount: number;
  /** 손절되면 잃는 돈 */
  risk: number;
}

/** 관심 종목이 왜 매수 대기인지: AI v2 매수 규칙 체크리스트 (docs/ai-duel.md) */
export interface WatchReadiness {
  /** 판단한 장 날짜 (뉴욕) */
  date: string;
  /** buy 모두 통과, hold 종목은 통과했지만 시장이 맑지 않음, watch 종목 조건에서 걸림 */
  verdict: 'buy' | 'hold' | 'watch';
  checks: AiCheck[];
  reasonKo: string;
  /** 조건부 매수가와 규칙상 손절가 */
  triggerPrice: number;
  stopPrice: number | null;
  /** 내 총 투자금 기준 수량 */
  mySize: PositionSize | null;
  /** vcp-screener 결과. 스캔에 없었으면 null */
  vcp: {
    valid: boolean;
    /** Pre-breakout | Breakout | Extended … */
    state: string;
    rating: string;
    pivot: number;
    /** 종가가 피벗에서 몇 % (음수면 아래) */
    distancePct: number;
    contractions: number;
  } | null;
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
  /** buy: 조건부 매수 | hold: 시장 때문에 보류 | watch: 셋업 약함 | sell: 매도 신호 */
  verdict: 'buy' | 'hold' | 'watch' | 'sell';
  /** planned(주문 대기) → filled | expired(3거래일 안에 못 넘음) | skipped, held, watch, done(매도 신호) */
  status: 'planned' | 'filled' | 'expired' | 'skipped' | 'held' | 'watch' | 'done';
  checks: AiCheck[];
  closePrice: number;
  /** 조건부 매수가: 이 가격을 넘으면 산다 (신호 날 고가 + 1센트). 예전 신호는 null */
  triggerPrice: number | null;
  /** 내 총 투자금으로 같은 규칙(위험 1%, 종목당 20%)을 적용한 수량. 총 투자금이 없으면 null */
  mySize: PositionSize | null;
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

/** 서로 다른 의원 3명 이상이 30일 안에 한쪽으로 거래한 내 종목 (반대쪽은 1명 이하) */
export interface HomeCongressFlow {
  symbol: string;
  nameEn: string;
  nameKo: string | null;
  tracked: 'holding' | 'watch';
  side: 'buy' | 'sell';
  /** 산 의원 수, 판 의원 수 (사람 수) */
  buyers: number;
  sellers: number;
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
