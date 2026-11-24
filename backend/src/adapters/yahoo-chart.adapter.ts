// Yahoo Finance 차트 응답 → 정규장 일봉. 공식 API가 아니라 실패하면 그 종목만 건너뛴다 (docs/skills.md).

/** 2년: VCP 스크리너가 253거래일 넘게, v2가 200일선의 한 달 전 값까지 본다 */
export const yahooChartUrl = (ticker: string, range = '2y') =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;

export interface Bar {
  date: string; // 뉴욕 장 날짜 YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartResult {
  meta?: { gmtoffset?: number; currentTradingPeriod?: { regular?: { start?: number; end?: number } } };
  timestamp?: number[];
  indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
}

/**
 * 값이 빠진 날은 버리고, 장이 아직 끝나지 않은 오늘 봉도 버린다.
 * 화면 가격은 정규장 종가 기준이라 미완성 봉을 저장하면 안 된다 (절대 규칙 6).
 */
export function adaptYahooChart(json: unknown, now: Date = new Date()): Bar[] {
  const result = (json as { chart?: { result?: ChartResult[] } })?.chart?.result?.[0];
  const ts = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!ts || !q) return [];

  const offset = result.meta?.gmtoffset ?? 0;
  const regular = result.meta?.currentTradingPeriod?.regular;
  const sessionOpen = regular?.start != null && regular.end != null && now.getTime() < regular.end * 1000;

  const bars: Bar[] = [];
  ts.forEach((t, i) => {
    const [open, high, low, close, volume] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i], q.volume?.[i]];
    if (open == null || high == null || low == null || close == null) return;
    if (sessionOpen && t >= regular!.start!) return;
    bars.push({
      date: new Date((t + offset) * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    });
  });
  return bars;
}
