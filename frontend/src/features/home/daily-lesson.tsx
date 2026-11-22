import type { MarketCondition } from "@atlas/contracts";
import { BookOpen } from "lucide-react";
import { dailyLesson, GLOSSARY } from "@/features/learn/glossary";
import { tradeDay } from "@/shared/lib/time";
import { SectionTitle } from "./section";

/** 4. 오늘의 한 줄 공부. 장 날짜가 바뀔 때마다 지금 날씨와 가까운 용어부터 하나씩 */
export function DailyLesson({ tradeDate, condition }: { tradeDate: string; condition: MarketCondition | null }) {
  const entry = GLOSSARY[dailyLesson(tradeDay(tradeDate).dayNumber, condition)];
  return (
    <section aria-labelledby="lesson-title">
      <SectionTitle id="lesson-title">오늘의 한 줄 공부</SectionTitle>
      <div className="mt-3 flex gap-3">
        <BookOpen size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-[16px] font-medium">{entry.term}</p>
          <p className="mt-1 text-[15px] leading-[1.55] text-text-secondary">{entry.short}</p>
        </div>
      </div>
    </section>
  );
}
