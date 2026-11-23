import type { HomeEarnings } from "@atlas/contracts";
import { CalendarDays } from "lucide-react";
import { displayName } from "@/features/my/format";
import { kstDayNumber, tradeDay } from "@/shared/lib/time";
import { SectionTitle } from "./section";

const TRACKED: Record<HomeEarnings["tracked"], string> = { holding: "보유", watch: "관심", ai: "AI 보유" };
/** 이 안이면 강조한다 */
const SOON_DAYS = 14;
const SHOW = 6;

/** 며칠 남았나. 미국 날짜와 한국 날짜의 차이라 하루 정도 어긋날 수 있다 */
export const daysUntil = (date: string, now: Date) => tradeDay(date).dayNumber - kstDayNumber(now);

/**
 * 다가오는 일정. 지금은 내 보유·관심·AI 보유 종목의 실적 발표만.
 * 물가·금리 같은 경제지표 일정은 FMP 무료 플랜에서 막혀 있다 (2026-11-23 확인).
 */
export function ScheduleCard({ earnings, now }: { earnings: HomeEarnings[]; now: Date }) {
  const upcoming = earnings.filter((e) => daysUntil(e.date, now) >= 0);
  return (
    <section aria-labelledby="schedule-title">
      <SectionTitle id="schedule-title" aside="내 종목 실적 발표">
        다가오는 일정
      </SectionTitle>

      {upcoming.length === 0 ? (
        <div className="mt-3 flex gap-3 text-[14px] leading-[1.55] text-text-secondary">
          <CalendarDays size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
          <p>앞으로 4개월 안에 잡힌 내 종목 실적 발표가 없어요.</p>
        </div>
      ) : (
        <ul className="mt-2">
          {upcoming.slice(0, SHOW).map((e) => {
            const d = daysUntil(e.date, now);
            const t = tradeDay(e.date);
            return (
              <li key={`${e.symbol}-${e.date}`} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <span
                  className={`w-12 shrink-0 rounded-lg py-1 text-center text-[13px] font-semibold tabular-nums ${
                    d <= SOON_DAYS ? "bg-primary-tint text-primary-hover" : "bg-surface text-text-secondary"
                  }`}
                >
                  {d === 0 ? "오늘" : `D-${d}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{e.symbol}</span>
                    <span className="truncate text-[13px] text-text-secondary">{displayName(e)}</span>
                  </span>
                  <span className="block text-[12px] text-text-muted">
                    실적 발표, 미국 {t.month}월 {t.day}일({t.weekday}), {TRACKED[e.tracked]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[12px] leading-[1.5] text-text-muted">
        물가·금리 같은 경제지표 일정은 FMP 무료 플랜에서 제공하지 않아요. 일부 종목은 무료 플랜이 실적 일정을 막아 빠질 수 있어요.
      </p>
    </section>
  );
}
