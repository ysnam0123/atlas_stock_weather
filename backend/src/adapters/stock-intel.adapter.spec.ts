import { adaptFacts, adaptNews, adaptPtr, coreName, isRelevant } from './stock-intel.adapter.js';

describe('뉴스 관련성', () => {
  it('회사 이름의 법인 꼬리말을 뗀다', () => {
    expect(coreName('NVIDIA Corporation')).toBe('nvidia');
    expect(coreName('Apple Inc.')).toBe('apple');
  });

  it('제목에 티커나 회사 이름이 있어야 남긴다', () => {
    expect(isRelevant('Warning for Nvidia Investors: UBS Says', 'NVDA', 'NVIDIA Corporation')).toBe(true);
    expect(isRelevant('NVDA slides after earnings', 'NVDA', 'NVIDIA Corporation')).toBe(true);
    expect(isRelevant("Is The Market Underpricing McDonald's Stock?", 'NVDA', 'NVIDIA Corporation')).toBe(false);
    // 티커가 다른 단어 안에 들어 있으면 아니다
    expect(isRelevant('AAPLX fund update', 'AAPL', 'Apple Inc.')).toBe(false);
  });

  it('2026-11-23 실제 피드 일부: 관련 없는 기사는 빠지고 공시는 남는다', () => {
    const json = {
      items: [
        { id: 'rss:1', kind: 'headline', ticker: 'NVDA', title: 'Intel Stock Could Have More Upside', link: 'u1', time: '2026-11-23T13:47:17+00:00', tags: ['earnings'] },
        { id: 'rss:2', kind: 'headline', ticker: 'NVDA', title: 'Warning for Nvidia Investors', link: 'u2', time: '2026-11-23T10:00:00+00:00' },
        { id: 'sec:3', kind: '8-K', ticker: 'NVDA', title: '8-K: Results of Operations', link: 'u3', time: '2026-11-20T21:05:00+00:00' },
      ],
    };
    const rows = adaptNews(json, new Map([['NVDA', 'NVIDIA Corporation']]));
    expect(rows.map((r) => r.id)).toEqual(['rss:2', 'sec:3']);
    expect(rows[1]).toMatchObject({ kind: 'sec', source: 'SEC' });
  });
});

describe('adaptFacts', () => {
  it('분기 줄을 꺼낸다 (실제 NVDA 출력 일부)', () => {
    const rows = adaptFacts([
      {
        ticker: 'NVDA',
        result: {
          rows: [
            { end: '2026-07-26', fiscal: 'Q2 2027', derived: false, revenue: 96221000000, eps_diluted: 2.46, operating_margin: 66.2, revenue_yoy: 105.9, eps_yoy: 127.8, filed: '2026-08-26', form: '10-Q' },
          ],
        },
      },
      { ticker: 'NASA', error: 'no SEC CIK' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'NVDA', fiscal: 'Q2 2027', revenueYoy: 105.9, operatingMargin: 66.2, grossMargin: null });
  });
});

describe('adaptPtr', () => {
  it('의원 거래 줄 (실제 PTR 20036844 일부)', () => {
    const rows = adaptPtr({
      rows: [
        { owner_name: 'self', type: 'S (partial)', type_name: 'partial sale', date: '2026-10-27', amount: '$15,001 - $50,000', ticker: 'MSFT', asset: 'Microsoft Corporation - Common Stock', amount_low: 15001, amount_high: 50000 },
      ],
    });
    expect(rows[0]).toMatchObject({ ticker: 'MSFT', typeName: 'partial sale', amountLow: 15001 });
    expect(rows[0].tradeDate?.toISOString().slice(0, 10)).toBe('2026-10-27');
  });
});
