"use client";

import type { HomeSectorHistory } from "@atlas/contracts";
import { useState } from "react";
import { tradeDay } from "@/shared/lib/time";
import { pct } from "./format";
import { sectorMeta } from "./sectors";

/** 순위 → 한 가지 색의 진하기 (1위가 가장 진함). 순차 색은 한 색상의 밝기만 바꾼다 */
const cellColor = (rank: number | null, total: number) => {
  if (rank == null) return "transparent";
  const strength = 100 - ((rank - 1) / Math.max(1, total - 1)) * 88;
  return `color-mix(in oklab, var(--color-primary) ${strength.toFixed(0)}%, var(--color-bg))`;
};

const dayLabel = (date: string) => {
  const t = tradeDay(date);
  return `${t.month}월 ${t.day}일`;
};

/** ② 섹터 순위 히트맵: 어느 섹터가 올라오고 내려가는지 */
export function SectorHeatmap({ data }: { data: HomeSectorHistory }) {
  const [hover, setHover] = useState<{ s: number; d: number } | null>(null);
  const total = data.sectors.length;
  const cols = data.dates.length;

  const readout = (() => {
    if (!hover) return null;
    const row = data.sectors[hover.s];
    const rank = row.ranks[hover.d];
    const ratio = row.ratios[hover.d];
    return { name: sectorMeta(row.sector).ko, date: dayLabel(data.dates[hover.d]), rank, ratio };
  })();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-medium">섹터 순위 흐름</p>
        <p className="text-[13px] text-text-muted">최근 {cols}거래일</p>
      </div>

      {/* 마우스를 올린 칸의 값. 비어 있으면 읽는 법 */}
      <p className="mt-1 min-h-5 text-[13px] text-text-secondary" aria-live="polite">
        {readout ? (
          <>
            <span className="font-semibold text-text">{readout.rank ? `${readout.rank}위` : "기록 없음"}</span>{" "}
            {readout.name}, {readout.date}
            {readout.ratio != null && <> (상승추세 {pct(readout.ratio)})</>}
          </>
        ) : (
          "진할수록 순위가 높아요. 오른쪽 끝이 최근이에요."
        )}
      </p>

      <div
        role="img"
        aria-label={`11개 섹터의 최근 ${cols}거래일 순위. 오늘 1위는 ${sectorMeta(data.sectors[0]?.sector ?? "").ko}`}
        className="mt-3 grid gap-[2px]"
        style={{ gridTemplateColumns: `84px repeat(${cols}, minmax(0, 1fr))` }}
        onPointerLeave={() => setHover(null)}
      >
        {data.sectors.map((row, s) => (
          <div key={row.sector} className="contents">
            <span className="truncate pr-2 text-[12px] leading-[20px] text-text-secondary">
              {sectorMeta(row.sector).ko}
            </span>
            {row.ranks.map((rank, d) => (
              <span
                key={d}
                onPointerEnter={() => setHover({ s, d })}
                className={`h-5 rounded-[3px] ${hover?.s === s && hover.d === d ? "ring-2 ring-text ring-inset" : ""}`}
                style={{ background: cellColor(rank, total) }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between pl-[86px] text-[11px] text-text-muted">
        <span>{dayLabel(data.dates[0])}</span>
        <span>{dayLabel(data.dates[cols - 1])}</span>
      </div>
    </div>
  );
}
