"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_GROUPS } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return <SidebarView pathname={pathname} />;
}

const row = "pressable relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px]";

/** 데스크톱(1024px 이상) 왼쪽 메뉴. 회색 바탕 위에 그대로 놓이고, 현재 화면은 주황 글씨 + 왼쪽 막대 */
export function SidebarView({ pathname }: { pathname: string | null }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col px-4 py-7 lg:flex">
      <Link href="/" className="px-3 text-[20px] font-semibold tracking-[-0.01em]">
        Atlas
      </Link>

      {/* 자주 쓰는 두 동작은 맨 위에: 종목 찾기, 증권사 앱에서 사고판 것 기록 */}
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/search"
          className="pressable flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-text-muted hover:border-text-muted"
        >
          <Search size={18} strokeWidth={1.8} aria-hidden />
          종목 검색
        </Link>
        <Link
          href="/records"
          className="pressable flex min-h-11 items-center gap-2.5 rounded-xl bg-primary px-3 text-[15px] font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          매매 기록 추가
        </Link>
      </div>

      <nav aria-label="주요 화면" className="mt-8 flex flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[12px] text-text-muted">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`${row} ${active ? "font-medium text-primary" : "text-text-secondary hover:bg-text/[0.04]"}`}
                  >
                    {active && (
                      <span className="absolute top-1/2 -left-4 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" aria-hidden />
                    )}
                    <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
