"use client";

import type { StockDetail } from "@atlas/contracts";
import { useQuery } from "@tanstack/react-query";
import { Check, Newspaper, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionTitle } from "@/features/home/section";
import { changeText, displayName, usd } from "@/features/my/format";
import { HoldingSheet, type SheetTarget } from "@/features/my/holding-sheet";
import { StockInfoSheet } from "@/features/my/stock-info-sheet";
import { useAddWatch, useMy } from "@/features/my/use-my";
import { api } from "@/shared/api/client";
import { tradeDay } from "@/shared/lib/time";
import { CARD } from "@/shared/ui/card";
import { DeepAnalysis } from "./deep-analysis";
import { type PlanLine, PlanChart } from "./plan-chart";

export const stockKey = (symbol: string) => ["stock", symbol] as const;

const VERDICT_KO: Record<string, string> = { buy: "매수", hold: "보류 (시장)", watch: "관찰", sell: "매도 신호" };
const STATUS_KO: Record<string, string> = {
  planned: "조건부 주문",
  filled: "체결",
  expired: "주문 취소",
  skipped: "건너뜀",
  held: "보류",
  watch: "관찰",
  done: "매도 신호",
};
const EXIT_KO: Record<string, string> = { stop: "손절가", target: "목표가", ma50: "50일선 이탈", time: "시간 손절", ema21: "21일 지수선 이탈" };

/** 계획 가격선: 내 것은 진한 색, AI 규칙 것은 점선 */
function planLines(d: StockDetail): PlanLine[] {
  const lines: PlanLine[] = [];
  if (d.holding) {
    lines.push({ key: "avg", label: "내 평단", price: d.holding.avgCost, color: "--color-text" });
    if (d.holding.stopPrice != null) lines.push({ key: "stop", label: "내 손절가", price: d.holding.stopPrice, color: "--color-down" });
    if (d.holding.targetPrice != null) lines.push({ key: "target", label: "내 목표가", price: d.holding.targetPrice, color: "--color-up" });
  }
  const r = d.readiness;
  if (r && r.verdict !== "watch") {
    lines.push({ key: "trigger", label: "조건부 매수가", price: r.triggerPrice, color: "--color-primary", dashed: true });
    if (r.stopPrice != null && !d.holding) lines.push({ key: "rule-stop", label: "규칙 손절가", price: r.stopPrice, color: "--color-down", dashed: true });
  }
  if (r?.vcp) lines.push({ key: "pivot", label: "VCP 피벗", price: r.vcp.pivot, color: "--color-steel", dashed: true });
  return lines;
}

/**
 * 종목 상세 (Phase 6). 차트 위에 내 계획과 AI 규칙의 가격선을 겹쳐 보고,
 * 지금 AI 매수 규칙으로 어떤 상태인지, 내 포지션과 매매 기록, AI가 이 종목을 어떻게 다뤘는지를 한 화면에.
 */
