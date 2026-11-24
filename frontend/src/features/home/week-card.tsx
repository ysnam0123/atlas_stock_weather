import type { HomeWeek } from "@atlas/contracts";
import { usd } from "@/features/my/format";
import { tradeDay } from "@/shared/lib/time";
import { CONDITION } from "./format";
import { SectionTitle } from "./section";
import { sectorMeta } from "./sectors";

const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
const money = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`;

/** 이번 주 정리 (주말 홈): 5거래일 날씨, S&P 500, 섹터 변화, 내 매매와 AI 매매 */
export function WeekCard({ data }: { data: HomeWeek }) {
  const from = tradeDay(data.from);
  const to = tradeDay(data.to);
  return (
    <section aria-labelledby="week-title">
      <SectionTitle id="week-title" aside={`${from.month}월 ${from.day}일 ~ ${to.month}월 ${to.day}일`}>
        이번 주 정리
      </SectionTitle>

      <ol className="mt-3 flex gap-1.5" aria-label="요일별 날씨">
        {data.days.map((d) => {
          const c = d.condition ? CONDITION[d.condition] : null;
          const t = tradeDay(d.date);
          return (
            <li key={d.date} className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-surface py-2">
              <span className="text-[12px] text-text-muted">{t.weekday}</span>
              {c ? <c.icon size={20} strokeWidth={1.6} className={c.color} aria-label={c.label} /> : <span className="text-[12px] text-text-muted">—</span>}
            </li>
          );
        })}
      </ol>

      <dl className="mt-3 space-y-1.5 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">S&amp;P 500</dt>
          <dd className="tabular-nums">{data.spyPct != null ? `${signed(data.spyPct)}%` : "—"}</dd>
        </div>
        {data.best && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">가장 좋아진 섹터</dt>
            <dd className="tabular-nums">
              {sectorMeta(data.best.sector).ko} {signed(data.best.change * 100)}%p
            </dd>
          </div>
        )}
        {data.worst && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">가장 나빠진 섹터</dt>
            <dd className="tabular-nums">
              {sectorMeta(data.worst.sector).ko} {signed(data.worst.change * 100)}%p
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">내 매매</dt>
          <dd className="tabular-nums">
            {data.my.buys + data.my.sells === 0
              ? "없음"
              : `샀음 ${data.my.buys}, 팔았음 ${data.my.sells}${data.my.sells ? `, 실현 ${money(data.my.realizedPnl)}` : ""}`}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">AI 매매 (v1·v2 합)</dt>
          <dd className="tabular-nums">
            {data.ai.opened + data.ai.closed === 0
              ? "없음"
              : `산 것 ${data.ai.opened}, 판 것 ${data.ai.closed}${data.ai.closed ? `, 실현 ${money(data.ai.realizedPnl)}` : ""}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
