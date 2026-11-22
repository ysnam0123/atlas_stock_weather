import type { HomeResponse } from "@atlas/contracts";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { tradeDay } from "@/shared/lib/time";
import { Term } from "@/features/learn/term";
import { pct, ratioDelta } from "./format";
import { SectionTitle } from "./section";
import { sectorMeta } from "./sectors";

/** 홈은 5위까지. 11개 전체는 섹터 지도에서 */
const TOP = 5;

function rankMove(rank: number, prevRank: number | null) {
  if (prevRank == null || prevRank === rank) return null;
  const up = prevRank > rank;
  return (
    <span className={up ? "text-up" : "text-down"}>
      {up ? "▲" : "▼"}
      {Math.abs(prevRank - rank)}
    </span>
  );
}

export function SectorRanking({ sectors }: { sectors: HomeResponse["sectors"] }) {
  const t = sectors ? tradeDay(sectors.tradeDate) : null;
  return (
    <section aria-labelledby="sector-title">
      <SectionTitle id="sector-title" aside={t && `${t.month}월 ${t.day}일 상승추세 비율`}>
        <Term id="sector" /> 순위
      </SectionTitle>

      {sectors ? (
        <ol className="mt-2">
          {sectors.items.slice(0, TOP).map((s) => {
            const meta = sectorMeta(s.sector);
            const delta = ratioDelta(s.uptrendRatio, s.prevUptrendRatio);
            const move = rankMove(s.rank, s.prevRank);
            return (
              <li key={s.sector} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-[15px] text-text-muted tabular-nums">{s.rank}</span>
                <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] text-white ${meta.tile}`}>
                  <meta.icon size={19} strokeWidth={1.8} aria-hidden />
                </span>
                {/* 구분선은 아이콘 오른쪽부터 */}
                <div className="flex min-h-[60px] flex-1 items-center justify-between gap-3 border-b border-border py-2.5">
                  <div>
                    <p className="text-[17px] leading-tight">{meta.ko}</p>
                    <p className="mt-0.5 text-[13px] text-text-muted">
                      {s.trend === "Up" ? "상승 중" : s.trend === "Down" ? "하락 중" : "추세 없음"}
                      {move && <> {move}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[17px] leading-tight tabular-nums">{pct(s.uptrendRatio)}</p>
                    {delta && <p className={`mt-0.5 text-[13px] tabular-nums ${delta.tone}`}>{delta.text}</p>}
                  </div>
                </div>
              </li>
            );
          })}
          <li>
            <Link
              href="/sectors"
              className="pressable flex min-h-[52px] items-center justify-between text-[15px] font-medium text-primary"
            >
              섹터 지도에서 {sectors.items.length}개 모두 보기
              <ChevronRight size={18} aria-hidden />
            </Link>
          </li>
        </ol>
      ) : (
        <p className="mt-3 text-[15px] text-text-muted">섹터 데이터 없음</p>
      )}
    </section>
  );
}
