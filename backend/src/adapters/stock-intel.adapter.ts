// Phase 3 종목 소식 스킬 출력 → 테이블 값. trader-news(뉴스·8-K), trader-analyst(분기 실적), trader-pelosi(의원 거래).

export interface NewsRow {
  id: string;
  symbol: string;
  kind: string;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: Date;
  tags: string[];
}

/** 회사 이름에서 법인 꼬리말을 떼어 제목 검색에 쓴다 ("NVIDIA Corporation" → "nvidia") */
export function coreName(nameEn: string): string {
  return nameEn
    .replace(/[,.]/g, ' ')
    .replace(/\b(inc|incorporated|corporation|corp|co|company|ltd|limited|plc|holdings?|group|sa|ag|nv|the|class [a-z]|common stock)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 야후 헤드라인 피드는 티커와 상관없는 기사가 많이 섞인다 (NVDA 피드에 인텔·맥도날드 기사).
 * 제목에 티커나 회사 이름이 나오는 기사와 SEC 공시만 남긴다.
 */
export function isRelevant(title: string, symbol: string, nameEn: string | undefined): boolean {
  if (new RegExp(`(^|[^A-Za-z])\\$?${symbol.replace('.', '\\.')}([^A-Za-z]|$)`).test(title)) return true;
  const core = nameEn ? coreName(nameEn) : '';
  return core.length >= 3 && title.toLowerCase().includes(core);
}

interface RawNews {
  id?: string;
  source?: string;
  kind?: string;
  ticker?: string;
  title?: string;
  summary?: string | null;
  link?: string;
  time?: string;
  tags?: string[];
}

export function adaptNews(json: unknown, names: Map<string, string>): NewsRow[] {
  const items = (json as { items?: RawNews[] })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((x) => {
    if (!x.id || !x.ticker || !x.title || !x.link || !x.time) return [];
    const publishedAt = new Date(x.time);
    if (Number.isNaN(publishedAt.getTime())) return [];
    const kind = x.kind === 'headline' ? 'headline' : 'sec';
    if (kind === 'headline' && !isRelevant(x.title, x.ticker, names.get(x.ticker))) return [];
    return [
      {
        id: x.id,
        symbol: x.ticker,
        kind,
        source: x.source ?? (kind === 'sec' ? 'SEC' : 'Yahoo Finance'),
        title: x.title,
        summary: x.summary ?? null,
        url: x.link,
        publishedAt,
        tags: Array.isArray(x.tags) ? x.tags : [],
      },
    ];
  });
}

export interface FactRow {
  symbol: string;
  periodEnd: Date;
  fiscal: string;
  derived: boolean;
  revenue: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueYoy: number | null;
  epsYoy: number | null;
  form: string | null;
  filed: Date | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);

export function adaptFacts(json: unknown): FactRow[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((c: { ticker?: string; result?: { rows?: Record<string, unknown>[] } }) => {
    if (!c.ticker || !Array.isArray(c.result?.rows)) return [];
    return c.result.rows.flatMap((r) => {
      const periodEnd = date(r.end);
      if (!periodEnd) return [];
      return [
        {
          symbol: c.ticker!,
          periodEnd,
          fiscal: typeof r.fiscal === 'string' ? r.fiscal : '',
          derived: r.derived === true,
          revenue: num(r.revenue),
          netIncome: num(r.net_income),
          epsDiluted: num(r.eps_diluted),
          grossMargin: num(r.gross_margin),
          operatingMargin: num(r.operating_margin),
          netMargin: num(r.net_margin),
          revenueYoy: num(r.revenue_yoy),
          epsYoy: num(r.eps_yoy),
          form: typeof r.form === 'string' ? r.form : null,
          filed: date(r.filed),
        },
      ];
    });
  });
}

export interface PtrRow {
  ticker: string | null;
  asset: string;
  type: string;
  typeName: string;
  tradeDate: Date | null;
  amount: string;
  amountLow: number | null;
  amountHigh: number | null;
  owner: string | null;
}

export function adaptPtr(json: unknown): PtrRow[] {
  const rows = (json as { rows?: Record<string, unknown>[] })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (typeof r.asset !== 'string' || typeof r.type !== 'string') return [];
    return [
      {
        ticker: typeof r.ticker === 'string' && r.ticker ? r.ticker.toUpperCase() : null,
        asset: r.asset,
        type: r.type,
        typeName: typeof r.type_name === 'string' ? r.type_name : r.type,
        tradeDate: date(r.date),
        amount: typeof r.amount === 'string' ? r.amount : '',
        amountLow: num(r.amount_low),
        amountHigh: num(r.amount_high),
        owner: typeof r.owner_name === 'string' ? r.owner_name : null,
      },
    ];
  });
}
