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
| `market_daily` | 화~토 13:30, 18:00(보충) | 시장 판정, 섹터, 고점 위험·큰 흐름·바닥 확인(FMP, 2026-11-23) (구현됨). 이후 테마, 스크리너, 깔때기, Claude 종합을 붙인다. TraderMonty CSV가 KST 11~13시에 갱신되기 때문(2026-11 확인). 거래일 기준 덮어쓰기라 두 번 돌아도 중복 없음 |
| `morning_news` | 화~토 07:00 | 보유·관심 종목 뉴스·실적 (Phase 3) |
| `backfill_uptrend` | 일 10:00 | uptrend 시계열 CSV로 빠진 날의 상승추세 비율(2023-08~)·섹터 순위(2024-07~, 11개 다 있는 날만)를 채움. 기존 행은 건드리지 않음. 시장 점수는 과거 계산 불가라 비어 있음 |
| `evening_refresh` | 월~금 18:00 | 뉴스·공시 재수집, 캘린더 갱신 (깔때기는 다시 돌리지 않음) |
| `core_weekly` | 일 10:00 | 보유 종목 주간 점검, 섹터·테마 주간 변화 |
| `prices_daily` | 화~토 13:30, 18:00(보충) | 보유·관심 종목과 섹터 ETF 11개·SPY의 2년치 일봉(야후) → `price_bars`. 장중 미완성 봉은 버림. 실패한 종목만 건너뜀 (구현됨, 2026-11-23) |
| `earnings_calendar` | 화~토 13:30, 18:00(보충) | 실적 발표 일정: 전체 일정 1회 + 내 보유·관심·AI 보유 종목별 조회 → `calendar_events`. FMP 무료 플랜 한계는 `docs/skills.md` (구현됨, 2026-11-23) |
| `stock_intel` | 화~토 13:30, 18:00(보충) | 내 보유·관심·AI 보유 종목 소식: trader-news(야후 헤드라인 + SEC 8-K, 제목에 종목이 나오는 것만) → `news_items`, trader-analyst(SEC 분기 실적) → `earnings_facts`, trader-pelosi(하원 의원 거래 신고 PDF, 최근 45일, 한 번에 40개) → `congress_docs`·`congress_trades`, 하원 의원 정당·지역구·상임위원회(unitedstates/congress-legislators 공개 JSON, 주 1회) → `congress_members`, 새 제목 Claude 번역·중요도 (구현됨, 2026-11-23) |
| `commentary_daily` | 화~토 13:30, 18:00(보충), AI 다음 | Claude 해설 (`claude -p`, JSON 스키마 강제, 도구 끔, 금지 표현 검사): 시장 해설 3줄 + 왜 이런 날씨인가 3줄 → `commentaries`, AI 신호 한 줄 해설 → `ai_signals.commentKo`. 장 날짜마다 한 번. 하루 약 1만5천 토큰 (구현됨, 2026-11-23) |
| `ai_daily` | 화~토 13:30, 18:00(보충), 시장 날씨·일봉 다음 | AI 모의 계좌: 체결 → 청산 → 계좌 가치 → trader-scanner 스캔·판단 → 내 종목 매도 신호 → 내 계좌 가치. 규칙은 `docs/ai-duel.md` (구현됨, 2026-11-23) |
| `premarket_snapshot` | 월~금 21:30 (늦어도 1시간 안, 미국 휴장이면 쉼) | SPY·QQQ·보유·관심 종목의 프리마켓 마지막 가격(야후 5분봉) → `premarket_snapshots` (구현됨, 2026-11-24) |
| `symbols_weekly` | 일 09:00 | 종목 목록(Nasdaq Trader + 한투 마스터 한글명) 갱신. 약 1만 1,800개, 한글명 약 5,900개. 사용자 별칭은 유지. SEC 티커·CIK는 Phase 3에서 `SEC_USER_AGENT`와 함께 (구현됨, 2026-11-23) |

