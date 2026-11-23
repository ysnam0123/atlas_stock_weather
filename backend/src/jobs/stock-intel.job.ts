import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { adaptFacts, adaptNews, adaptPtr } from '../adapters/stock-intel.adapter.js';
import { ClaudeService } from '../claude/claude.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkillRunnerService } from '../skills/skill-runner.service.js';

export const STOCK_INTEL = 'stock_intel';

const DAY_MS = 86_400_000;
/** 의원 거래 신고는 거래 뒤 최대 45일 늦게 온다 */
const CONGRESS_LOOKBACK_DAYS = 45;
/** 한 번에 읽는 PTR 문서 수 (PDF 하나씩 받는다) */
const CONGRESS_MAX_DOCS = 40;
/** Claude가 한 번에 번역하는 제목 수 */
const TRANSLATE_LIMIT = 40;
const PTR_SCRIPT = 'vendor/day-trader-skill/trader-pelosi/ptr.py';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const TRANSLATE_SYSTEM = `너는 미국 주식 뉴스 제목 번역가다. 독자는 한국 직장인이다.
- 제목을 자연스러운 한국어로 옮긴다. 원문의 뜻을 더하거나 빼지 않는다. 회사 이름은 한국에서 쓰는 이름으로.
- importance: 실적·가이던스, 인수합병, 경영진 교체, 소송·규제, 대규모 자금 조달, SEC 공시(8-K)는 high. 시장 일반 기사, 의견·칼럼, 목표가 기사는 normal.`;

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, titleKo: { type: 'string' }, importance: { type: 'string', enum: ['high', 'normal'] } },
        required: ['id', 'titleKo', 'importance'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

/**
 * Phase 3 종목 소식 (하루 한 번). 내 보유·관심·AI 보유 종목만.
 * 1) 뉴스·8-K (trader-news)  2) 분기 실적 (trader-analyst, SEC)  3) 의원 거래 신고 (trader-pelosi)  4) 새 제목 번역 (Claude)
 * 단계 하나가 실패해도 나머지는 계속한다 (절대 규칙 4).
 */
@Injectable()
export class StockIntelJob {
  private readonly logger = new Logger(StockIntelJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: SkillRunnerService,
    private readonly claude: ClaudeService,
  ) {}

  private async tracked() {
    const [h, w, a] = await Promise.all([
      this.prisma.holding.findMany({ select: { symbol: true } }),
      this.prisma.watchItem.findMany({ select: { symbol: true } }),
      this.prisma.aiPosition.findMany({ where: { status: 'open' }, select: { symbol: true } }),
    ]);
    const symbols = [...new Set([...h, ...w, ...a].map((x) => x.symbol))];
    const info = await this.prisma.symbol.findMany({ where: { symbol: { in: symbols } }, select: { symbol: true, nameEn: true, type: true } });
    return info;
  }

  async run() {
    const run = await this.prisma.run.create({ data: { kind: STOCK_INTEL, market: 'us' } });
    const notes: string[] = [];
    let failed = 0;
    const step = async (name: string, fn: () => Promise<string>) => {
      try {
        notes.push(await fn());
      } catch (err) {
        failed++;
        notes.push(`${name} 실패: ${String(err).slice(0, 160)}`);
        this.logger.warn(`${name} 실패: ${String(err)}`);
      }
    };

    const tracked = await this.tracked();
    const names = new Map(tracked.map((t) => [t.symbol, t.nameEn]));
    const symbols = tracked.map((t) => t.symbol);

    if (symbols.length) {
      await step('뉴스', async () => {
        const r = await this.skills.run(run.id, 'trader-news', {}, symbols);
        if (r.status !== 'success') throw new Error(r.error ?? '스킬 실패');
        const rows = adaptNews(r.json, names);
        const created = await this.prisma.newsItem.createMany({ data: rows, skipDuplicates: true });
        return `뉴스·공시 ${rows.length}건 중 새로 ${created.count}건`;
      });

      // 분기 실적은 SEC에 재무제표를 내는 보통주만 (ETF는 없다)
      const stocks = tracked.filter((t) => t.type === 'stock').map((t) => t.symbol);
      if (stocks.length) {
        await step('실적', async () => {
          const r = await this.skills.run(run.id, 'trader-analyst', {}, stocks);
          if (r.status !== 'success') throw new Error(r.error ?? '스킬 실패');
          const rows = adaptFacts(r.json);
          const bySymbol = [...new Set(rows.map((x) => x.symbol))];
          await this.prisma.$transaction([
            this.prisma.earningsFact.deleteMany({ where: { symbol: { in: bySymbol } } }),
            this.prisma.earningsFact.createMany({ data: rows }),
          ]);
          return `분기 실적 ${bySymbol.length}종목 ${rows.length}분기`;
        });
      }
    }

    // 의원 거래는 내 종목과 상관없이 모아 둔다 (나중에 관심에 넣은 종목도 바로 보이게)
    await step('의원 거래', () => this.congress(run.id));
    await step('번역', () => this.translate());

    const status = failed === 0 ? 'success' : failed >= 3 ? 'failed' : 'partial';
    await this.prisma.run.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), error: notes.join(' / ') } });
    this.logger.log(`끝 ${run.id} ${status}: ${notes.join(' / ')}`);
    return { runId: run.id, status, notes };
  }

  /** 최근 45일 PTR 중 아직 안 읽은 문서를 하나씩 받아 읽는다 (pdftotext 필요) */
  private async congress(runId: string) {
    const since = ymd(new Date(Date.now() - CONGRESS_LOOKBACK_DAYS * DAY_MS));
    const r = await this.skills.run(runId, 'trader-pelosi-index', {}, [since]);
    if (r.status !== 'success') throw new Error(r.error ?? '문서 목록 실패');
    const docs = (r.json as { doc_id: string; name: string; district?: string; filed: string; year: number }[]) ?? [];
    const done = new Set(
      (await this.prisma.congressDoc.findMany({ where: { docId: { in: docs.map((d) => d.doc_id) } }, select: { docId: true } })).map((d) => d.docId),
    );
    const todo = docs.filter((d) => !done.has(d.doc_id)).slice(0, CONGRESS_MAX_DOCS);
    const pdfDir = await mkdtemp(join(tmpdir(), 'atlas-ptr-'));
    const raw: unknown[] = [];
    let trades = 0;
    for (const d of todo) {
      try {
        const out = await this.skills.exec(PTR_SCRIPT, ['fetch', d.doc_id, '--year', String(d.year), '--filed', d.filed, '--pdf-dir', pdfDir, '--json']);
        const json = JSON.parse(out) as unknown;
        raw.push(json);
        const rows = adaptPtr(json);
        await this.prisma.congressDoc.create({
          data: {
            docId: d.doc_id,
            member: d.name,
            district: d.district ?? null,
            filed: new Date(`${d.filed}T00:00:00Z`),
            trades: { create: rows },
          },
        });
        trades += rows.length;
      } catch (err) {
        this.logger.warn(`PTR ${d.doc_id} 읽기 실패: ${String(err).slice(0, 120)}`);
      }
    }
    // 원본은 한 줄로 모아 남긴다 (절대 규칙 9)
    if (raw.length) {
      await this.prisma.skillOutput.create({
        data: { runId, skillId: 'trader-pelosi-fetch', status: 'success', rawJson: raw as Prisma.InputJsonValue },
      });
    }
    return `의원 거래 문서 ${todo.length}개 읽음, 거래 ${trades}건 (남은 문서 ${Math.max(0, docs.length - done.size - todo.length)}개)`;
  }

  /** 최근 7일 새 제목을 한국어로 옮기고 중요도를 매긴다 */
  private async translate() {
    const rows = await this.prisma.newsItem.findMany({
      where: { titleKo: null, publishedAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
      orderBy: { publishedAt: 'desc' },
      take: TRANSLATE_LIMIT,
      select: { id: true, symbol: true, kind: true, title: true },
    });
    if (!rows.length) return '번역할 새 제목 없음';
    // 뉴스 제목은 남의 글을 옮기는 것이라 금지 표현 검사(우리 판정 문장용)는 하지 않는다
    const r = await this.claude.structured<{ items: { id: string; titleKo: string; importance: 'high' | 'normal' }[] }>({
      system: TRANSLATE_SYSTEM,
      prompt: `다음 제목들을 옮겨 주세요.\n\n${JSON.stringify(rows, null, 1)}`,
      schema: TRANSLATE_SCHEMA,
    });
    const ids = new Set(rows.map((x) => x.id));
    const valid = r.data.items.filter((x) => ids.has(x.id) && x.titleKo.trim());
    await this.prisma.$transaction(
      valid.map((x) => this.prisma.newsItem.update({ where: { id: x.id }, data: { titleKo: x.titleKo.trim(), importance: x.importance } })),
    );
    return `제목 번역 ${valid.length}건 (입력 ${r.inputTokens}, 출력 ${r.outputTokens} 토큰)`;
  }
}
