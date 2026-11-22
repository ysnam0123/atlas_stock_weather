import { latestDueSlot, nextSlot, type Slot } from './slots.js';

// 화~토 13:30, 18:00 KST
const slot: Slot = { days: [2, 3, 4, 5, 6], times: ['13:30', '18:00'] };
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('latestDueSlot', () => {
  it('오늘 지난 시각 중 가장 최근', () => {
    // 2026-11-24 화요일
    expect(latestDueSlot(slot, kst('2026-11-24T15:00:00'))).toEqual(kst('2026-11-24T13:30:00'));
    expect(latestDueSlot(slot, kst('2026-11-24T19:00:00'))).toEqual(kst('2026-11-24T18:00:00'));
  });

  it('오늘 첫 시각 전이면 전날 마지막 시각', () => {
    // 수요일 오전 → 화요일 18:00
    expect(latestDueSlot(slot, kst('2026-11-25T09:00:00'))).toEqual(kst('2026-11-24T18:00:00'));
  });

  it('일·월은 실행하지 않으므로 토요일 18:00', () => {
    // 2026-11-23 월요일
    expect(latestDueSlot(slot, kst('2026-11-23T20:00:00'))).toEqual(kst('2026-11-21T18:00:00'));
  });

  it('정확히 그 시각이면 포함', () => {
    expect(latestDueSlot(slot, kst('2026-11-24T13:30:00'))).toEqual(kst('2026-11-24T13:30:00'));
  });
});

describe('nextSlot', () => {
  it('오늘 남은 시각 중 가장 이른 것', () => {
    expect(nextSlot(slot, kst('2026-11-24T09:00:00'))).toEqual(kst('2026-11-24T13:30:00'));
    expect(nextSlot(slot, kst('2026-11-24T13:30:00'))).toEqual(kst('2026-11-24T18:00:00'));
  });

  it('토요일 밤이면 화요일 13:30', () => {
    expect(nextSlot(slot, kst('2026-11-21T19:00:00'))).toEqual(kst('2026-11-24T13:30:00'));
  });
});
