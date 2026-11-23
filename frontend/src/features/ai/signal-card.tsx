import type { AiSignal } from "@atlas/contracts";
import { Check, ChevronDown, X } from "lucide-react";
import { displayName, usd } from "@/features/my/format";

const BADGE: Record<string, { text: string; className: string }> = {
  "buy:planned": { text: "매수 예정", className: "bg-primary text-white" },
  "buy:filled": { text: "체결", className: "bg-primary-tint text-primary-hover" },
  "buy:skipped": { text: "건너뜀", className: "bg-surface text-text-secondary" },
  "hold:held": { text: "보류 (시장)", className: "bg-surface text-text-secondary" },
  "watch:watch": { text: "관찰", className: "bg-surface text-text-muted" },
  "sell:done": { text: "매도 신호", className: "bg-text text-white" },
};

const pctFrom = (a: number, b: number) => `${b >= a ? "+" : "−"}${Math.abs((b / a - 1) * 100).toFixed(1)}%`;

/**
 * 신호 하나: 어떤 종목에서 어떤 셋업을 찾았고(발견), AI가 어떻게 판단했고(체크리스트),
 * 산다면 얼마에 사서 언제 팔지(계획). 누르면 펼쳐진다.
 */
export function SignalCard({ s }: { s: AiSignal }) {
  const badge = BADGE[`${s.verdict}:${s.status}`] ?? { text: s.status, className: "bg-surface text-text-secondary" };
  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-2 py-3 hover:bg-surface [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-semibold">{s.symbol}</span>
            <span className="truncate text-[14px] text-text-secondary">{displayName(s)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${badge.className}`}>{badge.text}</span>
          </span>
          <span className="mt-1 block text-[13px] text-text-muted">{s.setupLabels.join(", ")}</span>
          <span className="mt-1 block text-[14px] leading-[1.5] text-text-secondary">{s.reasonKo}</span>
          {s.commentKo && (
            <span className="mt-1.5 block rounded-lg bg-surface px-2.5 py-1.5 text-[13px] leading-[1.5] text-text">
              <span className="mr-1.5 text-text-muted">해설</span>
              {s.commentKo}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right text-[14px] tabular-nums">
          {usd(s.closePrice)}
          {s.lastClose != null && s.lastClose !== s.closePrice && (
            <span className="block text-[12px] text-text-muted">지금 {pctFrom(s.closePrice, s.lastClose)}</span>
          )}
        </span>
        <ChevronDown size={18} className="mt-1 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-4 px-2 pb-4">
        <div>
          <p className="text-[13px] font-medium text-text-secondary">AI의 판단</p>
          <ul className="mt-1.5 space-y-1.5">
            {s.checks.map((c) => (
              <li key={c.key} className="flex gap-2 text-[14px]">
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
        </div>

        {s.side === "buy" && s.stopPrice != null && s.targetPrice != null && (
          <div>
            <p className="text-[13px] font-medium text-text-secondary">산다면</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[14px] tabular-nums sm:grid-cols-4">
              <div>
                <dt className="text-[12px] text-text-muted">진입</dt>
                <dd>다음 거래일 시가</dd>
              </div>
              <div>
                <dt className="text-[12px] text-text-muted">손절가</dt>
                <dd>
                  {usd(s.stopPrice)} <span className="text-text-muted">{pctFrom(s.closePrice, s.stopPrice)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-text-muted">목표가</dt>
                <dd>
                  {usd(s.targetPrice)} <span className="text-text-muted">{pctFrom(s.closePrice, s.targetPrice)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-text-muted">수량</dt>
                <dd>
                  {s.shares ? `${s.shares}주` : "—"}
                  {s.riskAmount != null && <span className="text-text-muted">, 위험 {usd(s.riskAmount)}</span>}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {s.exitPlanKo && (
          <div>
            <p className="text-[13px] font-medium text-text-secondary">언제 파나</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] leading-[1.5]">
              {s.exitPlanKo.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {s.note && <p className="text-[13px] text-text-muted">{s.note}</p>}
      </div>
    </details>
  );
}
