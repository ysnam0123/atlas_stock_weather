"use client";

import type { StockReport } from "@atlas/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LineChart,
  type LucideIcon,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { usd } from "@/features/my/format";
import { api } from "@/shared/api/client";
import { formatKstDateTime } from "@/shared/lib/time";

type Output = NonNullable<StockReport["output"]>;

const signed = (n: number | null, digits = 1) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-text-muted" : n > 0 ? "text-up" : "text-down");
const gap = (price: number, ref: number | null) => (ref ? ((price / ref - 1) * 100) : null);

function daysUntil(date: string | null) {
  if (!date) return null;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

/**
 * 깊게 분석 (Phase 6). 버튼을 누를 때만 Claude가 돈다 (매일 자동 아님).
 * 숫자 줄·분기 막대·가격 사다리는 스크립트 계산값을 그대로 그리고, 글은 Claude 설명이다.
 * 기본은 웹 검색 없이 (입력 약 3천·출력 2천 토큰). 켜면 밸류에이션·최근 소식이 붙지만 입력이 수십만 토큰까지 늘어난다
 */
export function DeepAnalysis({ symbol }: { symbol: string }) {
  const queryClient = useQueryClient();
  const key = ["stock-report", symbol];
  const [web, setWeb] = useState(false);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.get<StockReport | null>(`/stocks/${encodeURIComponent(symbol)}/report`),
    refetchInterval: (q) => (q.state.data?.status === "running" ? 5_000 : false),
  });
  const start = useMutation({
    mutationFn: () => api.post<StockReport>(`/stocks/${encodeURIComponent(symbol)}/report`, { web }),
    onSuccess: (r) => queryClient.setQueryData(key, r),
  });
  const running = data?.status === "running" || start.isPending;
  const o = data?.status === "success" ? data.output : null;

  return (
    <section aria-labelledby="deep-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="deep-title" className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em]">
          <Sparkles size={18} className="text-primary" aria-hidden />
          깊게 분석
        </h2>
        {data?.finishedAt && (
          <p className="text-[13px] text-text-muted">
            {formatKstDateTime(new Date(data.finishedAt))} 분석{data.asOf && `, ${data.asOf} 종가 기준`}
            {data.web ? ", 웹 검색 포함" : ""}
          </p>
        )}
      </div>

      {o && data ? (
        <Report r={data} o={o} />
      ) : (
        <p className="mt-2 max-w-2xl text-[15px] leading-[1.55] text-text-secondary">
          {running
            ? "Claude가 분석하는 중이에요. 1~3분 걸려요. 끝나면 자동으로 바뀌어요."
            : data?.status === "failed"
              ? `지난 분석이 실패했어요 (${data.error?.slice(0, 80) ?? "원인 모름"}). 다시 해 보세요.`
              : "사업, 분기 실적, 차트(이동평균·지지·저항), 조심할 점, 앞으로 확인할 것을 한 장으로 정리해요. 누를 때만 돌아요."}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          disabled={running}
          onClick={() => start.mutate()}
          className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Sparkles size={16} aria-hidden />
          {running ? "분석 중" : o ? "다시 분석" : "깊게 분석하기"}
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-text-secondary">
          <input
            type="checkbox"
            checked={web}
            onChange={(e) => setWeb(e.target.checked)}
            disabled={running}
            className="size-4 accent-(--color-primary)"
          />
          웹 검색 포함 (밸류에이션·최근 소식, 토큰 수십 배)
        </label>
        {o && data?.inputTokens != null && (
          <span className="ml-auto text-[12px] text-text-muted tabular-nums">
            토큰 입력 {data.inputTokens.toLocaleString()}, 출력 {data.outputTokens?.toLocaleString()}
          </span>
        )}
      </div>
    </section>
  );
}

function Report({ r, o }: { r: StockReport; o: Output }) {
  return (
    <>
      <p className="mt-3 text-[22px] leading-snug font-semibold tracking-[-0.02em]">{o.headline}</p>
      {r.price && <KeyStats r={r} />}

      <div className="mt-8 grid gap-x-12 gap-y-9 lg:grid-cols-2">
        <div className="space-y-9">
          <Block icon={Building2} title="무슨 회사인가">
            <p className="text-[15px] leading-[1.65]">{o.business.join(" ")}</p>
          </Block>
          <Block icon={TrendingUp} title="실적으로 본 성장">
            {r.quarters.length > 0 && <QuarterBars quarters={r.quarters} />}
            <Bullets lines={o.growth} />
          </Block>
          {o.valuation.length > 0 && (
            <Block icon={Scale} title="밸류에이션">
              <Bullets lines={o.valuation} />
            </Block>
          )}
        </div>
        <Block icon={LineChart} title="차트">
          {r.price && r.levels.length > 0 && <PriceLadder close={r.price.close} levels={r.levels} />}
          <Bullets lines={o.chart} />
        </Block>
      </div>

      <div className="mt-9 grid gap-4 md:grid-cols-2">
        <CheckList icon={CircleAlert} title="조심할 점" lines={o.risks} iconClass="text-primary-hover" />
        <CheckList icon={CircleCheck} title="앞으로 확인할 것" lines={o.watch} iconClass="text-steel" />
      </div>

      {o.sources.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] text-text-muted">웹 검색 출처</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {o.sources.map((src) => (
              <li key={src.url}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable inline-flex max-w-[22rem] items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:border-text-muted hover:text-text"
                >
                  <span className="truncate">{src.title}</span>
                  <ExternalLink size={11} className="shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-5 text-[12px] text-text-muted">숫자와 그림은 Atlas가 계산한 값이고, Claude는 설명만 붙였어요. 예측이 아니에요.</p>
    </>
  );
}

/** 핵심 숫자 줄: 카드 없이 세로 구분선으로 나눈다 */
function KeyStats({ r }: { r: StockReport }) {
  const p = r.price!;
  const d = daysUntil(r.nextEarnings);
  const stats: { label: string; value: ReactNode; sub?: ReactNode }[] = [
    { label: "종가", value: usd(p.close), sub: <span className={tone(p.changePct)}>{signed(p.changePct)}</span> },
    {
      label: "52주 고점까지",
      value: signed(gap(p.close, p.high52w)),
      sub: <span className="text-text-muted">고점 {usd(p.high52w)}</span>,
    },
    {
      label: "50일선, 200일선 대비",
      value: (
        <>
          <span className={tone(gap(p.close, p.ma50))}>{signed(gap(p.close, p.ma50))}</span>
          <span className="text-text-muted">, </span>
          <span className={tone(gap(p.close, p.ma200))}>{signed(gap(p.close, p.ma200))}</span>
        </>
      ),
    },
    {
      label: "6개월 수익률",
      value: <span className={tone(p.return6m)}>{signed(p.return6m)}</span>,
      sub: <span className="text-text-muted">S&amp;P 500 {signed(p.spyReturn6m)}</span>,
    },
    {
      label: "다음 실적 발표",
      value: d == null ? "모름" : d <= 0 ? "오늘" : `D-${d}`,
      sub: r.nextEarnings && <span className="text-text-muted">{r.nextEarnings}</span>,
    },
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-y-4 border-y border-border py-4 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-border">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 pr-4 lg:px-5 lg:first:pl-0">
          <dt className="text-[12px] text-text-muted">{s.label}</dt>
          <dd className="mt-1 text-[18px] leading-tight font-semibold tabular-nums">{s.value}</dd>
          {s.sub && <dd className="mt-0.5 text-[12px] tabular-nums">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** 분기 매출 성장률(전년 대비) 가로 막대. 한 색의 막대, 값은 오른쪽 글자로 */
function QuarterBars({ quarters }: { quarters: StockReport["quarters"] }) {
  const rows = quarters.filter((q) => q.revenueYoyPct != null).slice(0, 6);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((q) => Math.abs(q.revenueYoyPct!)), 1);
  return (
    <div className="mb-3">
      <p className="text-[12px] text-text-muted">분기 매출, 1년 전 같은 분기 대비</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((q) => {
          const v = q.revenueYoyPct!;
          return (
            <li key={q.fiscal} className="grid grid-cols-[72px_1fr_64px] items-center gap-3 text-[13px] tabular-nums">
              <span className="text-text-secondary">{q.fiscal}</span>
              <span className="h-2.5 rounded-full bg-surface" aria-hidden>
                <span
                  className={`block h-full rounded-full ${v >= 0 ? "bg-steel" : "bg-down/50"}`}
                  style={{ width: `${Math.max(2, (Math.abs(v) / max) * 100)}%` }}
                />
              </span>
              <span className={`text-right ${v >= 0 ? "text-text" : "text-down"}`}>{signed(v)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 가격 사다리: 종가를 가운데 두고 위는 저항, 아래는 지지. 종가에서 몇 % 떨어져 있는지 */
function PriceLadder({ close, levels }: { close: number; levels: StockReport["levels"] }) {
  const rows = [
    ...levels.map((l) => ({ ...l, key: `${l.kind}-${l.price}` })),
    { key: "close", kind: "close" as const, price: close, touches: 0, lastDate: "" },
  ].sort((a, b) => b.price - a.price);
  return (
    <ol className="relative mb-4" aria-label="지지·저항 가격대">
      <span className="absolute top-3 bottom-3 left-[7px] w-px bg-border" aria-hidden />
      {rows.map((l) => {
        const isClose = l.kind === "close";
        const d = ((l.price / close - 1) * 100);
        return (
          <li key={l.key} className={`relative flex items-center gap-3 py-1.5 ${isClose ? "my-1" : ""}`}>
            <span
              className={`relative z-10 grid size-[15px] shrink-0 place-items-center rounded-full ${
                isClose ? "bg-text" : l.kind === "resistance" ? "border-2 border-up bg-surface-raised" : "border-2 border-down bg-surface-raised"
              }`}
              aria-hidden
            />
            <span className={`w-12 shrink-0 text-[13px] ${isClose ? "font-semibold" : l.kind === "resistance" ? "text-up" : "text-down"}`}>
              {isClose ? "종가" : l.kind === "resistance" ? "저항" : "지지"}
            </span>
            <span className={`w-24 shrink-0 text-[15px] tabular-nums ${isClose ? "font-semibold" : ""}`}>{usd(l.price)}</span>
            {!isClose && (
              <>
                <span className="w-16 shrink-0 text-[13px] text-text-secondary tabular-nums">{signed(d)}</span>
                <span className="min-w-0 truncate text-[12px] text-text-muted">
                  {l.touches}번 꺾임, 마지막 {l.lastDate}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Block({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Icon size={17} strokeWidth={1.8} className="text-text-secondary" aria-hidden />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullets({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2 text-[14px] leading-[1.6] text-text">
      {lines.map((line) => (
        <li key={line} className="flex gap-2.5">
          <span className="mt-[0.65em] size-1 shrink-0 rounded-full bg-text-muted" aria-hidden />
          {line}
        </li>
      ))}
    </ul>
  );
}

/** 조심할 점·확인할 것: 아이콘이 붙은 목록. 옅은 바탕으로 본문과 구분한다 */
function CheckList({ icon: Icon, title, lines, iconClass }: { icon: LucideIcon; title: string; lines: string[]; iconClass: string }) {
  return (
    <div className="rounded-2xl bg-surface px-5 py-4">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5 text-[14px] leading-[1.55]">
            <Icon size={17} strokeWidth={1.8} className={`mt-[2px] shrink-0 ${iconClass}`} aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
