"use client";

import type { StockIntel } from "@atlas/contracts";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { formatKstDateTime } from "@/shared/lib/time";
import { Sheet } from "@/shared/ui/sheet";
import { displayName } from "./format";
import { useStockIntel } from "./use-my";

export interface InfoTarget {
  symbol: string;
  nameKo: string | null;
  nameEn: string;
}

type Tab = "news" | "earnings" | "congress";
const TABS: { key: Tab; label: string }[] = [
  { key: "news", label: "뉴스·공시" },
  { key: "earnings", label: "분기 실적" },
  { key: "congress", label: "의원 거래" },
];

/** 달러 큰 수: 96,221,000,000 → "$96.2B" */
const bigUsd = (n: number | null) =>
  n == null ? "—" : Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`;
const signedPct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`);
const TRADE_KO: Record<string, string> = { P: "매수", S: "매도", "S (partial)": "일부 매도", E: "교환" };

/** 종목 하나의 소식: 최근 30일 뉴스·SEC 공시, 최근 6개 분기 실적, 120일 안 의원 거래 신고 */
export function StockInfoSheet({ target, onClose }: { target: InfoTarget | null; onClose: () => void }) {
  return (
    <Sheet
      open={target != null}
      onClose={onClose}
      title={
        target && (
          <>
            {displayName(target)} <span className="text-[15px] font-normal text-text-muted">{target.symbol}</span>
          </>
        )
      }
    >
      {target && <Body key={target.symbol} symbol={target.symbol} />}
    </Sheet>
  );
}

function Body({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<Tab>("news");
  const { data, isPending, isError } = useStockIntel(symbol);

  return (
    <div>
      <div role="tablist" aria-label="소식 종류" className="flex w-fit gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`pressable min-h-10 rounded-full px-4 text-[14px] font-medium ${
              tab === t.key ? "bg-primary text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4 min-h-40">
        {isPending ? (
          <div className="h-32 rounded-xl bg-surface motion-safe:animate-pulse" aria-busy="true" />
        ) : isError ? (
          <p className="text-[15px] text-text-muted">소식을 불러오지 못했어요.</p>
        ) : tab === "news" ? (
          <News data={data} />
        ) : tab === "earnings" ? (
          <Earnings data={data} />
        ) : (
          <Congress data={data} />
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-surface px-4 py-4 text-[14px] leading-[1.55] text-text-secondary">{children}</p>;
}

function News({ data }: { data: StockIntel }) {
  if (!data.news.length) return <Empty>최근 30일 동안 이 종목 이름이 나온 기사나 SEC 공시가 없어요.</Empty>;
  return (
    <ul className="-mx-2">
      {data.news.map((n) => (
        <li key={n.id} className="border-b border-border last:border-b-0">
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 rounded-xl px-2 py-3 hover:bg-surface"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                {n.kind === "sec" && <span className="rounded-md bg-text px-1.5 py-0.5 text-[11px] text-white">SEC 공시</span>}
                {n.importance === "high" && n.kind !== "sec" && (
                  <span className="rounded-md bg-primary-tint px-1.5 py-0.5 text-[11px] text-primary-hover">중요</span>
                )}
              </span>
              <span className="mt-1 block text-[15px] leading-[1.45]">{n.titleKo ?? n.title}</span>
              {n.titleKo && <span className="mt-0.5 block truncate text-[12px] text-text-muted">{n.title}</span>}
              <span className="mt-1 block text-[12px] text-text-muted">
                {n.source}, {formatKstDateTime(new Date(n.publishedAt))}
              </span>
            </span>
            <ExternalLink size={16} className="mt-1 shrink-0 text-text-muted" aria-label="원문 열기" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Earnings({ data }: { data: StockIntel }) {
  if (!data.earnings.length) return <Empty>SEC에 분기 재무제표가 없는 종목이에요. ETF나 미국 밖 회사는 없을 수 있어요.</Empty>;
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[14px] tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-text-muted">
              <th className="px-1 py-2 font-normal">분기</th>
              <th className="px-1 py-2 text-right font-normal">매출</th>
              <th className="px-1 py-2 text-right font-normal">매출 증가</th>
              <th className="px-1 py-2 text-right font-normal">영업이익률</th>
              <th className="px-1 py-2 text-right font-normal">EPS</th>
              <th className="px-1 py-2 text-right font-normal">EPS 증가</th>
            </tr>
          </thead>
          <tbody>
            {data.earnings.map((e) => (
              <tr key={e.periodEnd} className="border-b border-border last:border-b-0">
                <td className="px-1 py-2.5">
                  {e.fiscal}
                  {e.derived && <span className="text-text-muted">*</span>}
                </td>
                <td className="px-1 py-2.5 text-right">{bigUsd(e.revenue)}</td>
                <td className="px-1 py-2.5 text-right">{signedPct(e.revenueYoy)}</td>
                <td className="px-1 py-2.5 text-right">{e.operatingMargin == null ? "—" : `${e.operatingMargin.toFixed(1)}%`}</td>
                <td className="px-1 py-2.5 text-right">{e.epsDiluted == null ? "—" : `$${e.epsDiluted.toFixed(2)}`}</td>
                <td className="px-1 py-2.5 text-right">{signedPct(e.epsYoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-text-muted">
        증가율은 1년 전 같은 분기와 비교해요. * 표시는 연간 실적에서 앞 세 분기를 빼서 만든 4분기 값이에요. 출처: SEC 재무제표(XBRL).
      </p>
    </>
  );
}

function Congress({ data }: { data: StockIntel }) {
  if (!data.congress.length) return <Empty>최근 120일 동안 이 종목에 대한 미국 하원 의원 거래 신고가 없어요.</Empty>;
  return (
    <>
      <ul className="-mx-2">
        {data.congress.map((c, i) => (
          <li key={`${c.member}-${c.tradeDate}-${i}`} className="flex items-center gap-3 border-b border-border px-2 py-2.5 last:border-b-0">
            <span
              className={`w-16 shrink-0 rounded-full py-1 text-center text-[12px] font-medium ${
                c.type === "P" ? "bg-primary-tint text-primary-hover" : "bg-surface text-text-secondary"
              }`}
            >
              {TRADE_KO[c.type] ?? c.typeName}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[14px]">{c.member}</span>
                {c.memberInfo && (
                  <span className="shrink-0 text-[12px] text-text-secondary">
                    {c.memberInfo.party}, {c.memberInfo.seat}
                  </span>
                )}
              </span>
              {c.memberInfo && c.memberInfo.committees.length > 0 && (
                <span className="block text-[12px] text-text-secondary">위원회: {c.memberInfo.committees.join(", ")}</span>
              )}
              <span className="block text-[12px] text-text-muted tabular-nums">
                거래 {c.tradeDate ?? "—"}, 신고 {c.filed}
                {c.owner && c.owner !== "self" && `, ${c.owner === "spouse" ? "배우자" : c.owner}`}
              </span>
            </span>
            <span className="shrink-0 text-right text-[13px] tabular-nums text-text-secondary">{c.amount}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-[1.5] text-text-muted">
        미국 하원 공개 신고(STOCK Act)예요. 거래 뒤 최대 45일 늦게 신고되고, 금액은 범위로만 나와요. 내부 정보가 아니에요.
        소속 위원회가 그 회사 업종을 다루면(예: 군사위원회와 방산주) 눈여겨볼 만해요.
      </p>
    </>
  );
}
