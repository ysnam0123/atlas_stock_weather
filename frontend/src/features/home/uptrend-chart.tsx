"use client";

import type { HomeHistoryPoint } from "@atlas/contracts";
import { useMemo, useState } from "react";
import { tradeDay } from "@/shared/lib/time";
import { useWidth } from "@/shared/lib/use-width";
import { pct } from "./format";

const RANGES = [
  { key: "3m", label: "3개월", days: 63 },
  { key: "1y", label: "1년", days: 260 },
] as const;

const H = 180;
const PAD = { top: 12, right: 44, bottom: 24, left: 34 };

const dayLabel = (date: string) => {
  const t = tradeDay(date);
  return `${t.month}월 ${t.day}일`;
};

/** ② 상승추세 비율 흐름. 한 줄짜리 차트라 범례 없이 제목이 이름을 대신한다 */
export function UptrendChart({ history, median }: { history: HomeHistoryPoint[]; median: number | null }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m");
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const points = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    return history
      .filter((p): p is HomeHistoryPoint & { uptrendRatio: number } => p.uptrendRatio != null)
      .slice(-days);
  }, [history, range]);

  const last = points.at(-1);
  const max = Math.max(0.3, ...points.map((p) => p.uptrendRatio), median ?? 0);
  const yMax = Math.ceil(max * 10) / 10;
  const ticks = Array.from({ length: Math.round(yMax * 10) + 1 }, (_, i) => i / 10).filter(
    (_, i, all) => all.length <= 6 || i % 2 === 0,
  );

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : 0);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.uptrendRatio).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const active = hover != null ? points[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!points.length || plotW <= 0) return;
    const left = e.currentTarget.getBoundingClientRect().left;
    const ratio = (e.clientX - left - PAD.left) / plotW;
    setHover(Math.round(Math.min(1, Math.max(0, ratio)) * (points.length - 1)));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-medium">상승추세 종목 비율</p>
        <div role="group" aria-label="기간" className="flex rounded-full bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={`pressable min-h-8 rounded-full px-3 text-[13px] ${
                range === r.key ? "bg-primary font-medium text-white" : "text-text-secondary hover:text-text"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative mt-3">
        {width > 0 && points.length > 1 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`상승추세 종목 비율, ${dayLabel(points[0].date)}부터 ${dayLabel(last!.date)}까지. 마지막 값 ${pct(last!.uptrendRatio)}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            className="touch-pan-y select-none"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}

            {median != null && (
              <g>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(median)} y2={y(median)} className="stroke-text-muted" strokeWidth={1} />
                {/* 오른쪽 여백에 두 줄로 둔다 (선 위에 두면 데이터를 가린다) */}
                <text x={PAD.left + plotW + 8} y={y(median)} className="fill-text-muted text-[11px]">
                  <tspan dy="-0.2em">보통</tspan>
                  <tspan x={PAD.left + plotW + 8} dy="1.2em">
                    {pct(median)}
                  </tspan>
                </text>
              </g>
            )}

            <path d={area} className="fill-primary/10" />
            <path d={line} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* 끝점 + 값 */}
            <circle cx={x(points.length - 1)} cy={y(last!.uptrendRatio)} r={4} className="fill-primary stroke-bg" strokeWidth={2} />
            <text x={x(points.length - 1) + 8} y={y(last!.uptrendRatio)} dy="0.32em" className="fill-text text-[12px] font-medium tabular-nums">
              {pct(last!.uptrendRatio)}
            </text>

            <text x={PAD.left} y={H - 6} className="fill-text-muted text-[11px]">
              {dayLabel(points[0].date)}
            </text>
            <text x={PAD.left + plotW} y={H - 6} textAnchor="end" className="fill-text-muted text-[11px]">
              {dayLabel(last!.date)}
            </text>

            {active && hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-text-secondary" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(active.uptrendRatio)} r={4} className="fill-primary stroke-bg" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}

        {active && hover != null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg bg-text px-2.5 py-1.5 text-white shadow-lg"
            style={{
              left: Math.min(Math.max(x(hover) - 48, 0), width - 96),
            }}
          >
            <p className="text-[13px] font-semibold tabular-nums">{pct(active.uptrendRatio)}</p>
            <p className="text-[11px] text-white/70">{dayLabel(active.date)}</p>
          </div>
        )}

        {/* 프리렌더·폭 측정 전 자리 */}
        {width === 0 && <div style={{ height: H }} />}
      </div>
    </div>
  );
}
