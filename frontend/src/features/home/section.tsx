import type { ReactNode } from "react";

/** 섹션 제목 + 오른쪽 보조 글씨(기준 날짜 등) */
export function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[18px] font-semibold tracking-[-0.01em]">
        {children}
      </h2>
      {aside && <div className="shrink-0 text-[13px] text-text-muted">{aside}</div>}
    </div>
  );
}
