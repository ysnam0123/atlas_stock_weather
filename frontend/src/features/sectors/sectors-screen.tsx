"use client";

import type { SectorPhase, SectorRow, SectorsResponse } from "@atlas/contracts";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { pct } from "@/features/home/format";
import { SectionTitle } from "@/features/home/section";
import { sectorMeta } from "@/features/home/sectors";
import { UptrendChart } from "@/features/home/uptrend-chart";
import { Term } from "@/features/learn/term";
import { tradeDay } from "@/shared/lib/time";
import { CARD } from "@/shared/ui/card";
import { useSectors } from "./use-sectors";

const PHASES: { key: SectorPhase; title: string; note: string }[] = [
  { key: "leading", title: "주도", note: "비율이 높고 더 오르는 중. 돈이 몰리는 곳" },
  { key: "weakening", title: "식는 중", note: "아직 높지만 내려오는 중. 새로 들어가기엔 조심" },
  { key: "improving", title: "살아나는 중", note: "아직 낮지만 오르는 중. 다음 주도 후보" },
  { key: "lagging", title: "소외", note: "낮고 더 내려가는 중. 피하는 곳" },
];

/** 비율 차이 0.031 → "+3.1%p". 기호를 같이 써서 색만으로 구분하지 않는다 */
function pointChange(d: number | null) {
  if (d == null) return { text: "—", tone: "text-text-muted" };
  const p = d * 100;
  if (Math.abs(p) < 0.05) return { text: "0.0%p", tone: "text-text-muted" };
  return { text: `${p > 0 ? "▲" : "▼"}${Math.abs(p).toFixed(1)}%p`, tone: p > 0 ? "text-up" : "text-down" };
}

/** 수익률 0.034 → "+3.4%" */
function ret(r: number | null) {
  if (r == null) return { text: "—", tone: "text-text-muted" };
  return { text: `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)}%`, tone: r > 0 ? "text-up" : r < 0 ? "text-down" : "text-text-muted" };
}

/**
 * 섹터 지도 (Phase 7). 섹터 안 종목 중 상승추세인 비율(uptrend-analyzer)로 줄을 세우고,
 * 높낮이와 1개월 방향으로 국면 네 칸에 나눈다. 섹터를 누르면 1년 흐름과 대표 ETF 수익률.
 */
