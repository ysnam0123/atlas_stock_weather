"use client";

import type { AiDuelResponse, AiScore } from "@atlas/contracts";
import { Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionTitle } from "@/features/home/section";
import { changeText, displayName, usd } from "@/features/my/format";
import { useMy } from "@/features/my/use-my";
import { formatKstDateTime } from "@/shared/lib/time";
import { CARD } from "@/shared/ui/card";
import { Sheet } from "@/shared/ui/sheet";
import { DuelChart } from "./duel-chart";
import { SignalTabs } from "./signal-tabs";
import { useAiDuel, useRunAi, useStartAiAccount } from "./use-ai";

const EXIT_KO: Record<string, string> = { stop: "손절가", target: "목표가", ma50: "50일선 이탈", time: "시간 손절" };
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`);

/** AI 대결: AI 모의 계좌(추세 추종 스윙 v1) vs 내 매매 기록. 신호는 참고용, 선택과 주문은 사용자 */
export function AiScreen() {
  const { data, isPending, isError, refetch } = useAiDuel();
  const [startOpen, setStartOpen] = useState(false);
  const runAi = useRunAi();
  const running = data?.lastRun?.status === "running" || runAi.isPending;

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} lg:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">AI 대결</h1>
            <p className="mt-1 text-[14px] leading-[1.55] text-text-secondary">
              AI가 &ldquo;추세 추종 스윙&rdquo; 규칙으로 모의 계좌를 굴려요. 매일 차트 스캐너가 셋업을 찾고, 시장 판정과 종목 조건을
              통과하면 다음 거래일 시가에 사서 손절가·목표가·50일선 규칙대로 팝니다. 실제 주문은 하지 않아요. 나는 &ldquo;기록&rdquo;에
              샀음·팔았음을 남기면 같은 기준으로 성적이 매겨져요.
            </p>
          </div>
          {data?.account && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={running}
                onClick={() => runAi.mutate()}
                className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                <Play size={16} aria-hidden />
                {running ? "AI 실행 중" : "지금 실행"}
              </button>
              <button
                type="button"
                onClick={() => setStartOpen(true)}
                className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] hover:bg-border"
              >
                <RotateCcw size={16} aria-hidden />
                새로 시작
              </button>
            </div>
          )}
        </div>
        {data?.lastRun && (
          <p className="mt-3 text-[13px] text-text-muted">
            {data.lastRun.status === "running"
              ? "AI가 시장을 스캔하는 중이에요. 몇 분 걸려요. 끝나면 자동으로 바뀌어요."
              : `마지막 실행 ${formatKstDateTime(new Date(data.lastRun.startedAt))}${data.lastRun.status === "failed" ? ", 실패" : ""}. 화~토 오후 1시 30분에 자동으로 돌아요.`}
          </p>
        )}
      </div>

      {isPending ? (
        <div className={`${CARD} h-60 motion-safe:animate-pulse`} aria-busy="true" />
      ) : isError ? (
        <div className={CARD}>
          <p className="text-[15px] text-text-secondary">AI 대결 데이터를 불러오지 못했어요.</p>
          <button type="button" onClick={() => refetch()} className="pressable mt-3 min-h-11 rounded-full bg-surface px-5">
            다시 시도
          </button>
        </div>
      ) : !data.account ? (
        <div className={CARD}>
          <SectionTitle id="start-title">AI 계좌 열기</SectionTitle>
          <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
            AI에게 줄 시작 자금을 정하면 대결이 시작돼요. 내 총 투자금과 같게 두면 비교가 공정해요.
          </p>
          <button
            type="button"
            onClick={() => setStartOpen(true)}
            className="pressable mt-4 min-h-11 rounded-full bg-primary px-5 text-[15px] font-medium text-white hover:bg-primary-hover"
          >
            시작 자금 정하기
          </button>
        </div>
      ) : (
        <Duel data={data} />
      )}

      <StartSheet open={startOpen} onClose={() => setStartOpen(false)} defaultCapital={data?.capital ?? null} replacing={!!data?.account} />
    </div>
  );
}

function Duel({ data }: { data: AiDuelResponse }) {
  const score = data.score!;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5 lg:space-y-0">
      <div className="space-y-4 lg:space-y-5">
        {/* 신호 */}
        <section aria-labelledby="signals-title" className={CARD}>
          <SectionTitle id="signals-title" aside="눌러서 판단·계획 보기">
            AI 신호
          </SectionTitle>
          {data.signals.length === 0 ? (
            <p className="mt-3 text-[15px] leading-[1.5] text-text-secondary">
              아직 신호가 없어요. &ldquo;지금 실행&rdquo;을 누르거나, 화~토 오후 1시 30분 자동 실행을 기다려 주세요.
            </p>
          ) : (
            <SignalTabs signals={data.signals} />
          )}
        </section>

        {/* AI 보유·지난 거래 */}
        <section aria-labelledby="ai-pos-title" className={CARD}>
          <SectionTitle id="ai-pos-title" aside={`현금 ${usd(data.account!.cash)}`}>
            AI 보유 종목
          </SectionTitle>
          {data.positions.length === 0 ? (
            <p className="mt-3 text-[15px] text-text-secondary">지금 AI가 들고 있는 종목은 없어요.</p>
          ) : (
            <ul className="mt-2 -mx-2">
              {data.positions.map((p) => {
                const c = changeText(p.pnlPct);
                return (
                  <li key={p.id} className="flex items-center gap-3 border-b border-border px-2 py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[16px] font-semibold">{p.symbol}</span>
                        <span className="truncate text-[14px] text-text-secondary">{displayName(p)}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-text-muted tabular-nums">
                        {p.entryDate} {usd(p.entryPrice)}에 {p.shares}주, 손절 {usd(p.stopPrice)}, 목표 {usd(p.targetPrice)}
                        {p.pendingExit && <span className="text-primary-hover">, 다음 시가 매도 예정({EXIT_KO[p.pendingExit]})</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[15px] tabular-nums">
                      {p.lastClose != null ? usd(p.lastClose) : "—"}
                      {c && <span className={`block text-[12px] ${c.tone}`}>{c.text}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {data.closed.length > 0 && (
            <>
              <p className="mt-5 text-[13px] text-text-muted">지난 거래</p>
              <ul className="mt-1 -mx-2">
                {data.closed.map((p) => {
                  const c = changeText(p.pnlPct);
                  return (
                    <li key={p.id} className="flex items-center gap-3 border-b border-border px-2 py-2.5 text-[14px] last:border-b-0">
                      <span className="w-14 shrink-0 font-semibold">{p.symbol}</span>
                      <span className="min-w-0 flex-1 text-text-secondary tabular-nums">
                        {p.entryDate} → {p.exitDate}, {p.exitReason ? EXIT_KO[p.exitReason] : ""}
                      </span>
                      <span className={`shrink-0 tabular-nums ${c?.tone ?? ""}`}>
                        {c?.text} {p.pnl != null && `(${p.pnl >= 0 ? "+" : "−"}${usd(Math.abs(p.pnl))})`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* 오른쪽: 성적 */}
      <div className="space-y-4 lg:sticky lg:top-5 lg:space-y-5">
        <section aria-labelledby="score-title" className={CARD}>
          <SectionTitle id="score-title" aside={score.benchmarkPct != null ? `S&P 500 ${pct(score.benchmarkPct)}` : undefined}>
            성적
          </SectionTitle>
          <Scoreboard ai={score.ai} me={score.me} capital={data.capital} />
        </section>
        <section aria-labelledby="curve-title" className={CARD}>
          <SectionTitle id="curve-title">수익률 곡선</SectionTitle>
          <div className="mt-3">
            <DuelChart series={data.series} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Scoreboard({ ai, me, capital }: { ai: AiScore; me: AiScore | null; capital: number | null }) {
  const rows: { label: string; get: (s: AiScore) => string }[] = [
    { label: "수익률", get: (s) => pct(s.returnPct) },
    { label: "계좌 가치", get: (s) => usd(s.equity) },
    { label: "실현 손익", get: (s) => `${s.realizedPnl >= 0 ? "+" : "−"}${usd(Math.abs(s.realizedPnl))}` },
    { label: "승률", get: (s) => (s.winRate == null ? "—" : `${s.winRate.toFixed(0)}%`) },
    { label: "끝난 거래", get: (s) => `${s.trades}번` },
    { label: "최대 낙폭", get: (s) => (s.maxDrawdownPct == null ? "—" : `${s.maxDrawdownPct.toFixed(1)}%`) },
    { label: "보유 종목", get: (s) => `${s.openPositions}개` },
  ];
  return (
    <>
      <table className="mt-3 w-full text-[14px] tabular-nums">
        <thead>
          <tr className="text-[12px] text-text-muted">
            <th className="py-1.5 text-left font-normal" />
            <th className="py-1.5 text-right font-medium text-primary">AI</th>
            <th className="py-1.5 text-right font-medium text-text">나</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="py-2 text-text-secondary">{r.label}</td>
              <td className="py-2 text-right">{r.get(ai)}</td>
              <td className="py-2 text-right">{me ? r.get(me) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!me && (
        <p className="mt-3 text-[13px] leading-[1.5] text-text-muted">
          {capital == null ? "총 투자금을 넣으면 내 성적도 같이 잴 수 있어요. 홈 맨 위 “총 투자금 넣기”에서 넣어 주세요." : ""}
        </p>
      )}
      <p className="mt-3 text-[13px] leading-[1.5] text-text-muted">
        내 성적은{" "}
        <Link href="/records" className="text-primary">
          기록
        </Link>
        의 샀음·팔았음과 보유 종목 종가로 계산해요. AI 계좌 시작일부터 비교해요.
      </p>
    </>
  );
}

function StartSheet({
  open,
  onClose,
  defaultCapital,
  replacing,
}: {
  open: boolean;
  onClose: () => void;
  defaultCapital: number | null;
  replacing: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={replacing ? "AI 새로 시작" : "AI 시작 자금"}>
      {open && <StartForm onDone={onClose} defaultCapital={defaultCapital} replacing={replacing} />}
    </Sheet>
  );
}

function StartForm({ onDone, defaultCapital, replacing }: { onDone: () => void; defaultCapital: number | null; replacing: boolean }) {
  const [value, setValue] = useState(String(defaultCapital ?? 10000));
  const start = useStartAiAccount();
  const my = useMy();
  const n = Number(value.replace(/,/g, ""));
  const valid = Number.isFinite(n) && n >= 100;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) start.mutate(n, { onSuccess: onDone });
      }}
      className="space-y-4"
    >
      {replacing && (
        <p className="rounded-xl bg-primary-tint/50 px-4 py-3 text-[14px] leading-[1.5]">
          지금 AI 계좌를 끝내고 새 계좌로 다시 시작해요. 지난 신호와 거래는 이번 대결에서 빠져요.
        </p>
      )}
      <label className="block text-[13px] text-text-secondary">
        시작 자금 ($)
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 block min-h-12 w-full rounded-xl border border-border px-3 text-[18px] tabular-nums outline-none focus:border-primary"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {[my.data?.capital, 5000, 10000, 50000]
          .filter((v, i, all): v is number => v != null && all.indexOf(v) === i)
          .map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue(String(v))}
              className="pressable min-h-9 rounded-full bg-surface px-3 text-[13px] hover:bg-border"
            >
              {v === my.data?.capital ? `내 총 투자금 ${usd(v)}` : usd(v)}
            </button>
          ))}
      </div>
      {start.error && <p className="text-[13px] text-primary-hover">{start.error.message}</p>}
      <button
        type="submit"
        disabled={!valid || start.isPending}
        className="pressable min-h-11 w-full rounded-full bg-primary text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
      >
        {replacing ? "새로 시작" : "AI 계좌 열기"}
      </button>
    </form>
  );
}
