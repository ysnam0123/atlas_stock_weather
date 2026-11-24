import type { HomePremarket } from "@atlas/contracts";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { changeText, displayName, usd } from "@/features/my/format";
import { formatKstTime } from "@/shared/lib/time";
import { SectionTitle } from "./section";

const INDEX_NAME: Record<string, string> = { SPY: "S&P 500", QQQ: "나스닥 100" };

/**
 * 오늘 밤 프리마켓 (저녁 홈). 21:30 KST에 한 번 찍은 값이라 기준 시각을 꼭 같이 쓴다.
 * 장 전 거래는 양이 적어 정규장에서 뒤집히기 쉽다. 판정은 여전히 종가로 한다 (절대 규칙 6)
 */
export function PremarketCard({ data }: { data: HomePremarket }) {
  return (
    <section aria-labelledby="premarket-title">
      <SectionTitle id="premarket-title" aside={`${formatKstTime(new Date(data.takenAt))} 기준`}>
        오늘 밤 프리마켓
      </SectionTitle>
      <ul className="mt-2">
        {data.items.map((x) => {
          const c = changeText(x.changePct);
          return (
            <li key={x.symbol} className="border-b border-border last:border-b-0">
              <Link
                href={`/stocks/${encodeURIComponent(x.symbol)}`}
                className="pressable -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[15px]">{INDEX_NAME[x.symbol] ?? displayName(x)}</span>
                    <span className="shrink-0 text-[12px] text-text-muted">{x.tracked === "index" ? x.symbol : x.tracked === "holding" ? "보유" : "관심"}</span>
                  </span>
                  {x.belowStop && x.stopPrice != null && (
                    <span className="block text-[12px] text-primary-hover">손절가 {usd(x.stopPrice)} 아래에서 거래 중</span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] tabular-nums">{usd(x.price)}</span>
                  {c && <span className={`block text-[12px] tabular-nums ${c.tone}`}>{c.text}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] leading-[1.5] text-text-muted">
        전날 종가 대비예요. 장 전 거래는 양이 적어 본장에서 뒤집히기 쉬워요. 실시간 가격은 증권사 앱에서 보세요.
      </p>
    </section>
  );
}
