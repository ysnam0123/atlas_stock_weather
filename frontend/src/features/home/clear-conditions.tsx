import type { HomeWeather } from "@atlas/contracts";
import { Check } from "lucide-react";
import { Term } from "@/features/learn/term";
import { clearSteps, CONFIDENCE_LABEL, score, WEATHER_RULE } from "./format";
import { SectionTitle } from "./section";

const at = (n: number) => `${Math.min(100, Math.max(0, n))}%`;

/** ③ 다시 맑아지려면: 판정 점수가 기준선에서 얼마나 떨어져 있는지 + 남은 조건 */
export function ClearConditions({ weather, titleId = "clear-title" }: { weather: HomeWeather; titleId?: string }) {
  const s = weather.exposureScore;
  const clear = clearSteps(s, weather.exposureMissing);
  const provided = WEATHER_RULE.totalInputs - weather.exposureMissing.length;

  return (
    <section aria-labelledby={titleId} className="scroll-mt-6">
      <SectionTitle id={titleId}>
        {weather.condition === "clear" ? "맑음이 유지되려면" : "다시 맑아지려면"}
      </SectionTitle>

      {s == null || !clear ? (
        <p className="mt-3 text-[15px] text-text-muted">판정 점수 데이터 없음</p>
      ) : (
        <>
          {/* 기준선: 0~30 비, 30~50 흐림, 50~100 맑음 */}
          <div className="mt-4" role="img" aria-label={`판정 점수 ${score(s)}. 30 이상 흐림, 50 이상 맑음`}>
            <div className="relative flex h-2 gap-[2px]">
              <span className="h-full rounded-l-full bg-cond-rain/35" style={{ width: "30%" }} />
              <span className="h-full bg-cond-cloudy/25" style={{ width: "20%" }} />
              <span className="h-full flex-1 rounded-r-full bg-cond-clear/25" />
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text ring-[3px] ring-bg"
                style={{ left: at(s) }}
              />
            </div>
            <div className="mt-1.5 flex text-[11px] text-text-muted">
              <span style={{ width: "30%" }}>비</span>
              <span style={{ width: "20%" }}>흐림</span>
              <span>맑음</span>
            </div>
          </div>

          <p className="mt-3 text-[15px]">
            지금 <Term id="judgment" /> <span className="font-semibold">{score(s)}</span>
          </p>

          <ul className="mt-4 space-y-3.5">
            {clear.steps.map((step, i) => (
              <li key={step.text} className="flex gap-3">
                {step.done ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-white" aria-label="충족">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className={`size-6 shrink-0 rounded-full border-2 ${
                      i === clear.steps.findIndex((x) => !x.done) ? "border-primary border-dashed" : "border-border"
                    }`}
                    aria-label="아직"
                  />
                )}
                <div>
                  <p className="pt-0.5 text-[15px] leading-snug">{step.text}</p>
                  {step.note && <p className="mt-1 text-[13px] leading-[1.5] text-text-secondary">{step.note}</p>}
                </div>
              </li>
            ))}
          </ul>

          {weather.exposureConfidence && (
            <p className="mt-4 text-[13px] leading-[1.5] text-text-muted">
              판정 신뢰도 {CONFIDENCE_LABEL[weather.exposureConfidence] ?? weather.exposureConfidence}.{" "}
              {WEATHER_RULE.totalInputs}가지 입력 중 {provided}가지로 판정했어요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