- 2026-11-01 서머타임 종료 이후 정규장은 한국 시간 23:30~06:00. 서머타임 기간엔 1시간 앞당겨진다. 실행 시각은 장 마감 기준으로 계산한다.
- 미국장 휴장 다음 날 아침엔 새 결과가 없음을 표시한다(④ trader-alerts에 NYSE 2026·2027 휴장일 데이터가 있다).
- 워커는 10분마다 "가장 최근 실행 시각 이후 성공한 실행이 있나"를 확인해 놓친 실행을 보충한다(시작 직후 포함). 한 시각에 3번 실패하면 다음 시각까지 멈춘다.

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

## DB 스키마 (Prisma, 2026-11-24 실제)

정본은 `backend/prisma/schema.prisma`, 변경 이력은 `backend/prisma/migrations/`. 원칙: 스킬 원본은 `skill_outputs`에 통째로(jsonb), 화면용 값은 Adapter가 정규화 테이블로 뽑는다 (절대 규칙 9). 날짜만 있는 값은 뉴욕 장 날짜(`@db.Date`), 시각은 `timestamptz`.

| 묶음 | 테이블 | 무엇을 | 누가 쓰나 |
| --- | --- | --- | --- |
| 실행 기록 | `runs` | 작업 한 번(kind, status, 시각, 메모) | 모든 작업 |
| | `skill_outputs` | 스킬 원본 JSON·MD 통째 | `SkillRunnerService` |
| 시장 | `market_snapshots` | 장 날짜별 날씨·권장 비중·점수·상승추세 비율·고점 위험·큰 흐름·바닥 확인 | `market_daily`, `backfill_uptrend` |
| | `sector_snapshots` | 장 날짜 × 11개 섹터 순위·상승추세 비율 | 같음 |
| | `commentaries` | 장 날짜별 Claude 시장 해설 | `commentary_daily` |
| | `calendar_events` | 실적 발표 일정 | `earnings_calendar` |
| | `premarket_snapshots` | 종목 × 그날 장의 프리마켓 마지막 가격 (21:30 KST 한 번) | `premarket_snapshot` |
| 종목 | `symbols` | 미국 종목 목록, 한글명, 별칭 | `symbols_weekly` |
| | `price_bars` | 종목 × 날짜 일봉 (2년) | `prices_daily`, `ai_daily`, 종목 상세 |
| | `news_items` | 뉴스·8-K 제목, 한국어 번역, 중요도 | `stock_intel` |
| | `earnings_facts` | 분기 실적 (SEC, % 단위) | `stock_intel`, 깊게 분석 |
| | `congress_docs`, `congress_trades` | 하원 의원 거래 신고 문서와 거래 | `stock_intel` |
| | `congress_members` | 현직 하원 의원 정당·지역구·위원회 | `stock_intel` (주 1회) |
| | `stock_reports` | 깊게 분석 한 번 = 작업 하나. 입력(스크립트 계산값) jsonb + Claude 출력 jsonb + 토큰 | 종목 상세 버튼 |
| 나 | `holdings`, `watchlist` | 보유(수량·평단·손절가·목표가·산 날)와 관심 | 내 종목 |
| | `trades` | 샀음·팔았음 기록, 실현 손익 | 기록 |
| | `my_equity` | 날짜별 내 계좌 가치 | `ai_daily` |
| | `settings` | 키-값 (총 투자금 등) | 설정 |
| AI 대결 | `ai_accounts` | 모의 계좌 (규칙 버전 v1·v2, 시작 자금, 현금, 마지막 처리일) | `ai_daily` |
| | `ai_signals` | 계좌 × 날짜 × 종목 × 방향 신호, 체크리스트 jsonb, 조건부 매수가·손절가·목표가·수량, Claude 해설 | `ai_daily`, `commentary_daily` |
| | `ai_positions` | 모의 포지션 (진입·청산·사유·손익, 본전 보호) | `ai_daily` |
| | `ai_equity` | 계좌 × 날짜 계좌 가치 | `ai_daily` |

초안에 있던 `themes`, `candidates`, `decisions`, `outcomes`는 아직 없다. `jobs`는 따로 두지 않고 `stock_reports`(깊게 분석)가 작업 기록을 겸한다. 복기(Phase 8)에서 `outcomes`를 만든다.

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
