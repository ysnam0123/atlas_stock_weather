import { House, LayoutGrid, NotebookPen, Star, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** 데스크톱 사이드바는 묶음 이름과 함께, 모바일 탭바는 순서대로 펼쳐서 쓴다 */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "브리핑",
    items: [
      { href: "/", label: "홈", icon: House },
      { href: "/sectors", label: "섹터 지도", icon: LayoutGrid },
    ],
  },
  {
    label: "내 투자",
    items: [
      { href: "/my", label: "내 종목", icon: Star },
      { href: "/records", label: "기록", icon: NotebookPen },
    ],
  },
];

/** 모바일 탭바 순서 */
export const NAV: NavItem[] = ["/", "/my", "/records", "/sectors"].map(
  (href) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === href)!,
);

export function isActive(pathname: string | null, href: string) {
  if (pathname == null) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
