// 용어 뜻은 여기 한 곳에서 관리한다. 화면의 점선 밑줄 용어와 "오늘의 한 줄 공부"가 같이 쓴다.
// 상태를 설명할 뿐, 사라·팔라는 말이나 앞으로의 방향은 쓰지 않는다 (절대 규칙 7).

export const GLOSSARY = {
  marketScore: {
    term: "시장 점수",
    short:
      "미국 시장에서 얼마나 많은 종목이 함께 오르고 있는지를 6가지 기준으로 0~100점으로 매긴 값이에요. 지수가 올라도 소수 종목만 오르면 점수가 낮아요.",
  },
  uptrend: {
    term: "상승추세 비율",
    short:
      "미국 주식 약 2,800개 중 가격 흐름이 위를 향하고 있는 종목의 비율이에요. 비율이 높을수록 시장 전체가 같이 오르고 있다는 뜻이에요.",
  },
  exposure: {
    term: "권장 주식 비중",
    short:
      "투자금 중 주식에 둬도 괜찮은 최대 비율이에요. 시장이 약할수록 낮아지고, 나머지는 현금으로 두는 쪽을 권해요.",
  },
  judgment: {
    term: "판정 점수",
    short:
      "시장 폭, 상승추세, 섹터 같은 여러 분석을 합친 점수예요. 이 점수로 맑음·흐림·비가 정해져요. 30 미만이면 비, 50 미만이면 흐림이에요.",
  },
  sector: {
    term: "섹터",
    short:
      "비슷한 사업을 하는 회사 묶음이에요. 미국 주식은 기술, 헬스케어, 금융 등 11개로 나눠요. 시장이 약할 때도 상대적으로 버티는 섹터를 보면 돈이 어디로 몰리는지 알 수 있어요.",
  },
  stopLoss: {
    term: "손절가",
    short:
      "이 가격 아래로 떨어지면 팔겠다고 미리 정해두는 가격이에요. 손실이 커지기 전에 멈추는 장치라, 스윙 투자에서는 사기 전에 정해요.",
  },
  swing: {
    term: "스윙 투자",
    short:
      "몇 주에서 몇 달 정도 들고 있다가 파는 방식이에요. 시장 분위기가 좋을 때 사고, 미리 정한 손절가나 목표가에 닿으면 정리해요.",
  },
  regularClose: {
    term: "정규장 종가",
    short:
      "미국 정규 거래시간이 끝날 때의 가격이에요. 한국 시간으로 새벽 6시(서머타임엔 5시)에 정해져요. Atlas의 모든 가격은 이 기준이에요.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** 날씨별로 지금 화면과 가까운 용어부터. 장 날짜가 바뀔 때마다 하나씩 돌아간다 */
const LESSON_ORDER: Record<"clear" | "cloudy" | "rain", GlossaryKey[]> = {
  rain: ["uptrend", "exposure", "stopLoss", "judgment", "sector", "marketScore", "swing", "regularClose"],
  cloudy: ["judgment", "stopLoss", "exposure", "uptrend", "sector", "marketScore", "swing", "regularClose"],
  clear: ["swing", "stopLoss", "sector", "exposure", "marketScore", "uptrend", "judgment", "regularClose"],
};

export function dailyLesson(dayNumber: number, condition: "clear" | "cloudy" | "rain" | null): GlossaryKey {
  const order = LESSON_ORDER[condition ?? "rain"];
  return order[((dayNumber % order.length) + order.length) % order.length];
}
