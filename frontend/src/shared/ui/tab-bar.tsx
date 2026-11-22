"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV } from "./nav";

export function TabBar() {
  const pathname = usePathname();
  return <TabBarView pathname={pathname} />;
}

/** usePathname이 아직 없을 때(프리렌더)도 같은 모양을 보여준다. 데스크톱에서는 사이드바가 대신한다 */
export function TabBarView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="주요 화면"
      className="glass fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] mx-auto flex w-fit gap-1 rounded-[32px] p-1.5 lg:hidden"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`pressable flex min-h-11 w-[72px] flex-col items-center justify-center gap-0.5 rounded-[26px] py-1.5 text-[11px] font-medium ${
              active ? "bg-text/[0.07] text-text" : "text-text-secondary"
            }`}
          >
            <Icon size={21} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
