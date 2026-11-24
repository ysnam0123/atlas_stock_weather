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

/** 홈에서 보여줄 대표 계좌: 더 엄격한 v2 (없으면 첫 계좌) */
export const primaryAccount = (ai: AiDuelResponse | undefined) => ai?.accounts.find((a) => a.version === "v2") ?? ai?.accounts[0];

const signedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

/** 홈의 AI 신호 요약: v2의 가장 최근 장 신호와 AI v1·v2·나 수익률. 자세한 판단은 AI 대결 화면에서 */
export function AiSignalCard({ ai, failed }: { ai: AiDuelResponse | undefined; failed: boolean }) {
  const view = primaryAccount(ai);
  const latest = view?.signals[0]?.date;
  const today = (view?.signals ?? [])
    .filter((s) => s.date === latest)
    .sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));

  return (
    <section aria-labelledby="ai-card-title" className="flex h-full flex-col">
      <SectionTitle
        id="ai-card-title"
        aside={latest && `v2, ${tradeDay(latest).month}월 ${tradeDay(latest).day}일 종가`}
      >
        AI 신호
      </SectionTitle>

      {failed ? (
        <p className="mt-3 text-[15px] text-text-muted">AI 데이터 없음</p>
      ) : !ai ? (
        <div className="mt-3 h-20 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
      ) : !view ? (
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

      {ai && ai.accounts.length > 0 && (
        <p className="mt-3 text-[13px] text-text-secondary tabular-nums">
          수익률 {ai.accounts.map((a) => `AI ${a.version} ${signedPct(a.score.returnPct)}`).join(", ")}
          {ai.me && `, 나 ${signedPct(ai.me.returnPct)}`}
        </p>
      )}
      <Link href="/ai" className="pressable mt-auto flex min-h-11 items-center justify-between pt-3 text-[15px] font-medium text-primary">
        {view ? "AI 판단과 계획 보기" : "AI 대결 시작하기"}
        <ChevronRight size={18} aria-hidden />
      </Link>
    </section>
  );
}
