"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // 분석 결과는 하루 몇 번만 바뀐다. 탭에 돌아올 때만 다시 확인한다
      queries: { staleTime: 60_000, retry: 1 },
    },
  });
}

function getQueryClient() {
  // 서버 렌더는 요청마다 새로, 브라우저는 하나를 계속 쓴다
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
