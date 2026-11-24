"use client";

import type { StockReport } from "@atlas/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { SectionTitle } from "@/features/home/section";
import { usd } from "@/features/my/format";
import { api } from "@/shared/api/client";
import { formatKstDateTime } from "@/shared/lib/time";

const SECTIONS: { key: keyof Omit<NonNullable<StockReport["output"]>, "headline" | "sources">; title: string }[] = [
  { key: "business", title: "무슨 회사인가" },
  { key: "growth", title: "실적으로 본 성장" },
  { key: "valuation", title: "밸류에이션" },
  { key: "chart", title: "차트" },
  { key: "risks", title: "조심할 점" },
  { key: "watch", title: "앞으로 확인할 것" },
];

/**
 * 깊게 분석 (Phase 6). 버튼을 누를 때만 Claude가 돈다 (매일 자동 아님).
 * 기본은 웹 검색 없이 (입력 약 3천·출력 2천 토큰). 웹 검색을 켜면 밸류에이션·최근 소식이 붙지만 입력이 수십만 토큰까지 늘어난다
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
      <SectionTitle id="deep-title" aside={data?.finishedAt && `${formatKstDateTime(new Date(data.finishedAt))} 분석${data.asOf ? `, ${data.asOf} 종가 기준` : ""}`}>
        깊게 분석
      </SectionTitle>

      {o ? (
        <>
          <p className="mt-2 text-[18px] leading-snug font-semibold">{o.headline}</p>
          <div className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {SECTIONS.filter((sec) => o[sec.key].length).map((sec) => (
              <div key={sec.key}>
                <p className="text-[14px] font-medium text-text-secondary">{sec.title}</p>
                <ul className="mt-1.5 space-y-1.5 text-[14px] leading-[1.55]">
                  {o[sec.key].map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-text-muted" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data!.levels.length > 0 && (
              <div>
                <p className="text-[14px] font-medium text-text-secondary">지지·저항 가격대 (스크립트 계산)</p>
                <ul className="mt-1.5 text-[14px] tabular-nums">
                  {data!.levels.map((l) => (
                    <li key={`${l.kind}-${l.price}`} className="flex justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
                      <span className={l.kind === "resistance" ? "text-up" : "text-down"}>{l.kind === "resistance" ? "저항" : "지지"}</span>
                      <span>{usd(l.price)}</span>
                      <span className="text-text-muted">
                        {l.touches}번 꺾임, 마지막 {l.lastDate}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {o.sources.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-muted">
              {o.sources.map((src) => (
                <li key={src.url}>
                  <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                    {src.title}
                    <ExternalLink size={11} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-text-muted">
            숫자는 Atlas가 계산한 값이고, Claude는 설명만 붙였어요. 예측이 아니에요.
            {data!.inputTokens != null && ` 토큰 입력 ${data!.inputTokens.toLocaleString()}, 출력 ${data!.outputTokens?.toLocaleString()}.`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
          {running
            ? "Claude가 분석하는 중이에요. 1~3분 걸려요. 끝나면 자동으로 바뀌어요."
            : data?.status === "failed"
              ? `지난 분석이 실패했어요 (${data.error?.slice(0, 80) ?? "원인 모름"}). 다시 해 보세요.`
              : "사업, 분기 실적, 차트(이동평균·지지·저항), 조심할 점, 앞으로 확인할 것을 한 장으로 정리해요. 누를 때만 돌아요."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
          <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} disabled={running} className="size-4 accent-[var(--color-primary)]" />
          웹 검색 포함 (밸류에이션·최근 소식, 토큰 수십 배)
        </label>
      </div>
    </section>
  );
}
