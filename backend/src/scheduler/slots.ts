// 한국 시간 기준 실행 시각 계산. KST는 서머타임이 없어 UTC+9 고정이다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Slot {
  /** 0=일 … 6=토 (KST 요일) */
  days: number[];
  /** "HH:MM" KST */
  times: string[];
  /** 이 한국 날짜(YYYY-MM-DD)는 건너뛴다. 예: 어젯밤 미국장이 휴장이면 시장 수집을 쉬기 */
  skip?: (kstDate: string) => boolean;
}

/** 그날(KST 자정 기준)의 실행 시각들. 반환값은 KST 벽시계 기준 ms */
function slotTimesOn(slot: Slot, dayStart: number): number[] {
  const weekday = new Date(dayStart).getUTCDay();
  if (!slot.days.includes(weekday)) return [];
  if (slot.skip?.(new Date(dayStart).toISOString().slice(0, 10))) return [];
  return slot.times.map((t) => {
    const [h, m] = t.split(':').map(Number);
    return dayStart + (h * 60 + m) * 60 * 1000;
  });
}

/**
 * now 시점에 이미 지났어야 할 가장 최근 실행 시각.
 * 맥이 잠들어 크론을 놓쳐도, 깨어난 뒤 이 시각 이후 성공한 실행이 없으면 보충한다.
 */
export function latestDueSlot(slot: Slot, now: Date = new Date()): Date | null {
  const kstNow = now.getTime() + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS;

  for (let back = 0; back < 10; back++) {
    const due = slotTimesOn(slot, kstMidnight - back * DAY_MS)
      .filter((t) => t <= kstNow)
      .sort((a, b) => b - a)[0];
    if (due !== undefined) return new Date(due - KST_OFFSET_MS);
  }
  return null;
}

/** now 이후 처음 오는 실행 시각. 홈 화면의 "다음 브리핑" 표시에 쓴다 */
export function nextSlot(slot: Slot, now: Date = new Date()): Date | null {
  const kstNow = now.getTime() + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS;

  for (let ahead = 0; ahead < 10; ahead++) {
    const next = slotTimesOn(slot, kstMidnight + ahead * DAY_MS)
      .filter((t) => t > kstNow)
      .sort((a, b) => a - b)[0];
    if (next !== undefined) return new Date(next - KST_OFFSET_MS);
  }
  return null;
}
