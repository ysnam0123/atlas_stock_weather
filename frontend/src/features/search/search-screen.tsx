"use client";

import type { SymbolHit } from "@atlas/contracts";
import { Search } from "lucide-react";
import { useState } from "react";
import { HoldingSheet, type SheetTarget } from "@/features/my/holding-sheet";
import { useAddWatch, useSymbolSearch } from "@/features/my/use-my";
import { CARD } from "@/shared/ui/card";

/** 티커·영문명·한글명·별칭 검색 (docs/frontend.md "검색"). 결과에서 바로 관심 추가 또는 보유 입력 */
export function SearchScreen() {
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const results = useSymbolSearch(q);
  const addWatch = useAddWatch();

  return (
    <div className="space-y-4 pt-2 lg:space-y-5 lg:p-5 lg:pl-0">
      <div className={`${CARD} lg:p-8`}>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">종목 검색</h1>
        <label className="relative mt-4 block">
          <span className="sr-only">티커, 영문명, 한글명</span>
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="NVDA, 엔비디아, nvidia"
            className="min-h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-[16px] outline-none focus:border-primary focus:bg-surface-raised"
          />
        </label>
        <p className="mt-2 text-[13px] text-text-muted">미국 상장 주식과 ETF 약 1만 2천 개. 한글명은 한국투자증권 종목 마스터 기준이에요.</p>
      </div>

      {q.trim() && (
        <div className={CARD}>
          {results.isError ? (
            <p className="text-[15px] text-text-secondary">검색하지 못했어요. 서버가 켜져 있는지 확인해 주세요.</p>
          ) : results.data && results.data.length === 0 ? (
            <p className="text-[15px] text-text-secondary">&ldquo;{q.trim()}&rdquo;에 맞는 종목이 없어요.</p>
          ) : (
            <ul className={`-mx-2 ${results.isFetching ? "opacity-70" : ""}`} aria-busy={results.isFetching}>
              {(results.data ?? []).map((hit) => (
                <ResultRow
                  key={hit.symbol}
                  hit={hit}
                  onWatch={() => addWatch.mutate(hit.symbol)}
                  watching={addWatch.isPending && addWatch.variables === hit.symbol}
                  onHold={() => setSheet(hit)}
                />
              ))}
            </ul>
          )}
          {addWatch.error && <p className="mt-2 text-[13px] text-primary-hover">{addWatch.error.message}</p>}
        </div>
      )}

      <HoldingSheet target={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function ResultRow({
  hit,
  onWatch,
  watching,
  onHold,
}: {
  hit: SymbolHit;
  onWatch: () => void;
  watching: boolean;
  onHold: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-2 py-3 last:border-b-0">
      <span className="w-16 shrink-0 text-[15px] font-semibold">{hit.symbol}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px]">{hit.nameKo ?? hit.nameEn}</span>
          {hit.type === "etf" && (
            <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary">ETF</span>
          )}
        </span>
        <span className="block truncate text-[13px] text-text-muted">
          {hit.nameKo ? `${hit.nameEn}, ` : ""}
          {hit.exchange}
        </span>
      </span>
      {hit.tracked ? (
        <span className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
          {hit.tracked === "holding" ? "보유 중" : "관심 중"}
        </span>
      ) : (
        <span className="flex shrink-0 gap-1.5">
          <button
            type="button"
            disabled={watching}
            onClick={onWatch}
            className="pressable min-h-10 rounded-full bg-surface px-3.5 text-[14px] font-medium hover:bg-border disabled:opacity-50"
          >
            관심
          </button>
          <button
            type="button"
            onClick={onHold}
            className="pressable min-h-10 rounded-full bg-primary px-3.5 text-[14px] font-medium text-white hover:bg-primary-hover"
          >
            보유
          </button>
        </span>
      )}
    </li>
  );
}
