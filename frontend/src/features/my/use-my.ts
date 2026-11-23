import type { HoldingInput, MyResponse, StockIntel, StopOptionsResponse, SymbolHit } from "@atlas/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export const myKey = ["my"] as const;

export function useMy() {
  return useQuery({ queryKey: myKey, queryFn: () => api.get<MyResponse>("/my") });
}

export function useSymbolSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["symbols", query],
    queryFn: () => api.get<SymbolHit[]>(`/symbols/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
    // 글자를 칠 때 결과가 깜빡이지 않게 이전 결과를 잠시 둔다
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useStopOptions(symbol: string | null, avgCost: number | null, shares: number | null) {
  return useQuery({
    queryKey: ["stop-options", symbol, avgCost, shares],
    queryFn: () =>
      api.get<StopOptionsResponse>(
        `/holdings/${encodeURIComponent(symbol!)}/stop-options?avgCost=${avgCost}${shares ? `&shares=${shares}` : ""}`,
      ),
    enabled: !!symbol && avgCost != null && avgCost > 0,
    placeholderData: keepPreviousData,
  });
}

/** 저장·삭제 뒤에는 내 종목과 검색 결과(추적 표시)를 다시 받는다 */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: myKey });
    void queryClient.invalidateQueries({ queryKey: ["symbols"] });
  };
}

export function useAddWatch() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (symbol: string) => api.post<{ symbol: string }>("/watchlist", { symbol }),
    onSuccess: done,
  });
}

export function useRemoveWatch() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (symbol: string) => api.delete<{ symbol: string }>(`/watchlist/${encodeURIComponent(symbol)}`),
    onSuccess: done,
  });
}

export function useSaveHolding() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: ({ symbol, input }: { symbol: string; input: HoldingInput }) =>
      api.put<{ symbol: string; movedTo: "holding" | "watch" }>(`/holdings/${encodeURIComponent(symbol)}`, input),
    onSuccess: done,
  });
}

export function useRemoveHolding() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (symbol: string) => api.delete<{ symbol: string }>(`/holdings/${encodeURIComponent(symbol)}`),
    onSuccess: done,
  });
}

/** 총 투자금 저장. null이면 지운다 */
export function useSaveCapital() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (capital: number | null) => api.put<{ capital: number | null }>("/settings", { capital }),
    onSuccess: done,
  });
}

/** 종목 소식 (뉴스·공시, 분기 실적, 의원 거래). 시트를 열 때만 받는다 */
export function useStockIntel(symbol: string | null) {
  return useQuery({
    queryKey: ["intel", symbol],
    queryFn: () => api.get<StockIntel>(`/stocks/${encodeURIComponent(symbol!)}/intel`),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });
}
