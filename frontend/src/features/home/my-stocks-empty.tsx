import { Plus } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "./section";

/** 데스크톱 오른쪽 칸의 내 종목. Phase 2에서 보유·관심 목록으로 바뀐다. 그 전까지는 무엇이 올지 안내만 한다 */
export function MyStocksEmpty() {
  return (
    <section aria-labelledby="my-title">
      <SectionTitle id="my-title">내 종목</SectionTitle>
      <p className="mt-2 text-[15px] leading-[1.5] text-text-secondary">
        보유 종목은 손절가 도달, 새 공시, 실적 발표처럼 밤사이 바뀐 것만 골라 알려드려요. 관심 종목은 진입 조건을
        어디까지 통과했는지 보여드려요.
      </p>
      <Link
        href="/my"
        className="pressable mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-medium text-white hover:bg-primary-hover active:bg-primary-hover"
      >
        <Plus size={18} aria-hidden />
        종목 추가
      </Link>
    </section>
  );
}
