import { CalendarDays } from "lucide-react";
import { SectionTitle } from "./section";

/** 이번 주 일정. FMP 키(economic-calendar-fetcher, earnings-calendar)를 연결하면 채운다 */
export function ScheduleCard() {
  return (
    <section aria-labelledby="schedule-title">
      <SectionTitle id="schedule-title">이번 주</SectionTitle>
      <div className="mt-3 flex gap-3 text-[14px] leading-[1.55] text-text-secondary">
        <CalendarDays size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        <p>물가·금리·고용 발표와 내 종목 실적 발표일이 한국 시간으로 나와요. FMP 키를 연결하면 채워져요.</p>
      </div>
    </section>
  );
}
