# ReturnPick 리턴픽

ReturnPick은 반품 노트북, 모니터, 로봇청소기, 무선청소기, 공기청정기, 제습기 후보를 자동 수집하고 관리자가 승인한 상품만 게시하는 수익형 MVP입니다. 쿠팡 파트너스 API, 네이버 쇼핑 검색 API, 상품명 기반 스펙 파싱, 점수화 알고리즘을 조합해 후보 검토 시간을 줄이는 것이 목표입니다.

## 1. 프로젝트 소개

- 키워드 기반 자동 후보 수집
- 네이버 쇼핑 최저가 기준 가격 비교
- 반품등급, 반품가, 재고 등 확인이 필요한 값은 관리자 보완
- 점수와 위험 플래그 기반 검토
- 승인/게시 후 사용자 페이지 노출
- 게시 상품 텔레그램 발송
- Supabase PostgreSQL, Vercel, Telegram Bot API 기반 운영
- 운영 대시보드, 검토 우선순위, 가격·재고 변동 기록
- 네이버 쇼핑 공식 API 후보 수집과 robots.txt를 확인하는 공개 웹 참고 수집
- 쿠팡 파트너스 제휴 링크 클릭 퍼널 추적

## 2. 이 프로젝트가 하지 않는 것

- 쿠팡 로그인/우회/대량 크롤링 없음
- robots.txt가 막는 공개 페이지 수집 없음
- 탐지 회피 없음
- 프록시 없음
- 캡차 우회 없음
- 비공식 내부 API 호출 없음

반품등급이나 반품 가격이 공식 API에서 제공되지 않으면 임의 생성하지 않고 `확인필요` 또는 `null`로 둡니다.

공개 웹 참고 수집은 기본값이 꺼져 있습니다. 사용할 때도 `robots.txt`를 확인하고, allowlist에 넣은 호스트만, 낮은 빈도로 요청합니다. 탐지 회피, 프록시, 캡차 우회, 로그인 우회는 넣지 않았습니다.

## 3. 설치 방법

```bash
npm install
```

## 4. 환경변수 설정

`.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
COUPANG_ACCESS_KEY=
COUPANG_SECRET_KEY=
COUPANG_PARTNER_ID=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NEXT_PUBLIC_SITE_URL=
PUBLIC_WEB_CRAWL_ENABLED=false
PUBLIC_WEB_ALLOWED_HOSTS=
PUBLIC_WEB_SEARCH_TEMPLATES=
```

API 키가 없어도 로컬에서는 330개 안팎의 검수 샘플 카탈로그, mock provider, 로컬 JSON 저장소로 UI를 확인할 수 있습니다. Supabase가 없을 때 생성·수정한 mock 데이터는 `.returnpick/local-db.json`에 저장됩니다.

## 5. Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `sql/schema.sql`을 실행합니다.
3. 초기 키워드가 필요하면 `sql/seed.sql`을 실행합니다.
4. 프로젝트 URL, anon key, service role key를 `.env.local`에 넣습니다.

관리자 API는 서버에서 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. 브라우저에 노출하지 마세요.

## 6. 쿠팡 파트너스 API 설정

`.env.local`에 아래 값을 넣습니다.

```bash
COUPANG_ACCESS_KEY=
COUPANG_SECRET_KEY=
COUPANG_PARTNER_ID=
```

값이 없으면 `searchCoupangProducts`는 오류를 던지지 않고 `API_NOT_CONFIGURED`를 반환하며, 소싱 실행은 mock provider로 대체할 수 있습니다.

## 7. 네이버 쇼핑 API 설정

`.env.local`에 아래 값을 넣습니다.

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

값이 없으면 네이버 최저가는 mock 가격으로 채우지 않고 `null`로 둡니다.

네이버 API 키가 있으면 후보 수집 단계에서 `{키워드} 반품`과 일반 `{키워드}` 검색을 함께 수행합니다. 반품 문구가 있는 상품은 반품 후보로 처리하고, 반품 문구가 없는 상품도 가격 비교·스펙 분석 후보로 저장하되 등급과 반품가는 `확인필요`로 둡니다.

## 7-1. 공개 웹 참고 수집 설정

공식 API로 부족한 반품 문구를 보조적으로 확인하려면 아래 값을 설정합니다.

