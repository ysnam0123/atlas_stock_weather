"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "./glossary";

/** 점선 밑줄 용어. 누르면 바로 아래에 뜻이 뜬다. 바깥을 누르거나 Esc로 닫는다 */
export function Term({ id, children }: { id: GlossaryKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const entry = GLOSSARY[id];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help underline decoration-text-muted decoration-dotted underline-offset-4"
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-2 block w-72 max-w-[calc(100vw-48px)] rounded-xl bg-text p-3 text-left text-[13px] leading-[1.55] font-normal text-white shadow-lg"
        >
          <span className="mb-1 block font-semibold">{entry.term}</span>
          {entry.short}
        </span>
      )}
    </span>
  );
}
