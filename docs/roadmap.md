# 로드맵

첫 목표는 **블록 1 "시장 날씨"를 실제 데이터로 매일 돌리는 것**이다. 이게 돌기 시작하면 그날부터 시장 점수 이력이 쌓인다.

## 1일차: 시장 날씨 관통 (키 불필요)

- [x] pnpm 워크스페이스, `frontend`(Next.js), `backend`(NestJS), `packages/contracts` 생성
- [x] `docker-compose.yml`로 PostgreSQL, Prisma 초기화
- [x] `vendor/`에 claude-trading-skills, day-trader-skill 서브모듈 추가, 오늘 커밋으로 고정
- [x] `uv`로 ③용 Python 환경 구성
- [x] 터미널에서 `market-breadth-analyzer` 한 번 실행해 출력 JSON 구조 확인
- [x] Prisma: `runs`, `skill_outputs`, `market_snapshots`, `sector_snapshots`
- [x] `SkillRunnerService` + 키 불필요 4개 연결: market-breadth-analyzer, uptrend-analyzer, sector-analyst, exposure-coach
- [x] Adapter → `market_snapshots`, `sector_snapshots` (exposure-coach 판정 → 맑음·흐림·비 매핑)
- [x] 워커 스케줄러 + 놓친 실행 보충 (Phase 7에서 당김, 데이터를 바로 쌓기 위해)
- [x] `POST /runs/market_daily`
- [x] 과거 이력 채우기: 상승추세 비율 845일(2023-08-11~), 섹터 순위 562일(2024-07-21~)
- [ ] `GET /home`
- [ ] 홈: 날씨 히어로, 시장 점수 수평선, 권장 비중 문장, 섹터 순위 1~5위, 하단 탭바, 상단 버튼 (나머지 영역은 빈 상태)
- [ ] 한투 해외주식 마스터 파일을 받아 한글명이 실제로 채워져 있는지 확인

## 전체 단계 (2026-11-22 확정)

최종 목표는 코스피까지 다루는 것이다. MVP는 미국만 하고, `market` 컬럼(`us`·`kr`)은 처음부터 넣는다.

| Phase | 내용 | 필요한 키 |
| --- | --- | --- |
| 0 | 기반: uv, `vendor/` 서브모듈, Prisma, `.env.example` | 없음 |
| 1 | 시장 날씨 관통 (위 1일차 체크리스트) | 없음 |
| 2 | 종목 목록 병합 + 검색, 관심·보유 CRUD, 편집 시트, 손절가 3방식, `price_bars`, "할 일" 캡슐 | 없음 |
| 3 | ④ trader-news, trader-analyst, **trader-pelosi**(2차 후보에서 당김), fixture 기반 Adapter 테스트, 내 종목 영역 | `SEC_USER_AGENT` |
| 4 | `ClaudeService` 에이전트: 시장 해설, 뉴스 분류·번역, 실적 해설, 공시 요약. 스키마는 `packages/contracts`, 금지 표현 검사 | 없음 (`CLAUDE_MODE=code`) |
| 5 | 캘린더 2종, vcp·canslim·value-dividend 스크리너, `FunnelService` + `rules.yaml`, breakout-trade-planner, position-sizer | FMP |
| 6 | 종목 상세 + 계획 오버레이 차트 + 깊게 분석(us-stock-analysis, technical-analyst, `jobs`) + 매매 기록 | FMP |
| 7 | 스케줄러(07시, 18시, 주간), 놓친 실행 보충, 휴장일, 저녁·주말 모드, 섹터 지도, 저녁 프리마켓 스냅샷(하루 1회, 기준 시각 표시) → **MVP** | 없음 |
| 8 | 복기 루프: `outcomes` 채점(스크립트), trader-memory-core, signal-postmortem, weekly-performance-digest, 복기 코치·보유 논리 점검 에이전트 | 없음 |
| 9 | 한국 시장: NomaDamas/k-skill(`k-dart`, `korean-stock-search`)로 국내 종목 공시·실적, `pykrx`로 한국 시장 날씨 직접 계산. 이후 2차 후보 스킬, PWA 알림 | DART |

## 미확정 사항

- [x] Claude 호출: 구독 계정 Claude Code(`CLAUDE_MODE=code`)로 시작 (2026-11-22)
- [ ] 출근길 브리핑 시점: 시장 날씨 원본(TraderMonty CSV)이 KST 11~13시에 갱신돼 07시엔 하루 전 값이다. 홈 아침 모드를 "전날 장 기준"으로 표시할지, 시장 폭을 직접 계산해 07시에 맞출지 (2026-11-22)
- [ ] 초기 관심 종목 목록
- [ ] `rules.yaml` 첫 진입 조건 (예: 날씨 맑음, 섹터 상위 5위, VCP 통과, 손익비 2 이상)
- [ ] 하단 탭 "기록"의 최종 이름과 역할
- [x] 레포 공개 여부: 공개. 한투 마스터 파일은 커밋하지 않고 다운로드 스크립트만 (2026-11-22)
- [ ] 배포 방식(나중): 오픈소스 설치형 / 공개 시장 날씨 페이지 + 개인 분석은 로컬. 종목 추천을 남에게 공개하면 유사투자자문업 해당 여부 확인 필요

## MVP 이후

용어 쉬운 말·툴팁, 공포지수(VIX), 장중 분봉, TradingView 공식 위젯, 검색 즉시 판정, 원화 환산, 복기(블록 5), 시장 점수 30일 추이, 종목별 깔때기 이력, PWA·알림, 공개 시장 날씨 페이지와 판정 성적표.
