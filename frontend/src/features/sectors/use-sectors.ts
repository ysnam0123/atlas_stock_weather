import type { SectorsResponse } from "@atlas/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export function useSectors() {
  return useQuery({ queryKey: ["sectors"], queryFn: () => api.get<SectorsResponse>("/sectors") });
}
