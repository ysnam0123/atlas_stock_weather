"use client";

import type { AiDuelResponse } from "@atlas/contracts";
import { useWidth } from "@/shared/lib/use-width";
import { tradeDay } from "@/shared/lib/time";

const H = 200;
const PAD = { top: 12, right: 56, bottom: 24, left: 40 };

/** 계열은 셋뿐이라 색을 고정한다. 범례 + 끝 라벨로 색만으로 구분하지 않는다 */
const LINES = [
  { key: "ai", label: "AI", className: "stroke-primary", dot: "bg-primary" },
  { key: "me", label: "나", className: "stroke-text", dot: "bg-text" },
  { key: "spy", label: "S&P 500", className: "stroke-text-muted", dot: "bg-text-muted" },
] as const;

const fmt = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

/** 대결 시작 = 0%. AI, 나, S&P 500 수익률 곡선 */
export function DuelChart({ series }: { series: AiDuelResponse["series"] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const values = series.flatMap((p) => [p.ai, p.me, p.spy]).filter((v): v is number => v != null);
  const lo = Math.min(-1, ...values);
  const hi = Math.max(1, ...values);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (series.length > 1 ? (i / (series.length - 1)) * plotW : plotW);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH;

  const lines = LINES.flatMap((l) => {
    const pts = series.map((p, i) => [i, p[l.key]] as const).filter((p): p is readonly [number, number] => p[1] != null);
    if (!pts.length) return [];
    const [li, lv] = pts[pts.length - 1];
    return [{ ...l, d: pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(""), ex: x(li), ey: y(lv), value: lv, showLabel: true }];
  });
  const placed: number[] = [];
  for (const l of [...lines].sort((a, b) => a.ey - b.ey)) {
    if (placed.some((py) => Math.abs(py - l.ey) < 13)) l.showLabel = false;
    else placed.push(l.ey);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-secondary" aria-hidden>
        {LINES.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2">
        {series.length < 2 ? (
          <p className="py-8 text-center text-[14px] text-text-muted">장이 하루 이상 지나야 곡선이 생겨요</p>
        ) : (
          width > 0 && (
            <svg width={width} height={H} role="img" aria-label="AI, 나, S&P 500 수익률 비교">
              {[lo, 0, hi].map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-text-muted" : "stroke-border"} strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                    {fmt(t)}
                  </text>
                </g>
              ))}
              {lines.map((l) => (
                <g key={l.key}>
                  <path d={l.d} fill="none" className={l.className} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={l.ex} cy={l.ey} r={4} className={`${l.className.replace("stroke-", "fill-")} stroke-bg`} strokeWidth={2} />
                  {/* 끝 라벨이 겹치면 범례에 맡긴다 */}
                  {l.showLabel && (
                    <text x={l.ex + 8} y={l.ey} dy="0.32em" className="fill-text text-[11px] tabular-nums">
                      {l.label} {fmt(l.value)}
                    </text>
                  )}
                </g>
              ))}
              <text x={PAD.left} y={H - 6} className="fill-text-muted text-[11px]">
                {tradeDay(series[0].date).month}월 {tradeDay(series[0].date).day}일
              </text>
              <text x={PAD.left + plotW} y={H - 6} textAnchor="end" className="fill-text-muted text-[11px]">
                {tradeDay(series.at(-1)!.date).month}월 {tradeDay(series.at(-1)!.date).day}일
              </text>
            </svg>
          )
        )}
      </div>
    </div>
  );
}
