"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 창.
 * 브라우저 기본 <dialog>를 써서 Esc 닫기, 포커스 가두기, 뒤 배경 어둡게를 그대로 얻는다.
 * 움직임은 globals.css의 .sheet (움직임 줄이기 설정이면 페이드만).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // 바깥(어두운 배경)을 누르면 닫는다
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="sheet"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 lg:px-6 lg:pt-6">
          <div className="min-w-0 text-[18px] font-semibold tracking-[-0.01em]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-surface text-text-secondary active:bg-border"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">{children}</div>
      </div>
    </dialog>
  );
}
