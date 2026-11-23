import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const EARNINGS_CALENDAR = 'earnings_calendar';

/** 오늘 기준 앞뒤로 받는 기간 (FMP 실적 일정은 한 번에 3개월까지) */
const BACK_DAYS = 7;
const AHEAD_DAYS = 60;
/** 내 종목은 다음 실적까지 미리 알 수 있게 더 멀리 본다 (종목별 요청은 기간 제한이 없다) */
const TRACKED_AHEAD_DAYS = 120;
const DAY_MS = 86_400_000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

interface FmpEarning {
  symbol?: string;
  date?: string;
  epsEstimated?: number | null;
  revenueEstimated?: number | null;
}

/** FMP 응답 → 저장할 줄. 날짜·티커가 이상한 줄은 버린다 */
export function adaptEarnings(json: unknown) {
  if (!Array.isArray(json)) return [];
  return (json as FmpEarning[]).flatMap((e) => {
    if (!e.symbol || !e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return [];
    return [
      {
        symbol: e.symbol,
        date: e.date,
        epsEstimated: typeof e.epsEstimated === 'number' ? e.epsEstimated : null,
        revenueEstimated: typeof e.revenueEstimated === 'number' ? e.revenueEstimated : null,
      },
    ];
  });
}

/**
 * 실적 발표 일정. 키가 없으면 건너뛴다.
 * 1) 전체 일정 /stable/earnings-calendar (요청 1회). 무료 플랜은 일부 종목만 준다.
 * 2) 내 보유·관심·AI 보유 종목은 /stable/earnings?symbol= 로 하나씩 (종목 수만큼). 무료 플랜이 막는 종목은 건너뛴다.
 * 받은 기간은 통째로 바꾼다 (발표일이 바뀌는 일이 잦다).
 */
@Injectable()
export class EarningsCalendarJob {
  private readonly logger = new Logger(EarningsCalendarJob.name);

  constructor(private readonly prisma: PrismaService) {}

  private async trackedSymbols() {
    const [h, w, a] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
      this.prisma.aiPosition.findMany({ where: { status: 'open' }, select: { symbol: true } }),
    ]);
    return [...new Set([...h, ...w, ...a].map((x) => x.symbol))];
  }

  async run() {
    const run = await this.prisma.run.create({ data: { kind: EARNINGS_CALENDAR, market: 'us' } });
    const key = process.env.FMP_API_KEY;
    const finish = (status: 'success' | 'failed', error: string | null) =>
      this.prisma.run.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), error } });

    if (!key) {
      await finish('failed', 'FMP_API_KEY가 없어 건너뜀');
      return { runId: run.id, status: 'failed' };
    }
    try {
      const from = new Date(Date.now() - BACK_DAYS * DAY_MS);
      const to = new Date(Date.now() + AHEAD_DAYS * DAY_MS);
      const url = `https://financialmodelingprep.com/stable/earnings-calendar?from=${ymd(from)}&to=${ymd(to)}&apikey=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = adaptEarnings(await res.json());
      const day = (s: string) => new Date(`${s}T00:00:00Z`);

      // 2) 추적 중인 종목은 하나씩
      const tracked = await this.trackedSymbols();
      let requests = 1;
      let blocked = 0;
      const today = ymd(new Date());
      for (const symbol of tracked) {
        if (rows.some((r) => r.symbol === symbol && r.date >= today)) continue;
        requests++;
        const r = await fetch(
          `https://financialmodelingprep.com/stable/earnings?symbol=${encodeURIComponent(symbol)}&limit=4&apikey=${key}`,
          { signal: AbortSignal.timeout(20_000) },
        ).catch(() => null);
        if (!r?.ok) {
          blocked++;
          continue;
        }
        const until = ymd(new Date(Date.now() + TRACKED_AHEAD_DAYS * DAY_MS));
        const next = adaptEarnings(await r.json().catch(() => null)).filter((e) => e.date >= today && e.date <= until);
        rows.push(...next);
      }

      await this.prisma.$transaction([
        this.prisma.calendarEvent.deleteMany({ where: { type: 'earnings', date: { gte: day(ymd(from)) } } }),
        this.prisma.calendarEvent.createMany({
          data: rows.map((r) => ({ type: 'earnings', ...r, date: day(r.date) })),
          skipDuplicates: true,
        }),
      ]);
      const note = `실적 일정 ${rows.length}건, FMP 요청 ${requests}회${blocked ? `, 무료 플랜이 막은 종목 ${blocked}개` : ''}`;
      await finish('success', note);
      this.logger.log(`끝 ${run.id} ${note}`);
      return { runId: run.id, status: 'success', events: rows.length, requests, blocked };
    } catch (err) {
      // 에러 메시지에 키가 섞이지 않게 URL은 남기지 않는다
      const message = err instanceof Error ? err.message : String(err);
      await finish('failed', message);
      this.logger.warn(`실패 ${run.id}: ${message}`);
      return { runId: run.id, status: 'failed', error: message };
    }
  }
}
