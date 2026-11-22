import { Plus, Search } from "lucide-react";
import Link from "next/link";

const circle =
  "pressable grid size-11 place-items-center rounded-full bg-surface text-text active:bg-border";

export function TopBar() {
  return (
    <header className="flex items-center justify-between pt-[max(12px,env(safe-area-inset-top))] pb-2">
      <Link href="/" className="text-[20px] font-semibold tracking-[-0.01em]">
        Atlas
      </Link>
      <div className="flex gap-2">
        <Link href="/records" aria-label="매매 기록 추가" className={circle}>
          <Plus size={20} strokeWidth={2} />
        </Link>
        <Link href="/search" aria-label="검색" className={circle}>
          <Search size={19} strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}
