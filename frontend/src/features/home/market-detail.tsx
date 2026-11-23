"use client";

import type { HomeResponse } from "@atlas/contracts";
import { ChevronDown } from "lucide-react";
import { ClearConditions } from "./clear-conditions";
import { ScoreLine } from "./score-line";
import { SectionTitle } from "./section";
import { SectorHeatmap } from "./sector-heatmap";
import { UptrendChart } from "./uptrend-chart";
import { WhyPanel } from "./why-panel";

export const DETAIL_ID = "market-detail";

/**
 * 흐름과 근거. 모바일은 카드 하나로 접혀 있고, 데스크톱은 늘 펼쳐져 있다.
 * 흐름(상승추세 비율 | 섹터 순위 흐름) → 근거(시장 점수·6개 항목 | 다시 맑아지려면).
 */
export function MarketDetail({
  home,
  open,
  onToggle,
  className = "",
}: {
  home: HomeResponse;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { weather } = home;
  return (
    <section id={DETAIL_ID} aria-label="흐름과 근거" className={`scroll-mt-4 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${DETAIL_ID}-body`}
        onClick={onToggle}
        className="pressable flex min-h-11 w-full items-center justify-between text-[17px] font-semibold lg:hidden"
      >
        흐름과 근거 보기
        <ChevronDown
          size={18}
          aria-hidden
          className={`text-text-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div id={`${DETAIL_ID}-body`} className={`${open ? "" : "max-lg:hidden"} space-y-12 pt-6 lg:pt-0`}>
        <div>
          <SectionTitle id="flow-title">흐름</SectionTitle>
          <div className="mt-4 space-y-10 xl:grid xl:grid-cols-2 xl:gap-x-12 xl:space-y-0">
            {home.history.length > 1 ? (
              <UptrendChart history={home.history} median={weather?.uptrendMedian ?? null} />
            ) : (
              <p className="text-[15px] text-text-muted">상승추세 이력 데이터 없음</p>
            )}
            {home.sectorHistory ? (
              <SectorHeatmap data={home.sectorHistory} />
            ) : (
              <p className="text-[15px] text-text-muted">섹터 이력 데이터 없음</p>
            )}
          </div>
        </div>

        {weather && (
          <div className="space-y-12 xl:grid xl:grid-cols-2 xl:gap-x-12 xl:space-y-0">
            <div className="space-y-8">
              <WhyPanel weather={weather} />
              <ScoreLine weather={weather} />
            </div>
            <ClearConditions weather={weather} />
          </div>
        )}
      </div>
    </section>
  );
}
