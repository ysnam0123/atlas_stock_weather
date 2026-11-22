// 한국 시간 기준 실행 시각 계산. KST는 서머타임이 없어 UTC+9 고정이다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Slot {
  /** 0=일 … 6=토 (KST 요일) */
  days: number[];
  /** "HH:MM" KST */
  times: string[];
}

/**
 * now 시점에 이미 지났어야 할 가장 최근 실행 시각.
 * 맥이 잠들어 크론을 놓쳐도, 깨어난 뒤 이 시각 이후 성공한 실행이 없으면 보충한다.
 */
export function latestDueSlot(slot: Slot, now: Date = new Date()): Date | null {
  const kstNow = now.getTime() + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS;

  for (let back = 0; back < 8; back++) {
    const dayStart = kstMidnight - back * DAY_MS;
    const weekday = new Date(dayStart).getUTCDay();
    if (!slot.days.includes(weekday)) continue;

    const due = slot.times
      .map((t) => {
        const [h, m] = t.split(':').map(Number);
        return dayStart + (h * 60 + m) * 60 * 1000;
      })
      .filter((t) => t <= kstNow)
      .sort((a, b) => b - a)[0];
    if (due !== undefined) return new Date(due - KST_OFFSET_MS);
  }
  return null;
}
