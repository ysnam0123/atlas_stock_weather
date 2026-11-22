import { useLayoutEffect, useRef, useState } from "react";

/** 요소의 실제 폭(px). 차트를 화면 폭에 맞춰 그릴 때 쓴다 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 첫 그림 전에 바로 한 번 재고, 이후 크기가 바뀔 때마다 다시 잰다
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
