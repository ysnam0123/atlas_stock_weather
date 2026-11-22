"use client";

import type { HomeWeather } from "@atlas/contracts";
import { useId, useState } from "react";
import { Term } from "@/features/learn/term";
import { pct, ratioDelta, score } from "./format";

/** 0~100 위치를 트랙 위 %로 */
const at = (n: number) => `${Math.min(100, Math.max(0, n))}%`;

export function ScoreLine({ weather }: { weather: HomeWeather }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  const { score: today, prevScore } = weather;
  const uptrend = weather.uptrendRatio;
  const uptrendDelta = uptrend == null ? null : ratioDelta(uptrend, weather.prevUptrendRatio);

  return (
    <div>
      {today != null ? (
        <div
          role="img"
          aria-label={`시장 점수 100점 중 ${score(today)}점`}
          className="relative h-4"
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-text-muted/50" />
          {prevScore && (
            <div
              className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-text-secondary"
              style={{ left: at(prevScore.score) }}
            />
          )}
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text ring-4 ring-bg"
            style={{ left: at(today) }}
          />
        </div>
      ) : null}

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="text-[15px]">
          {today != null ? (
            <>
              <Term id="marketScore" /> <span className="font-semibold">{score(today)}</span>
              <span className="text-text-secondary">
                {prevScore ? `, 전 거래일 ${score(prevScore.score)}` : ", 비교할 전 거래일 점수는 아직 없어요"}
              </span>
            </>
          ) : (
            <span className="text-text-muted">시장 점수 데이터 없음</span>
          )}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={helpId}
          onClick={() => setOpen((v) => !v)}
          className="pressable -my-3 shrink-0 py-3 text-[13px] text-primary"
        >
          점수 읽는 법
        </button>
      </div>

      {uptrend != null && (
        <p className="mt-1 text-[13px] text-text-secondary">
          <Term id="uptrend">상승추세 종목</Term> {pct(uptrend)}
          {uptrendDelta && <span className={`ml-1.5 ${uptrendDelta.tone}`}>{uptrendDelta.text}</span>}
        </p>
      )}

      {/* 높이를 0fr → 1fr로 펼친다. 움직임 줄이기 설정이면 즉시 */}
      <div
        id={helpId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-2 border-l-2 border-primary/40 pl-3 text-[13px] leading-[1.55] text-text-secondary">
            <p>
              시장 점수는 미국 주식 시장의 폭, 즉 얼마나 많은 종목이 함께 오르고 있는지를 0~100으로 매긴 값이에요.
              선 위의 점이 오늘, 작은 눈금이 전 거래일이에요.
            </p>
            <p>상승추세 종목은 전체 종목 중 상승추세에 있는 종목의 비율이에요.</p>
            <p>둘 다 지금 상태를 보여줄 뿐, 앞으로의 방향을 말하지 않아요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
