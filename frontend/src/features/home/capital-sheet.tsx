"use client";

import { useState } from "react";
import { useSaveCapital } from "@/features/my/use-my";
import { Sheet } from "@/shared/ui/sheet";

/** 총 투자금 입력. 내 주식 비중(보유 평가금 ÷ 총 투자금)을 권장 상한과 비교하는 데 쓴다 */
export function CapitalSheet({ open, capital, onClose }: { open: boolean; capital: number | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="총 투자금">
      {open && <CapitalForm capital={capital} onDone={onClose} />}
    </Sheet>
  );
}

function CapitalForm({ capital, onDone }: { capital: number | null; onDone: () => void }) {
  const [value, setValue] = useState(capital ? String(capital) : "");
  const save = useSaveCapital();
  const n = Number(value.replace(/,/g, ""));
  const valid = value.trim() !== "" && Number.isFinite(n) && n > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate(n, { onSuccess: onDone });
      }}
      className="space-y-4"
    >
      <p className="text-[14px] leading-[1.55] text-text-secondary">
        미국 주식에 쓰는 돈 전체(현금 포함)를 달러로 넣어 주세요. 대략이어도 괜찮아요. 이 값은 내 맥의 DB에만 저장돼요.
      </p>
      <label className="block text-[13px] text-text-secondary">
        금액 ($)
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="10000"
          className="mt-1.5 block min-h-12 w-full rounded-xl border border-border px-3 text-[18px] tabular-nums outline-none focus:border-primary"
        />
      </label>
      {save.error && <p className="text-[13px] text-primary-hover">{save.error.message}</p>}
      <div className="flex items-center gap-2">
        {capital != null && (
          <button
            type="button"
            onClick={() => save.mutate(null, { onSuccess: onDone })}
            className="pressable min-h-11 rounded-full px-4 text-[15px] text-text-secondary hover:bg-surface"
          >
            지우기
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || save.isPending}
          className="pressable ml-auto min-h-11 rounded-full bg-primary px-6 text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </form>
  );
}
