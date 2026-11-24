"use client";

import type { MyHolding, MyResponse } from "@atlas/contracts";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changeText, displayName, STOP_TONE_CLASS, stopStatus, usd } from "@/features/my/format";
import { SectionTitle } from "./section";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`;

function Pnl({ h }: { h: MyHolding }) {
  const c = changeText(h.pnlPct);
  if (!c || h.pnl == null) return <span className="text-text-muted">—</span>;
  return (
    <span className={c.tone}>
      {c.text}
      <span className="block text-[12px]">{signed(h.pnl)}</span>
    </span>
  );
}

/**
 * 보유 종목 표. 트레이더가 매일 보는 숫자: 수익, 손절가까지 거리, 열린 위험(다 손절되면 잃는 돈), 보유 일수.
 * 넓은 화면은 표, 좁은 화면은 줄 목록. 행을 누르면 종목 상세(차트 위 계획선, 편집도 거기서).
 */
export function Positions({ my, failed }: { my: MyResponse | undefined; failed: boolean }) {
  const router = useRouter();
  const open = (symbol: string) => router.push(`/stocks/${encodeURIComponent(symbol)}`);
  const holdings = my?.holdings ?? [];
  const s = my?.summary;

  return (
    <section aria-labelledby="positions-title">
      <SectionTitle
        id="positions-title"
        aside={
          s &&
          holdings.length > 0 && (
            <span className="tabular-nums">
              평가 {usd(s.marketValue)}, 열린 위험{" "}
              {/* 손절가가 하나도 없으면 위험을 계산할 수 없다. $0으로 보이면 안전해 보인다 */}
              {s.noStopCount === holdings.length ? "모름" : usd(s.openRisk)}
              {s.noStopCount > 0 && `, 손절가 없음 ${s.noStopCount}`}
            </span>
          )
        }
      >
        보유 종목
      </SectionTitle>

      {failed ? (
        <p className="mt-3 text-[15px] text-text-muted">내 종목 데이터 없음</p>
      ) : !my ? (
        <div className="mt-3 h-24 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
      ) : holdings.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-text-secondary">보유 종목을 넣으면 수익, 손절가까지 거리, 열린 위험이 여기에 나와요.</p>
          <Link
            href="/search"
            className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={18} aria-hidden />
            종목 추가
          </Link>
        </div>
      ) : (
        <>
          {/* 넓은 화면: 표 */}
          <table className="mt-3 hidden w-full text-[14px] tabular-nums xl:table">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-text-muted">
                <th className="py-2 pr-3 font-normal">종목</th>
                <th className="py-2 pr-3 text-right font-normal">수량</th>
                <th className="py-2 pr-3 text-right font-normal">평단</th>
                <th className="py-2 pr-3 text-right font-normal">종가</th>
                <th className="py-2 pr-3 text-right font-normal">수익</th>
                <th className="py-2 pr-3 text-right font-normal">손절가</th>
                <th className="py-2 pr-3 font-normal">손절까지</th>
                <th className="py-2 pr-3 text-right font-normal">열린 위험</th>
                <th className="py-2 text-right font-normal">보유</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const status = stopStatus(h);
                const change = changeText(h.changePct);
                return (
                  <tr
                    key={h.symbol}
                    onClick={() => open(h.symbol)}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface"
                  >
                    <td className="py-3 pr-3">
                      <Link href={`/stocks/${encodeURIComponent(h.symbol)}`} className="text-left" onClick={(e) => e.stopPropagation()}>
                        <span className="block text-[15px] font-medium">{displayName(h)}</span>
                        <span className="text-[12px] text-text-muted">{h.symbol}</span>
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-right">{h.shares}</td>
                    <td className="py-3 pr-3 text-right">{usd(h.avgCost)}</td>
                    <td className="py-3 pr-3 text-right">
                      {h.lastClose != null ? usd(h.lastClose) : "—"}
                      {change && <span className={`block text-[12px] ${change.tone}`}>{change.text}</span>}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <Pnl h={h} />
                    </td>
                    <td className="py-3 pr-3 text-right">{h.stopPrice != null ? usd(h.stopPrice) : "—"}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[12px] whitespace-nowrap ${STOP_TONE_CLASS[status.tone]}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">{h.openRisk != null ? usd(h.openRisk) : "—"}</td>
                    <td className="py-3 text-right text-text-secondary">{h.daysHeld}일</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 좁은 화면: 줄 목록 */}
          <ul className="mt-2 -mx-2 xl:hidden">
            {holdings.map((h) => {
              const status = stopStatus(h);
              return (
                <li key={h.symbol} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => open(h.symbol)}
                    className="pressable flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[16px] font-medium">{displayName(h)}</span>
                        <span className="shrink-0 text-[12px] text-text-muted">{h.symbol}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-secondary tabular-nums">
                        <span>
                          {h.shares}주, 평단 {usd(h.avgCost)}, {h.daysHeld}일째
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] ${STOP_TONE_CLASS[status.tone]}`}>{status.text}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[15px] tabular-nums">
                      {h.lastClose != null ? usd(h.lastClose) : "—"}
                      <span className="block text-[13px]">
                        <Pnl h={h} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
