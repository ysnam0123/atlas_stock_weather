// 화면의 모든 시각은 KST (절대 규칙 5). 브라우저 시간대와 상관없이 Asia/Seoul로 찍는다.

const TZ = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function kstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

/** "오후 9시 42분", 정각이면 "오후 1시" */
export function formatKstTime(date: Date): string {
  const { hour, minute } = kstParts(date);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? "오전" : "오후"} ${h12}시${minute ? ` ${minute}분` : ""}`;
}

/** "11월 22일" */
export function formatKstDate(date: Date): string {
  const { month, day } = kstParts(date);
  return `${month}월 ${day}일`;
}

/** "11월 22일 오후 9시 42분" */
export function formatKstDateTime(date: Date): string {
  return `${formatKstDate(date)} ${formatKstTime(date)}`;
}

/** 오늘·내일이면 그 말로, 아니면 요일로: "화요일 오후 1시 30분" */
export function formatKstRelative(date: Date, now: Date): string {
  const diff = kstDayNumber(date) - kstDayNumber(now);
  const time = formatKstTime(date);
  if (diff === 0) return `오늘 ${time}`;
  if (diff === 1) return `내일 ${time}`;
  return `${WEEKDAYS[kstParts(date).weekday]}요일 ${time}`;
}

/** KST 달력 날짜를 일 단위 정수로 (날짜 차이 계산용) */
export function kstDayNumber(date: Date): number {
  const { year, month, day } = kstParts(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** 'YYYY-MM-DD' 장 날짜(뉴욕 기준)를 그 날짜 그대로 다룬다 */
export function tradeDay(tradeDate: string) {
  const [y, m, d] = tradeDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return {
    month: m,
    day: d,
    weekday: WEEKDAYS[new Date(utc).getUTCDay()],
    dayNumber: utc / 86_400_000,
  };
}
