# Atlas — 직장인용 미국주식 시장 날씨 비서

Atlas는 미국장이 끝난 뒤 자동으로 시장·섹터·내 종목을 분석해, 출근길과 퇴근길에 한 화면으로 보여주는 **개인 리서치 비서**다. 매매는 하지 않는다. 주문은 사용자가 증권사 앱에서 직접 한다.

상세 설계는 `docs/`에 있다. 작업 전에 해당 문서를 먼저 읽는다.

| 문서 | 내용 |
| --- | --- |
| `docs/architecture.md` | 모노레포 구조, 백엔드 서비스, 스케줄, DB 스키마, API |
| `docs/skills.md` | 사용하는 스킬 목록, 호출 방법, 데이터 출처 |
| `docs/frontend.md` | 페이지, 홈 모드, 화면 구성, 디자인 토큰, 상태 처리 |
| `docs/roadmap.md` | 개발 순서, 1일차 체크리스트, 미확정 사항 |

## 스택

- 프론트: Next.js (App Router), TypeScript, Tailwind CSS, React Query(서버 상태), Zustand(UI 상태만), Lightweight Charts
- 백엔드: NestJS, Prisma, PostgreSQL(docker)
- 분석 엔진: `vendor/`의 스킬 스크립트(Python) + Claude Code 헤드리스(`claude -p`)
- 패키지 관리: pnpm 워크스페이스, Python은 `uv`(③ 스킬용)

## 절대 규칙

1. **주문 기능을 만들지 않는다.** 브로커 연동 스킬(`trader-broker` 등)은 설치하지 않는다.
2. **결정론적인 계산은 스크립트, 판단과 요약만 Claude.** 점수·스크리닝·포지션 크기는 스크립트 결과를 그대로 쓴다.
3. **Claude 출력은 반드시 JSON 스키마로 강제**하고, 허용 툴은 `Read`, `Glob`, `WebSearch`로 제한한다.
4. **스킬 하나가 실패해도 전체가 멈추지 않는다.** 실패는 해당 카드만 "데이터 없음"으로 표시한다.
5. **화면의 모든 시각은 한국 시간(KST).** 원본 데이터의 뉴욕 시간은 저장 시 변환한다.
6. **가격은 정규장 종가 기준.** 실시간 가격은 만들지 않는다(증권사 앱 몫). 화면에 기준을 명시한다.
7. **판정은 예측이 아니다.** "예보", "상승 확률" 같은 표현을 쓰지 않는다. 날씨는 "현재 상태"다.
8. **API 키는 코드에 넣지 않는다.** 전부 `.env`로 받는다.
9. 스킬 원본 출력은 `skill_outputs`에 jsonb로 통째 저장하고, 화면용 값은 Adapter가 정규화 테이블로 뽑는다.

## 자주 쓰는 명령 (구현하면서 채운다)

```bash
pnpm install
docker compose up -d          # PostgreSQL
pnpm --filter backend prisma migrate dev
pnpm --filter backend dev         # NestJS API
pnpm --filter backend worker      # 스케줄러 + 분석 워커
pnpm --filter frontend dev         # Next.js
```

## 디자인 원칙

`docs/frontend.md`의 디자인 토큰과 규칙을 따른다. 프로젝트 스킬로 `.claude/skills/apple-design`(emilkowalski/skills)을 둔다. 목업: https://claude.ai/artifact/RDQjHgzf9QEJGqPe3svWFj

피해야 할 것(생성된 디자인처럼 보이는 패턴): 헤드라인의 한 단어만 색칠, 모든 걸 똑같은 둥근 카드에 담기, "A · B · C" 식 가운뎃점 메타 줄, 대문자 라벨, 장식용 그라데이션, 실제 브랜드 로고, 특정 앱(아이폰 날씨 앱 등) 화면 구성 그대로 따라 하기.

## 학습 모드

이 프로젝트의 목적은 사용자가 직접 배우는 것이다. 아래 방식으로 진행한다.

- 한 번에 한 단계만 진행한다.
- 단계를 시작하기 전에 무엇을, 왜 하는지 개념부터 설명한다.
- 명령어는 사용자가 직접 터미널에서 실행하게 제안만 하고, 결과를 보고 다음으로 간다.
- 파일을 만들거나 고치면 핵심 부분이 무슨 역할인지 설명한다.
- 단계가 끝나면 바뀐 것과 배운 개념을 3줄로 정리한다.

## 답변 머리말

- 학습 모드 답변(개념 설명, 직접 해보기 안내)은 제목 앞에 `[학습]`을 붙인다.
- 코드 작업 답변(파일 수정, 명령 실행 결과 보고)은 제목 앞에 `[code]`를 붙인다.
