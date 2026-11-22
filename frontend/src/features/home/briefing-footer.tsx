import type { HomeResponse } from "@atlas/contracts";
import { formatKstDateTime, formatKstRelative, tradeDay } from "@/shared/lib/time";

const RUN_BADGE = {
  running: "분석 중이에요. 끝나면 자동으로 바뀌어요",
  partial: "일부 데이터를 받지 못했어요",
  failed: "마지막 분석이 실패해서 이전 결과를 보여드려요",
} as const;

export function BriefingFooter({ home, now }: { home: HomeResponse; now: Date }) {
  const { weather, run, nextRunAt } = home;
  const badge = run && run.status !== "success" ? RUN_BADGE[run.status] : null;
  const t = weather ? tradeDay(weather.tradeDate) : null;

  return (
    <footer className="mt-14 space-y-1 text-center text-[13px] text-text-muted">
      {badge && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface-raised px-3 py-1.5 text-text-secondary">
          {run?.status === "running" && (
            <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
          )}
          {badge}
        </p>
      )}
      {nextRunAt && <p>다음 브리핑 {formatKstRelative(new Date(nextRunAt), now)}</p>}
      {weather && t && (
        <p>
          {formatKstDateTime(new Date(weather.analyzedAt))} 분석, {t.month}월 {t.day}일 정규장 종가 기준
        </p>
      )}
    </footer>
  );
}
