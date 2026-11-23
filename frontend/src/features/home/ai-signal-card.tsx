import type { AiDuelResponse } from "@atlas/contracts";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { displayName } from "@/features/my/format";
import { tradeDay } from "@/shared/lib/time";
import { SectionTitle } from "./section";

const VERDICT: Record<string, { text: string; className: string }> = {
  sell: { text: "매도", className: "bg-text text-white" },
  buy: { text: "매수", className: "bg-primary text-white" },
  hold: { text: "보류", className: "bg-surface text-text-secondary" },
  watch: { text: "관찰", className: "bg-surface text-text-muted" },
};
const ORDER = ["sell", "buy", "hold", "watch"];
const SHOW = 5;

/** 홈의 AI 신호 요약: 가장 최근 장의 신호와 AI vs 나 수익률. 자세한 판단은 AI 대결 화면에서 */
export function AiSignalCard({ ai, failed }: { ai: AiDuelResponse | undefined; failed: boolean }) {
  const latest = ai?.signals[0]?.date;
  const today = (ai?.signals ?? [])
    .filter((s) => s.date === latest)
    .sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const score = ai?.score;

  return (
    <section aria-labelledby="ai-card-title" className="flex h-full flex-col">
      <SectionTitle
        id="ai-card-title"
        aside={latest && `${tradeDay(latest).month}월 ${tradeDay(latest).day}일 종가`}
      >
        AI 신호
      </SectionTitle>

      {failed ? (
        <p className="mt-3 text-[15px] text-text-muted">AI 데이터 없음</p>
      ) : !ai ? (
        <div className="mt-3 h-20 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
      ) : !ai.account ? (
        <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
          AI에게 모의 계좌를 주면 매일 셋업을 찾아 사고팔아요. 나와 성적을 겨뤄 보세요.
        </p>
      ) : today.length === 0 ? (
        <p className="mt-2 text-[15px] text-text-secondary">아직 신호가 없어요. 화~토 오후 1시 30분에 AI가 돌아요.</p>
      ) : (
        <ul className="mt-2">
          {today.slice(0, SHOW).map((s) => {
            const v = VERDICT[s.verdict];
            return (
              <li key={s.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${v.className}`}>{v.text}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{s.symbol}</span>
                    <span className="truncate text-[13px] text-text-secondary">{displayName(s)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-text-muted">{s.setupLabels.join(", ")}</span>
                </span>
              </li>
            );
          })}
          {today.length > SHOW && <li className="pt-2 text-[13px] text-text-muted">외 {today.length - SHOW}개</li>}
        </ul>
      )}

      {score && (
        <p className="mt-3 text-[13px] text-text-secondary tabular-nums">
          수익률 AI {score.ai.returnPct >= 0 ? "+" : "−"}
          {Math.abs(score.ai.returnPct).toFixed(1)}%
          {score.me && `, 나 ${score.me.returnPct >= 0 ? "+" : "−"}${Math.abs(score.me.returnPct).toFixed(1)}%`}
        </p>
      )}
      <Link href="/ai" className="pressable mt-auto flex min-h-11 items-center justify-between pt-3 text-[15px] font-medium text-primary">
        {ai?.account ? "AI 판단과 계획 보기" : "AI 대결 시작하기"}
        <ChevronRight size={18} aria-hidden />
      </Link>
    </section>
  );
}
