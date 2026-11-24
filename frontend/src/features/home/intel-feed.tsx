import type { HomeResponse } from "@atlas/contracts";
import { ChevronRight, ExternalLink } from "lucide-react";
import { displayName } from "@/features/my/format";
import type { InfoTarget } from "@/features/my/stock-info-sheet";
import { formatKstDate, formatKstTime, kstDayNumber } from "@/shared/lib/time";

const SHOW = 5;

function when(iso: string, now: Date) {
  const d = new Date(iso);
  const diff = kstDayNumber(now) - kstDayNumber(d);
  return diff === 0 ? formatKstTime(d) : diff === 1 ? "어제" : formatKstDate(d);
}

/**
 * 내 종목 소식: 보유·관심 종목의 최근 뉴스·SEC 공시를 시간순으로 한 목록에.
 * 제목을 누르면 원문, 종목 이름을 누르면 그 종목 소식 시트. 의원 거래 신고는 종목별 한 줄로 아래에.
 */
export function IntelFeed({
  intel,
  now,
  onInfo,
}: {
  intel: HomeResponse["intel"];
  now: Date;
  onInfo: (target: InfoTarget) => void;
}) {
  const news = [...intel.news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const congress = new Map<string, typeof intel.congress>();
  for (const c of intel.congress) congress.set(c.symbol, [...(congress.get(c.symbol) ?? []), c]);

  return (
    <section aria-labelledby="intel-title" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="intel-title" className="text-[12px] text-text-muted">
          내 종목 소식
        </h2>
        <span className="text-[12px] text-text-muted">뉴스·공시 3일, 의원 거래 30일</span>
      </div>

      {news.length === 0 && congress.size === 0 ? (
        <p className="mt-1.5 text-[15px] text-text-secondary">최근 3일 동안 보유·관심 종목 소식이 없어요.</p>
      ) : (
        <ul className="mt-1">
          {news.slice(0, SHOW).map((n) => (
            <li key={n.id} className="flex items-start gap-3 border-b border-border py-2 last:border-b-0">
              <button
                type="button"
                onClick={() => onInfo(n)}
                className="pressable w-16 shrink-0 truncate pt-px text-left text-[13px] font-medium hover:text-primary"
                title={`${displayName(n)} 소식 모두 보기`}
              >
                {displayName(n)}
              </button>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="group min-w-0 flex-1 text-[14px] leading-[1.45] hover:text-primary"
              >
                {n.kind === "sec" && <span className="mr-1.5 text-[12px] text-text-muted">SEC 공시</span>}
                {n.title}
                <ExternalLink size={12} className="ml-1 inline align-[-1px] text-text-muted opacity-0 group-hover:opacity-100" aria-hidden />
              </a>
              <span className="shrink-0 pt-px text-[12px] text-text-muted tabular-nums">{when(n.publishedAt, now)}</span>
            </li>
          ))}
          {[...congress].map(([symbol, list]) => {
            const buys = list.filter((c) => c.type === "P").length;
            return (
              <li key={`congress-${symbol}`} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => onInfo(list[0])}
                  className="pressable flex w-full items-center gap-3 py-2 text-left text-[13px] text-text-secondary hover:text-text"
                >
                  <span className="min-w-0 flex-1">
                    {displayName(list[0])} 의원 거래 신고 {list.length}건 (매수 {buys}, 매도 {list.length - buys}). 거래 뒤 늦게
                    신고되는 공개 자료예요
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {news.length > SHOW && <p className="mt-1 text-[12px] text-text-muted">외 {news.length - SHOW}건은 종목 이름을 눌러 보세요</p>}
    </section>
  );
}
