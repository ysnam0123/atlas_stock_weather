import { congressFlows, memberInfo, parseDistrict } from './congress-members.js';

describe('congressFlows', () => {
  const t = (symbol: string, member: string, type: string) => ({ symbol, member, type });

  it('서로 다른 의원 3명 이상이 한쪽이고 반대쪽이 1명 이하면 쏠림', () => {
    const flows = congressFlows([t('NVDA', 'A', 'P'), t('NVDA', 'B', 'P'), t('NVDA', 'C', 'P'), t('NVDA', 'D', 'S (partial)')]);
    expect(flows).toEqual([{ symbol: 'NVDA', buyers: 3, sellers: 1, side: 'buy' }]);
  });

  it('한 의원의 여러 거래는 한 명, 양쪽이 섞이면 쏠림 아님', () => {
    expect(congressFlows([t('AAPL', 'A', 'P'), t('AAPL', 'A', 'P'), t('AAPL', 'A', 'P')])).toEqual([]);
    expect(congressFlows([t('X', 'A', 'P'), t('X', 'B', 'P'), t('X', 'C', 'P'), t('X', 'D', 'S'), t('X', 'E', 'S')])).toEqual([]);
  });
});

describe('memberInfo', () => {
  it('지역구 코드와 한국어 표시', () => {
    expect(parseDistrict('OH06')).toEqual({ state: 'OH', district: 6 });
    expect(parseDistrict(null)).toBeNull();
    const info = memberInfo({ bioguide: 'x', name: 'x', party: 'Democrat', state: 'AK', district: 0, committees: ['HSAS', 'HSXX'] });
    expect(info).toEqual({ party: '민주당', seat: '알래스카 전역', committees: ['군사'] });
  });
});
