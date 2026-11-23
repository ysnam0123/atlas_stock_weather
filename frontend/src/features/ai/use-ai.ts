import type { AiDuelResponse, TradeInput, TradeRow } from "@atlas/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { myKey } from "@/features/my/use-my";
import { api } from "@/shared/api/client";

export const aiKey = ["ai"] as const;
export const tradesKey = ["trades"] as const;

export function useAiDuel() {
  return useQuery({
    queryKey: aiKey,
    queryFn: () => api.get<AiDuelResponse>("/ai"),
    // AI가 도는 동안(스캔 몇 분)은 10초마다 다시 본다
    refetchInterval: (q) => (q.state.data?.lastRun?.status === "running" ? 10_000 : false),
  });
}

export function useStartAiAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (startCapital: number) => api.post<{ id: string }>("/ai/account", { startCapital }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiKey }),
  });
}

export function useRunAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ accepted: string }>("/ai/run"),
    // 실행이 시작돼 running 기록이 생길 즈음 다시 받는다
    onSuccess: () => setTimeout(() => queryClient.invalidateQueries({ queryKey: aiKey }), 1500),
  });
}

export function useTrades() {
  return useQuery({ queryKey: tradesKey, queryFn: () => api.get<TradeRow[]>("/trades") });
}

/** 매매 기록은 보유 종목·AI 성적에도 영향을 준다 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [tradesKey, myKey, aiKey, ["symbols"]]) void queryClient.invalidateQueries({ queryKey: key });
  };
}

export function useAddTrade() {
  const done = useInvalidateAll();
  return useMutation({ mutationFn: (input: TradeInput) => api.post("/trades", input), onSuccess: done });
}

export function useDeleteTrade() {
  const done = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.delete(`/trades/${id}`), onSuccess: done });
}
