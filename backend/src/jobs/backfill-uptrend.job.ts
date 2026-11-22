import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { repoRoot } from '../common/paths.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  adaptUptrendTimeseries,
  UPTREND_TIMESERIES_URL,
} from '../adapters/uptrend-history.adapter.js';

export const BACKFILL_UPTREND = 'backfill_uptrend';

/**
 * 과거 상승추세 비율(2023-08~)과 섹터 순위(2024-07~)를 채운다.
 * 이미 있는 날은 건드리지 않으므로 몇 번을 돌려도 안전하다. 워커가 꺼져 있던 날을 메우는 데도 쓴다.
 * 시장 점수(composite)는 스크립트가 과거 날짜 계산을 지원하지 않아 채우지 않는다.
 */
@Injectable()
export class BackfillUptrendJob {
  private readonly logger = new Logger(BackfillUptrendJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async run() {
    const run = await this.prisma.run.create({ data: { kind: BACKFILL_UPTREND, market: 'us' } });
    const started = Date.now();

    try {
      const res = await fetch(UPTREND_TIMESERIES_URL, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`CSV 다운로드 실패: HTTP ${res.status}`);
      const csv = await res.text();

      // 원본은 파일로 남기고, DB에는 요약만 둔다 (3만 줄이 넘는다)
      const dir = join(repoRoot(), 'reports', run.id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'uptrend_ratio_timeseries.csv'), csv);

      const history = adaptUptrendTimeseries(csv);
      const day = (d: string) => new Date(`${d}T00:00:00Z`);

      const market = await this.prisma.marketSnapshot.createMany({
        data: history.market.map((m) => ({
          market: 'us' as const,
          tradeDate: day(m.date),
          runId: run.id,
          uptrendRatio: m.uptrendRatio,
        })),
        skipDuplicates: true,
      });
      const sectors = await this.prisma.sectorSnapshot.createMany({
        data: history.sectors.flatMap((s) =>
          s.rows.map((r) => ({ market: 'us' as const, tradeDate: day(s.date), runId: run.id, ...r })),
        ),
        skipDuplicates: true,
      });

      const summary = {
        endpoint: UPTREND_TIMESERIES_URL,
        retrievedAt: new Date().toISOString(),
        dateRange: history.dateRange,
        marketDays: history.market.length,
        sectorDays: history.sectors.length,
        inserted: { marketSnapshots: market.count, sectorSnapshots: sectors.count },
      };
      await this.prisma.skillOutput.create({
        data: {
          runId: run.id,
          skillId: 'uptrend-timeseries-csv',
          status: 'success',
          rawJson: summary,
          durationMs: Date.now() - started,
        },
      });
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: 'success', finishedAt: new Date() },
      });
      this.logger.log(
        `끝 ${run.id}: 시장 ${market.count}일, 섹터 ${sectors.count}줄 새로 넣음 (${history.dateRange?.join(' ~ ')})`,
      );
      return { runId: run.id, status: 'success', ...summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.skillOutput.create({
        data: {
          runId: run.id,
          skillId: 'uptrend-timeseries-csv',
          status: 'failed',
          error: message,
          durationMs: Date.now() - started,
        },
      });
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), error: message },
      });
      this.logger.error(`실패 ${run.id}: ${message}`);
      return { runId: run.id, status: 'failed', error: message };
    }
  }
}
