import type { MarketCondition } from "@atlas/contracts";
import { SectionTitle } from "./section";

/**
 * 3. 새로 살 후보. 비·흐림이면 찾지 않는다는 한 줄만 (docs/frontend.md 상태 처리).
 * 맑은 날의 후보 목록은 스크리너가 붙는 Phase 5에서 채운다.
 */
export function CandidatesSoon({ condition }: { condition: MarketCondition | null }) {
  const text =
    condition === "rain" || condition === "cloudy"
      ? `${condition === "rain" ? "비" : "흐림"}인 날엔 후보를 찾지 않아요. 맑아지면 진입 조건을 모두 통과한 종목이 여기에 나와요.`
      : condition === "clear"
        ? "후보 찾기는 준비 중이에요. 진입 조건을 모두 통과한 종목이 여기에 나올 거예요."
        : "판정 데이터가 없어 후보를 찾지 않았어요.";

  return (
    <section aria-labelledby="candidates-title">
      <SectionTitle id="candidates-title">새로 살 후보</SectionTitle>
      <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">{text}</p>
    </section>
  );
}
