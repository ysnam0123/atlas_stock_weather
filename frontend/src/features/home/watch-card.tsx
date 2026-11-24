"use client";

import type { MyWatchItem, MyResponse, WatchReadiness } from "@atlas/contracts";
import { Check, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { changeText, displayName, usd } from "@/features/my/format";
import { tradeDay } from "@/shared/lib/time";
import { SectionTitle } from "./section";

const VCP_RATING: Record<string, string> = {
  "Textbook VCP": "교과서형",
  "Strong VCP": "강한 VCP",
  "Good VCP": "좋은 VCP",
  "Developing VCP": "만들어지는 중",
  "Weak VCP": "약함",
  "No VCP": "VCP 아님",
};
const VCP_STATE: Record<string, string> = { "Pre-breakout": "돌파 직전", Breakout: "돌파 중", Extended: "이미 많이 오름" };

/** VCP 한 줄: "약함, 수축 1번, 피벗 $351.73까지 0.8%" */
function vcpLine(v: NonNullable<WatchReadiness["vcp"]>) {
  const where = v.distancePct < 0 ? `피벗 ${usd(v.pivot)}까지 ${Math.abs(v.distancePct).toFixed(1)}%` : `피벗 ${usd(v.pivot)}보다 ${v.distancePct.toFixed(1)}% 위`;
  return `${VCP_RATING[v.rating] ?? v.rating}, 수축 ${v.contractions}번, ${where}${VCP_STATE[v.state] ? ` (${VCP_STATE[v.state]})` : ""}`;
}

/** 한 줄 상태: 왜 아직 대기인지. 시장 조건은 따로 빼고 종목 조건만 센다 */
function status(r: WatchReadiness | null): { text: string; tone: string } {
  if (!r) return { text: "판단할 일봉이 아직 없어요", tone: "text-text-muted" };
  if (r.verdict === "buy") return { text: "AI 규칙 모두 통과, 매수 자리", tone: "text-primary" };
  if (r.verdict === "hold") return { text: "종목 조건은 통과, 시장이 맑아지면", tone: "text-text-secondary" };
  const failed = r.checks.filter((c) => !c.pass && c.key !== "market").map((c) => c.label);
  const shown = failed.slice(0, 2).join(", ");
  return { text: `걸린 조건: ${shown}${failed.length > 2 ? ` 외 ${failed.length - 2}개` : ""}`, tone: "text-text-muted" };
}

/**
 * 관심 → 매수 대기. 종목마다 AI v2 매수 규칙 체크리스트로 "왜 아직 대기인지"를 보여준다.
 * 행을 누르면 체크리스트가 펼쳐진다. 판단은 규칙 계산이고, 사는 건 사용자가 정한다.
 */
export function WatchCard({
  my,
  failed,
  onInfo,
}: {
  my: MyResponse | undefined;
  failed: boolean;
  /** 그 종목 뉴스·실적·의원 거래 시트 */
  onInfo: (target: { symbol: string; nameKo: string | null; nameEn: string }) => void;
}) {
  const watch = my?.watchlist ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const date = watch.find((w) => w.readiness)?.readiness?.date;

  return (
    <section aria-labelledby="watch-title" className="flex h-full flex-col">
      <SectionTitle id="watch-title" aside={date && `AI v2 규칙, ${tradeDay(date).month}월 ${tradeDay(date).day}일 종가`}>
        관심 → 매수 대기
      </SectionTitle>

      {failed ? (
        <p className="mt-3 text-[15px] text-text-muted">내 종목 데이터 없음</p>
      ) : !my ? (
        <div className="mt-3 h-20 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
      ) : watch.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
          사고 싶은 종목을 관심에 넣어 두세요. AI 매수 규칙으로 매일 어떤 조건이 남았는지 알려드려요.
        </p>
      ) : (
        <ul className="mt-2">
          {watch.map((w) => (
            <WatchRow
              key={w.symbol}
              item={w}
              open={open === w.symbol}
              onToggle={() => setOpen((cur) => (cur === w.symbol ? null : w.symbol))}
              onInfo={() => onInfo(w)}
            />
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <Link href="/search" className="pressable inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-primary">
          <Plus size={16} aria-hidden />
          관심 추가
        </Link>
        <Link href="/my" className="pressable inline-flex min-h-11 items-center text-[14px] text-text-secondary">
          내 종목
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function WatchRow({
  item: w,
  open,
  onToggle,
  onInfo,
}: {
  item: MyWatchItem;
  open: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const change = changeText(w.changePct);
  const s = status(w.readiness);
  const r = w.readiness;
  const stockChecks = r?.checks.filter((c) => c.key !== "market") ?? [];
  const passed = stockChecks.filter((c) => c.pass).length;
  const panelId = `watch-${w.symbol}`;

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="pressable -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-medium">{displayName(w)}</span>
            <span className="shrink-0 text-[12px] text-text-muted">{w.symbol}</span>
          </span>
          <span className={`mt-0.5 block truncate text-[12px] ${s.tone}`}>{s.text}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] tabular-nums">{w.lastClose != null ? usd(w.lastClose) : "—"}</span>
          {change && <span className={`block text-[12px] tabular-nums ${change.tone}`}>{change.text}</span>}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div id={panelId} className="pb-3">
          {r ? (
            <>
              {r.vcp && (
                <p className="mb-1.5 text-[13px] text-text-secondary">
                  <span className="text-text-muted">VCP</span> {vcpLine(r.vcp)}
                </p>
              )}
              <p className="text-[13px] text-text-secondary">
                종목 조건 {stockChecks.length}개 중 {passed}개 통과
                {r.checks.find((c) => c.key === "market" && !c.pass) && ", 시장이 맑지 않아 새 매수는 쉼"}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {r.checks.map((c) => (
                  <li key={c.key} className="flex gap-2 text-[13px] leading-[1.45]">
                    {c.pass ? (
                      <Check size={15} className="mt-0.5 shrink-0 text-primary" aria-label="통과" />
                    ) : (
                      <X size={15} className="mt-0.5 shrink-0 text-text-muted" aria-label="미통과" />
                    )}
                    <span>
                      {c.label}
                      <span className="ml-1.5 text-[12px] text-text-muted">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {r.verdict !== "watch" && r.stopPrice != null && (
                <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[13px] leading-[1.5] tabular-nums">
                  {r.verdict === "hold" && "시장이 맑아지면 "}
                  {usd(r.triggerPrice)} 넘으면 매수, 손절가 {usd(r.stopPrice)}
                  {r.mySize && (
                    <>
                      . 내 계좌라면 <span className="font-semibold">{r.mySize.shares}주</span> ({usd(r.mySize.amount)}), 손절되면{" "}
                      {usd(r.mySize.risk)}
                    </>
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-text-muted">일봉을 받으면 다음 실행 때 판단해요.</p>
          )}
          <button type="button" onClick={onInfo} className="pressable mt-2 min-h-9 text-[13px] font-medium text-primary">
            뉴스·실적·의원 거래 보기
          </button>
        </div>
      )}
    </li>
  );
}
