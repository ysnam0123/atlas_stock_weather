import { findForbidden } from './claude.service.js';

describe('findForbidden', () => {
  it('중첩된 문자열까지 예측·지시 표현을 찾는다', () => {
    expect(
      findForbidden({
        headline: '비 오는 날이에요',
        summary: ['곧 반등할 것으로 보여요', '지금 사세요'],
        signals: [{ comment: '상승 확률이 높아요' }],
      }).sort(),
    ).toEqual(['반등할 것', '사세요', '확률'].sort());
  });

  it('상태를 말하는 문장은 통과', () => {
    expect(findForbidden(['오르는 종목이 100개 중 7개예요', '손절가까지 4% 남았어요'])).toEqual([]);
  });
});