export function StockScreen({ symbol }: { symbol: string }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: stockKey(symbol),
    queryFn: () => api.get<StockDetail>(`/stocks/${encodeURIComponent(symbol)}`),
  });
  const my = useMy();
  const addWatch = useAddWatch();
  const [infoOpen, setInfoOpen] = useState(false);
  const [holdTarget, setHoldTarget] = useState<SheetTarget | null>(null);
  const lines = useMemo(() => (data ? planLines(data) : []), [data]);

  if (isPending) return <div className={`mt-2 lg:m-5 lg:ml-0 ${CARD} h-[520px] motion-safe:animate-pulse`} aria-busy="true" />;
  if (isError || !data)
    return (
      <div className={`mt-2 lg:m-5 lg:ml-0 ${CARD}`}>
        <p className="text-[17px]">종목을 불러오지 못했어요</p>
        <p className="mt-1 text-[14px] text-text-secondary">티커가 맞는지, API 서버가 켜져 있는지 확인해 주세요.</p>
        <button type="button" onClick={() => refetch()} className="pressable mt-4 min-h-11 rounded-full bg-surface px-4 text-[15px]">
          다시 시도
        </button>
      </div>
    );

  const change = changeText(data.changePct);
  const t = data.lastDate ? tradeDay(data.lastDate) : null;
  const myHolding = my.data?.holdings.find((h) => h.symbol === data.symbol);

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} lg:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-text-muted">
              {data.symbol}, {data.exchange}
              {data.type === "etf" && ", ETF"}
            </p>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em]">{displayName(data)}</h1>
            {data.nameKo && <p className="text-[13px] text-text-secondary">{data.nameEn}</p>}
            <p className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-[28px] font-semibold tracking-[-0.02em]">{data.lastClose != null ? usd(data.lastClose) : "—"}</span>
              {change && <span className={`text-[15px] ${change.tone}`}>{change.text}</span>}
              {t && <span className="text-[13px] text-text-muted">{t.month}월 {t.day}일 정규장 종가</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] hover:bg-border"
            >
              <Newspaper size={16} aria-hidden />
              뉴스·실적·의원 거래
            </button>
            {!data.holding && !data.watching && (
              <button
                type="button"
                disabled={addWatch.isPending}
                onClick={() => addWatch.mutate(data.symbol, { onSuccess: () => refetch() })}
                className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] hover:bg-border disabled:opacity-50"
              >
                <Plus size={16} aria-hidden />
                관심
              </button>
            )}
            <button
              type="button"
              onClick={() => setHoldTarget({ symbol: data.symbol, nameKo: data.nameKo, nameEn: data.nameEn, holding: myHolding })}
              className="pressable inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-[15px] font-medium text-white hover:bg-primary-hover"
            >
              {data.holding ? "보유 편집" : "보유 등록"}
            </button>
          </div>
        </div>
      </div>

      <div className={`${CARD} lg:p-8`}>
        {data.bars.length ? <PlanChart bars={data.bars} lines={lines} /> : <p className="text-[15px] text-text-muted">일봉 데이터 없음</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div className={`${CARD} lg:p-8`}>
          <Readiness d={data} />
        </div>
        <div className="space-y-4 lg:space-y-5">
          <div className={`${CARD} lg:p-8`}>
            <MyPosition d={data} />
          </div>
          <div className={`${CARD} lg:p-8`}>
            <AiHistory d={data} />
          </div>
        </div>
      </div>

      <div className={`${CARD} lg:p-8`}>
        <DeepAnalysis symbol={data.symbol} />
      </div>

      <StockInfoSheet target={infoOpen ? data : null} onClose={() => setInfoOpen(false)} />
      <HoldingSheet
        target={holdTarget}
        onClose={() => {
          setHoldTarget(null);
          void refetch();
        }}
      />
    </div>
  );
}

