import type { MarketCondition, MyResponse } from "@atlas/contracts";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { changeText, displayName, usd } from "@/features/my/format";
import { SectionTitle } from "./section";

/**
 * 관심 → 매수 대기. 지금은 종가·등락과 날씨에 따른 상태만.
 * Phase 5(스크리너·breakout-trade-planner)가 붙으면 진입가·손절가·수량이 여기에 나온다.
 */
export function WatchCard({
  my,
  failed,
  condition,
}: {
  my: MyResponse | undefined;
  failed: boolean;
  condition: MarketCondition | null;
}) {
  const watch = my?.watchlist ?? [];
  const status = condition === "clear" ? "진입 조건 준비 중" : "맑아지면 확인";

  return (
    <section aria-labelledby="watch-title" className="flex h-full flex-col">
      <SectionTitle id="watch-title" aside={watch.length ? `${watch.length}종목` : undefined}>
        관심 → 매수 대기
      </SectionTitle>

      {failed ? (
        <p className="mt-3 text-[15px] text-text-muted">내 종목 데이터 없음</p>
      ) : !my ? (
        <div className="mt-3 h-20 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
      ) : watch.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
          사고 싶은 종목을 관심에 넣어 두세요. 시장이 맑아지면 매수 자리(진입가·손절가·수량)를 계산해 드려요.
        </p>
      ) : (
        <ul className="mt-2">
          {watch.map((w) => {
            const change = changeText(w.changePct);
            return (
              <li key={w.symbol} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[15px] font-medium">{displayName(w)}</span>
                    <span className="shrink-0 text-[12px] text-text-muted">{w.symbol}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-muted">{status}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] tabular-nums">{w.lastClose != null ? usd(w.lastClose) : "—"}</span>
                  {change && <span className={`block text-[12px] tabular-nums ${change.tone}`}>{change.text}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <Link href="/search" className="pressable inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-primary">
          <Plus size={16} aria-hidden />
          관심 추가
        </Link>
        <Link href="/my" className="pressable inline-flex min-h-11 items-center text-[14px] text-text-secondary">
          내 종목
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