export function SectorsScreen() {
  const { data, isPending, isError, refetch } = useSectors();
  const t = data?.tradeDate ? tradeDay(data.tradeDate) : null;

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} lg:p-8`}>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">섹터 지도</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-[1.55] text-text-secondary">
          11개 <Term id="sector">섹터</Term>를 섹터 안 종목 중 <Term id="uptrend">상승추세</Term>인 비율로 줄 세웠어요. 비율이 높고 오르는
          섹터에 돈이 몰려 있어요. 개별 종목도 주도 섹터에 있을 때 더 잘 가는 편이에요.
        </p>
        {t && <p className="mt-3 text-[13px] text-text-muted">{t.month}월 {t.day}일 종가 기준</p>}
      </div>

      {isPending ? (
        <div className={`${CARD} h-80 motion-safe:animate-pulse`} aria-busy="true" />
      ) : isError ? (
        <div className={CARD}>
          <p className="text-[15px] text-text-muted">섹터 데이터 없음</p>
          <button type="button" onClick={() => refetch()} className="pressable mt-3 min-h-11 rounded-full bg-surface px-4 text-[15px]">
            다시 시도
          </button>
        </div>
      ) : !data.sectors.length ? (
        <div className={CARD}>
          <p className="text-[15px] text-text-secondary">아직 섹터 기록이 없어요. 시장 날씨 수집이 한 번 돌면 채워져요.</p>
        </div>
      ) : (
        <>
          <PhaseBoard data={data} />
          <div className={`${CARD} lg:p-8`}>
            <SectionTitle id="sector-table-title" aside="누르면 1년 흐름">
              전체 순위
            </SectionTitle>
            <SectorTable data={data} />
          </div>
        </>
      )}
    </div>
  );
}

function PhaseBoard({ data }: { data: SectorsResponse }) {
  const allFalling = data.sectors.every((s) => (s.change1m ?? 0) < 0);
  return (
    <div className={`${CARD} lg:p-8`}>
      <SectionTitle id="phase-title" aside="높낮이: 11개 섹터 가운데값, 방향: 최근 1개월">
        지금 국면
      </SectionTitle>
      {allFalling && (
        <p className="mt-2 text-[14px] text-text-secondary">
          지금은 11개 섹터가 모두 한 달 전보다 내려왔어요. 시장 전체가 약할 때 나오는 모습이라, 주도 칸이 비어 있어요.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PHASES.map((p) => {
          const list = data.sectors.filter((s) => s.phase === p.key);
          return (
            <section key={p.key} aria-label={p.title} className="rounded-2xl border border-border p-4">
              <p className="text-[16px] font-semibold">{p.title}</p>
              <p className="mt-0.5 text-[13px] text-text-muted">{p.note}</p>
              {list.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {list.map((s) => {
                    const meta = sectorMeta(s.sector);
                    const c = pointChange(s.change1m);
                    return (
                      <li key={s.sector} className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1">
                        <span className={`grid size-7 place-items-center rounded-full text-white ${meta.tile}`}>
                          <meta.icon size={15} strokeWidth={1.8} aria-hidden />
                        </span>
                        <span className="text-[14px]">{meta.ko}</span>
                        <span className="text-[13px] tabular-nums text-text-secondary">{pct(s.uptrendRatio)}</span>
                        <span className={`text-[12px] tabular-nums ${c.tone}`}>{c.text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-text-muted">없음</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SectorTable({ data }: { data: SectorsResponse }) {
  const [open, setOpen] = useState<string | null>(null);
  const th = "py-2 text-[12px] font-normal text-text-muted";
  const num = `${th} text-right`;
  return (
    <table className="mt-3 w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className={`${th} w-10 text-left`}>순위</th>
          <th className={`${th} text-left`}>섹터</th>
          <th className={num}>상승추세</th>
          <th className={`${num} max-sm:hidden`}>1주</th>
          <th className={num}>1개월</th>
          <th className={`${num} max-md:hidden`}>ETF 1개월</th>
          <th className={`${num} max-md:hidden`}>S&amp;P 대비 3개월</th>
          <th className="w-6" />
        </tr>
      </thead>
      <tbody>
        {data.sectors.map((s) => (
          <Row key={s.sector} s={s} dates={data.dates} open={open === s.sector} onToggle={() => setOpen((o) => (o === s.sector ? null : s.sector))} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ s, dates, open, onToggle }: { s: SectorRow; dates: string[]; open: boolean; onToggle: () => void }) {
  const meta = sectorMeta(s.sector);
  const w1 = pointChange(s.change1w);
  const m1 = pointChange(s.change1m);
  const etf = ret(s.etf?.m1 ?? null);
  const rs = ret(s.etf?.rs3m ?? null);
  const rankMove = s.rank1m != null ? s.rank1m - s.rank : 0;
  const td = "py-3 text-right text-[14px] tabular-nums";
  const panelId = `sector-${s.sector.replace(/\s/g, "-")}`;

  return (
    <>
      <tr
        onClick={onToggle}
        className="pressable cursor-pointer border-b border-border hover:bg-surface"
      >
        <td className="py-3 text-[14px] text-text-muted tabular-nums">{s.rank}</td>
        <td className="py-3">
          <button type="button" className="flex items-center gap-2.5 text-left" aria-expanded={open} aria-controls={panelId}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${meta.tile}`}>
              <meta.icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <span>
              <span className="block text-[15px]">{meta.ko}</span>
              {rankMove !== 0 && (
                <span className={`block text-[12px] ${rankMove > 0 ? "text-up" : "text-down"}`}>
                  한 달 전보다 {Math.abs(rankMove)}계단 {rankMove > 0 ? "올라옴" : "내려감"}
                </span>
              )}
            </span>
          </button>
        </td>
        <td className={td}>{pct(s.uptrendRatio)}</td>
        <td className={`${td} max-sm:hidden ${w1.tone}`}>{w1.text}</td>
        <td className={`${td} ${m1.tone}`}>{m1.text}</td>
        <td className={`${td} max-md:hidden ${etf.tone}`}>
          {etf.text}
          {s.etf && <span className="ml-1 text-[12px] text-text-muted">{s.etf.symbol}</span>}
        </td>
        <td className={`${td} max-md:hidden ${rs.tone}`}>{rs.text}</td>
        <td className="py-3 pl-2">
          <ChevronDown size={16} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </td>
      </tr>
      {open && (
        <tr id={panelId} className="border-b border-border">
          <td colSpan={8} className="py-4">
            <p className="mb-2 text-[14px] text-text-secondary">
              {meta.ko} 섹터의 상승추세 비율. 점선은 최근 1년 가운데값({s.median1y != null ? pct(s.median1y) : "—"})이에요.
              {s.etf && (
                <>
                  {" "}
                  대표 ETF {s.etf.symbol}: 1주 {ret(s.etf.w1).text}, 1개월 {ret(s.etf.m1).text}, 3개월 {ret(s.etf.m3).text}.
                </>
              )}
            </p>
            <UptrendChart
              history={dates.map((date, i) => ({ date, uptrendRatio: s.history[i], score: null }))}
              median={s.median1y}
            />
          </td>
        </tr>
      )}
    </>
  );
}
