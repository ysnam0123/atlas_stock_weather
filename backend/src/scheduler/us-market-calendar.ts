// 미국 정규장(NYSE) 휴장일과 조기 폐장일. pandas-market-calendars(NYSE)에서 뽑아 고정 표로 둔다 (2026-11-24).
// 2028년 뒤로는 표를 다시 뽑아 채운다:
//   uv run --project vendor/claude-trading-skills --extra market-calendar python -c "import pandas_market_calendars as m; ..."

export const US_HOLIDAYS: Record<string, string> = {
  '2025-01-01': '새해',
  '2025-01-09': '카터 전 대통령 장례',
  '2025-01-20': '마틴 루서 킹 데이',
  '2025-02-17': '대통령의 날',
  '2025-04-18': '성금요일',
  '2025-05-26': '메모리얼 데이',
  '2025-06-19': '준틴스',
  '2025-07-04': '독립기념일',
  '2025-09-01': '노동절',
  '2025-11-27': '추수감사절',
  '2025-12-25': '크리스마스',
  '2026-01-01': '새해',
  '2026-01-19': '마틴 루서 킹 데이',
  '2026-02-16': '대통령의 날',
  '2026-04-03': '성금요일',
  '2026-05-25': '메모리얼 데이',
  '2026-06-19': '준틴스',
  '2026-07-03': '독립기념일 대체',
  '2026-09-07': '노동절',
  '2026-11-26': '추수감사절',
  '2026-12-25': '크리스마스',
  '2027-01-01': '새해',
  '2027-01-18': '마틴 루서 킹 데이',
  '2027-02-15': '대통령의 날',
  '2027-03-26': '성금요일',
  '2027-05-31': '메모리얼 데이',
  '2027-06-18': '준틴스 대체',
  '2027-07-05': '독립기념일 대체',
  '2027-09-06': '노동절',
  '2027-11-25': '추수감사절',
  '2027-12-24': '크리스마스 대체',
  '2028-01-17': '마틴 루서 킹 데이',
  '2028-02-21': '대통령의 날',
  '2028-04-14': '성금요일',
  '2028-05-29': '메모리얼 데이',
  '2028-06-19': '준틴스',
  '2028-07-04': '독립기념일',
  '2028-09-04': '노동절',
  '2028-11-23': '추수감사절',
  '2028-12-25': '크리스마스',
};

/** 오후 1시(뉴욕)에 끝나는 날. 거래량이 적어 판정이 흔들릴 수 있다 */
export const US_EARLY_CLOSES = new Set([
  '2025-07-03',
  '2025-11-28',
  '2025-12-24',
  '2026-11-27',
  '2026-12-24',
  '2027-11-26',
  '2028-07-03',
  '2028-11-24',
]);

const DAY_MS = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 미국 정규장이 열리는 날인가 (주말·휴장일 아님). date는 뉴욕 날짜 YYYY-MM-DD */
export function isUsTradingDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !(date in US_HOLIDAYS);
}

/** 한국 날짜의 "어젯밤" 미국 장 날짜 (KST 화요일 → 뉴욕 월요일) */
export const usSessionBefore = (kstDate: string) => ymd(new Date(`${kstDate}T00:00:00Z`).getTime() - DAY_MS);

/** 한국 시각 now 기준, 가장 최근에 열렸어야 할 미국 장 날짜가 휴장이었으면 그 날짜와 이름 */
export function lastNightHoliday(now: Date = new Date()): { date: string; name: string } | null {
  const kstDate = ymd(now.getTime() + 9 * 60 * 60 * 1000);
  const session = usSessionBefore(kstDate);
  const weekday = new Date(`${session}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return null;
  return session in US_HOLIDAYS ? { date: session, name: US_HOLIDAYS[session] } : null;
}