```bash
PUBLIC_WEB_CRAWL_ENABLED=true
PUBLIC_WEB_ALLOWED_HOSTS=example.com
PUBLIC_WEB_SEARCH_TEMPLATES=https://example.com/search?q={keyword}
```

동작 원칙:

- `PUBLIC_WEB_ALLOWED_HOSTS`에 있는 호스트만 요청
- 요청 전 `robots.txt` 확인
- `User-Agent: ReturnPickBot/0.1` 사용
- 요청 사이에 지연을 둠
- HTML에서 공개 링크 텍스트의 반품/리퍼/재포장 문구만 참고
- 반품등급과 반품가는 근거가 있을 때만 저장
- robots.txt가 막으면 `ROBOTS_DISALLOWED`로 기록하고 건너뜀

## 8. 로컬 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 9. 자동 후보 수집 실행 방법

관리자 페이지 `/admin`에서 `후보 수집 실행` 버튼을 누릅니다. API로 실행하려면:

```bash
curl -X POST http://localhost:3000/api/admin/sourcing/run \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d "{\"useMockFallback\":true}"
```

활성화된 `sourcing_keywords`를 읽고, 쿠팡 파트너스 API, 네이버 쇼핑 반품 후보, 공개 웹 참고 수집, mock provider 순서로 후보를 수집한 뒤 스펙 파싱, 네이버 최저가 보완, 점수화를 수행합니다.

자동 재수집은 이미 `approved` 또는 `published`인 상품의 게시 상태를 임의로 낮추지 않습니다. 가격, 재고, 네이버 최저가, 반품등급 같은 관찰값만 갱신하고, 변동 내역은 `product_snapshots`에 기록합니다.

사이트의 구매 전환은 강제 이동이나 숨은 리다이렉트가 아니라 사용자가 명확히 누른 `쿠팡에서 가격 확인` 버튼으로만 발생합니다. 클릭 이벤트는 `affiliate_events`에 익명 세션 기준으로 저장하며, IP나 개인정보는 저장하지 않습니다.

## 10. 관리자 후보 검토 방법

`/admin`에서 다음 필터를 사용할 수 있습니다.

- 상태: `needs_review`, `candidate`, `approved`, `published`, `rejected`, `sold_out`
- 카테고리
- 점수
- 가격
- 반품등급 `확인필요`
- 검색어
- 정렬: 점수, 할인율, 최신, 가격

후보를 선택하면 반품등급, 반품가, 새상품가, 네이버 최저가, 재고, 파트너스 URL, 공개 메모, 관리자 메모를 수정할 수 있습니다.

관리자 상단 운영 대시보드에서는 다음을 확인할 수 있습니다.

- 검토 대기, 게시 중, 평균 점수, 수동 확인 필요 수
- 게시 상품 중 파트너스 URL 누락
- 최근 수집 결과
- 게시 적합, 수동 확인, 가격 관찰, 보류 우선 분포
- 점수, 할인율, 재고, 위험 플래그를 반영한 검토 우선순위
- 노출 → 상세 진입 → 구매 클릭 수익 퍼널
- 상품별 구매 클릭 수, CTA 전환율, 텔레그램 유입 수
- 게시 상품의 제휴 URL 누락과 CTA 준비 상태

## 11. 상품 게시 방법

관리자 후보 테이블에서:

- 승인: `approved`
- 게시: `published`, `is_published=true`
- 비공개: `approved`, `is_published=false`
- 거절: `rejected`
- 품절: `sold_out`

사용자 페이지에는 `published` 상태이면서 `is_published=true`인 상품만 표시됩니다.

상세 페이지에는 검수 신뢰도, 확인 필요 항목, 용도 적합도, 가격·재고 변동 기록, 위험 플래그, 수령 후 체크리스트, 비슷한 딜 추천이 함께 표시됩니다.
구매 버튼은 `쿠팡에서 가격 확인`으로 표시되며, 버튼 근처와 하단 고정 CTA에 제휴 안내가 함께 표시됩니다.

`/deals`는 공개 상품이 많아져도 탐색이 가능하도록 서버 사이드 필터와 페이지네이션을 제공합니다.

