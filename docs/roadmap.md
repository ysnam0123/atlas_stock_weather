# 로드맵

첫 목표는 **블록 1 "시장 날씨"를 실제 데이터로 매일 돌리는 것**이다. 이게 돌기 시작하면 그날부터 시장 점수 이력이 쌓인다.

## 1일차: 시장 날씨 관통 (키 불필요)

- [ ] pnpm 워크스페이스, `apps/web`(Next.js), `apps/api`(NestJS), `packages/contracts` 생성
- [ ] `docker-compose.yml`로 PostgreSQL, Prisma 초기화
- [ ] `vendor/`에 claude-trading-skills, day-trader-skill 서브모듈 추가, 오늘 커밋으로 고정
- [ ] `uv`로 ③용 Python 환경 구성
- [ ] 터미널에서 `market-breadth-analyzer` 한 번 실행해 출력 JSON 구조 확인
- [ ] Prisma: `runs`, `skill_outputs`, `market_snapshots`, `sector_snapshots`
- [ ] `SkillRunnerService` + 키 불필요 4개 연결: market-breadth-analyzer, uptrend-analyzer, sector-analyst, exposure-coach
- [ ] Adapter → `market_snapshots`, `sector_snapshots` (exposure-coach 판정 → 맑음·흐림·비 매핑)
- [ ] `POST /runs/market_daily`, `GET /home`
- [ ] 홈: 날씨 히어로, 시장 점수 수평선, 권장 비중 문장, 섹터 순위 1~5위, 하단 탭바, 상단 버튼 (나머지 영역은 빈 상태)
- [ ] 한투 해외주식 마스터 파일을 받아 한글명이 실제로 채워져 있는지 확인

## 이후 순서

| 순서 | 내용 |
| --- | --- |
| 2 | 종목 목록 병합 + 검색(티커·영문·한글·ETF), 관심·보유 CRUD, 편집 시트 |
| 3 | ④ trader-news, trader-analyst 연결 (`SEC_USER_AGENT`), 저장소 fixture로 Adapter 테스트, 내 종목 영역 |
| 4 | 손절가 3방식 제안, "할 일" 캡슐(손절가 도달), `price_bars` 수집 |
| 5 | FMP 키, 캘린더 2종, vcp·canslim·value-dividend 스크리너 |
| 6 | `FunnelService` + `rules.yaml`, breakout-trade-planner, position-sizer → 관심 종목 카드와 진입 계획 |
| 7 | `ClaudeService`: 시장 요약 한국어, 뉴스 제목 번역, market-news-analyst |
| 8 | 종목 상세 + 계획 오버레이 차트 + 깊게 분석(us-stock-analysis, technical-analyst) + 매매 기록 |
| 9 | 스케줄러(07시, 18시, 주간), 놓친 실행 보충, 휴장일 처리 |
| 10 | 저녁·주말 모드, 섹터 지도 |

## 미확정 사항

- [ ] Claude 호출: 구독 계정 Claude Code(`CLAUDE_MODE=code`)로 시작할지, API 키로 할지
- [ ] 초기 관심 종목 목록
- [ ] `rules.yaml` 첫 진입 조건 (예: 날씨 맑음, 섹터 상위 5위, VCP 통과, 손익비 2 이상)
- [ ] 하단 탭 "기록"의 최종 이름과 역할
- [ ] 레포 공개 여부 (공개면 한투 마스터 파일은 커밋하지 않고 다운로드 스크립트만)
- [ ] 배포 방식(나중): 오픈소스 설치형 / 공개 시장 날씨 페이지 + 개인 분석은 로컬. 종목 추천을 남에게 공개하면 유사투자자문업 해당 여부 확인 필요

## MVP 이후

용어 쉬운 말·툴팁, 공포지수(VIX), 장중 분봉, TradingView 공식 위젯, 검색 즉시 판정, 원화 환산, 복기(블록 5), 시장 점수 30일 추이, 종목별 깔때기 이력, PWA·알림, 공개 시장 날씨 페이지와 판정 성적표.
