"use client";

import type { HomeWeather, MarketCondition, MyResponse } from "@atlas/contracts";
import type { ReactNode } from "react";
import { Term } from "@/features/learn/term";
import { CONDITION, conclusion, pct, sessionLabel } from "./format";

/** 날씨별 오늘의 자세. exposure-coach recommendation을 한 단어로 */
const STANCE: Record<MarketCondition, string> = {
  clear: "조건 맞으면 매수",
  cloudy: "새 매수 쉼",
  rain: "새 매수 쉼",
};

function Stat({ label, children, sub }: { label: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-text-muted">{label}</p>
      <p className="mt-0.5 text-[20px] leading-tight font-semibold tracking-[-0.01em] tabular-nums">{children}</p>
      {sub && <p className="mt-0.5 text-[12px] leading-snug">{sub}</p>}
    </div>
  );
}

/**
 * 맨 위 "시장 자세" 띠. 트레이더가 제일 먼저 보는 네 숫자:
 * 날씨와 결론, 권장 비중 상한, 내 실제 비중, 오늘의 자세, 어제보다 달라진 것.
 */
export function MarketPosture({
  weather,
  my,
  now,
  onSetCapital,
}: {
  weather: HomeWeather;
  my: MyResponse | undefined;
  now: Date;
  onSetCapital: () => void;
}) {
  const cond = weather.condition ? CONDITION[weather.condition] : null;
  const text = weather.condition ? conclusion(weather.condition, weather.exposureCeiling) : null;
  const exposure = my?.summary.exposurePct ?? null;
  const ceiling = weather.exposureCeiling;
  const over = exposure != null && ceiling != null ? exposure - ceiling : null;

  return (
    <section aria-label="시장 자세">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          {cond ? (
            <>
              <cond.icon size={44} strokeWidth={1.4} className={`shrink-0 ${cond.color}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-[13px] text-text-secondary">{sessionLabel(weather.tradeDate, now)}</p>
                <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                  {cond.label}, {text!.title}
                </h1>
              </div>
            </>
          ) : (
            <h1 className="text-[22px] font-semibold text-text-muted">시장 날씨 데이터 없음</h1>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:shrink-0 xl:gap-x-8">
          <Stat label={<Term id="exposure">권장 비중</Term>}>{ceiling != null ? `≤${ceiling}%` : "—"}</Stat>
          <Stat
            label="내 주식 비중"
            sub={
              exposure == null ? null : over != null && over > 0 ? (
                <span className="text-primary-hover">상한보다 {over.toFixed(0)}%p 높음</span>
              ) : (
                <span className="text-text-muted">상한 안</span>
              )
            }
          >
            {exposure != null ? (
              `${exposure.toFixed(0)}%`
            ) : (
              <button type="button" onClick={onSetCapital} className="pressable text-[15px] font-medium text-primary">
                총 투자금 넣기
              </button>
            )}
          </Stat>
          <Stat label="오늘의 자세">{weather.condition ? STANCE[weather.condition] : "—"}</Stat>
          <Stat
            label={<Term id="uptrend">오르는 종목</Term>}
            sub={
              weather.prevUptrendRatio != null && <span className="text-text-muted">전 거래일 {pct(weather.prevUptrendRatio)}</span>
            }
          >
            {weather.uptrendRatio != null ? pct(weather.uptrendRatio) : "—"}
          </Stat>
        </div>
      </div>

    </section>
  );
}
