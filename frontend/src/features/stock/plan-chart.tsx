"use client";

import type { PriceBarRow } from "@atlas/contracts";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { usd } from "@/features/my/format";

export interface PlanLine {
  key: string;
  label: string;
  price: number;
  /** CSS 변수 이름 (예: --color-up) */
  color: string;
  dashed?: boolean;
}

const RANGES = [
  { key: "3m", label: "3개월", days: 63 },
  { key: "6m", label: "6개월", days: 126 },
  { key: "1y", label: "1년", days: 252 },
  { key: "2y", label: "2년", days: 504 },
] as const;

/** 이동평균선: 단기 → 장기로 갈수록 옅게 (같은 회색 계열의 밝기만 바꾼다) */
const MAS = [
  { n: 50, color: "--color-text-secondary", label: "50일선" },
  { n: 200, color: "--color-mist", label: "200일선" },
] as const;

/** 차트 라이브러리는 color-mix()를 못 읽는다. #RRGGBB → rgba */
function alpha(hex: string, a: number) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})` : hex;
}

const time = (date: string) => (Date.parse(`${date}T00:00:00Z`) / 1000) as UTCTimestamp;

function sma(bars: PriceBarRow[], n: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: time(b.date), value: sum / n });
  });
  return out;
}

/**
 * 종목 상세 차트: 일봉(정규장 종가 기준) + 거래량 + 50·200일선, 그 위에 계획 가격선(평단·손절가·조건부 매수가·VCP 피벗 등).
 * 가격선마다 오른쪽 축에 이름표가 붙어 색만으로 구분하지 않는다
 */
export function PlanChart({ bars, lines }: { bars: PriceBarRow[]; lines: PlanLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6m");
  const [hover, setHover] = useState<PriceBarRow | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !bars.length) return;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const up = v("--color-up");
    const down = v("--color-down");

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: v("--color-surface-raised") || "#fff" },
        textColor: v("--color-text-muted"),
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: 12,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--color-border") } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: v("--color-text") }, vertLine: { labelBackgroundColor: v("--color-text") } },
      localization: {
        priceFormatter: (p: number) => `$${p.toFixed(2)}`,
        timeFormatter: (t: UTCTimestamp) => {
          const d = new Date(t * 1000);
          return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
        },
      },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderVisible: false,
      priceLineVisible: false,
    });
    candles.setData(bars.map((b) => ({ time: time(b.date), open: b.open, high: b.high, low: b.low, close: b.close })));

    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      bars.map((b, i) => ({
        time: time(b.date),
        value: b.volume,
        color: alpha(b.close >= (bars[i - 1]?.close ?? b.open) ? up : down, 0.35),
      })),
    );

    for (const ma of MAS) {
      const s = chart.addSeries(LineSeries, { color: v(ma.color), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(sma(bars, ma.n));
    }

    for (const l of lines) {
      candles.createPriceLine({
        price: l.price,
        color: v(l.color),
        lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: l.label,
      });
    }

    const byTime = new Map(bars.map((b) => [time(b.date), b]));
    chart.subscribeCrosshairMove((p) => setHover(p.time ? (byTime.get(p.time as UTCTimestamp) ?? null) : null));

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, lines]);

  // 기간: 최근 N거래일을 보이게
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !bars.length) return;
    const days = RANGES.find((r) => r.key === range)!.days;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - days), to: bars.length + 3 });
  }, [range, bars, lines]);

  const shown = hover ?? bars.at(-1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-[13px] text-text-secondary tabular-nums" aria-live="polite">
          {shown && (
            <>
              <span className="text-text">{shown.date}</span> 시 {usd(shown.open)} 고 {usd(shown.high)} 저 {usd(shown.low)} 종{" "}
              <span className="font-semibold text-text">{usd(shown.close)}</span>
            </>
          )}
        </p>
        <div role="radiogroup" aria-label="기간" className="flex rounded-full bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => setRange(r.key)}
              className={`pressable min-h-8 rounded-full px-3 text-[13px] ${range === r.key ? "bg-surface-raised font-medium text-text shadow-card" : "text-text-secondary"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={box} className="mt-3 h-[360px] w-full lg:h-[440px]" role="img" aria-label="일봉 차트와 계획 가격선" />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-text-secondary">
        {MAS.map((m) => (
          <li key={m.n} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: `var(${m.color})` }} aria-hidden />
            {m.label}
          </li>
        ))}
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span
              className="h-0 w-4 border-t-2"
              style={{ borderColor: `var(${l.color})`, borderStyle: l.dashed ? "dashed" : "solid" }}
              aria-hidden
            />
            {l.label} <span className="tabular-nums text-text">{usd(l.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
