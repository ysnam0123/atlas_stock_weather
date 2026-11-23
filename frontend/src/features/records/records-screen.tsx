"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteTrade, useTrades } from "@/features/ai/use-ai";
import { SectionTitle } from "@/features/home/section";
import { displayName, usd } from "@/features/my/format";
import { CARD } from "@/shared/ui/card";
import { TradeSheet } from "./trade-sheet";

/** 기록: 내 매매 기록 (샀음·팔았음). AI 대결의 "나" 성적이 여기서 나온다 */
export function RecordsScreen() {
  const { data, isPending, isError } = useTrades();
  const remove = useDeleteTrade();
  const [open, setOpen] = useState(false);
  const realized = (data ?? []).reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 lg:p-8`}>
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">기록</h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            증권사 앱에서 사고판 뒤 여기에 남겨 주세요. 보유 종목이 같이 바뀌고, AI 대결의 내 성적이 계산돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={18} aria-hidden />
          매매 기록 추가
        </button>
      </div>

      <section aria-labelledby="trades-title" className={CARD}>
        <SectionTitle
          id="trades-title"
          aside={data?.length ? `실현 손익 ${realized >= 0 ? "+" : "−"}${usd(Math.abs(realized))}` : undefined}
        >
          매매 기록
        </SectionTitle>
        {isPending ? (
          <div className="mt-3 h-24 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
        ) : isError ? (
          <p className="mt-3 text-[15px] text-text-muted">기록을 불러오지 못했어요.</p>
        ) : data.length === 0 ? (
          <p className="mt-3 text-[15px] leading-[1.5] text-text-secondary">
            아직 기록이 없어요. 오늘 이후 사고판 것부터 남기면 AI와 같은 날부터 비교돼요.
          </p>
        ) : (
          <ul className="mt-2 -mx-2">
            {data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b border-border px-2 py-3 last:border-b-0">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    t.side === "buy" ? "bg-primary-tint text-primary-hover" : "bg-surface text-text-secondary"
                  }`}
                >
                  {t.side === "buy" ? "샀음" : "팔았음"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{t.symbol}</span>
                    <span className="truncate text-[14px] text-text-secondary">{displayName(t)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-text-muted tabular-nums">
                    {t.date}, {usd(t.price)}에 {t.shares}주{t.note && `, ${t.note}`}
                  </span>
                </span>
                {t.realizedPnl != null && (
                  <span className={`shrink-0 text-[14px] tabular-nums ${t.realizedPnl >= 0 ? "text-up" : "text-down"}`}>
                    {t.realizedPnl >= 0 ? "▲" : "▼"}
                    {usd(Math.abs(t.realizedPnl))}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="기록 지우기"
                  title="기록만 지워요. 보유 수량은 그대로예요"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(t.id)}
                  className="pressable grid size-10 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TradeSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
