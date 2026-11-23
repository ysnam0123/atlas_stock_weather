"use client";

import type { MyHolding, MyWatchItem } from "@atlas/contracts";
import { ChevronRight, Newspaper, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionTitle } from "@/features/home/section";
import { CARD } from "@/shared/ui/card";
import { changeText, displayName, STOP_TONE_CLASS, stopStatus, usd } from "./format";
import { HoldingSheet, type SheetTarget } from "./holding-sheet";
import { type InfoTarget, StockInfoSheet } from "./stock-info-sheet";
import { useMy, useRemoveWatch } from "./use-my";

/** 내 종목: 보유(수량·평단가·손절가)와 관심 종목. 행을 누르면 편집 시트 */
export function MyScreen() {
  const { data, isPending, isError, refetch } = useMy();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [info, setInfo] = useState<InfoTarget | null>(null);

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} flex items-center justify-between gap-3 lg:p-8`}>
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">내 종목</h1>
          <p className="mt-1 text-[14px] text-text-secondary">가격은 정규장 종가 기준이에요. 실시간 가격은 증권사 앱에서 보세요.</p>
        </div>
        <Link
          href="/search"
          className="pressable inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={18} aria-hidden />
          종목 추가
        </Link>
      </div>

      {isPending ? (
        <div className={`${CARD} h-60 motion-safe:animate-pulse`} aria-busy="true" aria-label="불러오는 중" />
      ) : isError ? (
        <div className={CARD}>
          <p className="text-[15px] text-text-secondary">내 종목을 불러오지 못했어요.</p>
          <button type="button" onClick={() => refetch()} className="pressable mt-3 min-h-11 rounded-full bg-surface px-5 text-[15px]">
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
          <section aria-labelledby="holdings-title" className={CARD}>
            <SectionTitle id="holdings-title" aside={`${data.holdings.length}종목`}>
              보유
            </SectionTitle>
            {data.holdings.length ? (
              <ul className="mt-2 -mx-2">
                {data.holdings.map((h) => (
                  <HoldingRow key={h.symbol} h={h} onOpen={() => setSheet({ ...h, holding: h })} onInfo={() => setInfo(h)} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] leading-[1.5] text-text-secondary">
                아직 보유 종목이 없어요. 종목을 추가하고 수량과 평단가를 넣으면 손절가까지 남은 거리를 매일 알려드려요.
              </p>
            )}
          </section>

          <section aria-labelledby="watch-title" className={CARD}>
            <SectionTitle id="watch-title" aside={`${data.watchlist.length}종목`}>
              관심
            </SectionTitle>
            {data.watchlist.length ? (
              <ul className="mt-2 -mx-2">
                {data.watchlist.map((w) => (
                  <WatchRow key={w.symbol} w={w} onBuy={() => setSheet(w)} onInfo={() => setInfo(w)} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] leading-[1.5] text-text-secondary">
                지켜보고 싶은 종목을 추가해 두세요. 진입 조건이 붙으면(Phase 5) 어디까지 통과했는지 보여드려요.
              </p>
            )}
          </section>
        </div>
      )}

      <HoldingSheet target={sheet} onClose={() => setSheet(null)} />
      <StockInfoSheet target={info} onClose={() => setInfo(null)} />
    </div>
  );
}

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} 소식`}
      title="뉴스·공시, 분기 실적, 의원 거래"
      className="pressable grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text"
    >
      <Newspaper size={18} aria-hidden />
    </button>
  );
}

function PriceCell({ lastClose, changePct }: { lastClose: number | null; changePct: number | null }) {
  const change = changeText(changePct);
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[16px] tabular-nums">{lastClose != null ? usd(lastClose) : "—"}</span>
      {change ? (
        <span className={`block text-[13px] tabular-nums ${change.tone}`}>{change.text}</span>
      ) : (
        <span className="block text-[13px] text-text-muted">{lastClose == null ? "가격 받는 중" : ""}</span>
      )}
    </span>
  );
}

function HoldingRow({ h, onOpen, onInfo }: { h: MyHolding; onOpen: () => void; onInfo: () => void }) {
  const status = stopStatus(h);
  return (
    <li className="flex items-center border-b border-border last:border-b-0">
      <button type="button" onClick={onOpen} className="pressable flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-surface">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[16px] font-medium">{displayName(h)}</span>
            <span className="shrink-0 text-[13px] text-text-muted">{h.symbol}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-secondary">
            <span className="tabular-nums">
              {h.shares}주, 평단 {usd(h.avgCost)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[12px] ${STOP_TONE_CLASS[status.tone]}`}>{status.text}</span>
          </span>
        </span>
        <PriceCell lastClose={h.lastClose} changePct={h.changePct} />
        <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
      </button>
      <InfoButton label={displayName(h)} onClick={onInfo} />
    </li>
  );
}

function WatchRow({ w, onBuy, onInfo }: { w: MyWatchItem; onBuy: () => void; onInfo: () => void }) {
  const remove = useRemoveWatch();
  return (
    <li className="flex items-center gap-2 border-b border-border px-2 py-3 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[16px] font-medium">{displayName(w)}</span>
          <span className="shrink-0 text-[13px] text-text-muted">{w.symbol}</span>
        </span>
        <button type="button" onClick={onBuy} className="pressable mt-1 text-[13px] font-medium text-primary">
          보유로 옮기기
        </button>
      </span>
      <PriceCell lastClose={w.lastClose} changePct={w.changePct} />
      <InfoButton label={displayName(w)} onClick={onInfo} />
      <button
        type="button"
        aria-label={`${displayName(w)} 관심에서 빼기`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(w.symbol)}
        className="pressable grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface"
      >
        <X size={18} aria-hidden />
      </button>
    </li>
  );
}
