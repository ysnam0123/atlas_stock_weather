# 아키텍처

분석은 워커가 미리 돌려 DB에 쌓고, 웹은 DB만 읽는다. 웹 요청 안에서 Python이나 Claude를 기다리지 않는다.

```text
Next.js (frontend) ──REST──> NestJS API (backend, main.ts) ──> PostgreSQL
                                                                    ^
NestJS Worker (backend, worker.ts) ── 스케줄·jobs ─────────────────┘
   ├─ SkillRunnerService ── uv run / python3 ──> vendor/ 스킬 스크립트 ──> reports/<run>/*.json
   ├─ ClaudeService ─────── claude -p --output-format json --json-schema
   └─ Adapters ──────────── 스킬 원본 JSON → 정규화 테이블
외부 데이터: TraderMonty 공개 CSV · FMP(무료 250회/일) · Yahoo Finance · SEC EDGAR · 웹검색
```

## 레포 구조

```text
atlas/
├─ CLAUDE.md
├─ docs/
├─ frontend/               # Next.js App Router
├─ backend/                # NestJS: src/main.ts(API), src/worker.ts(스케줄러+잡 실행)
├─ packages/
│  └─ contracts/           # 공유 타입, Claude 출력 JSON 스키마
├─ vendor/                 # git submodule, 커밋 고정
│  ├─ claude-trading-skills/   # tradermonty, MIT
│  └─ day-trader-skill/        # Jakeschincariol, MIT
├─ data/
│  └─ kis-master/          # 한투 해외주식 마스터 스냅샷 (비공개 레포일 때만 커밋)
├─ config/
│  ├─ skills-registry.yaml # 채택한 스킬만 등록
│  └─ rules.yaml           # 깔때기 단계별 통과 조건
├─ reports/                # 스킬 원본 출력 (gitignore)
├─ docker-compose.yml
└─ .env.example
```

`.claude/skills/apple-design/`에 emilkowalski의 apple-design 스킬을 둔다. dickwu/apple-design-skill은 라이선스 파일이 없으므로 리뷰용으로 개인 환경에만 두고 레포에 커밋하지 않는다.

## 실행 환경

- 맥에서 네이티브로 개발한다. PostgreSQL만 Docker.
- ③ claude-trading-skills: `uv`로 Python 3.10+ 환경 구성
- ④ day-trader-skill: 표준 라이브러리만 사용, 시스템 Python 3.8+로 실행
- 맥이 잠들면 스케줄이 멈춘다 → 워커 시작 시 "놓친 실행 보충"이 필수

## 환경 변수 (`.env.example`)

```text
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas
FMP_API_KEY=                     # 3일차부터
SEC_USER_AGENT="이름 이메일"     # ④ 뉴스·실적 스크립트 필수
CLAUDE_MODE=code                 # code(구독 Claude Code) | api
ANTHROPIC_API_KEY=               # CLAUDE_MODE=api일 때만
TZ=Asia/Seoul
```

## 스케줄 (한국 시간)

| 실행 | 시각 | 내용 |
| --- | --- | --- |
| `market_daily` | 화~토 07:00 | 시장 판정, 섹터, 테마, 스크리너, 깔때기, 보유·관심 종목 뉴스·실적, Claude 종합 |
| `evening_refresh` | 월~금 18:00 | 뉴스·공시 재수집, 캘린더 갱신 (깔때기는 다시 돌리지 않음) |
| `core_weekly` | 일 10:00 | 보유 종목 주간 점검, 섹터·테마 주간 변화 |
| `symbols_weekly` | 일 09:00 | 종목 목록(Nasdaq Trader, SEC, 한투 마스터) 갱신 |

- 2026-11-01 서머타임 종료 이후 정규장은 한국 시간 23:30~06:00. 서머타임 기간엔 1시간 앞당겨진다. 실행 시각은 장 마감 기준으로 계산한다.
- 미국장 휴장 다음 날 아침엔 새 결과가 없음을 표시한다(④ trader-alerts에 NYSE 2026·2027 휴장일 데이터가 있다).
- 워커 시작 시 마지막 성공 실행일을 확인해 놓친 실행을 보충한다.

## 백엔드 서비스

