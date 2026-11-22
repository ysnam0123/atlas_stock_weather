import { Suspense } from "react";
import { Providers } from "@/shared/ui/providers";
import { Sidebar, SidebarView } from "@/shared/ui/sidebar";
import { TabBar, TabBarView } from "@/shared/ui/tab-bar";
import { TopBar } from "@/shared/ui/top-bar";

// 종목 상세처럼 동적 경로에서는 경로를 프리렌더 때 모르므로 메뉴에 Suspense가 필요하다
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <div className="lg:flex">
        <Suspense fallback={<SidebarView pathname={null} />}>
          <Sidebar />
        </Suspense>

        {/* 모바일은 한 줄(아래 여백은 떠 있는 탭바 자리). 데스크톱은 화면을 꽉 채우고, 안쪽 여백은 각 화면이 정한다 */}
        <div className="mx-auto w-full max-w-[480px] min-w-0 px-4 pb-32 md:max-w-[640px] lg:mx-0 lg:max-w-none lg:px-0 lg:pb-0">
          <div className="lg:hidden">
            <TopBar />
          </div>
          <main>{children}</main>
        </div>
      </div>

      <Suspense fallback={<TabBarView pathname={null} />}>
        <TabBar />
      </Suspense>
    </Providers>
  );
}
