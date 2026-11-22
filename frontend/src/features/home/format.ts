import type { MarketCondition } from "@atlas/contracts";
import { Cloud, CloudRain, Sun, type LucideIcon } from "lucide-react";
import { kstDayNumber, tradeDay } from "@/shared/lib/time";

// 날씨는 "현재 상태"다. 예보·확률 같은 말을 쓰지 않는다 (절대 규칙 7)
export const CONDITION: Record<MarketCondition, { label: string; icon: LucideIcon; color: string }> = {
  clear: { label: "맑음", icon: Sun, color: "text-cond-clear" },
  cloudy: { label: "흐림", icon: Cloud, color: "text-cond-cloudy" },
  rain: { label: "비", icon: CloudRain, color: "text-cond-rain" },
};

/** 결론 한 줄 + 권장 주식 비중 한 줄. 상태만 말한다 */
export function conclusion(condition: MarketCondition, ceiling: number | null) {
  const share = ceiling == null ? null : `주식은 투자금의 ${ceiling}%까지`;
  switch (condition) {
    case "clear":
      return {
        title: "조건이 맞는 종목은 사도 괜찮은 날이에요",
        detail: share ? `${share} 둬도 괜찮은 상태예요.` : "새로 사도 괜찮은 상태예요.",
      };
    case "cloudy":
      return {
        title: "새로 사기보다 가진 종목을 점검할 때예요",
        detail: share ? `${share}만 두는 상태예요.` : "비중을 줄이는 쪽이 맞는 상태예요.",
      };
    case "rain":
      return {
        title: "새로 사지 말고 쉬는 날이에요",
        detail: share ? `${share}만 두고 현금을 먼저 챙기는 상태예요.` : "현금을 먼저 챙기는 상태예요.",
      };
  }
}

/** 히어로 위 작은 글씨. 장 날짜(뉴욕)의 밤이 한국의 다음 날 새벽이다 */
export function sessionLabel(tradeDate: string, now: Date): string {
  const t = tradeDay(tradeDate);
  const daysAgo = kstDayNumber(now) - t.dayNumber;
  if (daysAgo <= 1) return "어젯밤 미국 시장";
  if (daysAgo < 7) return `${t.weekday}요일 밤 미국 시장`;
  return `${t.month}월 ${t.day}일 미국 시장`;
}

/** 0.0688 → "6.9%" */
export const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

/** 스크립트 값을 그대로 쓴다. 정수면 소수점 없이 */
export const score = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 비율 차이를 %p로. 기호를 같이 써서 색만으로 구분하지 않는다 */
export function ratioDelta(now: number, prev: number | null) {
  if (prev == null) return null;
  const diff = (now - prev) * 100;
  if (Math.abs(diff) < 0.05) return { text: "변동 없음", tone: "text-text-muted" };
  return diff > 0
    ? { text: `▲${diff.toFixed(1)}%p`, tone: "text-up" }
    : { text: `▼${Math.abs(diff).toFixed(1)}%p`, tone: "text-down" };
}

/** 시장 점수(market-breadth-analyzer)를 이루는 6개 항목. 비중은 스킬 문서 기준 */
export const BREADTH_PARTS: Record<string, { label: string; weight: number }> = {
  breadth_level_trend: { label: "참여 종목 수준", weight: 25 },
  ma_crossover: { label: "단기·장기 평균선", weight: 20 },
  cycle_position: { label: "상승·하락 사이클", weight: 20 },
  bearish_signal: { label: "하락 경고", weight: 15 },
  historical_percentile: { label: "과거 대비 위치", weight: 10 },
  divergence: { label: "지수와 같은 방향인지", weight: 10 },
};

/**
 * exposure-coach가 날씨를 정하는 기준 (calculate_exposure.py determine_recommendation).
 * 스킬이 바뀌면 여기도 맞춘다.
 */
export const WEATHER_RULE = {
  cloudyFrom: 30,
  clearFrom: 50,
  /** 이 입력 중 2개 이상 빠지면 점수와 상관없이 맑음이 나오지 않는다 */
  critical: ["regime", "top_risk", "breadth"],
  totalInputs: 8,
} as const;

/** 판정 입력 이름 → 화면 이름. regime·top_risk·ftd 등은 FMP 키로 채운다 */
export const INPUT_LABEL: Record<string, string> = {
  regime: "큰 흐름",
  top_risk: "고점 위험",
  breadth: "시장 폭",
  uptrend: "상승추세",
  institutional: "기관 수급",
  sector: "섹터",
  theme: "테마",
  ftd: "바닥 확인 신호",
};

/** 맑아지기까지 남은 조건. 홈 "오늘 확인할 것"과 "다시 맑아지려면"이 같이 쓴다 */
export function clearSteps(exposureScore: number | null, missing: string[]) {
  if (exposureScore == null) return null;
  const missingCritical = missing.filter((m) => (WEATHER_RULE.critical as readonly string[]).includes(m));
  const blocked = missingCritical.length >= 2;
  const steps: { done: boolean; text: string; note?: string }[] = [
    { done: exposureScore >= WEATHER_RULE.cloudyFrom, text: `판정 점수 ${WEATHER_RULE.cloudyFrom} 이상이면 흐림` },
    { done: exposureScore >= WEATHER_RULE.clearFrom, text: `판정 점수 ${WEATHER_RULE.clearFrom} 이상이면 맑음` },
  ];
  if (blocked) {
    steps.push({
      done: false,
      text: `${missingCritical.map((m) => INPUT_LABEL[m] ?? m).join("·")} 데이터 연결`,
      note: "핵심 입력이 2개 이상 빠지면 점수와 상관없이 맑음이 나오지 않아요. FMP 키를 연결하면 채워져요.",
    });
  }
  return { steps, remaining: steps.filter((s) => !s.done).length };
}

export const CONFIDENCE_LABEL: Record<string, string> = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" };
