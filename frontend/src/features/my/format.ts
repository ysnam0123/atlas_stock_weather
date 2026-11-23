import type { MyHolding, StopMethod } from "@atlas/contracts";

export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 등락은 기호를 같이 붙인다 (색만으로 구분하지 않는다) */
export function changeText(pct: number | null) {
  if (pct == null) return null;
  if (Math.abs(pct) < 0.005) return { text: "0.00%", tone: "text-text-muted" };
  return pct > 0
    ? { text: `▲${pct.toFixed(2)}%`, tone: "text-up" }
    : { text: `▼${Math.abs(pct).toFixed(2)}%`, tone: "text-down" };
}

export const displayName = (x: { nameKo: string | null; nameEn: string }) => x.nameKo ?? x.nameEn;

export const STOP_METHOD_LABEL: Record<StopMethod | "manual", string> = {
  percent: "비율형",
  atr: "변동성형",
  support: "차트형",
  manual: "직접 입력",
};

/** 손절가 근접 경고 기준 (종가가 손절가보다 이만큼 이내로 위에 있으면) */
export const STOP_NEAR_PCT = 5;

export type StopTone = "alert" | "near" | "ok" | "none";

/** 보유 종목의 손절가 상태 한 줄. 상태만 말하고 사라·팔라고 하지 않는다 */
export function stopStatus(h: MyHolding): { tone: StopTone; text: string } {
  if (h.stopPrice == null) return { tone: "none", text: "손절가 없음" };
  if (h.lastClose == null || h.stopDistancePct == null) return { tone: "none", text: `손절가 ${usd(h.stopPrice)}` };
  if (h.stopDistancePct <= 0) return { tone: "alert", text: "손절가 아래로 마감" };
  return {
    tone: h.stopDistancePct < STOP_NEAR_PCT ? "near" : "ok",
    text: `손절가까지 ${h.stopDistancePct.toFixed(1)}%`,
  };
}

export const STOP_TONE_CLASS: Record<StopTone, string> = {
  alert: "bg-primary text-white",
  near: "bg-primary-tint text-primary-hover",
  ok: "bg-surface text-text-secondary",
  none: "bg-surface text-text-muted",
};