- 검색어, 카테고리, 반품등급, 검수 상태, 재고 상태
- 용도 필터: 사무·대학생, 게이밍, 작업·크리에이터, 휴대성, 가성비, 청소 자동화, 공기·필터, 장마·제습
- 가격대 필터: 30만원 이하, 70만원 이하, 120만원 이하, 120만원 이상
- 최소 점수, 최소 할인율, 최소/최대 가격
- 정렬: 점수, 용도 적합도, 할인율, 검수 신뢰도, 최신 게시, 가격 높음/낮음
- 빠른 프리셋: 80점 이상, 20% 이상 할인, 게시 적합, 확인필요, 재고 1개
- 결과 수, 평균 점수, 최대 할인율, 최저 판매가, 반품 확인 수
- 딜 레이더: 최고 점수, 최대 할인, 게시 적합 수, 강한 카테고리, 용도별 딜 수, 가격대별 딜 수

## 12. 텔레그램 발송 방법

`.env.local`에 아래 값을 넣습니다.

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NEXT_PUBLIC_SITE_URL=
```

관리자에서 게시된 상품을 선택한 뒤 텔레그램 미리보기를 확인하고 발송합니다. 텔레그램 메시지는 쿠팡 직링크가 아니라 `/deals/[id]?utm_source=telegram` 상세 페이지 링크를 사용하며, 발송 결과는 `telegram_logs`에 저장됩니다.

## 13. Vercel 배포 방법

1. GitHub 저장소에 프로젝트를 올립니다.
2. Vercel에서 Next.js 프로젝트로 Import합니다.
3. Environment Variables에 `.env.local`과 같은 값을 등록합니다.
4. Supabase SQL이 적용되어 있는지 확인합니다.
5. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 바꿉니다.

## 14. 운영 체크리스트

- 키워드별 최소/최대 가격이 현실적인지 확인
- `확인필요` 반품등급은 게시 전 보완
- 반품가, 재고, 파트너스 URL을 게시 직전 재확인
- 네이버 최저가가 없거나 오래된 경우 수동 확인
- 텔레그램 발송 전 상세 페이지 링크 확인
- 관리자 수익 퍼널에서 구매 클릭과 CTA 전환율 확인
- 제휴 URL이 없는 게시 상품은 `링크 확인필요`로 표시되는지 확인
- 운영 대시보드의 수동 확인 항목을 먼저 처리
- `product_snapshots`에서 가격·재고 변동이 잦은 상품 재검수
- 제휴 안내 문구가 상세와 구매 버튼 근처에 표시되는지 확인
- 고가 반품, FreeDOS, 배터리/필터/도킹 리스크 상품은 보수적으로 승인

## 15. 향후 개선 방향

- 소싱 실행을 Vercel Cron 또는 별도 워커로 예약
- 브랜드/모델명 정규화 테이블 추가
- 네이버 가격 히스토리 저장
- 관리자별 감사 로그
- 텔레그램 채널별 메시지 템플릿
- 재고/가격 변동 재검수 알림
- Supabase Storage 기반 이미지 캐싱
- 카테고리별 점수 가중치 튜닝 UI

## 16. 운영 스케줄러

ReturnPick은 Vercel Cron으로 반복 운영할 수 있습니다. `vercel.json`에는 두 개의 작업이 등록되어 있습니다.

- `/api/cron/sourcing`: 1시간마다 활성 키워드 기준으로 후보를 다시 수집하고 점수화합니다.
- `/api/cron/telegram-digest`: 매일 09:00 KST 기준으로 아직 텔레그램에 보낸 적 없는 게시 상품 중 점수 높은 상품을 발송합니다.

운영 환경변수:

```bash
CRON_SECRET=
CRON_USE_MOCK_FALLBACK=true
```

`CRON_SECRET`은 Vercel 프로젝트 환경변수에 16자 이상 랜덤 문자열로 설정합니다. Vercel Cron이 호출할 때 이 값이 `Authorization: Bearer ...` 헤더로 전달되며, API는 이 헤더가 맞을 때만 실행됩니다. 로컬 개발 환경에서는 `CRON_SECRET`이 없어도 테스트 호출이 가능합니다.

로컬 테스트:

```bash
curl http://localhost:3000/api/cron/sourcing
curl http://localhost:3000/api/cron/telegram-digest
```

텔레그램 다이제스트는 중복 발송을 피하기 위해 `telegram_logs`에서 이미 `sent` 처리된 상품을 제외합니다. `TELEGRAM_BOT_TOKEN` 또는 `TELEGRAM_CHAT_ID`가 없으면 실제 발송 대신 `API_NOT_CONFIGURED` 상태로 로그만 남습니다.
