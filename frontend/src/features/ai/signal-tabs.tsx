"use client";

import type { AiSignal } from "@atlas/contracts";
import { useState, type ReactNode } from "react";
import { tradeDay } from "@/shared/lib/time";
import { SignalCard } from "./signal-card";

type Tab = "buy" | "sell" | "watch";

const TABS: { key: Tab; label: string }[] = [
  { key: "buy", label: "매수" },
  { key: "sell", label: "매도" },
  { key: "watch", label: "관찰" },
];

/** 같은 장 날짜끼리 묶어 날짜 줄을 붙인다 (최근 날짜가 위) */
function ByDate({ list }: { list: AiSignal[] }) {
  const dates = [...new Set(list.map((s) => s.date))];
  return dates.map((date) => {
    const t = tradeDay(date);
    return (
      <div key={date} className="mt-3">
        <p className="text-[12px] text-text-muted">
          {t.month}월 {t.day}일({t.weekday}) 종가 기준
        </p>
        <div className="mt-1 -mx-2">
          {list
            .filter((s) => s.date === date)
            .map((s) => (
              <SignalCard key={s.id} s={s} />
            ))}
        </div>
      </div>
    );
  });
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-surface px-4 py-4 text-[15px] leading-[1.55] text-text-secondary">{children}</p>;
}

/**
 * AI 신호를 매수·매도·관찰 탭으로 나눈다.
 * 매수 탭에는 "보류"(종목 조건은 통과, 시장 때문에 대기)도 따로 묶어 보여준다. 매수 후보라서다.
 */
export function SignalTabs({ signals }: { signals: AiSignal[] }) {
  const [tab, setTab] = useState<Tab>("buy");
  const buys = signals.filter((s) => s.verdict === "buy");
  const holds = signals.filter((s) => s.verdict === "hold");
  const sells = signals.filter((s) => s.verdict === "sell");
  const watches = signals.filter((s) => s.verdict === "watch");
  const count: Record<Tab, number> = { buy: buys.length, sell: sells.length, watch: watches.length };
  // 매수가 없을 때 이유: 시장 판정 체크의 설명 ("시장 판정 비: 새 매수 쉼")
  const market = signals.find((s) => s.side === "buy")?.checks.find((c) => c.key === "market");
  const weatherWord = market && !market.pass ? /시장 판정 (\S+):/.exec(market.detail)?.[1] : null;

  return (
    <div className="mt-3">
      <div role="tablist" aria-label="신호 종류" className="flex w-fit gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`signal-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`signal-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`pressable inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium ${
              tab === t.key ? "bg-primary text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
            <span className={`tabular-nums ${tab === t.key ? "text-white/80" : "text-text-muted"}`}>{count[t.key]}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`signal-panel-${tab}`} aria-labelledby={`signal-tab-${tab}`}>
        {tab === "buy" && (
          <>
            {buys.length ? (
              <ByDate list={buys} />
            ) : (
              <Empty>
                지금 매수 신호는 없어요.
                {weatherWord && <> 시장이 {weatherWord}인 날이라 종목이 좋아도 새로 사지 않아요.</>}
                {holds.length > 0 && " 시장만 맑았다면 샀을 종목은 아래 보류에 있어요."}
              </Empty>
            )}
            {holds.length > 0 && (
              <div className="mt-6">
                <p className="text-[14px] font-medium">
                  보류 <span className="text-text-muted">{holds.length}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-text-muted">종목 조건은 모두 통과했고, 시장 판정 하나만 걸렸어요.</p>
                <ByDate list={holds} />
              </div>
            )}
          </>
        )}

        {tab === "sell" &&
          (sells.length ? (
            <>
              <p className="mt-3 text-[13px] text-text-muted">내 보유 종목을 AI 매도 규칙(손절가, 50일선 이탈)으로 본 결과예요.</p>
              <ByDate list={sells} />
            </>
          ) : (
            <Empty>지금 매도 신호는 없어요. 내 보유 종목이 모두 손절가와 50일선 위에 있어요.</Empty>
          ))}

        {tab === "watch" &&
          (watches.length ? (
            <>
              <p className="mt-3 text-[13px] text-text-muted">셋업은 보였지만 종목 조건에서 걸린 종목이에요. 펼치면 어디서 걸렸는지 보여요.</p>
              <ByDate list={watches} />
            </>
          ) : (
            <Empty>관찰 중인 종목이 없어요.</Empty>
          ))}
      </div>
    </div>
  );
}
