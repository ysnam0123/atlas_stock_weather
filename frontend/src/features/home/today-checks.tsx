import type { HomeWeather } from "@atlas/contracts";
import { CalendarDays, ChevronRight, CloudSun, Star, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { clearSteps } from "./format";
import { SectionTitle } from "./section";

interface Check {
  key: string;
  icon: LucideIcon;
  text: string;
  sub?: string;
  /** 누르면 이동할 곳 (링크) 또는 할 일 (근거 펼치기) */
  href?: string;
  onClick?: () => void;
  muted?: boolean;
}

/**
 * 2. 오늘 확인할 것. 시장 → 내 종목 → 일정 순.
 * 내 종목(Phase 2)과 일정(FMP)이 붙기 전에는 무엇이 올지 안내 줄을 둔다.
 */
export function TodayChecks({ weather, onOpenConditions }: { weather: HomeWeather | null; onOpenConditions: () => void }) {
  const checks: Check[] = [];

  if (weather) {
    const clear = clearSteps(weather.exposureScore, weather.exposureMissing);
    if (weather.condition !== "clear" && clear && clear.remaining > 0) {
      checks.push({
        key: "market",
        icon: CloudSun,
        text: `다시 맑아지려면 조건 ${clear.remaining}개가 남았어요`,
        sub: "새로 사기 전에 이 조건부터 보면 돼요",
        onClick: onOpenConditions,
      });
    }
  }

  checks.push({
    key: "holdings",
    icon: Star,
    text: "보유 종목을 등록해 주세요",
    sub: "평단가와 손절가를 넣어두면 손절가까지 남은 거리를 매일 알려드려요",
    href: "/my",
  });

  checks.push({
    key: "schedule",
    icon: CalendarDays,
    text: "이번 주 발표 일정은 준비 중이에요",
    sub: "FMP 키를 연결하면 물가·고용 발표와 실적 발표가 한국 시간으로 나와요",
    muted: true,
  });

  return (
    <section aria-labelledby="checks-title">
      <SectionTitle id="checks-title">오늘 확인할 것</SectionTitle>
      <ul className="mt-2 -mx-2">
        {checks.map((c, i) => {
          const last = i === checks.length - 1;
          const body = (
            <>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  c.muted ? "bg-surface text-text-muted" : "bg-primary-tint text-primary"
                }`}
              >
                <c.icon size={18} strokeWidth={1.8} aria-hidden />
              </span>
              <span className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 ${last ? "" : "border-b border-border"}`}>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] leading-snug ${c.muted ? "text-text-secondary" : ""}`}>
                    {c.text}
                  </span>
                  {c.sub && <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-muted">{c.sub}</span>}
                </span>
                {(c.href || c.onClick) && <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />}
              </span>
            </>
          );
          const row = "flex w-full items-center gap-3 rounded-2xl pl-2 text-left";
          return (
            <li key={c.key}>
              {c.href ? (
                <Link href={c.href} className={`pressable ${row} hover:bg-surface active:bg-surface`}>
                  {body}
                </Link>
              ) : c.onClick ? (
                <button type="button" onClick={c.onClick} className={`pressable ${row} hover:bg-surface active:bg-surface`}>
                  {body}
                </button>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
