import type { HomeWeather } from "@atlas/contracts";
import { Term } from "@/features/learn/term";
import { BREADTH_PARTS, pct, score } from "./format";
import { SectionTitle } from "./section";

/** ① 왜 이런 날씨인가: 시장 점수 6개 항목 + 상승추세 비율의 과거 대비 위치 */
export function WhyPanel({ weather }: { weather: HomeWeather }) {
  const parts = (weather.breadthComponents ?? []).filter((p) => BREADTH_PARTS[p.key]);
  const weakest = parts.length ? parts.reduce((a, b) => (b.score < a.score ? b : a)) : null;

  return (
    <section aria-labelledby="why-title">
      <SectionTitle id="why-title" aside="높을수록 건강">
        왜 이런 날씨인가요
      </SectionTitle>

      {weather.commentary && (
        <ol className="mt-3 space-y-1.5 text-[15px] leading-[1.55]">
          {weather.commentary.why.map((line, i) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-tint text-[12px] font-semibold text-primary-hover">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      )}

      {!weather.commentary && weather.uptrendRatio != null && weather.uptrendPercentile != null && (
        <p className="mt-3 text-[15px] leading-[1.55]">
          <Term id="uptrend">상승추세</Term>에 있는 종목이 <span className="font-semibold">{pct(weather.uptrendRatio)}</span>뿐이에요.
          2023년 8월 이후 하위 {weather.uptrendPercentile}% 수준이고
          {weather.uptrendMedian != null && <>, 보통은 {pct(weather.uptrendMedian)}예요</>}.
        </p>
      )}

      {parts.length ? (
        <>
          <p className="mt-4 text-[13px] text-text-secondary">
            시장 점수 {weather.score != null ? score(weather.score) : "-"}를 이루는 6가지
            {weakest && <>. 가장 약한 곳은 {BREADTH_PARTS[weakest.key].label}</>}
          </p>
          <ul className="mt-3 space-y-2.5">
            {parts.map((p) => (
              <li key={p.key} className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-center gap-3">
                <span className="truncate text-[13px] text-text-secondary">{BREADTH_PARTS[p.key].label}</span>
                {/* 미터: 트랙은 같은 계열의 옅은 단계 */}
                <span className="h-1.5 overflow-hidden rounded-full bg-slate/15" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${p === weakest ? "bg-primary" : "bg-slate"}`}
                    style={{ width: `${Math.max(2, Math.min(100, p.score))}%` }}
                  />
                </span>
                <span className="text-right text-[13px] tabular-nums">{score(p.score)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-[15px] text-text-muted">시장 점수 항목 데이터 없음</p>
      )}
    </section>
  );
}
