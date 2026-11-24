import { latestDueSlot, nextSlot, type Slot } from './slots.js';
import { isUsTradingDay, lastNightHoliday, usSessionBefore } from './us-market-calendar.js';

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

describe('휴장일 건너뛰기', () => {
  const market: Slot = { ...slot, skip: (d) => !isUsTradingDay(usSessionBefore(d)) };

  it('추수감사절(11/26 목) 다음 날 한국 금요일은 건너뛴다', () => {
    // 금요일 오후 → 목요일 18:00 (어젯밤=수요일 장)
    expect(latestDueSlot(market, kst('2026-11-27T20:00:00'))).toEqual(kst('2026-11-26T18:00:00'));
    expect(nextSlot(market, kst('2026-11-26T19:00:00'))).toEqual(kst('2026-11-28T13:30:00'));
  });

  it('어젯밤 휴장 여부', () => {
    expect(lastNightHoliday(kst('2026-11-27T09:00:00'))).toEqual({ date: '2026-11-26', name: '추수감사절' });
    expect(lastNightHoliday(kst('2026-11-25T09:00:00'))).toBeNull();
    // 월요일 아침의 어젯밤은 일요일이라 휴장이 아니라 주말
    expect(lastNightHoliday(kst('2026-11-30T09:00:00'))).toBeNull();
  });
});
