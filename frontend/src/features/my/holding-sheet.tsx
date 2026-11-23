"use client";

import type { MyHolding, StopMethod } from "@atlas/contracts";
import { useDeferredValue, useId, useState } from "react";
import { Term } from "@/features/learn/term";
import { Sheet } from "@/shared/ui/sheet";
import { displayName, STOP_METHOD_LABEL, usd } from "./format";
import { useRemoveHolding, useSaveHolding, useStopOptions } from "./use-my";

export interface SheetTarget {
  symbol: string;
  nameKo: string | null;
  nameEn: string;
  /** 이미 보유 중이면 기존 값 */
  holding?: MyHolding;
}

type StopChoice = StopMethod | "manual" | "none";

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
};

const field =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-[16px] tabular-nums outline-none focus:border-primary";

/**
 * 보유 정보 편집 (docs/frontend.md "내 종목 편집 시트").
 * 수량·평단가를 넣으면 손절가 세 방식이 계산돼 나오고, 하나를 고르거나 직접 입력한다.
 * 수량 0으로 저장하면 관심 종목으로 돌아간다.
 */
export function HoldingSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
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
      {/* 종목이 바뀌면 폼을 새로 만든다 */}
      {target && <HoldingForm key={target.symbol} target={target} onDone={onClose} />}
    </Sheet>
  );
}

