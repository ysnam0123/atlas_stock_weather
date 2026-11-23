import { cleanName, parseKisMaster, parseNasdaqTrader, yahooTicker } from './symbols.adapter.js';

// 2026-11-23에 받은 실제 파일의 일부
const nasdaq = `Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N
QQQ|Invesco QQQ Trust, Series 1|G|N|N|100|Y|N
ZZZT|Test Issue Common Stock|S|Y|N|100|N|N
ACAHW|Acri Capital Acquisition Corp - Warrants|S|N|N|100|N|N
File Creation Time: 1123202608:30|||||||`;

const other = `ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
A|Agilent Technologies, Inc. Common Stock|N|A|N|100|N|A
BRK.B|Berkshire Hathaway Inc. Class B Common Stock|N|BRK.B|N|100|N|BRK=B
SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY
ABR$D|Arbor Realty Trust Preferred Series D|N|ABRpD|N|100|N|ABR-D
File Creation Time: 1123202608:30|||||||`;

describe('parseNasdaqTrader', () => {
  it('나스닥 상장: 테스트 종목·워런트를 빼고 ETF를 구분한다', () => {
    expect(parseNasdaqTrader(nasdaq, 'nasdaq')).toEqual([
      { symbol: 'AAPL', exchange: 'NASDAQ', nameEn: 'Apple Inc.', type: 'stock' },
      { symbol: 'QQQ', exchange: 'NASDAQ', nameEn: 'Invesco QQQ Trust, Series 1', type: 'etf' },
    ]);
  });

  it('기타 거래소: 거래소 코드를 이름으로, 우선주($)는 뺀다', () => {
    expect(parseNasdaqTrader(other, 'other')).toEqual([
      { symbol: 'A', exchange: 'NYSE', nameEn: 'Agilent Technologies, Inc.', type: 'stock' },
      { symbol: 'BRK.B', exchange: 'NYSE', nameEn: 'Berkshire Hathaway Inc.', type: 'stock' },
      { symbol: 'SPY', exchange: 'NYSE Arca', nameEn: 'SPDR S&P 500 ETF Trust', type: 'etf' },
    ]);
  });
});

describe('parseKisMaster', () => {
  it('한글명이 있는 종목만 고른다', () => {
    const text = [
      'US\t22\tNAS\t나스닥\tNVDA\tNASNVDA\t엔비디아\tNVIDIA CORP\t2\tUSD',
      'US\t22\tNAS\t나스닥\tQQQ\tNASQQQ\tINVESCO QQQ TRUST\tINVESCO QQQ TRUST UNIT SER 1\t3\tUSD',
    ].join('\n');
    expect([...parseKisMaster(text)]).toEqual([['NVDA', '엔비디아']]);
  });
});

it('cleanName·yahooTicker', () => {
  expect(cleanName('Alcoa Corporation Common Stock ')).toBe('Alcoa Corporation');
  expect(yahooTicker('BRK.B')).toBe('BRK-B');
});
