# 스킬

Atlas는 두 저장소의 스킬만 쓴다. TradingView MCP(tradesdontlie, LewisWJackson)는 쓰지 않는다. 데스크톱 앱 의존, 약관 리스크, 유료 구독 문제로 제외했다.

| 저장소 | 라이선스 | 성격 |
| --- | --- | --- |
| [tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills) | MIT | 74개 분석 스킬. `skills-index.yaml`이 공식 목록. `workflows/*.yaml`에 시장 판정 → 스윙 후보 → 복기 순서가 정의돼 있다 |
| [Jakeschincariol/day-trader-skill](https://github.com/Jakeschincariol/day-trader-skill) | MIT | 11개 단타 스킬. 표준 라이브러리 Python, 키 불필요. 정기 실행용(뉴스·실적·의원 공시)만 가져온다 |

두 저장소 모두 출력이 "매수·매도 신호가 아니다"라고 명시한다. Atlas도 이 원칙을 지킨다.

## 기능 블록과 스킬

개발은 블록 순서대로 한다. 블록 1만 끝나도 쓸 수 있는 앱이다.

| 블록 | 질문 | 스킬 (출처) | 데이터 |
| --- | --- | --- | --- |
| 1. 시장 날씨 | 사도 되는 시장인가, 어느 섹터가 강한가 | market-breadth-analyzer ③, uptrend-analyzer ③, exposure-coach ③, sector-analyst ③ | 공개 CSV, 키 불필요 |
| 1. 시장 날씨 (추가) | 이번 주 일정, 시장 뉴스 | economic-calendar-fetcher ③, market-news-analyst ③ (Claude), theme-detector ③ | FMP, 웹검색, FINVIZ 공개 |
| 2. 종목 찾기 | 조건 맞는 종목은 | vcp-screener ③, canslim-screener ③, value-dividend-screener ③ | FMP |
| 3. 종목 이해 | 실적·뉴스·차트는 | trader-news ④, trader-analyst ④, earnings-calendar ③, technical-analyst ③ (스크립트 모드), us-stock-analysis ③ (Claude) | Yahoo, SEC, FMP |
| 4. 계획 | 얼마에 사고 어디서 손절하나 | breakout-trade-planner ③, position-sizer ③, pre-trade-discipline-gate ③ | 계산 전용 |
| 5. 기록·복기 (2차) | 내 판단이 맞았나 | trader-memory-core ③, signal-postmortem ③, weekly-performance-digest ③ | 계산 전용 |

## 화면 숫자의 출처

| 화면 표시 | 출처 | 설명 |
| --- | --- | --- |
| 시장 점수 (0~100) | market-breadth-analyzer | 6개 항목 가중 합산: 참여도 수준·추세 25%, 단기·장기 평균선 비교 20%, 사이클 위치 20%, 하락 신호 15%, 과거 대비 위치 10%, S&P 500과의 괴리 10% |
| 상승추세 비율 | uptrend-analyzer | 약 2,800개 미국 종목 중 상승 추세 비율 |
| 권장 주식 비중 | exposure-coach | 여러 스킬 결과를 종합한 주식 노출 상한 |
| 날씨 (맑음·흐림·비) | exposure-coach | 신규 진입 허용 / 제한 / 현금 우선 |
| 섹터 순위 | sector-analyst | 11개 섹터 상승추세 비율 순위. 어제 대비 변화는 DB 이력으로 계산 |

## 호출 예시

```bash
# ③ 시장 점수 (키 불필요)
uv run python vendor/claude-trading-skills/skills/market-breadth-analyzer/scripts/market_breadth_analyzer.py \
  --detail-url "https://tradermonty.github.io/market-breadth-analysis/market_breadth_data.csv" \
  --summary-url "https://tradermonty.github.io/market-breadth-analysis/market_breadth_summary.csv" \
  --output-dir reports/<run-id>
# → market_breadth_YYYY-MM-DD_HHMMSS.json / .md

# ④ 뉴스 (상태 파일을 쓰지 않고, 중복 제거는 DB에서)
python3 vendor/day-trader-skill/trader-news/news.py --tickers NVDA MSFT --hours 48 --all --dry-run --json

# ④ 분기 실적 (SEC XBRL)
python3 vendor/day-trader-skill/trader-analyst/facts.py NVDA MSFT --quarters 6 --json
```

스크립트별 정확한 인자는 각 `SKILL.md`를 따른다. 저장소가 자주 바뀌므로(③은 매일 갱신) 서브모듈을 커밋 고정하고, 올릴 때 Adapter 테스트를 먼저 돌린다.

## 손절가 제안 (보유 종목)

breakout-trade-planner는 새로 살 종목용이다. 이미 보유한 종목은 평단가 기준으로 세 가지를 나란히 보여주고 사용자가 고른다.

| 방식 | 계산 | 출처 |
| --- | --- | --- |
| 비율형 | 평단가 × (1 − 8%) | 직접 계산 (오닐 CANSLIM의 7~8% 손절 원칙) |
| 변동성형 | 평단가 − ATR × 2 | position-sizer ATR 모드 (기본 배수 2.0) |
| 차트형 | 가장 가까운 지지선 바로 아래 | technical-analyst 스크립트 모드 |

각 방식 옆에 "이 손절가면 최대 손실 $X (투자금의 Y%)"를 표시한다. 입력은 수량과 평단가만 받고 평가금은 계산한다. 손절가 도달 판단은 일봉 저가 ≤ 손절가.

## 제외한 스킬 (요약)

- ③: 옵션·선물·크립토·공매도·페어 트레이딩, COT 기반 스킬, Stockbee 단기 이벤트 스킬, 별도 엔진(manifoldbt, MT5), Alpaca 계좌 필수(portfolio-manager), 미국 세무, 스킬 개발 도구
- ④: trader-entry, trader-timemachine, trader-risk, trader-budget, trader-broker (장중 단타·주문용)
- 2차 이후 후보: market-top-detector, ftd-detector, macro-regime-detector, institutional-flow-tracker, trader-scanner(일봉 스캔만), trader-alerts, trader-pelosi, 배당 스킬, backtest-expert, skill-idea-miner

## 데이터 주의

- FMP 무료 등급 하루 250회. 실행별 요청 수를 `runs`에 기록한다.
- Yahoo Finance는 공식 API가 아니다. 실패 시 해당 종목만 건너뛴다.
- SEC EDGAR는 `SEC_USER_AGENT` 필수, 초당 요청 제한이 있어 간격을 둔다.
- 공포지수(VIX)는 MVP 제외. 넣는다면 Yahoo로 별도 수집해야 한다.
