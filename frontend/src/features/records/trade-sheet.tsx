"use client";

import type { SymbolHit } from "@atlas/contracts";
import { useState } from "react";
import { useAddTrade } from "@/features/ai/use-ai";
import { displayName } from "@/features/my/format";
import { useMy, useSymbolSearch } from "@/features/my/use-my";
import { Sheet } from "@/shared/ui/sheet";

const field =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-[16px] tabular-nums outline-none focus:border-primary";

/** 오늘 날짜 (한국 시간) YYYY-MM-DD */
const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

/** 매매 기록 추가. 샀음이면 보유가 늘고 평단가가 다시 계산되며, 팔았음이면 실현 손익이 남는다 */
export function TradeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="매매 기록 추가">
      {open && <TradeForm onDone={onClose} />}
    </Sheet>
  );
}

function TradeForm({ onDone }: { onDone: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Pick<SymbolHit, "symbol" | "nameKo" | "nameEn"> | null>(null);
  const [date, setDate] = useState(todayKst());
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [note, setNote] = useState("");
  const add = useAddTrade();
  const my = useMy();
  const search = useSymbolSearch(picked ? "" : query);

  // 팔았음은 보유 종목에서 고른다
  const holdings = my.data?.holdings ?? [];
  const priceN = Number(price);
  const sharesN = Number(shares);
  const valid = picked && date && priceN > 0 && sharesN > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        add.mutate(
          { symbol: picked.symbol, side, date, price: priceN, shares: sharesN, note: note.trim() || null },
          { onSuccess: onDone },
        );
      }}
      className="space-y-5"
    >
      <div role="radiogroup" aria-label="종류" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {(["buy", "sell"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={side === v}
            onClick={() => {
              setSide(v);
              setPicked(null);
            }}
            className={`pressable min-h-10 rounded-full text-[15px] font-medium ${
              side === v ? "bg-surface-raised shadow-[0_1px_2px_rgb(24_24_24/0.08)]" : "text-text-secondary"
            }`}
          >
            {v === "buy" ? "샀음" : "팔았음"}
          </button>
        ))}
      </div>

      <div>
        <p className="text-[13px] text-text-secondary">종목</p>
        {picked ? (
          <div className="mt-1.5 flex min-h-11 items-center justify-between rounded-xl border border-primary px-3">
            <span className="text-[16px]">
              <span className="font-semibold">{picked.symbol}</span> <span className="text-text-secondary">{displayName(picked)}</span>
            </span>
            <button type="button" onClick={() => setPicked(null)} className="pressable text-[13px] text-primary">
              바꾸기
            </button>
          </div>
        ) : side === "sell" ? (
          holdings.length ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {holdings.map((h) => (
                <button
                  key={h.symbol}
                  type="button"
                  onClick={() => setPicked(h)}
                  className="pressable min-h-10 rounded-full bg-surface px-3.5 text-[14px] hover:bg-border"
                >
                  {h.symbol} <span className="text-text-muted">{h.shares}주</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[14px] text-text-muted">보유 종목이 없어요. 팔았음은 보유 종목에서만 기록할 수 있어요.</p>
          )
        ) : (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="NVDA, 엔비디아"
              className={field}
              aria-label="종목 검색"
            />
            {(search.data ?? []).length > 0 && query.trim() && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-border">
                {search.data!.slice(0, 8).map((hit) => (
                  <li key={hit.symbol}>
                    <button
                      type="button"
                      onClick={() => setPicked(hit)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface"
                    >
                      <span className="w-14 shrink-0 text-[14px] font-semibold">{hit.symbol}</span>
                      <span className="truncate text-[14px] text-text-secondary">{hit.nameKo ?? hit.nameEn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block text-[13px] text-text-secondary">
          날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="block text-[13px] text-text-secondary">
          가격 ($)
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
        </label>
        <label className="block text-[13px] text-text-secondary">
          수량
          <input inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} className={field} />
        </label>
      </div>
      <label className="block text-[13px] text-text-secondary">
        메모 (선택)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={side === "buy" ? "왜 샀나" : "왜 팔았나"}
          className={field}
        />
      </label>

      {add.error && <p className="text-[13px] text-primary-hover">{add.error.message}</p>}
      <button
        type="submit"
        disabled={!valid || add.isPending}
        className="pressable min-h-11 w-full rounded-full bg-primary text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
      >
        {add.isPending ? "저장 중" : "기록하기"}
      </button>
    </form>
  );
}
