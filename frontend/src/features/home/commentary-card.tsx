import type { HomeWeather } from "@atlas/contracts";
import { tradeDay } from "@/shared/lib/time";
import { SectionTitle } from "./section";

/** Claude 해설: 시장 날씨 숫자를 쉬운 말 세 줄로. 판정은 스크립트 결과 그대로이고 말로 옮기기만 한다 */
export function CommentaryCard({ weather }: { weather: HomeWeather | null }) {
  const c = weather?.commentary;
  const d = weather && tradeDay(weather.tradeDate);
  return (
    <section aria-labelledby="commentary-title">
      <SectionTitle id="commentary-title" aside={d && `${d.month}월 ${d.day}일 종가`}>
        Claude 해설
      </SectionTitle>
      {c ? (
        <>
          <p className="mt-2 text-[16px] leading-snug font-medium">{c.headline}</p>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-[1.55] text-text-secondary">
            {c.summary.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-text-muted" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-text-muted">해설 없음. 다음 실행 때 다시 만들어요.</p>
      )}
    </section>
  );
}
