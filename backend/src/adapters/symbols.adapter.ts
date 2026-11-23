// 종목 목록 원본(Nasdaq Trader, 한투 해외주식 마스터) → symbols 테이블 값.
// 형식이 바뀌면 이 파일만 고친다.

export const NASDAQ_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
export const OTHER_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
/** 한투 해외주식 마스터 (나스닥·뉴욕·아멕스). zip 안에 cp949 탭 구분 .COD 파일 하나 */
export const KIS_MASTER_URLS = ['nasmst', 'nysmst', 'amsmst'].map(
  (m) => `https://new.real.download.dws.co.kr/common/master/${m}.cod.zip`,
);

export interface SymbolRow {
  symbol: string;
  exchange: string;
  nameEn: string;
  type: 'stock' | 'etf';
}

const OTHER_EXCHANGE: Record<string, string> = {
  N: 'NYSE',
  A: 'NYSE American',
  P: 'NYSE Arca',
  Z: 'Cboe BZX',
  V: 'IEX',
};

/** 워런트·유닛·권리·우선주처럼 스윙 대상이 아닌 증권은 뺀다 */
const SKIP_NAME = /\b(warrants?|units?|rights?|preferred|depositary shares? representing)\b/i;

/** "Agilent Technologies, Inc. Common Stock" → "Agilent Technologies, Inc." */
export function cleanName(name: string): string {
  return name
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+(Class [A-Z] )?(Common Stock|Ordinary Shares|Common Shares|Common Units|Shares of Beneficial Interest).*$/i, '')
    .trim();
}

/** nasdaqlisted.txt / otherlisted.txt (파이프 구분, 마지막 줄은 "File Creation Time") */
export function parseNasdaqTrader(text: string, kind: 'nasdaq' | 'other'): SymbolRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split('|') ?? [];
  const col = (name: string) => header.indexOf(name);
  const iSymbol = col(kind === 'nasdaq' ? 'Symbol' : 'ACT Symbol');
  const iName = col('Security Name');
  const iTest = col('Test Issue');
  const iEtf = col('ETF');
  const iExchange = col('Exchange');

  return lines.flatMap((line) => {
    const f = line.split('|');
    const symbol = f[iSymbol]?.trim();
    const name = f[iName]?.trim();
    if (!symbol || !name || line.startsWith('File Creation Time')) return [];
    if (f[iTest] === 'Y' || symbol.includes('$') || SKIP_NAME.test(name)) return [];
    const exchange = kind === 'nasdaq' ? 'NASDAQ' : (OTHER_EXCHANGE[f[iExchange]] ?? f[iExchange]);
    return [{ symbol, exchange, nameEn: cleanName(name) || name, type: f[iEtf] === 'Y' ? 'etf' : 'stock' }];
  });
}

/**
 * 한투 마스터 .COD (cp949를 풀어 둔 문자열). 열: 국가, 거래소ID, 거래소코드, 거래소명, 심볼, 실시간심볼, 한글명, 영문명, 유형…
 * 한글명이 실제 한글일 때만 돌려준다 (ETF는 영문이 그대로 들어 있는 경우가 많다).
 */
export function parseKisMaster(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const f = line.split('\t');
    const symbol = f[4]?.trim();
    const nameKo = f[6]?.trim();
    if (symbol && nameKo && /[가-힣]/.test(nameKo)) names.set(symbol, nameKo);
  }
  return names;
}

/** 야후 티커: BRK.B → BRK-B */
export const yahooTicker = (symbol: string) => symbol.replace(/\./g, '-');
