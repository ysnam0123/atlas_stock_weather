import type { AiSignal, HomeCongressFlow, HomeEarnings, HomePremarket, HomeWeather, MyResponse } from "@atlas/contracts";
import {
  CalendarDays,
  ChevronRight,
  CloudSun,
  Flag,
  Landmark,
  PieChart,
  ShieldAlert,
  Star,
  Swords,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { displayName, STOP_NEAR_PCT, usd } from "@/features/my/format";
import { clearSteps } from "./format";
import { daysUntil } from "./schedule-card";
import { SectionTitle } from "./section";

interface Action {
  key: string;
  icon: LucideIcon;
  text: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  /** 손절가 아래 마감처럼 가장 먼저 봐야 하는 줄 */
  alert?: boolean;
  muted?: boolean;
}

/**
 * 오늘 할 일 (급한 순): 손절가 → AI 매도 신호 → 실적 발표 → 비중 초과 → 목표가 → 손절가 없음 → 설정 → 시장 → AI 매수.
 * 행동할 것만 둔다. 뉴스는 "내 종목 소식"(intel-feed), 관심 종목 상태는 관심 카드에서 본다.
 * 의원 거래는 여러 명이 한쪽으로 몰릴 때만 한 줄 (낱개 신고는 종목 소식 시트에서).
 * 날씨 판정과 내 종목 상태에서 규칙대로 만든다 (Claude를 쓰지 않는다). 선택과 주문은 사용자가 한다.
 */
export function ActionQueue({
  weather,
  my,
  aiSignals,
  earnings,
  congressFlows,
  premarket,
  now,
  onInfo,
  onOpenConditions,
  onSetCapital,
}: {
  weather: HomeWeather | null;
  /** 불러오는 중이거나 실패하면 undefined. 그때는 내 종목 줄만 빠진다 */
  my: MyResponse | undefined;
  /** 가장 최근 장의 AI 신호. 내 종목 매도 신호와 AI 조건부 주문만 쓴다 */
  aiSignals: AiSignal[];
  earnings: HomeEarnings[];
  /** 내 종목에 의원 3명 이상이 한쪽으로 몰린 경우만 */
  congressFlows: HomeCongressFlow[];
  /** 오늘 밤 프리마켓. 보유 종목이 손절가 아래에서 거래되면 맨 위에 */
  premarket: HomePremarket | null;
  now: Date;
  onInfo: (target: { symbol: string; nameKo: string | null; nameEn: string }) => void;
  onOpenConditions: () => void;
  onSetCapital: () => void;
}) {
  const actions: Action[] = [];
  const holdings = my?.holdings ?? [];

  for (const p of premarket?.items.filter((x) => x.belowStop) ?? []) {
    actions.push({
      key: `pre-stop-${p.symbol}`,
      icon: ShieldAlert,
      alert: true,
      text: `${displayName(p)}, 프리마켓에서 손절가 아래예요`,
      sub: `프리마켓 ${usd(p.price)}, 손절가 ${usd(p.stopPrice!)}. 본장에서 그대로면 손절 자리예요. 증권사 앱에서 확인하세요`,
      href: "/my",
    });
  }

  for (const h of holdings) {
    if (h.stopPrice == null || h.lastClose == null || h.stopDistancePct == null) continue;
    if (h.stopDistancePct <= 0) {
      actions.push({
        key: `stop-${h.symbol}`,
        icon: ShieldAlert,
        alert: true,
        text: `${displayName(h)}, 손절가 아래로 마감했어요`,
        sub: `종가 ${usd(h.lastClose)}, 손절가 ${usd(h.stopPrice)}. 정해 둔 계획대로라면 정리할 자리예요`,
        href: "/my",
      });
    } else if (h.stopDistancePct < STOP_NEAR_PCT) {
      actions.push({
        key: `stop-${h.symbol}`,
        icon: ShieldAlert,
        text: `${displayName(h)}, 손절가까지 ${h.stopDistancePct.toFixed(1)}% 남았어요`,
        sub: `종가 ${usd(h.lastClose)}, 손절가 ${usd(h.stopPrice)}`,
        href: "/my",
      });
    }
  }

  // AI 규칙으로 본 내 종목 매도 신호 (선택은 사용자)
  for (const s of aiSignals.filter((x) => x.verdict === "sell")) {
    actions.push({
      key: `ai-sell-${s.symbol}`,
      icon: Swords,
      text: `AI 매도 신호: ${displayName(s)}`,
      sub: s.checks[0]?.detail ?? s.reasonKo,
      href: "/ai",
    });
  }

  // 보유 종목 실적 발표가 일주일 안이면 (발표 날 크게 움직일 수 있다)
  for (const e of earnings.filter((x) => x.tracked === "holding")) {
    const d = daysUntil(e.date, now);
    if (d < 0 || d > 7) continue;
    actions.push({
      key: `earnings-${e.symbol}`,
      icon: CalendarDays,
      text: `${displayName(e)} 실적 발표 ${d === 0 ? "오늘" : `D-${d}`}`,
      sub: "발표 날은 크게 움직일 수 있어요. 손절가와 비중을 미리 확인해 두세요",
      href: "/my",
    });
  }

  // 의원 거래 쏠림: 서로 다른 의원 3명 이상이 30일 안에 같은 방향 (신고가 늦어 참고용)
  for (const f of congressFlows) {
    const n = f.side === "buy" ? f.buyers : f.sellers;
    actions.push({
      key: `congress-${f.symbol}`,
      icon: Landmark,
      muted: true,
      text: `${displayName(f)}, 의원 ${n}명이 ${f.side === "buy" ? "샀어요" : "팔았어요"}`,
      sub: `30일 안 신고 기준, 반대쪽은 ${f.side === "buy" ? f.sellers : f.buyers}명. 거래 뒤 늦게 신고되는 공개 자료예요`,
      onClick: () => onInfo(f),
    });
  }

  const exposure = my?.summary.exposurePct ?? null;
  const ceiling = weather?.exposureCeiling ?? null;
  if (exposure != null && ceiling != null && exposure > ceiling) {
    actions.push({
      key: "exposure",
      icon: PieChart,
      text: `주식 비중이 권장 상한보다 ${(exposure - ceiling).toFixed(0)}%p 높아요`,
      sub: `지금 ${exposure.toFixed(0)}%, 상한 ${ceiling}%. 약한 종목부터 줄이는 쪽이 판정과 맞아요`,
      href: "/my",
    });
  }

  for (const h of holdings) {
    if (h.targetPrice != null && h.lastClose != null && h.lastClose >= h.targetPrice) {
      actions.push({
        key: `target-${h.symbol}`,
        icon: Flag,
        text: `${displayName(h)}, 목표가에 닿았어요`,
        sub: `종가 ${usd(h.lastClose)}, 목표가 ${usd(h.targetPrice)}`,
        href: "/my",
      });
    }
  }

  const noStop = holdings.filter((h) => h.stopPrice == null);
  if (noStop.length) {
    actions.push({
      key: "no-stop",
      icon: ShieldAlert,
      text: noStop.length === 1 ? `${displayName(noStop[0])}에 손절가가 없어요` : `보유 종목 ${noStop.length}개에 손절가가 없어요`,
      sub: "손절가가 없으면 열린 위험(최대 손실)을 계산할 수 없어요",
      href: "/my",
    });
  }

  if (my && holdings.length === 0) {
    actions.push({
      key: "holdings",
      icon: Star,
      text: "보유 종목을 등록해 주세요",
      sub: "평단가와 손절가를 넣어두면 손절가까지 남은 거리를 매일 알려드려요",
      href: "/search",
    });
  }
  if (my && my.capital == null) {
    actions.push({
      key: "capital",
      icon: Wallet,
      text: "총 투자금을 넣어 주세요",
      sub: "내 주식 비중을 권장 상한과 비교해 드려요",
      onClick: onSetCapital,
    });
  }

  if (weather && weather.condition !== "clear") {
    const clear = clearSteps(weather.exposureScore, weather.exposureMissing);
    if (clear && clear.remaining > 0) {
      actions.push({
        key: "market",
        icon: CloudSun,
        text: `다시 맑아지려면 조건 ${clear.remaining}개가 남았어요`,
        sub: "그전까지 새 매수는 쉬는 날이에요",
        onClick: onOpenConditions,
      });
    }
  }

  const buys = aiSignals.filter((x) => x.verdict === "buy" && x.status === "planned");
  if (buys.length) {
    actions.push({
      key: "ai-buy",
      icon: Swords,
      text: `AI 조건부 주문: ${buys.map((b) => (b.triggerPrice != null ? `${b.symbol} $${b.triggerPrice.toFixed(2)} 넘으면` : b.symbol)).join(", ")}`,
      sub: "모의 계좌예요. 나라면 어떻게 할지 정해 보세요",
      href: "/ai",
    });
  }

  return (
    <section aria-labelledby="actions-title">
      <SectionTitle id="actions-title" aside={actions.length ? `${actions.length}개` : undefined}>
        오늘 할 일
      </SectionTitle>
      {actions.length === 0 && (
        <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
          오늘은 손볼 게 없어요. 손절가와 비중이 모두 계획 안에 있어요.
        </p>
      )}
      <ul className="mt-2 -mx-2">
        {actions.map((a, i) => {
          const last = i === actions.length - 1;
          const body = (
            <>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  a.alert ? "bg-primary text-white" : a.muted ? "bg-surface text-text-muted" : "bg-primary-tint text-primary"
                }`}
              >
                <a.icon size={18} strokeWidth={1.8} aria-hidden />
              </span>
              <span className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 ${last ? "" : "border-b border-border"}`}>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] leading-snug ${a.muted ? "text-text-secondary" : ""}`}>{a.text}</span>
                  {a.sub && <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-muted">{a.sub}</span>}
                </span>
                {(a.href || a.onClick) && <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />}
              </span>
            </>
          );
          const row = "flex w-full items-center gap-3 rounded-2xl pl-2 text-left";
          return (
            <li key={a.key}>
              {a.href ? (
                <Link href={a.href} className={`pressable ${row} hover:bg-surface`}>
                  {body}
                </Link>
              ) : a.onClick ? (
                <button type="button" onClick={a.onClick} className={`pressable ${row} hover:bg-surface`}>
                  {body}
                </button>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
