"use client";

import type { HomeResponse } from "@atlas/contracts";
import { ChevronDown } from "lucide-react";
import { ClearConditions } from "./clear-conditions";
import { ScoreLine } from "./score-line";
import { UptrendChart } from "./uptrend-chart";
import { WhyPanel } from "./why-panel";

export const DETAIL_ID = "market-detail";

/**
 * 5. 시장 자세히 보기 (근거). 모바일은 카드 하나로 접혀 있고, 데스크톱은 큰 패널 아래쪽에 펼쳐져 있다.
 * 시장 점수·이유·상승추세 흐름. "다시 맑아지려면"은 데스크톱에서 오른쪽 카드로 빠지므로 여기서는 모바일에만 둔다.
 * 섹터 순위와 흐름은 홈 위쪽 SectorBlock으로 올라갔다.
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
    <section id={DETAIL_ID} aria-label="시장 자세히 보기" className={`scroll-mt-4 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${DETAIL_ID}-body`}
        onClick={onToggle}
        className="pressable flex min-h-11 w-full items-center justify-between text-[17px] font-semibold lg:hidden"
      >
        시장 자세히 보기
        <ChevronDown
          size={18}
          aria-hidden
          className={`text-text-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <h2 className="hidden text-[13px] text-text-muted lg:block">시장 자세히 보기</h2>

      <div id={`${DETAIL_ID}-body`} className={`${open ? "" : "max-lg:hidden"} space-y-12 pt-6 lg:pt-5`}>
        <div className="space-y-12 xl:grid xl:grid-cols-2 xl:gap-x-12 xl:space-y-0">
          {weather ? (
            <div className="space-y-8">
              <ScoreLine weather={weather} />
              <WhyPanel weather={weather} />
            </div>
          ) : (
            <p className="text-[15px] text-text-muted">시장 날씨 데이터 없음</p>
          )}
          {home.history.length > 1 ? (
            <UptrendChart history={home.history} median={weather?.uptrendMedian ?? null} />
          ) : (
            <p className="text-[15px] text-text-muted">상승추세 이력 데이터 없음</p>
          )}
        </div>

        {weather && (
          <div className="lg:hidden">
            <ClearConditions weather={weather} />
          </div>
        )}
      </div>
    </section>
  );
}
