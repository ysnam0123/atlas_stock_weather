import type { VcpInfo } from '../ai/strategy.js';

interface RawVcp {
  symbol?: string;
  composite_score?: number;
  rating?: string;
  valid_vcp?: boolean;
  execution_state?: string;
  distance_from_pivot_pct?: number;
  pivot_proximity?: { pivot_price?: number | null; stop_loss_price?: number | null };
  vcp_pattern?: { num_contractions?: number; pivot_price?: number | null };
}

/** vcp-screener 출력(results) → 종목별 VcpInfo. 피벗이 없는 줄은 뺀다 */
export function adaptVcp(json: unknown): Map<string, VcpInfo> {
  const results = ((json as { results?: RawVcp[] } | null)?.results ?? []).filter((r) => r && typeof r.symbol === 'string');
  const out = new Map<string, VcpInfo>();
  for (const r of results) {
    const pivot = r.pivot_proximity?.pivot_price ?? r.vcp_pattern?.pivot_price;
    if (typeof pivot !== 'number' || !Number.isFinite(pivot) || pivot <= 0) continue;
    out.set(r.symbol!, {
      valid: r.valid_vcp === true,
      state: r.execution_state ?? 'Unknown',
      rating: r.rating ?? '',
      score: r.composite_score ?? 0,
      pivot,
      stop: r.pivot_proximity?.stop_loss_price ?? null,
      contractions: r.vcp_pattern?.num_contractions ?? 0,
      distancePct: r.distance_from_pivot_pct ?? 0,
    });
  }
  return out;
}
