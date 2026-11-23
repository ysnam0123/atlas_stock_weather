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
- [x] `GET /home` (API는 4000 포트, CORS는 `WEB_ORIGIN`)
- [x] 홈: 날씨 히어로, 시장 점수 수평선, 권장 비중 문장, 섹터 순위 1~5위, 하단 탭바, 상단 버튼 (나머지 영역은 빈 상태)
- [x] 홈 개편: 왜 이런 날씨인가, 흐름 차트·섹터 히트맵, 다시 맑아지려면, 데스크톱 반응형, 흰 바탕 (2026-11-23)
- [x] 홈 2차 개편: 결론 먼저, 오늘 확인할 것, 새로 살 후보, 오늘의 한 줄 공부, 근거는 펼쳐서, 용어 뜻 (2026-11-23)
- [x] 한투 해외주식 마스터 파일을 받아 한글명이 실제로 채워져 있는지 확인 (5,880개, 주식 위주. ETF는 영문)

## Phase 2 진행 (2026-11-23)

- [x] `symbols`·`holdings`·`watchlist`·`price_bars`, `symbols_weekly`·`prices_daily` 작업
- [x] 검색 `GET /symbols/search`, 내 종목 API, 손절가 3방식 `GET /holdings/:symbol/stop-options`
- [x] 화면: 내 종목, 검색, 편집 시트(손절가 고르기), 홈 "오늘 확인할 것"의 손절가·목표가 줄, 데스크톱 오른쪽 내 종목 카드
- [ ] 한글 별칭 입력 (검색은 이미 `aliases`를 본다)
- [ ] SEC 티커·CIK 병합 (Phase 3, `SEC_USER_AGENT`)
- [x] 총 투자금 설정, 홈 트레이더 리뉴얼(시장 자세, 오늘 할 일, 보유 종목 표·열린 위험) (2026-11-23)
- [x] Phase 3 (2026-11-23): 내 종목 뉴스·SEC 8-K(관련 기사만, 제목 한국어 번역·중요도), 분기 실적 6개 분기, 하원 의원 거래 신고. 홈 오늘 할 일(새 공시·중요 뉴스·의원 거래), 종목 소식 시트(내 종목, 홈 관심 카드)
- [x] Phase 4 일부 (2026-11-23): `ClaudeService`(헤드리스, JSON 스키마, 도구 끔, 금지 표현 검사·재시도), 시장 해설·왜 이런 날씨인가·AI 신호 해설. 뉴스 번역·중요도 분류도 완료(Phase 3와 함께). 남은 것: 실적 해설, 공시 본문 요약
- [x] FMP 연결 (2026-11-23): 고점 위험·큰 흐름·바닥 확인을 날씨 판정 입력에 추가 (신뢰도 낮음 → 높음, 맑음 가능), 실적 일정 → 홈 "다가오는 일정"·오늘 할 일. 경제지표 일정은 무료 플랜에서 막힘
- [x] **AI 대결** (2026-11-23, 사용자 요청으로 당김): trader-scanner + 규칙 "추세 추종 스윙 v1" 모의 계좌, 매매 기록(샀음/팔았음), 성적 비교. `docs/ai-duel.md`

## 전체 단계 (2026-11-22 확정, 2026-11-23 순서 조정)

최종 목표는 코스피까지 다루는 것이다. MVP는 미국만 하고, `market` 컬럼(`us`·`kr`)은 처음부터 넣는다.

2026-11-23: 사용자가 개별주를 보유한 스윙 투자 초보라서, 홈의 "오늘 확인할 것"을 채우는 **Phase 2를 바로 다음**에 한다. Phase 7의 섹터 지도는 그대로 뒤에 둔다. FMP 키는 받기로 했고, 연결 영역은 `TODO.md`에 정리돼 있다.

| Phase | 내용 | 필요한 키 |
| --- | --- | --- |
| 0 | 기반: uv, `vendor/` 서브모듈, Prisma, `.env.example` | 없음 |
| 1 | 시장 날씨 관통 (위 1일차 체크리스트) | 없음 |
| 2 (다음) | 종목 목록 병합 + 검색, 관심·보유 CRUD, 편집 시트, 손절가 3방식, `price_bars`(일봉 종가), 홈 "오늘 확인할 것"에 손절가까지 남은 거리 | 없음 |
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

공포지수(VIX), 장중 분봉, TradingView 공식 위젯, 검색 즉시 판정, 원화 환산, 복기(블록 5), 시장 점수 30일 추이, 종목별 깔때기 이력, PWA·알림, 공개 시장 날씨 페이지와 판정 성적표.
