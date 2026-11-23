import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { unzipSync } from 'fflate';
import {
  KIS_MASTER_URLS,
  NASDAQ_LISTED_URL,
  OTHER_LISTED_URL,
  parseKisMaster,
  parseNasdaqTrader,
  type SymbolRow,
} from '../adapters/symbols.adapter.js';
import { repoRoot } from '../common/paths.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SYMBOLS_WEEKLY = 'symbols_weekly';

const CHUNK = 2000;

async function download(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 미국 종목 목록(Nasdaq Trader)에 한투 마스터 한글명을 붙여 symbols에 넣는다. 키 불필요.
 * 한투 마스터는 실패해도 영문 목록만으로 계속한다 (한글명만 비게 된다).
 * 사용자 별칭(aliases)은 덮어쓰지 않는다.
 */
@Injectable()
export class SymbolsWeeklyJob {
  private readonly logger = new Logger(SymbolsWeeklyJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async run() {
    const run = await this.prisma.run.create({ data: { kind: SYMBOLS_WEEKLY, market: 'us' } });
    const dir = join(repoRoot(), 'reports', run.id);
    await mkdir(dir, { recursive: true });

    try {
      const [nasdaq, other] = await Promise.all([download(NASDAQ_LISTED_URL), download(OTHER_LISTED_URL)]);
      await writeFile(join(dir, 'nasdaqlisted.txt'), nasdaq);
      await writeFile(join(dir, 'otherlisted.txt'), other);

      const rows = new Map<string, SymbolRow>();
      for (const r of [...parseNasdaqTrader(nasdaq.toString('utf8'), 'nasdaq'), ...parseNasdaqTrader(other.toString('utf8'), 'other')]) {
        if (!rows.has(r.symbol)) rows.set(r.symbol, r);
      }

      const nameKo = new Map<string, string>();
      let kisError: string | null = null;
      try {
        const decoder = new TextDecoder('euc-kr');
        for (const url of KIS_MASTER_URLS) {
          const zip = unzipSync(new Uint8Array(await download(url)));
          for (const [file, data] of Object.entries(zip)) {
            await writeFile(join(dir, file), data);
            for (const [symbol, name] of parseKisMaster(decoder.decode(data))) nameKo.set(symbol, name);
          }
        }
      } catch (err) {
        kisError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`한투 마스터 실패, 영문 목록만 갱신: ${kisError}`);
      }

      const all = [...rows.values()];
      for (let i = 0; i < all.length; i += CHUNK) {
        const chunk = all.slice(i, i + CHUNK);
        await this.prisma.$executeRaw`
          INSERT INTO symbols (symbol, market, exchange, "nameEn", "nameKo", type, aliases, "updatedAt")
          SELECT s, 'us'::"Market", e, n, k, t::"SymbolType", '{}', now()
          FROM unnest(
            ${chunk.map((r) => r.symbol)}::text[],
            ${chunk.map((r) => r.exchange)}::text[],
            ${chunk.map((r) => r.nameEn)}::text[],
            ${chunk.map((r) => nameKo.get(r.symbol) ?? null)}::text[],
            ${chunk.map((r) => r.type)}::text[]
          ) AS x(s, e, n, k, t)
          ON CONFLICT (symbol) DO UPDATE SET
            exchange = EXCLUDED.exchange,
            "nameEn" = EXCLUDED."nameEn",
            "nameKo" = COALESCE(EXCLUDED."nameKo", symbols."nameKo"),
            type = EXCLUDED.type,
            "updatedAt" = now()`;
      }

      const summary = { symbols: all.length, withKoreanName: all.filter((r) => nameKo.has(r.symbol)).length, kisError };
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: kisError ? 'partial' : 'success', finishedAt: new Date(), error: kisError },
      });
      this.logger.log(`끝 ${run.id} ${JSON.stringify(summary)}`);
      return { runId: run.id, ...summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.run.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), error: message },
      });
      this.logger.error(`실패 ${run.id}: ${message}`);
      return { runId: run.id, status: 'failed', error: message };
    }
  }
}
