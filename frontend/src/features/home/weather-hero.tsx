"use client";

import type { HomeWeather } from "@atlas/contracts";
import { ChevronDown } from "lucide-react";
import { Term } from "@/features/learn/term";
import { CONDITION, conclusion, sessionLabel } from "./format";

/** 1. 결론 히어로: 날씨 → 결론 한 줄 → 권장 비중 → "왜 그런가요?" */
export function WeatherHero({ weather, now, onWhy }: { weather: HomeWeather; now: Date; onWhy: () => void }) {
  const cond = weather.condition ? CONDITION[weather.condition] : null;
  const text = weather.condition ? conclusion(weather.condition, weather.exposureCeiling) : null;

  return (
    <section aria-label="오늘의 결론">
      <p className="text-[15px] text-text-secondary">{sessionLabel(weather.tradeDate, now)}</p>

      {cond && text ? (
        <>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-[56px] leading-[1.05] font-light tracking-[-0.035em]">{cond.label}</p>
            <cond.icon size={48} strokeWidth={1.4} className={cond.color} aria-hidden />
          </div>
          <h1 className="mt-4 text-[24px] leading-[1.3] font-semibold tracking-[-0.02em]">{text.title}</h1>
          <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
            <Term id="exposure">권장 비중</Term>: {text.detail}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[34px] leading-[1.1] font-light tracking-[-0.02em] text-text-muted">데이터 없음</p>
          <h1 className="mt-3 text-[17px] leading-[1.45]">
            이번 분석에서 판정이 실패했어요. 다음 분석 때 다시 채워져요.
          </h1>
        </>
      )}

      <button
        type="button"
        onClick={onWhy}
        className="pressable mt-5 inline-flex min-h-11 items-center gap-1 rounded-full bg-surface px-4 lg:hidden text-[15px] font-medium text-text-secondary hover:text-text active:bg-border"
      >
        왜 그런가요?
        <ChevronDown size={16} aria-hidden />
      </button>
    </section>
  );
}
