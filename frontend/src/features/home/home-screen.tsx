"use client";

import { useState } from "react";
import { CARD, MOBILE_CARD } from "@/shared/ui/card";
import { BriefingFooter } from "./briefing-footer";
import { CandidatesSoon } from "./candidates-soon";
import { ClearConditions } from "./clear-conditions";
import { DailyLesson } from "./daily-lesson";
import { DETAIL_ID, MarketDetail } from "./market-detail";
import { MyStocksEmpty } from "./my-stocks-empty";
import { SectorBlock } from "./sector-block";
import { TodayChecks } from "./today-checks";
import { useHome, useRunMarketDaily } from "./use-home";
import { WeatherHero } from "./weather-hero";

/** 근거를 펼친 뒤 그 자리로 내려간다. 움직임 줄이기 설정이면 바로 이동 */
function scrollToId(id: string) {
  requestAnimationFrame(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

/**
 * 홈은 결론 → 확인할 것 → 근거 순서다 (docs/frontend.md "아침 모드 구성").
 * 모바일: 카드가 결론 → 확인할 것 → 후보 → 섹터 → 공부 → 자세히 보기 순서로 쌓인다.
 * 데스크톱: 가운데 큰 패널(결론·확인할 것·후보 | 섹터 순위·흐름, 아래로 근거) + 오른쪽 카드 열(다시 맑아지려면, 내 종목, 공부).
 * 모바일 순서를 맞추려고 패널과 오른쪽 열은 모바일에서 display: contents로 풀고 order로 줄 세운다.
 */
export function HomeScreen() {
  const { data, isPending, isError, refetch } = useHome();
  const [detailOpen, setDetailOpen] = useState(false);

  if (isPending) return <HomeSkeleton />;
  if (isError) return <ServerDown onRetry={() => refetch()} />;
  if (!data.weather && !data.sectors) return <StartGuide running={data.run?.status === "running"} />;

  // 데이터가 온 뒤에만 현재 시각을 읽는다 (프리렌더 때는 여기까지 오지 않는다)
  const now = new Date();
  const { weather } = data;
  const openDetail = (target: string) => {
    setDetailOpen(true);
    scrollToId(target);
  };

  return (
    <div className="flex flex-col gap-4 pt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 lg:py-5 lg:pr-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* 가운데 큰 패널. xl: 왼쪽 위 결론, 그 아래 확인할 것·후보 / 오른쪽 섹터 순위 + 흐름 / 아래로 근거 */}
      <div className="max-lg:contents lg:grid lg:items-start lg:gap-x-12 lg:gap-y-10 lg:rounded-[24px] lg:border lg:border-border lg:bg-surface-raised lg:p-8 lg:shadow-card xl:grid-cols-2">
        {/* 왼쪽 칸: 결론 → 확인할 것 → 후보. 모바일에서는 풀려서 카드 하나씩 */}
        <div className="max-lg:contents lg:space-y-10 xl:col-start-1 xl:row-start-1">
          <div className={`${MOBILE_CARD} max-lg:order-1`}>
            {weather ? (
              <WeatherHero weather={weather} now={now} onWhy={() => openDetail(DETAIL_ID)} />
            ) : (
              <p className="text-[17px] text-text-muted">시장 날씨 데이터 없음</p>
            )}
          </div>
          <div className={`${MOBILE_CARD} max-lg:order-2`}>
            <TodayChecks
              weather={weather}
              onOpenConditions={() => (isDesktop() ? scrollToId("clear-title-rail") : openDetail("clear-title"))}
            />
          </div>
          <div className={`${MOBILE_CARD} max-lg:order-3`}>
            <CandidatesSoon condition={weather?.condition ?? null} />
          </div>
        </div>
        {/* 오른쪽 칸: 섹터 순위 + 흐름 */}
        <div className={`${MOBILE_CARD} max-lg:order-4 xl:col-start-2 xl:row-start-1`}>
          <SectorBlock home={data} />
        </div>
        <MarketDetail
          home={data}
          open={detailOpen}
          onToggle={() => setDetailOpen((v) => !v)}
          className={`${MOBILE_CARD} max-lg:order-6 lg:col-span-full lg:border-t lg:border-border lg:pt-8`}
        />
        <div className="max-lg:order-7 lg:col-span-full">
          <BriefingFooter home={data} now={now} />
        </div>
      </div>

      {/* 오른쪽 카드 열: 스크롤을 따라오고, 화면 높이를 채운다 */}
      <aside
        aria-label="조건, 내 종목, 공부"
        className="max-lg:contents lg:sticky lg:top-5 lg:flex lg:h-[calc(100dvh-40px)] lg:flex-col lg:gap-5 lg:overflow-y-auto"
      >
        {weather && (
          <div className={`${CARD} max-lg:hidden`}>
            <ClearConditions weather={weather} titleId="clear-title-rail" />
          </div>
        )}
        {/* 남는 높이는 내 종목 카드가 채운다 (Phase 2에서 목록이 들어갈 자리) */}
        <div className={`${CARD} max-lg:hidden lg:flex-1`}>
          <MyStocksEmpty />
        </div>
        {weather && (
          <div className={`${CARD} max-lg:order-5`}>
            <DailyLesson tradeDate={weather.tradeDate} condition={weather.condition} />
          </div>
        )}
      </aside>
    </div>
  );
}

function HomeSkeleton() {
  const block = "rounded-lg bg-text/[0.06] motion-safe:animate-pulse";
  return (
    <div aria-busy="true" aria-label="불러오는 중" className={`mt-2 lg:m-5 ${CARD} lg:p-8`}>
      <div className={`h-4 w-28 ${block}`} />
      <div className={`mt-3 h-14 w-40 ${block}`} />
      <div className={`mt-4 h-5 w-full ${block}`} />
      <div className={`mt-10 h-px w-full ${block}`} />
      <div className={`mt-14 h-6 w-24 ${block}`} />
      <div className={`mt-3 h-72 w-full rounded-[20px] ${block}`} />
    </div>
  );
}

function ServerDown({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={`mt-2 lg:m-5 ${CARD} lg:p-8`}>
      <h1 className="text-[28px] font-light tracking-[-0.02em]">서버에 연결할 수 없어요</h1>
      <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
        API 서버가 켜져 있는지 확인해 주세요. 터미널에서 <code>pnpm --filter backend dev</code>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable mt-5 min-h-11 rounded-full bg-surface px-5 text-[15px] font-medium active:bg-border"
      >
        다시 시도
      </button>
    </div>
  );
}

function StartGuide({ running }: { running: boolean }) {
  const run = useRunMarketDaily();
  const busy = running || run.isPending;
  return (
    <div className={`mt-2 lg:m-5 ${CARD} lg:p-8`}>
      <h1 className="text-[28px] font-light tracking-[-0.02em]">아직 분석 결과가 없어요</h1>
      <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
        첫 분석을 실행하면 미국 시장 날씨와 섹터 순위가 채워져요. 1분 정도 걸려요.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => run.mutate()}
        className="pressable mt-5 min-h-11 rounded-full bg-primary px-5 text-[15px] font-medium text-white active:bg-primary-hover disabled:opacity-50"
      >
        {busy ? "분석 중" : "첫 분석 실행"}
      </button>
      {run.isError && <p className="mt-3 text-[13px] text-primary-hover">실행 요청이 실패했어요. 서버 로그를 확인해 주세요.</p>}
    </div>
  );
}