| 서비스 | 역할 |
| --- | --- |
| `SkillRunnerService` | `skills-registry.yaml`에 등록된 스킬만 실행. 타임아웃, stdout/stderr 캡처, 출력 JSON 경로 수집, `skill_outputs` 저장 |
| `ClaudeService` | `claude -p` 래퍼. JSON 스키마 강제, 허용 툴 화이트리스트, `total_cost_usd`를 `runs`에 기록 |
| `Adapters` | 스킬별 1개. 원본 JSON → 정규화 테이블. 스킬 출력이 바뀌면 여기만 고친다. 저장소의 오프라인 fixture로 테스트 |
| `FunnelService` | 깔때기 단계 순서 실행, `rules.yaml` 조건으로 후보 거르기, `candidates` 작성 |
| `SchedulerService` | `@nestjs/schedule` 크론 + 놓친 실행 보충 |
| `JobsService` | "깊게 분석" 같은 수동 요청을 `jobs` 테이블로 받아 워커가 처리 (Redis·큐 없음) |
| `SymbolsService` | 종목 목록 병합, 한글명·별칭 검색 |

Claude CLI 플래그(`-p`, `--output-format json`, `--json-schema`, `--allowedTools`)는 구현 시점에 [Claude Code 공식 문서](https://docs.claude.com/en/docs/claude-code/overview)로 재확인한다.

## DB 스키마 (Prisma, 초안)

| 테이블 | 주요 컬럼 | 단계 |
| --- | --- | --- |
| `runs` | id, kind, status, startedAt, finishedAt, error, claudeCostUsd | MVP |
| `skill_outputs` | id, runId, skillId, status, rawJson(jsonb), rawMd, createdAt | MVP |
| `market_snapshots` | date, marketScore, uptrendRatio, exposureCeiling, condition(clear·cloudy·rain), summaryKo | MVP |
| `sector_snapshots` | date, sector, rank, uptrendRatio, trend, status | MVP |
| `themes` | date, name, lifecycle, confidence, tickers[] | 2차 |
| `symbols` | symbol, exchange, nameEn, nameKo, type(stock·etf), cik, alias[] | MVP |
| `holdings` | symbol, shares, avgCost, stopPrice, stopMethod(percent·atr·support), targetPrice, thesis, openedAt | MVP |
| `watchlist` | symbol, addedAt, note | MVP |
| `news_items` | symbol, publishedAt(KST), title, titleKo, url, source, tags[] | MVP |
| `earnings_facts` | symbol, period, revenue, grossMargin, opMargin, eps, yoy(jsonb) | MVP |
| `calendar_events` | at(KST), type(earnings·macro), symbol, title | MVP |
| `price_bars` | symbol, date, o, h, l, c, v | MVP |
| `candidates` | id, date, symbol, sourceSkills[], stageReached, stoppedAt, conditionsMet, conditionsTotal, entry, stop, target, rr, shares, verdict, reasonKo | 3일차 |
| `decisions` | id, symbol, candidateId?, action(bought·sold·skipped·watching), price, shares, decidedAt, note | MVP |
| `jobs` | id, type, payload(jsonb), status, resultRunId | MVP |
| `outcomes` | candidateId, ret5d, ret20d, ret60d, hitStop, hitTarget | 2차 |

`condition` 매핑: exposure-coach 판정 allow → 맑음, restrict → 흐림, cash_priority → 비. 실제 필드명은 스크립트 출력 JSON을 보고 확정한다.

## API

홈은 모드별로 묶음 엔드포인트 하나만 호출한다.

| 화면 | 엔드포인트 | React Query 키 |
| --- | --- | --- |
| 기준 시각 배지 | `GET /runs/latest` | `['runs','latest']` (분석 중일 때만 30초 폴링) |
| 홈 | `GET /home` (서버가 KST로 모드 결정, `?mode=`로 강제 가능) | `['home']` |
| 검색 | `GET /symbols/search?q=` | `['symbols', q]` |
| 내 종목 | `GET /my`, `POST /watchlist`, `PATCH /holdings/:symbol`, `DELETE /watchlist/:symbol` | `['my']` |
| 손절가 제안 | `GET /holdings/:symbol/stop-options` | `['stop-options', symbol]` |
| 종목 상세 | `GET /stocks/:symbol`, `GET /stocks/:symbol/bars?tf=D\|W` | `['stock', symbol]`, `['bars', symbol, tf]` |
| 깊게 분석 | `POST /stocks/:symbol/deep-dive` → `{jobId}`, `GET /jobs/:id` | `['job', id]` |
| 매매 기록 | `POST /decisions`, `GET /decisions` | `['decisions']` |
| 섹터 | `GET /sectors?date=` | `['sectors', date]` |
| 수동 실행 | `POST /runs/:kind`, `GET /runs` | `['runs']` |

데이터는 하루 두 번 바뀌므로 staleTime 5분, 화면 복귀 시 재조회.