function Readiness({ d }: { d: StockDetail }) {
  const r = d.readiness;
  return (
    <section aria-labelledby="readiness-title">
      <SectionTitle id="readiness-title" aside="AI v2 매수 규칙">
        지금 사도 되는 자리인가
      </SectionTitle>
      {!r ? (
        <p className="mt-2 text-[15px] text-text-muted">일봉이 30개보다 적어 판단하지 않아요.</p>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-[1.5]">{r.reasonKo}</p>
          {r.vcp && (
            <p className="mt-2 text-[13px] text-text-secondary">
              <span className="text-text-muted">VCP</span> {r.vcp.rating}, 수축 {r.vcp.contractions}번, 피벗 {usd(r.vcp.pivot)} (종가{" "}
              {r.vcp.distancePct >= 0 ? "+" : ""}
              {r.vcp.distancePct.toFixed(1)}%), {r.vcp.valid ? "유효" : "아직 유효한 VCP 아님"}
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {r.checks.map((c) => (
              <li key={c.key} className="flex gap-2 text-[14px] leading-[1.45]">
                {c.pass ? (
                  <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-label="통과" />
                ) : (
                  <X size={16} className="mt-0.5 shrink-0 text-text-muted" aria-label="미통과" />
                )}
                <span>
                  {c.label}
                  <span className="ml-1.5 text-[13px] text-text-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {r.verdict !== "watch" && r.stopPrice != null && (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[14px] leading-[1.5] tabular-nums">
              {r.verdict === "hold" && "시장이 맑아지면 "}
              {usd(r.triggerPrice)} 넘으면 매수, 손절가 {usd(r.stopPrice)}
              {r.mySize && (
                <>
                  . 내 계좌라면 <span className="font-semibold">{r.mySize.shares}주</span> ({usd(r.mySize.amount)}), 손절되면 {usd(r.mySize.risk)}
                </>
              )}
            </p>
          )}
          <p className="mt-3 text-[12px] text-text-muted">규칙 계산 결과예요. 예측이 아니고, 고르는 건 나예요.</p>
        </>
      )}
    </section>
  );
}

function MyPosition({ d }: { d: StockDetail }) {
  const h = d.holding;
  const close = d.lastClose;
  return (
    <section aria-labelledby="mine-title">
      <SectionTitle id="mine-title" aside={d.trades.length ? `매매 ${d.trades.length}번` : undefined}>
        내 포지션
      </SectionTitle>
      {h ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] tabular-nums sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-text-muted">수량, 평단</dt>
            <dd>
              {h.shares}주, {usd(h.avgCost)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-text-muted">수익</dt>
            <dd className={close != null ? (close >= h.avgCost ? "text-up" : "text-down") : ""}>
              {close != null ? `${close >= h.avgCost ? "+" : "−"}${usd(Math.abs((close - h.avgCost) * h.shares))} (${(((close / h.avgCost) - 1) * 100).toFixed(1)}%)` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-text-muted">손절가</dt>
            <dd>
              {h.stopPrice != null ? (
                <>
                  {usd(h.stopPrice)}
                  {close != null && <span className="text-text-muted"> ({(((close - h.stopPrice) / close) * 100).toFixed(1)}% 위)</span>}
                </>
              ) : (
                <span className="text-primary-hover">없음</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-[15px] text-text-secondary">{d.watching ? "관심 종목이에요. 보유하고 있지 않아요." : "보유하지 않은 종목이에요."}</p>
      )}
      {d.trades.length > 0 && (
        <ul className="mt-4 border-t border-border">
          {d.trades.map((tr) => (
            <li key={tr.id} className="flex items-center gap-3 border-b border-border py-2 text-[14px] tabular-nums last:border-b-0">
              <span className="w-24 shrink-0 text-text-muted">{tr.date}</span>
              <span className="flex-1">
                {tr.side === "buy" ? "샀음" : "팔았음"} {tr.shares}주 {usd(tr.price)}
              </span>
              {tr.realizedPnl != null && (
                <span className={tr.realizedPnl >= 0 ? "text-up" : "text-down"}>
                  {tr.realizedPnl >= 0 ? "+" : "−"}
                  {usd(Math.abs(tr.realizedPnl))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/records" className="pressable mt-3 inline-flex min-h-10 items-center text-[14px] text-primary">
        매매 기록 남기기
      </Link>
    </section>
  );
}

function AiHistory({ d }: { d: StockDetail }) {
  const empty = !d.signals.length && !d.aiPositions.length;
  return (
    <section aria-labelledby="ai-hist-title">
      <SectionTitle id="ai-hist-title">AI는 이 종목을</SectionTitle>
      {empty ? (
        <p className="mt-2 text-[15px] text-text-secondary">AI 스캔에 잡힌 적이 없어요.</p>
      ) : (
        <ul className="mt-2">
          {d.aiPositions.map((p) => (
            <li key={`${p.version}-${p.entryDate}`} className="border-b border-border py-2 text-[14px] tabular-nums last:border-b-0">
              <span className="font-medium">AI {p.version}</span>{" "}
              {p.status === "open"
                ? `보유 중: ${p.entryDate}에 ${p.shares}주 ${usd(p.entryPrice)}, 손절가 ${usd(p.stopPrice)}`
                : `${p.entryDate} ${usd(p.entryPrice)}에 사서 ${p.exitDate} ${usd(p.exitPrice ?? 0)}에 팖 (${EXIT_KO[p.exitReason ?? ""] ?? p.exitReason})`}
            </li>
          ))}
          {d.signals.map((s, i) => (
            <li key={`${s.version}-${s.date}-${s.side}-${i}`} className="border-b border-border py-2 last:border-b-0">
              <p className="text-[14px]">
                <span className="text-text-muted tabular-nums">{s.date}</span> <span className="font-medium">AI {s.version}</span>{" "}
                {VERDICT_KO[s.verdict] ?? s.verdict}
                {s.status !== s.verdict && s.status !== "held" && s.status !== "done" && `, ${STATUS_KO[s.status] ?? s.status}`}
                {s.triggerPrice != null && s.verdict !== "watch" && s.side === "buy" && (
                  <span className="tabular-nums text-text-secondary">, {usd(s.triggerPrice)} 넘으면</span>
                )}
              </p>
              {s.note && <p className="text-[12px] text-text-muted">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
