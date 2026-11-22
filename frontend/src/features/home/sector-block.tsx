import type { HomeResponse } from "@atlas/contracts";
import { SectorHeatmap } from "./sector-heatmap";
import { SectorRanking } from "./sector-ranking";

/** 섹터 순위(오늘 1~5위) + 그 아래 최근 20거래일 순위 흐름. 데스크톱에서는 결론 오른쪽에 선다 */
export function SectorBlock({ home }: { home: HomeResponse }) {
  return (
    <div className="space-y-10">
      <SectorRanking sectors={home.sectors} />
      {home.sectorHistory ? (
        <SectorHeatmap data={home.sectorHistory} />
      ) : (
        <p className="text-[15px] text-text-muted">섹터 이력 데이터 없음</p>
      )}
    </div>
  );
}
