import type { HomeResponse } from "@atlas/contracts";
import { ExternalLink } from "lucide-react";
import { displayName } from "@/features/my/format";
import type { InfoTarget } from "@/features/my/stock-info-sheet";
import { formatKstDate, formatKstTime, kstDayNumber } from "@/shared/lib/time";
import { SectionTitle } from "./section";

const SHOW = 5;

function when(iso: string, now: Date) {
  const d = new Date(iso);
  const diff = kstDayNumber(now) - kstDayNumber(d);
  return diff === 0 ? formatKstTime(d) : diff === 1 ? "어제" : formatKstDate(d);
}

/**
 * 내 종목 소식: 보유·관심 종목의 최근 중요 뉴스·SEC 공시를 시간순으로 한 목록에.
 * 제목을 누르면 원문, 종목 이름을 누르면 그 종목 소식 시트 (의원 거래도 거기서).
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

  return (
    <section aria-labelledby="intel-title" className="flex flex-col">
      <SectionTitle id="intel-title" aside="중요 뉴스·공시, 3일">
        내 종목 소식
      </SectionTitle>

      {news.length === 0 ? (
        <p className="mt-2 text-[15px] text-text-secondary">최근 3일 동안 보유·관심 종목의 중요한 소식이 없어요.</p>
      ) : (
        <ul className="mt-2">
          {news.slice(0, SHOW).map((n) => (
            <li key={n.id} className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
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
        </ul>
      )}
      {news.length > SHOW && <p className="mt-1 text-[12px] text-text-muted">외 {news.length - SHOW}건은 종목 이름을 눌러 보세요</p>}
    </section>
  );
}