function HoldingForm({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const h = target.holding;
  const ids = useId();
  const [shares, setShares] = useState(h ? String(h.shares) : "");
  const [avgCost, setAvgCost] = useState(h ? String(h.avgCost) : "");
  const [picked, setChoice] = useState<StopChoice>(h?.stopMethod ?? (h ? "none" : "percent"));
  const [manualStop, setManualStop] = useState(h?.stopMethod === "manual" && h.stopPrice ? String(h.stopPrice) : "");
  const [target_, setTarget] = useState(h?.targetPrice ? String(h.targetPrice) : "");
  const [note, setNote] = useState(h?.note ?? "");
  const [openedAt, setOpenedAt] = useState(h?.openedAt ?? "");

  const save = useSaveHolding();
  const remove = useRemoveHolding();

  // 칠 때마다 요청하지 않도록 한 박자 늦춰 계산한다
  const deferredAvg = useDeferredValue(num(avgCost));
  const deferredShares = useDeferredValue(num(shares));
  const stops = useStopOptions(target.symbol, deferredAvg, deferredShares);
  const options = stops.data?.options ?? [];
  const lastClose = stops.data?.lastClose ?? h?.lastClose ?? null;

  // 고른 방식이 계산되지 않으면(일봉 부족 등) 직접 입력으로 본다
  const choice: StopChoice = options.some((o) => o.method === picked && o.stopPrice == null) ? "manual" : picked;

  const sharesN = num(shares);
  const avgN = num(avgCost);
  const stopPrice =
    choice === "none" ? null : choice === "manual" ? num(manualStop) : (options.find((o) => o.method === choice)?.stopPrice ?? null);
  const canSave = sharesN != null && sharesN >= 0 && (sharesN === 0 || (avgN != null && avgN > 0));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    save.mutate(
      {
        symbol: target.symbol,
        input: {
          openedAt: openedAt || null,
          shares: sharesN!,
          avgCost: avgN ?? 0,
          stopPrice,
          stopMethod: choice === "none" ? null : choice,
          targetPrice: num(target_),
          note: note.trim() || null,
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[13px] text-text-secondary">
          수량 (주)
          <input
            inputMode="decimal"
            autoFocus
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="10"
            className={field}
          />
        </label>
        <label className="block text-[13px] text-text-secondary">
          평단가 ($)
          <input
            inputMode="decimal"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="150.00"
            className={field}
          />
        </label>
      </div>
      {sharesN === 0 && <p className="-mt-3 text-[13px] text-text-secondary">수량 0으로 저장하면 관심 종목으로 옮겨요.</p>}

      {sharesN !== 0 && (
        <fieldset>
          <legend className="text-[15px] font-medium">
            <Term id="stopLoss" /> 고르기
          </legend>
          <p className="mt-1 text-[13px] leading-[1.5] text-text-muted">
            {lastClose != null
              ? `최근 종가 ${usd(lastClose)} (정규장 종가 기준). 평단가를 넣으면 세 가지 방식으로 계산해요.`
              : "평단가를 넣으면 세 가지 방식으로 계산해요."}
          </p>

          <div className="mt-3 space-y-2">
            {avgN == null ? (
              <p className="rounded-xl bg-surface px-4 py-3 text-[14px] text-text-muted">평단가를 먼저 넣어 주세요</p>
            ) : (
              options.map((o) => {
                const disabled = o.stopPrice == null;
                const aboveClose = o.stopPrice != null && lastClose != null && o.stopPrice >= lastClose;
                return (
                  <label
                    key={o.method}
                    className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${
                      choice === o.method ? "border-primary bg-primary-tint/40" : "border-border"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`${ids}-stop`}
                      checked={choice === o.method}
                      disabled={disabled}
                      onChange={() => setChoice(o.method)}
                      className="mt-1 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] font-medium">{STOP_METHOD_LABEL[o.method]}</span>
                        <span className="text-[15px] font-semibold tabular-nums">
                          {o.stopPrice != null ? usd(o.stopPrice) : "계산 불가"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-secondary">{o.basis}</span>
                      {o.stopPrice != null && (
                        <span className="mt-0.5 block text-[13px] text-text-muted tabular-nums">
                          평단가 대비 −{o.lossPct}%{o.maxLoss != null && <>, 최대 손실 {usd(o.maxLoss)}</>}
                        </span>
                      )}
                      {aboveClose && (
                        <span className="mt-1 block text-[13px] text-primary-hover">이미 최근 종가보다 위에 있는 가격이에요</span>
                      )}
                    </span>
                  </label>
                );
              })
            )}

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${
                choice === "manual" ? "border-primary bg-primary-tint/40" : "border-border"
              }`}
            >
              <input
                type="radio"
                name={`${ids}-stop`}
                checked={choice === "manual"}
                onChange={() => setChoice("manual")}
                className="accent-primary"
              />
              <span className="text-[15px] font-medium">직접 입력</span>
              <input
                inputMode="decimal"
                value={manualStop}
                onFocus={() => setChoice("manual")}
                onChange={(e) => setManualStop(e.target.value)}
                placeholder="$"
                aria-label="손절가 직접 입력 ($)"
                className="ml-auto min-h-10 w-32 rounded-lg border border-border px-3 text-right text-[15px] tabular-nums outline-none focus:border-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-[14px] text-text-secondary">
              <input
                type="radio"
                name={`${ids}-stop`}
                checked={choice === "none"}
                onChange={() => setChoice("none")}
                className="accent-primary"
              />
              지금은 정하지 않기
            </label>
          </div>
        </fieldset>
      )}

      {sharesN !== 0 && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[13px] text-text-secondary">
            산 날짜 (선택)
            <input type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} className={field} />
          </label>
          <label className="block text-[13px] text-text-secondary">
            목표가 ($, 선택)
            <input inputMode="decimal" value={target_} onChange={(e) => setTarget(e.target.value)} className={field} />
          </label>
          <label className="col-span-2 block text-[13px] text-text-secondary">
            메모 (선택)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="산 이유" className={field} />
          </label>
        </div>
      )}

      {(save.error || remove.error) && (
        <p className="text-[13px] text-primary-hover">{(save.error ?? remove.error)?.message}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {h && (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(target.symbol, { onSuccess: onDone })}
            className="pressable min-h-11 rounded-full px-4 text-[15px] text-text-secondary hover:bg-surface"
          >
            보유에서 삭제
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave || save.isPending}
          className="pressable ml-auto min-h-11 rounded-full bg-primary px-6 text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {save.isPending ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
