// 현직 하원 의원 정보: 정당, 지역구, 상임위원회.
// 출처: unitedstates/congress-legislators (공개 데이터, 키 불필요). 의원 거래 신고 문서의 지역구 코드(NJ07)로 잇는다.

import type { PrismaService } from '../prisma/prisma.service.js';

const BASE ='https://unitedstates.github.io/congress-legislators';

export interface MemberRow {
  bioguide: string;
  name: string;
  party: string;
  state: string;
  district: number;
  committees: string[];
}

interface Legislator {
  id: { bioguide: string };
  name: { official_full?: string; first: string; last: string };
  terms: { type: string; state: string; district?: number; party: string }[];
}

/** 세 파일을 받아 하원 의원만 정리한다. 실패하면 던진다 (호출하는 쪽이 그 단계만 실패 처리) */
export async function fetchHouseMembers(): Promise<MemberRow[]> {
  const get = async <T>(file: string): Promise<T> => {
    const res = await fetch(`${BASE}/${file}.json`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  const [legislators, membership] = await Promise.all([
    get<Legislator[]>('legislators-current'),
    get<Record<string, { bioguide: string }[]>>('committee-membership-current'),
  ]);
  const committeesOf = new Map<string, string[]>();
  for (const [id, members] of Object.entries(membership)) {
    // 상임위원회만 (HSAS). 소위원회(HSAS28)는 뺀다
    if (!/^HS[A-Z]{2}$/.test(id)) continue;
    for (const m of members) committeesOf.set(m.bioguide, [...(committeesOf.get(m.bioguide) ?? []), id]);
  }
  return legislators
    .map((l) => ({ l, term: l.terms.at(-1)! }))
    .filter(({ term }) => term.type === 'rep')
    .map(({ l, term }) => ({
      bioguide: l.id.bioguide,
      name: l.name.official_full ?? `${l.name.first} ${l.name.last}`,
      party: term.party,
      state: term.state,
      district: term.district ?? 0,
      committees: committeesOf.get(l.id.bioguide) ?? [],
    }));
}

/** 신고 문서의 지역구 "NJ07" → { state: 'NJ', district: 7 } */
export function parseDistrict(code: string | null): { state: string; district: number } | null {
  const m = code?.match(/^([A-Z]{2})(\d{1,2})$/);
  return m ? { state: m[1], district: Number(m[2]) } : null;
}

const PARTY_KO: Record<string, string> = { Republican: '공화당', Democrat: '민주당', Independent: '무소속' };

const STATE_KO: Record<string, string> = {
  AL: '앨라배마', AK: '알래스카', AZ: '애리조나', AR: '아칸소', CA: '캘리포니아', CO: '콜로라도', CT: '코네티컷',
  DE: '델라웨어', FL: '플로리다', GA: '조지아', HI: '하와이', ID: '아이다호', IL: '일리노이', IN: '인디애나',
  IA: '아이오와', KS: '캔자스', KY: '켄터키', LA: '루이지애나', ME: '메인', MD: '메릴랜드', MA: '매사추세츠',
  MI: '미시간', MN: '미네소타', MS: '미시시피', MO: '미주리', MT: '몬태나', NE: '네브래스카', NV: '네바다',
  NH: '뉴햄프셔', NJ: '뉴저지', NM: '뉴멕시코', NY: '뉴욕', NC: '노스캐롤라이나', ND: '노스다코타', OH: '오하이오',
  OK: '오클라호마', OR: '오리건', PA: '펜실베이니아', RI: '로드아일랜드', SC: '사우스캐롤라이나', SD: '사우스다코타',
  TN: '테네시', TX: '텍사스', UT: '유타', VT: '버몬트', VA: '버지니아', WA: '워싱턴', WV: '웨스트버지니아',
  WI: '위스콘신', WY: '와이오밍', DC: '워싱턴 D.C.', PR: '푸에르토리코', GU: '괌', VI: '미국령 버진아일랜드',
  AS: '미국령 사모아', MP: '북마리아나 제도',
};

/** 하원 상임위원회. 없는 id는 화면에 내보내지 않는다 */
const COMMITTEE_KO: Record<string, string> = {
  HSAG: '농업', HSAP: '세출', HSAS: '군사', HSBA: '금융서비스', HSBU: '예산', HSED: '교육·노동',
  HSIF: '에너지·상업', HSFA: '외교', HSHM: '국토안보', HSHA: '하원 운영', HSJU: '법사', HSII: '천연자원',
  HSGO: '감독·정부개혁', HSRU: '규칙', HSSY: '과학·우주·기술', HSSM: '중소기업', HSPW: '교통·인프라',
  HSVR: '보훈', HSWM: '세입', HSIG: '정보', HSSO: '윤리', HSZS: '미중 전략경쟁 특별',
};

/** 신고 문서 지역구 코드들 → 화면용 의원 정보. 의원 정보를 아직 못 받았거나 전직이면 빠진다 */
export async function lookupMembers(prisma: PrismaService, codes: (string | null)[]) {
  const seats = [...new Set(codes)].map((c) => ({ code: c, seat: parseDistrict(c) })).filter((x) => x.seat);
  if (!seats.length) return new Map<string, ReturnType<typeof memberInfo>>();
  const rows = await prisma.congressMember.findMany({ where: { OR: seats.map((x) => x.seat!) } });
  const out = new Map<string, ReturnType<typeof memberInfo>>();
  for (const { code, seat } of seats) {
    const m = rows.find((r) => r.state === seat!.state && r.district === seat!.district) ?? null;
    if (m) out.set(code!, memberInfo(m));
  }
  return out;
}

/** 같은 방향으로 몰렸다고 보는 서로 다른 의원 수. 반대쪽은 이 수 미만이어야 한다 */
export const FLOW_MIN_MEMBERS = 3;

/**
 * 종목별로 서로 다른 의원이 몇 명 샀고 팔았는지 센다. 한쪽이 3명 이상이고 반대쪽이 1명 이하면 "쏠림".
 * 한 의원이 여러 번 거래해도 한 명으로 센다 (거래 수가 아니라 사람 수).
 */
export function congressFlows(trades: { symbol: string; member: string; type: string }[]) {
  const by = new Map<string, { buyers: Set<string>; sellers: Set<string> }>();
  for (const t of trades) {
    const g = by.get(t.symbol) ?? { buyers: new Set<string>(), sellers: new Set<string>() };
    if (t.type === 'P') g.buyers.add(t.member);
    else if (t.type.startsWith('S')) g.sellers.add(t.member);
    by.set(t.symbol, g);
  }
  return [...by]
    .map(([symbol, g]) => ({ symbol, buyers: g.buyers.size, sellers: g.sellers.size }))
    .filter((f) => Math.max(f.buyers, f.sellers) >= FLOW_MIN_MEMBERS && Math.min(f.buyers, f.sellers) <= 1)
    .map((f) => ({ ...f, side: f.buyers > f.sellers ? ('buy' as const) : ('sell' as const) }));
}

/** 화면용: "공화당", "오하이오 6구", ["에너지·상업", "외교"] */
export function memberInfo(m: MemberRow | null) {
  if (!m) return null;
  const state = STATE_KO[m.state] ?? m.state;
  return {
    party: PARTY_KO[m.party] ?? m.party,
    seat: m.district === 0 ? `${state} 전역` : `${state} ${m.district}구`,
    committees: m.committees.map((id) => COMMITTEE_KO[id]).filter((x): x is string => !!x),
  };
}
