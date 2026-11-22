import type { HomeResponse } from "@atlas/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export const homeKey = ["home"] as const;

export function useHome() {
  return useQuery({
    queryKey: homeKey,
    queryFn: () => api.get<HomeResponse>("/home"),
    // 분석이 도는 동안만 5초마다 다시 본다
    refetchInterval: (query) => (query.state.data?.run?.status === "running" ? 5_000 : false),
  });
}

/** 수동 분석 실행. 서버는 바로 202를 주고 뒤에서 돈다 */
export function useRunMarketDaily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ accepted: string }>("/runs/market_daily"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: homeKey }),
  });
}
