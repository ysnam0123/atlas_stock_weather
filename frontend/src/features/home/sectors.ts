import {
  Building2,
  Cpu,
  Factory,
  Flame,
  Gem,
  HeartPulse,
  Landmark,
  RadioTower,
  ShoppingBag,
  ShoppingBasket,
  Zap,
  type LucideIcon,
} from "lucide-react";

// 키는 sector_snapshots.sector 값 (uptrend-analyzer 섹터 이름)
export const SECTORS: Record<string, { ko: string; icon: LucideIcon; tile: string }> = {
  Technology: { ko: "기술", icon: Cpu, tile: "bg-sector-technology" },
  "Communication Services": { ko: "커뮤니케이션", icon: RadioTower, tile: "bg-sector-communication" },
  "Consumer Cyclical": { ko: "경기소비재", icon: ShoppingBag, tile: "bg-sector-cyclical" },
  "Consumer Defensive": { ko: "필수소비재", icon: ShoppingBasket, tile: "bg-sector-defensive" },
  Healthcare: { ko: "헬스케어", icon: HeartPulse, tile: "bg-sector-healthcare" },
  "Financial Services": { ko: "금융", icon: Landmark, tile: "bg-sector-financial" },
  Financial: { ko: "금융", icon: Landmark, tile: "bg-sector-financial" },
  Industrials: { ko: "산업재", icon: Factory, tile: "bg-sector-industrials" },
  Energy: { ko: "에너지", icon: Flame, tile: "bg-sector-energy" },
  "Basic Materials": { ko: "소재", icon: Gem, tile: "bg-sector-materials" },
  "Real Estate": { ko: "부동산", icon: Building2, tile: "bg-sector-realestate" },
  Utilities: { ko: "유틸리티", icon: Zap, tile: "bg-sector-utilities" },
};

export function sectorMeta(name: string) {
  return SECTORS[name] ?? { ko: name, icon: Factory, tile: "bg-slate" };
}
