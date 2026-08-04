# ReturnPick 리턴픽

ReturnPick은 반품 노트북, 모니터, 로봇청소기, 무선청소기, 공기청정기, 제습기 후보를 자동 수집하고 관리자가 승인한 상품만 게시하는 수익형 MVP입니다. 쿠팡 파트너스 API, 네이버 쇼핑 검색 API, 상품명 기반 스펙 파싱, 점수화 알고리즘을 조합해 후보 검토 시간을 줄이는 것이 목표입니다.

공개 유입은 `/guide/search/[slug]` 검색 의도별 구매 가이드로도 연결됩니다. `반품 노트북`, `갤럭시북`, `QHD 모니터`, `로봇청소기`처럼 실제 검색 문장에 맞춘 가이드에서 카테고리별 체크포인트와 FAQ를 먼저 제공하고, 검수·파트너스 링크 확인을 마친 상품만 같은 페이지에 동적으로 노출합니다. 상품이 없을 때 가격·재고·반품등급을 임의로 채우지 않는 정직한 빈 상태를 유지합니다.

검색 가이드에 공개 상품이 아직 없을 때는 실제 제휴 링크가 연결된 직접 검수 사례로 이어지는 브리지를 보여줍니다. 이 링크는 자동 구매 이동이 아니라 공개된 ReturnPick 상세를 먼저 거치며, 상세 페이지에서 쿠팡 파트너스 고지와 최신 가격·재고 확인 안내를 함께 제공합니다.

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
- `/picks` 검수 추천 허브: 승인용 직접 검수 콘텐츠와 실제 고객공개 상품을 한 곳에서 연결

`/compare`에서 `비교 링크 공유`를 누르면 공개 상품 UUID만 포함한 공유 비교 URL이 만들어집니다. 상품이 비공개되거나 만료되어 공개 목록에서 사라지면 공유 링크의 비교 결과에서 제외될 수 있습니다.

## 2. 이 프로젝트가 하지 않는 것

- 쿠팡 로그인/우회/대량 크롤링 없음
- robots.txt가 막는 공개 페이지 수집 없음
- 탐지 회피 없음
- 프록시 없음
- 캡차 우회 없음
- 비공식 내부 API 호출 없음

반품등급이나 반품 가격이 공식 API에서 제공되지 않으면 임의 생성하지 않고 `확인필요` 또는 `null`로 둡니다.

공개 웹 참고 수집은 기본값이 꺼져 있습니다. 사용할 때도 `robots.txt`를 확인하고, allowlist에 넣은 호스트만, 낮은 빈도로 요청합니다. 탐지 회피, 프록시, 캡차 우회, 로그인 우회는 넣지 않았습니다.

배포 응답 헤더도 같은 원칙을 따릅니다. 공개 페이지에는 referrer와 기본 보안 헤더를 적용하고, `/admin`과 `/api`에는 `X-Robots-Tag: noindex, nofollow, noarchive`와 `Cache-Control: no-store`를 붙여 관리자 화면과 운영 API가 검색 색인이나 캐시에 남지 않도록 했습니다.

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
NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL=
RETURNPICK_DEMO_MODE=
CRON_SECRET=
CRON_USE_MOCK_FALLBACK=false
PUBLIC_WEB_CRAWL_ENABLED=false
PUBLIC_WEB_ALLOWED_HOSTS=
PUBLIC_WEB_SEARCH_TEMPLATES=
```

운영 배포용 환경변수 초안은 아래 명령으로 만들 수 있습니다. 쿠팡, 네이버, Supabase, 텔레그램의 실제 키는 빈칸으로 남기고, `ADMIN_PASSWORD`와 `CRON_SECRET`만 로컬에서 새 랜덤 값으로 출력합니다.

```powershell
npm run env:production -- https://returnpick.vercel.app https://link.coupang.com/a/승인용코드
```

직접 Node로 실행할 때는 `node scripts/print-production-env-template.mjs --site https://returnpick.vercel.app --approval-url https://link.coupang.com/a/승인용코드`처럼 옵션형 인자도 사용할 수 있습니다. 출력된 `ADMIN_PASSWORD`와 `CRON_SECRET`은 Vercel에 붙여넣은 뒤 따로 보관하세요. 같은 출력의 `RETURNPICK_CRON_SECRET`과 `RETURNPICK_SITE_URL`은 GitHub Actions 1시간 스케줄러용 값입니다. 실제 API 키 값은 공식 대시보드에서 복사해 Vercel에 직접 넣고, 파일에 커밋하지 마세요.

API 키가 없어도 로컬에서는 31개의 검수 샘플 카탈로그, mock provider, 로컬 JSON 저장소로 UI를 확인할 수 있습니다. 이 샘플은 개발용 화면 확인용이며 실제 공개 상품이나 수익 상품 수를 뜻하지 않습니다. 개발 서버(`npm run dev`)에서는 `RETURNPICK_DEMO_MODE`를 비워도 데모 모드가 켜지며, `RETURNPICK_DEMO_MODE=false`로 비활성화할 수 있습니다. 데모 상품에는 실제 쿠팡 가격·재고·반품등급·파트너스 링크가 없고 구매 버튼도 비활성화됩니다. Production에서는 환경변수 값을 `true`로 넣어도 데모가 강제로 숨겨집니다. Supabase가 없을 때 생성·수정한 mock 데이터는 `.returnpick/local-db.json`에 저장됩니다.

주의: 로컬 개발에서는 `ADMIN_PASSWORD`를 비워도 mock UI 확인이 가능하지만, Vercel 배포 환경에서는 `ADMIN_PASSWORD`가 없으면 관리자 API가 `ADMIN_PASSWORD_NOT_CONFIGURED`로 닫힙니다. 운영 배포 전 반드시 관리자 비밀번호를 등록하세요.

브라우저 관리자 로그인은 `ADMIN_PASSWORD`를 한 번 확인한 뒤 8시간 동안 유효한 서명 세션을 `HttpOnly`, `Secure`, `SameSite=Strict` 쿠키로 발급합니다. 비밀번호는 localStorage에 저장하지 않으며, 예전 버전이 저장한 `returnpick_admin_password` 값도 관리자 화면 진입 시 삭제합니다. 운영 점검 CLI의 `x-admin-password` 헤더 방식은 자동화 호환용으로 계속 지원합니다.

직접 `vercel deploy`로 배포할 때도 로컬 `.env.production`, `.env.local`, `.returnpick` 개발 저장소, 빌드 산출물이 업로드되지 않도록 `.vercelignore`를 포함했습니다. 실제 운영 키는 Vercel Environment Variables에만 넣고, 로컬 env 파일은 점검용으로만 사용하세요.

운영 준비 기능이 로컬에만 있고 GitHub에는 빠지는 상황을 막기 위해 배포 전 아래 검사를 실행합니다. 핵심 운영 파일이 Git에 추적되는지, 작업트리가 깨끗한지, 현재 브랜치가 원격과 일치하는지 확인합니다. `deploy:production:launch`와 `deploy:production:go-live`도 이 검사를 가장 먼저 실행하고 실패하면 Vercel 배포를 시작하지 않습니다.

```powershell
npm run git:check
```

## 5. Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `sql/schema.sql`을 실행합니다.
3. 초기 키워드는 `sql/seed.sql`로 넣을 수 있습니다. 운영 DB가 완전히 비어 있어도 첫 소싱 실행 시 기본 키워드가 자동으로 한 번 주입됩니다.
4. 프로젝트 URL, anon key, service role key를 `.env.local`에 넣습니다.

관리자 API는 서버에서 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. 브라우저에 노출하지 마세요.

Vercel에 넣기 전 로컬에서 Supabase SQL 적용 상태만 직접 확인하려면 아래 명령을 사용합니다.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://프로젝트.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
npm run schema:production
```

Supabase SQL 적용 전에 로컬 `schema.sql`이 첫 가동에 필요한 테이블, RLS, 엄격한 쿠팡 파트너스 링크 검증 함수를 포함하는지 확인하고 적용 순서를 보고 싶으면 아래 명령을 사용합니다.

```powershell
npm run schema:setup
```

이 검사는 `returnpick_schema_meta`의 스키마 버전, 필수 테이블과 컬럼, `is_strict_coupang_partners_url` 함수, `sourcing_runs`와 `affiliate_events` 쓰기/정리 경로, anon 역할의 공개 컬럼 읽기와 내부 컬럼 차단을 확인합니다. anon key와 service role key는 화면에 마스킹해서 표시하고, 실제 값은 출력하지 않습니다.

`schema.sql`은 새로 공개되는 상품이 `https://link.coupang.com/a/짧은코드` 형태의 엄격한 쿠팡 파트너스 단축 링크 없이 `published` 상태가 되는 것을 DB 레벨에서도 막습니다. 테스트·샘플처럼 보이는 단축 코드는 서버와 DB 양쪽에서 거부합니다. 이 제약은 `not valid`로 추가되어 기존 레거시 데이터 때문에 SQL 적용이 중단되지는 않지만, 이후 새로 저장하거나 수정하는 공개 상품에는 바로 적용됩니다. 기존 문제 데이터는 `/admin` 실제 연결 테스트의 `공개 데이터 품질` 항목에서 찾아 정리하세요.

`schema.sql`은 `returnpick_schema_meta` 테이블에 `schema_version=2026-08-01-public-column-boundary` 표식도 기록합니다. `/admin`의 실제 연결 테스트는 이 값을 확인하므로, Supabase 테이블은 있어도 최신 SQL을 다시 적용하지 않은 경우 `Supabase 운영 DB` 카드에서 바로 드러납니다. `last_observed_at`은 자동 소싱이 상품을 다시 찾은 시각만 기록하며, 관리자 수정 시각과 섞이지 않습니다. 관리자 수동 후보는 자동 관측 시각을 부여하지 않으므로, 수동 입력만으로 `24시간 내 수집` 상태가 되지 않고 구매 전 쿠팡 페이지 재확인이 계속 표시됩니다. 다만 관리자가 상품별 링크·이미지·가격을 확인해 명시적으로 게시하면 `manual_catalog_review` 증거를 남기고, 승인 대기용 임시 카탈로그에는 그 수동 검토 시각을 사용합니다. 수동 검토 증거는 7일 뒤 만료되어 다시 게시 검토와 카탈로그 내보내기가 필요합니다.

또한 실제 연결 테스트는 Supabase RPC로 `is_strict_coupang_partners_url` 함수를 직접 호출해 정상 파트너스 단축 링크는 허용하고, 테스트 코드처럼 보이는 링크와 일반 쿠팡 상품 URL은 거부하는지 확인합니다. 버전 표식만 맞고 DB 함수가 빠졌거나 다르게 적용된 상태도 이 단계에서 막힙니다.

운영 데이터가 늘어날 때 공개 상품 목록, 관리자 검토 큐, 수집 실행 로그, 텔레그램 로그, 가격 스냅샷, 클릭 퍼널 지표가 느려지지 않도록 `schema.sql`에 전용 인덱스를 포함했습니다. 공개 역할에는 고객 화면용 상품·점수·가격 스냅샷 컬럼만 `select` 권한을 주고, `raw_json`, 관리자 메모, 거절 사유, 내부 로그는 서비스 역할에서만 읽도록 제한합니다. 이미 Supabase를 만들어 둔 경우 최신 `sql/schema.sql`을 다시 실행해 이 인덱스, 권한 경계, 스키마 버전 표식을 반영하세요.

## 6. 쿠팡 파트너스 API 설정

`.env.local`에 아래 값을 넣습니다.

```bash
COUPANG_ACCESS_KEY=
COUPANG_SECRET_KEY=
COUPANG_PARTNER_ID=
```

값이 없으면 `searchCoupangProducts`는 오류를 던지지 않고 `API_NOT_CONFIGURED`를 반환하며, 소싱 실행은 mock provider로 대체할 수 있습니다.

승인 대기 중에는 쿠팡 파트너스 웹에서 직접 만든 상품 링크를 `affiliate_url`에 수동 입력해 운영할 수 있습니다. 관리자 수동 후보 등록 화면에서도 실제 상품 상세 URL과 파트너스 단축 링크를 함께 입력할 수 있으며, 링크를 함께 저장해도 목적지 상품번호 확인 전에는 게시되지 않습니다. 초기 출시에는 상품별로 확인된 수동 링크와 Supabase 등 운영 필수 환경이면 충분하고, 쿠팡 파트너스 최종승인 후 위 3개 값을 Vercel Environment Variables에 넣으면 쿠팡 API 검색과 딥링크 보강을 자동화할 수 있습니다.

여러 상품을 한 번에 운영할 때는 `/admin`의 `상품별 파트너스 링크 보강`에서 링크를 붙여넣고 `미확인 링크 n건 확인`을 먼저 실행합니다. 이미 확인된 링크는 다시 검사하지 않고 다음 미확인 항목으로 넘어가며, 한 번에 최대 8건씩 처리합니다. 대상이 24개를 넘으면 큐의 `이전`·`다음` 페이지로 뒤쪽 후보까지 확인할 수 있습니다. 상품번호가 `MATCH` 또는 `MANUAL_CONFIRMED`로 확인된 항목만 `확인된 링크 n건 게시` 버튼에 포함되며, 게시 요청에서도 공개 품질 게이트를 다시 통과해야 합니다. 불일치 링크·승인용 샘플 링크·가격이나 이미지가 부족한 상품은 자동 게시되지 않습니다.

네이버 쇼핑 API가 아직 없거나 동일 SKU 자동 매칭이 실패한 경우에는 `/admin`의 `네이버 최저가 보강`에서 상품 ID, 직접 확인한 네이버 가격, 선택한 근거 URL과 상품명을 탭으로 입력할 수 있습니다. 저장된 수동 가격은 상품 fingerprint와 확인 시각에 묶여 가격 비교에 사용되며, 상품 식별을 직접 확인하지 않은 숫자는 입력하지 않아야 합니다.

쿠팡 API 호출은 공식 HMAC 방식으로 서명합니다. 쿼리스트링이 있는 검색 요청도 서명 메시지는 `signed-date + METHOD + path + query` 형식으로 만들며, `?` 문자는 포함하지 않습니다. 인증 실패가 나면 `/admin`의 실제 연결 테스트에서 Coupang 오류 메시지와 함께 드러나도록 했습니다.

응답 파서는 공식 응답의 camelCase 필드뿐 아니라 흔한 snake_case 변형과 `data.productData.products` 형태를 방어적으로 읽고, `1,299,000원`처럼 표시 형식이 붙은 가격도 숫자로 정규화합니다. 반품 등급·반품가는 응답에 근거가 없으면 계속 `확인필요` 또는 `null`로 둡니다.

Vercel에 쿠팡 키를 붙여넣을 때 생길 수 있는 앞뒤 공백은 Provider 단계에서 한 번 더 제거한 뒤 설정 여부 확인, HMAC 서명, `subId` 입력에 사용합니다. 그래도 `env:check:launch`는 공백이 섞인 값 자체를 운영 준비 실패로 보므로, 최종 등록값은 공식 화면에서 다시 복사해 깨끗하게 넣는 것이 좋습니다.

쿠팡 파트너스 안내처럼 최종승인 전에는 API 권한이 열리지 않을 수 있습니다. 이때 `/admin`의 실제 연결 테스트는 401/403, 권한 없음, 미승인류 응답을 `COUPANG_API_PERMISSION_OR_APPROVAL_REQUIRED`로 구분하고 “승인 후 API 메뉴에서 새 키를 발급해 Vercel에 등록”하라는 다음 행동을 표시합니다.

승인 후 점검 순서:

1. Vercel에 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, `COUPANG_PARTNER_ID`를 등록합니다.
2. Supabase 3개 값을 운영 환경에 등록합니다. `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`은 가격 비교를 바로 켤 때 함께 등록하는 선택 연동입니다.
3. 재배포 후 `/admin`의 `승인 후 운영 즉시 가동 준비` 패널에서 `실제 연결 테스트`를 실행합니다.
4. 쿠팡 연결 테스트는 상품 검색뿐 아니라 검색 결과 URL을 파트너스 딥링크로 바꿀 수 있는지도 함께 확인합니다.
5. Supabase 연결 테스트는 `sourcing_keywords`, `sourced_products`, `deal_scores`, `sourcing_runs`, `telegram_logs`, `affiliate_events`, `product_snapshots` 전체 테이블 접근과 최신 필수 컬럼 적용 여부를 확인합니다.
6. `자동 후보 수집`에서 `목업 대체 허용`을 끄고 실행하면 실제 API/허용 소스만으로 후보가 들어오는지 확인할 수 있습니다.

## 7. 네이버 쇼핑 API 설정

`.env.local`에 아래 값을 넣습니다.

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

값이 없으면 네이버 최저가는 mock 가격으로 채우지 않고 `null`로 둡니다.

네이버 API 키가 있으면 후보 수집 단계에서 `{키워드} 반품`과 일반 `{키워드}` 검색을 함께 수행합니다. 반품 문구가 있는 상품은 반품 후보로 처리하고, 반품 문구가 없는 상품도 가격 비교·스펙 분석 후보로 저장하되 등급과 반품가는 `확인필요`로 둡니다.

네이버 Client ID/Secret도 요청 헤더에 넣기 전에 앞뒤 공백을 제거합니다. 붙여넣기 실수로 생긴 줄 끝 공백 때문에 첫 가격 보강이 실패하지 않게 하기 위한 방어이며, launch 검증에서는 여전히 공백이 포함된 원본 값을 잘못된 설정으로 표시합니다.

승인 후 실제 연결 테스트에서 네이버가 401/403, 인증 실패, 권한 오류를 반환하면 관리자 화면은 `NAVER_API_CREDENTIAL_OR_PERMISSION_FAILED`로 구분하고 Client ID/Secret 재등록과 쇼핑 검색 API 활성화를 안내합니다. 호출 한도 문제는 `NAVER_API_RATE_LIMITED`로 분리해 키 문제와 운영 호출량 문제를 구분합니다.

## 7-1. 공개 웹 참고 수집 설정

공식 API로 부족한 반품 문구를 보조적으로 확인하려면 아래 값을 설정합니다.

```bash
PUBLIC_WEB_CRAWL_ENABLED=true
PUBLIC_WEB_ALLOWED_HOSTS=example.com
PUBLIC_WEB_SEARCH_TEMPLATES=https://example.com/search?q={keyword}
```

공개 웹 참고 수집을 켜기 전에는 아래 명령으로 allowlist, 검색 템플릿, robots.txt, Crawl-delay를 먼저 확인하세요. `PUBLIC_WEB_CRAWL_ENABLED=false`이면 실제 공개 웹 요청을 하지 않고 비활성 상태만 보여줍니다.

```powershell
npm run public-web:check
npm run public-web-detail:check
```

쿠팡 파트너스 API 권한이 아직 없어도, 공개웹 설정이 준비되고 Supabase 운영 저장소가 연결된 상태라면 `/admin`에서 `공개 웹 후보 수집`을 명시적으로 실행할 수 있습니다. 이 모드는 쿠팡 API 검색·딥링크·목업 대체를 사용하지 않고 allowlist와 robots.txt를 통과한 공개 페이지의 후보와 반품 근거만 `needs_review`로 저장합니다. 후보에는 파트너스 링크가 자동으로 생기지 않으므로, 게시 전 관리자 상품별 링크 검증이 반드시 필요합니다.

같은 조건을 만족하면 시간별 `/api/cron/sourcing`도 공개웹 전용 모드로 동작합니다. `PUBLIC_WEB_CRAWL_ENABLED=true` 자체가 명시적 옵트인이고, Supabase·사이트·관리자·Cron·공개웹 준비도가 모두 통과하지 않으면 스케줄러는 실행하지 않고 대기합니다. robots.txt 차단, 리다이렉트, HTML 크기, Crawl-delay 제한은 모든 실행에서 그대로 적용됩니다.

동작 원칙:

- `PUBLIC_WEB_ALLOWED_HOSTS`에 있는 호스트만 요청
- allowlist에는 `https://`나 경로가 아니라 `example.com`처럼 공개 호스트명만 입력
- 검색 템플릿은 `{keyword}`를 반드시 포함하고, 템플릿의 호스트가 allowlist와 일치해야 하며, 누락되면 provider 단계에서도 fetch 전에 `INVALID_TEMPLATE`로 차단
- 운영 폭주를 막기 위해 허용 호스트와 검색 템플릿은 각각 최대 5개까지만 허용
- provider 실행 단계에서도 localhost, 사설/개발용 호스트, 깨진 호스트명은 다시 거부
- 요청 전 `robots.txt` 확인
- `robots.txt`가 없거나 가져올 수 없으면 허용으로 간주하지 않고 `ROBOTS_UNAVAILABLE`로 건너뜀
- 검색 템플릿은 `http`/`https` URL만 허용하고, 계정정보가 포함된 URL이나 깨진 URL은 `INVALID_TEMPLATE`로 건너뜀
- `User-Agent: ReturnPickBot/0.1 (+https://배포주소/disclosure)`처럼 제휴 안내 주소가 포함된 식별자 사용
- 요청 사이에 지연을 둠
- robots.txt의 `Crawl-delay`를 읽어 요청 간격을 늘리고, 서버리스 수집에 너무 긴 지연이 필요한 호스트는 `CRAWL_DELAY_TOO_HIGH`로 건너뜀
- `text/html` 또는 `application/xhtml+xml` 응답만 읽고, HTML 본문은 페이지당 750KB, robots.txt는 250KB까지만 읽음
- 검색 URL이나 robots.txt가 리다이렉트하면 자동 추적하지 않고 `REDIRECT_BLOCKED`로 차단
- HTML에서 공개 링크 텍스트의 반품/리퍼/재포장 문구를 우선 참고하고, 반품 문구가 없는 상품형 링크도 가격·스펙 후보로 제한적으로 수집
- 반품 문구가 없는 후보는 `candidate_kind=product_without_return_evidence`로 구분하며 `condition_grade=확인필요`, `return_price=null`을 유지합니다. `판매가`·`할인가`·`정가`처럼 명시적으로 라벨된 일반 가격은 가격·스펙 검수 후보의 `source_price`로 사용할 수 있지만, 반품등급과 반품가는 명시적 근거가 있을 때까지 `확인필요` 또는 `null`로 남깁니다. JSON-LD `Product`는 공개 `offers` 가격이 있을 때만 같은 방식으로 후보화합니다.
- 상세 페이지에 본 상품의 일반 가격처럼 서로 다른 라벨 가격이 여러 개 있으면 어느 가격이 본 상품인지 자동 판단하지 않고 상세 가격 보강을 보류합니다. 검색 결과에서 이미 확인된 `source_price`는 유지하고, 기존 가격이 없을 때만 `source_price=null`로 남겨 관리자가 본 상품 가격을 확인한 뒤 보완해야 합니다. 추천·연관상품 영역의 가격은 본 상품 가격 후보에서 제외합니다.
- 검색 결과에서 발견한 allowlist 상품 링크 중 최대 3개의 상세 페이지를 추가로 확인해 상세에만 있는 반품등급·반품가·재고 문구를 보강
- 상세 페이지를 읽을 때도 같은 `robots.txt`, allowlist, Crawl-delay, 수동 리다이렉트 차단, 750KB 본문 제한을 다시 적용
- 상세 페이지에서 반품 근거를 찾지 못하면 기존 값이나 `확인필요`를 유지하고 숫자를 추정하지 않으며, 보강 근거는 `raw_json.web_return_info.detail_page`에 남김
- 고객 화면과 관리자 검토 화면의 `근거 페이지 확인` 링크는 공개 웹 참고 문구의 출처를 보여주는 보조 단서이며, 반품등급·반품가의 최종 기준은 쿠팡 상품 페이지입니다
- HTML에서 발견한 상품 후보 링크도 `http://` 또는 `https://` 공개 호스트 URL만 저장하고, `javascript:`, `mailto:`, 인증정보가 들어간 URL, localhost/private 형태의 URL은 후보에서 제외
- 반품등급과 반품가는 근거가 있을 때만 저장
- robots.txt가 막으면 `ROBOTS_DISALLOWED`로 기록하고 건너뜀

현재 확인한 [쿠팡 robots.txt](https://www.coupang.com/robots.txt)는 일부 명시된 검색엔진 User-agent에만 상품·검색 경로를 허용하고, `User-agent: *`에는 전체 경로를 차단합니다. `ReturnPickBot`으로 쿠팡 공개 페이지를 allowlist에 넣어 수집하지 않습니다. 쿠팡 상품 후보와 파트너스 링크는 공식 Partners API 권한 또는 관리자가 직접 확인한 상품별 링크를 사용하세요.

`PUBLIC_WEB_CRAWL_ENABLED=true`로 켠 경우 `/admin`의 실제 연결 테스트에 `공개 웹 참고 수집` 카드가 추가됩니다. 이 카드는 allowlist, 검색 템플릿 개수 제한, robots.txt, HTML 응답 경로를 작은 샘플 키워드로 확인하고, 호스트/템플릿이 너무 많거나 robots.txt가 없거나 막는 경우 첫 가동 전에 오류로 보여줍니다. 기본값이 `false`이면 같은 카드는 `skipped`로 남고 첫 가동 필수 조건에는 포함하지 않습니다.

## 7-2. 승인 후 파트너스 링크 빠른 등록

쿠팡 파트너스 최종 승인 후 상품별 파트너스 단축 링크를 여러 개 확보했다면 `/admin`의 `파트너스 링크 등록`에서 빠르게 후보를 만들 수 있습니다. 단건 입력 또는 여러 줄 일괄 입력을 사용할 수 있으며, 일괄 입력은 한 줄에 `상품명`, 카테고리 키(`laptop`, `monitor` 등), `https://link.coupang.com/a/...` 링크, 일반 쿠팡 상품 URL을 탭으로 구분해 최대 40개까지 붙여넣을 수 있습니다. 화면이 8개씩 순차 요청하므로 각 서버 요청의 검증·본문·동시성 제한은 그대로 유지됩니다. 필요하면 공개 이미지 URL과 메모도 뒤에 붙일 수 있습니다.

서버는 파트너스 링크의 쿠팡 상품번호와 입력한 상품 URL의 상품번호를 확인합니다. 링크 목적지가 확인되지 않거나 서로 다른 상품이면 저장하지 않습니다. 쿠팡 응답이 401/403/405/429로 제한된 경우에도 관리자가 제공한 상품 URL을 `needs_review` 후보로만 저장하며, 링크 확인 전에는 게시하지 않습니다.

이 흐름은 가격, 반품가, 반품등급, 재고를 추정하지 않습니다. 저장 후에는 링크 보강 큐에서 목적지 확인을 완료하고, 가격·이미지·반품 근거를 보완한 다음 승인/게시하세요. 승인용 샘플 링크는 실제 딜 후보에 재사용할 수 없습니다.

```bash
npm run affiliate-link-intake:check
npm run affiliate-link-intake-bulk:check
```

## 7-3. Supabase 전 수동 임시 카탈로그

쿠팡 파트너스 승인 직후 실제 상품별 링크를 확보했지만 Supabase를 아직 연결하지 못한 경우, `/admin`의 `승인 전 출시 카탈로그`에서 `Supabase 전 임시 입력`을 사용할 수 있습니다. `열 순서 복사`로 아래 TSV 열을 복사한 뒤, 관리자가 직접 확인한 상품만 한 줄씩 붙여넣습니다.

```text
상품명	카테고리	쿠팡 상품 URL	상품별 파트너스 링크	브랜드	모델명	이미지 URL	수집 당시 가격	반품가	새상품가	네이버 최저가	반품등급	재고 수량	공개 메모
```

각 행에는 정확한 `https://www.coupang.com/vp/products/{상품번호}` URL, 해당 상품으로 연결되는 `https://link.coupang.com/a/{상품별코드}` 링크, 쿠팡·네이버 상품 이미지 CDN의 공개 HTTPS 이미지 URL, 직접 확인한 가격 중 하나 이상이 필요합니다. 파트너스 링크를 브라우저에서 열어 상품 URL과 같은 상품인지 확인한 뒤 확인 체크박스를 선택하세요. 승인용 샘플 링크, 가짜 링크, 임의로 추정한 반품가·재고는 입력하지 않습니다. 한 번에 최대 20개까지 입력할 수 있지만, 환경변수 용량 때문에 일부만 들어가는 경우에는 부분 카탈로그를 만들지 않고 전체를 거부합니다.

`수동 공개 스냅샷 만들기`가 반환한 `RETURNPICK_BOOTSTRAP_CATALOG_JSON` Key와 Value를 Vercel **Production** 환경변수에 넣고 새 배포를 만들어야 공개 페이지에 반영됩니다. 이 값은 임시 공개 상품 보존용이라 관리자 수정, 클릭 집계, 자동 소싱, 텔레그램 발송 기록을 대체하지 않으며, 지속 운영 전에는 `sql/schema.sql`을 적용한 Supabase 연결이 필요합니다. 수동 공개 검토 시각은 7일 후 만료되므로 가격·재고·파트너스 목적지를 다시 확인하고 카탈로그를 재생성하세요.

관리자 준비도에서 `제한 공개 가능`이 표시되면 사이트·승인용 링크·관리자 보호값과 검수된 부트스트랩 카탈로그가 준비된 상태입니다. 이때는 상품별 파트너스 링크와 공개 검수를 통과한 상품만 제한적으로 공개할 수 있지만, 자동 후보 수집·상품 수정의 영구 저장·클릭 이벤트 집계·시간별 스케줄러는 계속 잠깁니다. Supabase 연결만으로 자동 운영이 열리는 것은 아니며, `sql/schema.sql` 적용, 세 가지 Supabase 환경변수와 `CRON_SECRET` 연결, 실제 핵심 연결 테스트, Production 첫 가동 확인까지 통과한 뒤 정식 자동 운영을 시작하세요.

수동 임시 카탈로그 입력 검증은 다음 명령으로 확인할 수 있습니다.

```bash
npm run manual-bootstrap:check
npm run manual-bootstrap:runtime:check
```

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

쿠팡 API 없이 공개웹 후보만 수집하려면 공개웹 설정과 운영 저장소가 준비된 뒤 다음처럼 모드를 명시합니다. 반환된 후보는 자동 게시되지 않으며, 반품 근거·상품 식별자·파트너스 링크를 관리자가 확인해야 합니다.

```bash
curl -X POST http://localhost:3000/api/admin/sourcing/run \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d "{\"sourceMode\":\"public_web_only\",\"useMockFallback\":false,\"keywordLimit\":6}"
```

활성화된 `sourcing_keywords`를 읽고, 쿠팡 파트너스 API, 네이버 쇼핑 반품 후보, 공개 웹 참고 수집, mock provider 순서로 후보를 수집한 뒤 스펙 파싱, 네이버 최저가 보완, 점수화를 수행합니다.

후보별 네이버 가격 검증과 쿠팡 파트너스 링크 보강은 기본적으로 동시에 2건만 처리합니다. `SOURCING_ENRICHMENT_CONCURRENCY`를 `1`~`4`로 설정하면 승인 후 응답이 안정적인 운영에서 처리량을 조정할 수 있으며, 서버는 4를 초과하는 값을 허용하지 않습니다. 한 후보의 가격·링크·점수 저장이 실패해도 다른 후보는 계속 처리하고, 해당 상품의 오류만 실행 로그에 남겨 제한된 실행 시간 안에 더 많은 후보를 검토 대기로 쌓습니다.

공개 웹 참고 수집을 명시적으로 켠 경우에는 쿠팡·네이버 검색이 이미 상품을 찾았더라도 robots.txt, allowlist, Crawl-delay 검사를 통과한 공개 웹 반품 후보를 보조 공급원으로 함께 수집합니다. 동일 출처 상품 ID 또는 카테고리와 정규화 상품명이 정확히 같은 후보만 중복으로 합치고, 이때 명시적인 반품가·등급 근거가 있는 레코드를 우선합니다. 일반 API 상품이 있다는 이유만으로 공개 웹 반품 후보를 건너뛰지 않으며, 반품 근거가 없는 값은 계속 `확인필요`로 남깁니다. 페이지에 일반 판매가만 있고 반품가 라벨이나 반품등급에 연결된 가격이 없으면 그 숫자를 반품가로 추정하지 않습니다.

허용된 검색 페이지가 링크 카드 대신 `application/ld+json`의 `Product` 구조화 데이터를 제공하는 경우에도 상품명·설명·SKU·공개 가격과 반품 표현을 보조적으로 읽습니다. JSON-LD에 반품·리퍼·재포장 근거가 없어도 공개된 `offers` 가격이 있으면 가격·스펙 검수 후보로 만들 수 있으며, 그 가격은 `source_price`에만 저장하고 반품가나 `new_price`로 임의 변환하지 않습니다.

자동 후보 수집 패널은 실행 중, 성공, 부분 오류, API 오류, 네트워크 오류를 상태 메시지로 구분해 보여줍니다. 서버 쪽 수집 실행 API도 예외가 나면 HTML 오류 페이지 대신 `SOURCING_RUN_FAILED` JSON과 짧은 원인 메시지를 반환하므로, 승인 후 첫 실행에서 막힌 이유를 관리자 화면에서 바로 확인할 수 있습니다.

후보 상품 저장이나 갱신이 끝난 뒤 점수 저장만 실패한 경우에는 저장된 상품을 실패로 되돌리지 않습니다. 해당 후보는 `inserted_count` 또는 `updated_count`에 반영하고, 점수 저장 실패만 `product_score_error`로 실행 로그에 남깁니다. 그래서 첫 가동 결과에서 실제 후보 저장 신호가 사라지지 않습니다.

상품 저장 뒤 가격·재고 스냅샷 기록이 실패해도 상품 저장 자체는 유지합니다. 이 경우 서버 로그에 `PRODUCT_SNAPSHOT_SAVE_FAILED`로 남기고, 운영자는 다음 실행이나 수동 수정으로 스냅샷을 다시 쌓을 수 있습니다.

최근 실행 표는 각 실행마다 공급원별 `통과/원천` 요약과 진단 문구를 같이 보여줍니다. 예를 들어 쿠팡·네이버·공개 웹 중 어디에서 후보가 들어왔는지, 가격 필터로 몇 개가 제외됐는지, robots.txt 확인 실패나 공개 웹 템플릿 오류가 있었는지를 목록에서 바로 확인할 수 있습니다. 쿠팡이나 네이버 같은 공급원 자체가 실패한 경우에는 `공급원 오류` 건수와 실패 공급원명이 따로 표시되어, 후보가 들어온 소스와 실패한 소스를 한 화면에서 분리해 볼 수 있습니다.

공개 웹 참고 수집은 실행 로그의 `provider_meta.public_web_diagnostics`에 allowlist/robots/content-type/redirect/HTML 추출 결과를 최대 12건까지 남깁니다. 그래서 공개 웹을 켰는데 후보가 0개인 경우에도 `ROBOTS_DISALLOWED`, `ROBOTS_UNAVAILABLE`, `FETCHED_HTML`, `UNSUPPORTED_CONTENT_TYPE`, `CONTENT_TOO_LARGE`, `REDIRECT_BLOCKED`, `CRAWL_DELAY_TOO_HIGH` 중 어디서 막혔는지 확인하고 템플릿이나 allowlist를 조정할 수 있습니다.

운영 DB의 `sourcing_keywords`가 비어 있거나 기본 키워드가 일부 빠져 있으면 첫 소싱 실행에서 노트북·모니터·로봇청소기·무선청소기·공기청정기·제습기용 기본 키워드 55개를 부족한 만큼만 자동 보강합니다. 기존 키워드의 활성 상태·가격 조건은 덮어쓰지 않으며, 운영자가 추가한 키워드도 유지합니다. 현재 범위는 `/admin` 자동 후보 수집 카드와 `npm run sourcing:keywords:check`에서 확인할 수 있습니다.

`sourcing_keywords`는 정리된 키워드값과 카테고리 조합으로 중복을 막습니다. 같은 카테고리에 같은 키워드를 다시 추가하면 새 행을 늘리지 않고 기존 키워드를 재사용합니다.

키워드 관리 API는 첫 수집을 망치는 잘못된 조건을 먼저 거부합니다. 키워드는 2~80자여야 하고, 최소/최대 가격은 0 이상의 정수이며, 최소가가 최대가보다 클 수 없습니다. 최소 할인율은 `0.12`처럼 비율로 넣거나 `12%`처럼 퍼센트로 넣을 수 있습니다. 관리자 키워드 화면은 저장 성공, 검증 실패, 네트워크 오류를 바로 표시합니다.

쿠팡 API가 상품 URL만 반환하고 단축 파트너스 링크를 바로 주지 않는 경우에는 `createCoupangDeeplink`로 딥링크 생성을 시도해 `affiliate_url`에 저장합니다. 딥링크 생성이 실패해도 후보 자체는 저장하고, `raw_json.coupang_deeplink`에 상태를 남겨 관리자가 원인을 확인할 수 있게 합니다.

딥링크 API 응답도 최종적으로 `https://link.coupang.com/a/...` 형태의 파트너스 단축 링크인지 한 번 더 검증합니다. Coupang API가 일반 상품 URL이나 landing URL만 돌려주면 `affiliate_url`로 저장하지 않고 `COUPANG_DEEPLINK_NO_PARTNERS_URL` 진단을 남겨, API 키 입력 후에도 수익 추적이 안 되는 링크가 조용히 게시되는 일을 막습니다.

쿠팡 검색 API 응답 구조가 계정 상태나 API 버전에 따라 달라져도 후보별 `raw_json.coupang_provider_parse`에 사용한 배열 경로, 파싱된 원천 상품 수, 상품명·가격·상품 URL·이미지·파트너스 URL로 읽은 필드명을 남깁니다. 승인 직후 검색은 되는데 후보가 이상하게 저장되는 경우에도 원본 응답의 어느 필드를 썼는지 관리자 로그에서 바로 추적할 수 있습니다.

`/admin`의 실제 연결 테스트도 후보 저장 전 단계에서 쿠팡 검색 응답의 `provider_path`, `response_array_path`, `raw_product_count`, `normalized_product_count`, 샘플 상품 URL 필드, 검색 응답 내 파트너스 링크 사용 가능 여부를 보여줍니다. 검색은 OK인데 상품 배열이 비었거나 상품 URL을 못 찾아 딥링크 생성이 막히면 카드의 `operator_next_action`에 다음 조치가 표시됩니다.

쿠팡 검색 API가 일시 오류나 권한 오류를 반환한 키워드는 그 오류를 `provider_error`와 `provider_issues`로 로그에 남긴 뒤, 네이버 쇼핑 후보 수집과 공개 웹 참고 수집처럼 허용된 보조 소스를 계속 시도합니다. 그래서 승인 직후 한 공급원이 막혀도 전체 키워드가 조용히 0건으로 끝나지 않고, 운영자는 후보가 들어온 소스와 실패한 공급원을 같은 실행 로그에서 구분할 수 있습니다. 공급원 오류만 있었고 보조 소스로 후보를 확보한 실행은 빨간 실패가 아니라 경고로 표시해, 실제 후보 검토를 이어가도 되는 상태임을 구분합니다. 운영 배포에서 API 키가 준비된 뒤에는 목업 대체는 여전히 차단됩니다.

네이버 최저가는 긴 상품명 한 번으로만 찾지 않고 브랜드, 모델명, 스펙, 정리된 상품명 조합을 최대 5개까지 시도합니다. 가격이 가장 싼 결과를 바로 채택하지 않고 모델코드, 브랜드, 카테고리, 노트북 RAM·SSD·CPU·GPU, 모니터 크기·해상도·주사율, 공기청정기 사용면적, 제습기 용량이 같은 SKU인지 먼저 판정합니다. 다른 모델·용량, 다중 옵션 상품, 액세서리·소모품, 식별 근거가 부족한 결과는 기준가에서 제외하고 값을 `null`로 유지합니다. 선택된 검색어, 네이버 상품명·URL·브랜드·카테고리, SKU 일치 등급과 근거, 제외 사유별 후보 수는 `raw_json.naver_price_lookup` 또는 `raw_json.naver_price_backfill`에 남겨서 관리자가 가격 기준을 검토할 수 있습니다.

네이버 쇼핑 검색 Provider는 응답별 `api_total`, `raw_item_count`, `normalized_item_count`, `priced_item_count`를 함께 반환합니다. `/admin`의 실제 연결 테스트도 테스트 검색어, Naver API 총 검색 수, 가격 필드가 있는 항목 수, 샘플 상품명과 쇼핑몰명을 보여주므로, API는 응답했지만 최저가가 비는 경우 검색어 문제인지 가격 필드 문제인지 첫 가동 전에 구분할 수 있습니다.

자동 재수집은 이미 `approved` 또는 `published`인 상품의 게시 상태를 임의로 낮추지 않습니다. 가격, 재고, 네이버 최저가, 반품등급 같은 관찰값만 갱신하고, 변동 내역은 `product_snapshots`에 기록합니다.

홈과 `/picks`의 `최근 검증된 상품` 피드, `/deals?sort=latest`의 `최근 검증순` 정렬은 관리자 수정 시각을 자동 수집 시각으로 오인하지 않도록 운영 출처를 분리합니다. 소싱·네이버 재검증으로 생성된 스냅샷에는 `raw_json.observation_origin=sourcing`을 남기고, 관리자 수정은 `admin`, 수동 후보 등록은 `manual`로 기록합니다. 따라서 실제 관찰 시각이 없는 수동 상품이나 데모 상품은 최근 검증 피드에 섞이지 않습니다. 이 계약은 아래 명령으로 독립 검증할 수 있습니다.

```bash
npm run discovery-updates:check
```

사이트의 구매 전환은 강제 이동이나 숨은 리다이렉트가 아니라 사용자가 명확히 누른 `쿠팡에서 가격 확인` 버튼으로만 발생합니다. 클릭 이벤트는 `affiliate_events`에 익명 세션 기준으로 저장하며, IP나 개인정보는 저장하지 않습니다. 유입 referrer는 출처 분석에 필요한 origin/path만 저장하고 쿼리스트링과 해시는 제거합니다. `channel`과 `utm_source`는 영문/숫자/점/하이픈/언더스코어 라벨만 저장하고, 익명 세션은 브라우저가 만든 UUID 형식만 받습니다. 서버 이벤트 API는 공개 상품 여부뿐 아니라 실제 상품별 쿠팡 파트너스 링크도 다시 확인한 뒤 `affiliate_click`을 저장하므로 클라이언트가 임의로 구매 클릭을 부풀릴 수 없습니다. 관리자 수익 화면은 구매 클릭뿐 아니라 `share_copy`도 함께 보여줘 상세 방문 후 공유만 일어나는 콘텐츠를 후속 검수 대상으로 찾을 수 있습니다. 브라우저가 localStorage나 sendBeacon을 막아도 추적만 조용히 실패하고 쿠팡 이동은 계속 진행되도록 구성했습니다. `sendBeacon`이 큐에 넣지 못한 경우에는 `keepalive` fetch로 한 번 더 시도하지만, 이 실패도 구매 이동을 막지 않습니다.

상세 페이지의 구매 버튼은 위치별로 `web_detail_hero`, `web_detail_decision`, `web_detail_price`, `web_detail_sidebar`, `web_detail_mobile_sticky` 같은 안전한 `channel` 라벨을 붙여 기록합니다. 텔레그램 유입이면 같은 위치에 `telegram_` 접두가 붙습니다. `telegram_detail_click`은 현재 상세 페이지 URL에 `utm_source=telegram`이 직접 붙어 들어온 경우에만 기록하고, 이후 둘러본 다른 딜은 일반 `detail_view`로 세되 저장된 UTM은 구매 클릭 attribution에만 남깁니다. 관리자 수익 퍼널은 `channel`을 `CTA 위치별 클릭`으로, `utm_source`를 `유입 채널별 전환`으로, `context`를 승인 샘플·편집 추천 같은 콘텐츠별 전환으로 분리해 보여줍니다. 따라서 네이버 블로그·텔레그램·직접 방문 중 어느 유입이 쿠팡 클릭으로 이어졌는지, 어떤 버튼 배치와 콘텐츠가 클릭을 만들었는지를 섞지 않고 판단할 수 있습니다. 원시 이벤트 수와 별도로 `anon_session_id`를 기준으로 중복을 합친 고유 상세 방문 세션·고유 구매 클릭 세션·세션 전환율도 제공해, 한 사람이 여러 번 눌렀다고 전환이 부풀려지는 일을 줄입니다. 세션 ID가 없는 레거시 이벤트는 원시 수에는 포함하되 고유 세션 수에는 억지로 포함하지 않습니다.

`check:readiness`는 공개 상세, 구매 판단 패널, 비교함, 제휴 고지, 쿠팡 CTA 헬퍼의 핵심 문구가 깨진 한글로 바뀌지 않았는지도 확인합니다. 구매 버튼 근처 문구가 깨지면 고객 신뢰와 쿠팡 이동률이 바로 떨어지므로, 배포 전 readiness에서 `public purchase copy readable Korean` 항목이 통과하는지 확인하세요.

## 9-1. 승인 전/승인 후 준비도 점검

배포 전에는 아래 명령으로 구조, SQL, Cron, 환경변수 누락을 한 번에 확인합니다.

```bash
npm run check:readiness
```

배포 전 정적 점검은 아래 명령으로 실행합니다. Next 16에서는 `next lint` 대신 프로젝트의 `eslint.config.mjs` 기반 ESLint를 사용하며, 현재 큰 리팩터가 필요한 규칙은 경고로 남겨 명령 자체가 운영 전 검증 흐름을 막지 않게 했습니다.

```bash
npm run lint
```

후보 점수화 규칙만 별도로 확인하려면 아래 명령을 사용합니다. 가격 점수 구간, 반품등급 점수, `확인필요`/반품가 누락/네이버보다 비싼 상품의 강제 판정 제한, 위험 플래그, 소싱 후 `deal_scores` 저장 연결이 빠지면 실패합니다.

```bash
npm run scoring:check
```

승인 대기 모드에서는 쿠팡/네이버/Supabase 키 누락이 경고로 표시됩니다. 수동 파트너스 링크와 mock fallback으로 사이트를 계속 운영할 수 있다는 뜻입니다.

최종승인 후 API 키를 넣고 실제 운영 모드로 전환할 때는 아래 명령을 사용합니다.

```bash
npm run check:launch
```

Vercel에 환경변수를 넣고 재배포한 뒤에는 로컬 소스 검사만으로 충분하지 않습니다. 운영 주소가 실제로 새 환경변수를 읽는지, 승인용 페이지와 관리자 readiness API가 같은 상태를 보는지 아래 명령으로 한 번 더 확인하세요.

```powershell
npm run env:vercel:launch
```

위 명령은 아래 세 단계를 한 번에 실행합니다.

```powershell
npm run env:pull:production
npm run env:vercel
npm run env:check:launch
```

`env:pull:production`은 Vercel Production 값을 `.env.production`으로 내려받습니다. 이 파일은 Git과 Vercel 업로드에서 제외되어 있으며, 점검용으로만 사용합니다. `env:vercel`은 Vercel Production의 핵심 출시 변수 이름과 권장 선택 기능 이름을 분리해서 확인합니다. Vercel CLI가 값은 `Encrypted` 또는 `[SENSITIVE]`로 숨기므로 실제 비밀값은 출력하지 않습니다. `env:check`는 마스킹된 값을 형식 오류로 오판하지 않고 "Vercel env pull masks this secret locally" 경고로 표시하므로, 실제 운영 준비 여부는 배포된 `/admin`의 API readiness 또는 `doctor:production` 라이브 점검으로 확인합니다. `.env.production`, `.env.local`, `.env`를 읽어 비밀값을 출력하지 않고 누락·빈 값·형식 오류만 보여줍니다. 승인 전에는 쿠팡·네이버·Supabase·텔레그램 키 누락이 경고로 남을 수 있고, `env:vercel:launch` 또는 `env:check:launch`는 승인용 링크·Supabase·관리자·Cron 같은 핵심 출시 값이 없거나 형식이 틀리면 실패합니다. 쿠팡 API 키는 자동화 선택 기능으로 별도 경고를 남기며, 네이버와 텔레그램 누락도 핵심 출시 검사를 실패시키지 않습니다.

`env:check:launch`가 실패하면 `Next action checklist`가 함께 출력됩니다. 이 목록은 Vercel Production에 채워야 할 핵심 변수와 네이버·텔레그램 선택 기능을 분리해서 보여주며, 값 자체는 출력하지 않습니다. 핵심 목록을 채운 뒤 재배포하고 `npm run env:vercel:launch`와 `npm run doctor:production:launch` 순서로 다시 확인하세요. Vercel에 값을 막 넣은 직후라면 로컬 `.env.production`이 낡았을 수 있으므로 `npm run doctor:production:launch:fresh`를 쓰면 Production 값을 다시 내려받은 뒤 같은 점검을 이어서 실행합니다.

사람이 바로 따라 할 수 있는 복구 순서만 따로 보고 싶으면 아래 명령을 사용합니다. 이 명령은 `.env.production`, `.env.local`, `.env`의 현재 상태를 읽어 Vercel Production에 채워야 할 변수 이름, 안전한 운영 기본값, 재배포 후 재검증 순서를 출력하며 비밀번호나 API 키 값은 출력하지 않습니다.

```powershell
npm run env:repair
```

This repair plan also prints the external hourly scheduler checklist: set GitHub Repository secret `RETURNPICK_CRON_SECRET` to the same value as Vercel `CRON_SECRET`, set Repository variable `RETURNPICK_SITE_URL` to the public site URL, then manually run `ReturnPick Hourly Scheduler` and confirm `/api/cron/sourcing` plus `/api/cron/telegram-digest?limit=1` succeed.

```bash
RETURNPICK_ADMIN_PASSWORD=운영관리자비밀번호 npm run check:production
RETURNPICK_ADMIN_PASSWORD=운영관리자비밀번호 npm run check:production:launch
```

Windows PowerShell에서는 아래처럼 실행합니다.

```powershell
$env:RETURNPICK_ADMIN_PASSWORD="운영관리자비밀번호"
npm run check:production
npm run check:production:launch
```

승인 후 전체 상태를 한 번에 훑으려면 production doctor를 사용합니다. doctor는 먼저 `env:check`를 실행한 뒤 공개 웹 참고 수집 설정, Supabase 스키마, 공개 승인 페이지와 운영 준비 상태, 첫 가동 예비 점검, 소싱 복구 진단을 이어서 확인합니다. report 모드는 Supabase 라이브 스키마 환경변수가 없으면 경고만 내고, 공개 승인 페이지·운영 준비 상태·소싱 진단을 계속 확인합니다.

```powershell
$env:RETURNPICK_ADMIN_PASSWORD="운영관리자비밀번호"
npm run doctor:production
```

`doctor:production`과 `doctor:production:launch`는 결과 마지막에 `Next command checklist`를 출력합니다. 승인 후 Vercel 값을 막 넣은 경우에는 `doctor:production:launch:fresh`, 누락 환경변수 이름만 보고 싶을 때는 `env:repair`, 점검 통과 후 배포는 `deploy:production:launch -- confirm`, 배포와 첫 실데이터 가동을 한 번에 이어갈 때는 `deploy:production:go-live -- confirm` 순서가 표시됩니다. 이 안내도 `confirm`이 없으면 배포나 데이터 작업을 시작하지 않는 가드 흐름을 기준으로 합니다.

`doctor:production`도 운영 배포 확인용 명령이므로 `--site`, `RETURNPICK_SITE_URL`, `NEXT_PUBLIC_SITE_URL`이 외부에서 접근 가능한 `https://...`가 아니면 라이브 점검을 중단합니다. `localhost`, `127.0.0.1`, `.local`, `http://...` 주소로는 공개 readiness나 첫 가동 예비 점검을 계속하지 않습니다.

Vercel Production 환경변수를 수정한 직후에는 아래 명령을 쓰면 `vercel env pull`로 최신 값을 먼저 내려받고, 변수 이름 확인까지 한 뒤 doctor를 실행합니다.

```powershell
npm run doctor:production:fresh
```

Supabase SQL을 적용하고 승인용 상품별 파트너스 링크를 준비한 뒤에는 launch 모드로 환경값 형식, 공개 웹 설정, DB 스키마, 운영 readiness, 첫 가동 예비 점검, 소싱 복구 진단을 한 번에 확인합니다. 쿠팡 API 키는 자동 후보 수집과 딥링크 보강을 위한 선택 기능이며, 네이버와 텔레그램도 설정된 경우 같은 진단에서 확인하지만 누락만으로 수동 링크 기반 핵심 출시를 막지 않습니다. 이 명령은 실제 소싱이나 발송을 시작하지 않으며, 통과 후 `npm run launch:production -- standard confirm`을 따로 실행해야 첫 가동이 시작됩니다. launch 모드에서 핵심 환경값 프리플라이트가 실패하면 DB/API 라이브 점검은 시작하지 않고 뒤 단계는 `SKIP`으로 남깁니다.

```powershell
$env:RETURNPICK_ADMIN_PASSWORD="운영관리자비밀번호"
$env:NEXT_PUBLIC_SUPABASE_URL="https://프로젝트.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
npm run doctor:production:launch
```

Vercel에 API 키와 Supabase 값을 넣고 재배포한 뒤에는 아래 명령이 가장 안전합니다. 이 명령은 Vercel Production 값을 다시 내려받고, 변수 이름과 값 형식을 확인한 뒤 launch doctor를 실행합니다.

```powershell
npm run doctor:production:launch:fresh
```

Vercel 환경변수 입력 후 재배포까지 한 번에 진행하려면 아래 배포 가드를 사용합니다. `confirm`을 붙이지 않으면 최신 Production env를 내려받고 이름/값 형식만 확인한 뒤 멈춥니다. 검토 후 `confirm`을 붙이면 Vercel production 배포를 실행하고, 배포 직후 다시 launch doctor를 돌립니다. 이 명령도 실제 소싱이나 텔레그램 발송은 시작하지 않습니다.

```powershell
npm run deploy:production:launch
npm run deploy:production:launch -- confirm
```

배포 직후 첫 후보 수집·링크 보강·가격 보강까지 이어서 실행하려면 `go-live` 명령을 사용합니다. 이 경우에도 env 값 검사와 launch doctor가 먼저 통과해야 하며, `confirm`이 없으면 실제 배포나 데이터 작업은 시작하지 않습니다.

```powershell
npm run deploy:production:go-live
npm run deploy:production:go-live -- confirm
```

같은 순서는 `/admin`의 `승인 후 운영 즉시 가동 준비` 패널에서도 `운영 전환 명령 복사` 버튼으로 복사할 수 있습니다. 승인 후 현장에서 해야 할 일은 Vercel Production 환경변수를 채우고, 패널의 실제 연결 테스트를 통과시킨 뒤, 복사한 배포 가드 명령을 순서대로 실행하는 것입니다. 쿠팡 API 키가 아직 없으면 수동 링크 운영으로 시작하고 API 자동화 단계만 보류됩니다.

`check:production`은 운영 `/products/approval-sample`, `/disclosure`, `/robots.txt`, `/sitemap.xml`, `/`, `/admin`, `/api/admin/api-readiness`, 실제 연결 테스트, 비인증 `/api/admin/launch` POST 보호 확인, `/api/admin/scheduler-health`를 호출해 현재 상태를 보고합니다. 승인용 페이지뿐 아니라 공개 제휴 안내 페이지가 200으로 열리고, 쿠팡 파트너스 고지·수수료 안내·가격/재고 변동 안내가 들어 있는지, `robots.txt`가 공개 화면을 허용하면서 `/admin`과 `/api`를 막는지, 사이트맵에 메인·딜 목록·가이드·제휴 안내·승인용 상품 페이지가 포함되는지도 함께 확인합니다. 또한 공개 페이지의 referrer/보안 헤더와 `/admin`, `/api`의 `noindex`·`no-store` 헤더가 운영 배포에 실제 반영됐는지도 확인합니다. 특히 `/api/admin/launch`는 관리자 비밀번호 없이 POST했을 때 실제 데이터 작업을 시작하지 않고 `UNAUTHORIZED`, `ADMIN_PASSWORD_NOT_CONFIGURED`, `ADMIN_PASSWORD_WEAK_CONFIGURATION` 중 하나로 닫히는지 확인합니다. `/admin`에서는 Next.js 정적 JS 청크까지 읽어 `상품별 링크 보강`, `품질 보강 대기`, `링크 보강 큐로 이동`, `품질 보강 후보로 이동` 문구가 실제 배포 번들에 들어 있는지 확인하므로, 관리자 보강 화면을 고쳤지만 Vercel alias가 예전 배포를 보고 있는 상황도 잡을 수 있습니다. 운영 CLI인 `check:production`, `doctor:production`, `schema:production`, `launch:production`은 `RETURNPICK_ADMIN_PASSWORD`/`ADMIN_PASSWORD` 환경변수뿐 아니라 `vercel env pull .env.production --environment=production`으로 내려받은 `.env.production`, `.env.local`, `.env`도 순서대로 읽습니다. 값이 비어 있으면 비밀값을 출력하지 않고 어느 파일의 어떤 키가 빈 값인지 알려줍니다. report 모드의 `check:production`은 관리자 비밀번호가 없으면 관리자 API 실시간 점검만 경고로 건너뛰고 공개 승인 페이지·제휴 안내·robots·sitemap·배포 헤더 검증 결과를 계속 보여줍니다. 임시 카탈로그가 검증돼 `catalogLaunchReady=true`이고 `launchReady=false`인 catalog-only 상태면 제한 공개 가능으로 통과시키고, `launchReady=true`인 수동 링크 출시 상태는 핵심 운영 준비 완료로 통과시키며 API 자동화가 선택 대기로 남았음을 표시합니다. `check:production:launch`는 관리자 비밀번호와 운영 필수 연결이 모두 준비되지 않았으면 실패로 끝나며, 쿠팡 API 키가 없으면 자동화 선택 기능 경고만 남깁니다. 첫 가동 확인 전이라 `FIRST_LAUNCH_NOT_CONFIRMED`가 나오면 환경변수는 준비된 상태일 수 있으므로 `/admin#admin-first-launch`에서 첫 가동 실행을 완료하세요. 자동 스케줄러까지 완전 가동 중인지 엄격히 보려면 `node scripts/verify-production-readiness.mjs --launch --strict-scheduler`를 사용할 수 있습니다. 보고/출시 모드 분기만 빠르게 검증하려면 `npm run production-readiness:check`을 실행하세요.

`check:production`은 `/picks` 검수 추천 허브도 함께 확인합니다. 허브는 공개 딜이 없는 승인 전에도 직접 검수 콘텐츠를 제공하고, 실제 상품이 추가되면 고객공개 품질 기준을 통과한 상품만 자동으로 합칩니다. 그래서 빈 목록을 억지로 채우지 않으면서도 검색·블로그·텔레그램 유입이 구매 전 확인 페이지로 이어집니다.

운영 준비가 통과한 뒤 첫 가동도 CLI로 실행할 수 있습니다. 이 명령은 기본적으로 실제 데이터 작업을 시작하지 않고 운영 readiness와 필수 연결 테스트만 확인합니다.

```powershell
$env:RETURNPICK_ADMIN_PASSWORD="운영관리자비밀번호"
npm run launch:production -- standard
```

출력에 `Required live connection checks passed`가 보이면 같은 명령에 `--confirm`을 붙여 첫 소싱, 쿠팡 파트너스 링크 보강, 네이버 최저가 보강, `launch_confirmed` 기록을 한 번에 실행합니다.

```powershell
npm run launch:production -- standard confirm
```

`launch:production`은 운영 배포용 명령이므로 대상 주소가 외부에서 접근 가능한 `https://...`가 아니면 실행을 거부합니다. `NEXT_PUBLIC_SITE_URL` 또는 `RETURNPICK_SITE_URL`이 `localhost`, `127.0.0.1`, `.local`, `http://...`를 가리키면 첫 가동 데이터 작업을 시작하지 않고 운영 Vercel 주소로 바꾸라는 안내를 출력합니다.

프리셋은 `quick`, `standard`, `wide` 중 하나입니다. 직접 Node로 실행할 때는 `node scripts/run-production-launch.mjs --preset standard --confirm`처럼 옵션형 인자도 사용할 수 있습니다. 실수 방지를 위해 `confirm` 또는 `--confirm`이 없으면 `/api/admin/launch`를 호출하지 않으며, 준비가 덜 된 상태에서는 `LAUNCH_NOT_READY` 원인을 출력하고 종료합니다. 이때 CLI는 막힌 readiness 항목, 누락 또는 형식 오류가 있는 환경변수, 다음 조치를 함께 출력하므로 API 키를 넣은 직후 어느 Vercel 값이나 Supabase SQL 적용을 고쳐야 하는지 바로 확인할 수 있습니다.

`check:launch`는 승인용 파트너스 링크, Supabase 키, `ADMIN_PASSWORD`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`이 있어야 통과합니다. `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, `COUPANG_PARTNER_ID`는 최종승인 후 자동 후보 수집을 켤 때 추가하는 선택 기능이며, 네이버와 텔레그램도 별도 상태로 표시합니다.

값이 있어도 형식이 틀리면 통과하지 않습니다. `NEXT_PUBLIC_SITE_URL`과 `NEXT_PUBLIC_SUPABASE_URL`은 외부 접속 가능한 `https://...` 주소여야 하고, `NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL`은 `https://link.coupang.com/a/짧은코드` 형태의 파트너스 링크여야 하며, `CRON_SECRET`은 16자 이상이어야 합니다. `ADMIN_PASSWORD`는 12자 이상 랜덤 문자열이어야 하고 공백, 예시값, `password/test/admin` 같은 쉬운 값은 운영 준비로 보지 않습니다. 쿠팡 API 키를 입력했다면 공백이나 예시 문구 없이 복사된 값이어야 합니다. 선택 네이버 키나 텔레그램 값을 입력했다면 동일하게 형식을 검증하며, 텔레그램 Bot token은 `숫자:토큰`, chat ID는 숫자 또는 `@채널명` 형태여야 합니다. Supabase anon key와 service role key는 각각 완전한 키여야 하고 서로 달라야 합니다.

`env:check:launch`는 `.env.production`, `.env.local`, `.env`와 현재 프로세스 환경변수의 원본값도 확인해 앞뒤 공백이 섞인 값은 비밀값을 출력하지 않고 실패로 표시합니다.

`/admin`의 `승인 후 운영 즉시 가동 준비` 패널에는 `Vercel 환경변수 입력표`가 있습니다. `누락 키만 복사`로 승인용 링크·운영 필수 변수명을 바로 복사한 뒤 Vercel Environment Variables에 값을 채우고 재배포하세요. 쿠팡 API 키 3개는 최종승인 후 자동화를 추가할 때 선택적으로 입력합니다. `전체 필수 키 복사`에는 운영 기본값인 `CRON_USE_MOCK_FALLBACK=false`, `SOURCING_TIME_BUDGET_MS=52000`, 공개 웹 참고 수집 기본값도 포함됩니다. 공개 URL 값 외의 민감한 키 값은 관리자 화면에 표시하거나 복사하지 않습니다.

관리자 첫 화면의 `운영 전환 센터`는 현재 상태를 `승인 대기`, `수동 출시 가능`, `설정 보강`, `첫 가동 가능`으로 요약하고 `준비도 점검`, `첫 가동`, `운영 지표`, `승인용 페이지`로 바로 이동시킵니다. 승인 후에는 이 상단 요약에서 누락 환경변수를 먼저 확인한 뒤 아래 준비도 패널의 복사 버튼과 실제 연결 테스트를 이어가면 됩니다.

같은 입력표에서 `보안값 생성`을 누르면 브라우저 안에서 `ADMIN_PASSWORD`와 `CRON_SECRET`용 강한 랜덤 값을 만듭니다. 이 값은 서버나 DB에 저장하지 않고 현재 화면과 복사 템플릿에만 들어가므로, Vercel에 붙여넣은 뒤 재배포하고 새 `ADMIN_PASSWORD`로 다시 로그인하면 됩니다.

실제 연결 테스트 결과에 실패 카드가 있으면 `실패 보고서 복사`로 실패한 연결 테스트만 모은 보고서를 복사할 수 있습니다. 보고서에는 카드명, 안전하게 잘린 메시지, `다음 조치`, `품질 blocker 요약`, 진단 세부정보가 들어가며 API 키 원문은 포함하지 않습니다.

같은 패널의 `첫 가동을 위한 다음 조치` 카드는 현재 상태에서 운영자가 해야 할 한 가지를 먼저 보여줍니다. 승인 대기 중에는 심사용 페이지와 수동 파트너스 링크 유지를, API 키 입력 후에는 누락 환경변수나 실패한 연결 테스트를, 모든 연결이 통과하면 `표준 런칭` 첫 가동 실행을 안내합니다.

실제 연결 테스트가 모두 통과하면 `첫 가동 실행으로 이동` 버튼이 나타나 바로 첫 가동 패널로 내려갑니다. 반대로 첫 가동 실행이 환경변수 누락이나 연결 테스트 실패로 막히면 결과 카드의 `준비도 패널로 이동` 버튼으로 다시 올라가 실패 항목을 고칠 수 있습니다. 이런 패널 이동 버튼은 도착한 패널을 잠깐 강조해 긴 관리자 화면에서도 방금 어디로 이동했는지 바로 알 수 있게 합니다. `/admin#admin-api-readiness`, `/admin#admin-first-launch`처럼 해시가 붙은 주소로 직접 들어와도 로그인 후 해당 패널로 이동하고 같은 강조가 적용됩니다. 첫 가동 결과에는 막힌 준비 항목별 메시지, 누락 환경변수, 다음 조치가 같이 표시되므로 `coupang`, `supabase` 같은 내부 ID만 보고 추측하지 않아도 됩니다.

운영 필수 환경변수가 모두 준비된 뒤에는 `/admin`의 `승인 후 첫 가동 실행` 버튼을 누릅니다. 이 버튼은 먼저 Supabase, 공개 상품 데이터 품질, 공개 승인 페이지, Cron 인증, 공개 웹 참고 수집 사용 시 robots.txt 경로 같은 핵심 연결을 확인합니다. 쿠팡 API 키가 있으면 쿠팡 연결도 필수 검사에 포함하고, 없으면 자동 소싱만 대기하는 선택 연결로 표시합니다. 핵심 연결이 하나라도 실패하면 데이터 작업을 시작하지 않고 누락·오류 항목을 보여줍니다. 네이버와 텔레그램 연결 결과도 함께 표시하지만 선택 기능 오류는 핵심 첫 가동을 막지 않습니다. API 권한이 있으면 목업 없이 첫 소싱과 기존 후보의 쿠팡 파트너스 링크 자동 보강을 실행하고, API 권한 전에는 관리자에서 검수한 상품별 링크를 수동 등록·게시합니다. 네이버 키가 있으면 최저가 보강도 이어서 실행하며, 실패해도 세부 결과를 남기고 첫 가동 확인은 계속할 수 있습니다. 첫 실행 범위는 `빠른 점검`, `표준 런칭`, `넉넉한 런칭` 중에서 고를 수 있으며 기본값은 키워드 6개, 링크 8개, 가격 5개를 처리하는 `표준 런칭`입니다. 후보가 너무 적으면 `넉넉한 런칭`으로 키워드 10개와 링크 12개까지 한 번에 넓혀 시작할 수 있습니다.

첫 가동 API는 필수 연결 테스트 카드가 응답에서 아예 빠진 경우도 실패로 처리합니다. 따라서 `public_web`처럼 설정에 따라 필수가 되는 검사나 `data_quality`처럼 Supabase 검사 뒤에 이어지는 카드가 누락되어도 조용히 첫 가동을 통과하지 않고, `MISSING_REQUIRED_CONNECTION_CHECK` 진단으로 어떤 카드가 비었는지 보여줍니다. 연결 테스트가 실패한 경우에는 각 실패 카드의 안전한 메시지와 `operator_next_action`을 첫 가동 응답에도 복사해, 운영자가 같은 문제를 준비도 패널과 첫 가동 패널 양쪽에서 확인할 수 있습니다.

첫 가동 실행 결과는 실행 전/후 요약과 변화량을 함께 보여줍니다. 새 후보 수, 검토 대기 변화, 파트너스 링크 준비 증가, 고객공개 가능 상품 증가, 링크 누락 감소, 네이버 가격 누락 감소를 바로 확인해 다음 보강 작업을 결정할 수 있습니다. 각 단계 카드에는 실제 연결 테스트, 후보 수집, 쿠팡 링크 보강, 네이버 가격 보강의 실행 세부정보도 함께 표시되므로 중간 실패가 나도 어느 단계까지 처리됐고 어떤 응답이 문제였는지 바로 확인할 수 있습니다. 단계 세부정보에 `operator_next_action`이 있으면 JSON 안에 묻어두지 않고 `단계 다음 조치` 박스로 따로 보여주므로, 운영자는 실패 카드에서 바로 해야 할 일을 읽고 보강할 수 있습니다. 실행 결과 상단의 `첫 가동을 위한 다음 조치` 카드는 누락 환경변수, 연결 테스트 실패, 소싱 실패, 파트너스 링크 보강 실패, 네이버 가격 보강 실패, 첫 실데이터 신호 없음 상태별로 운영자가 다음에 눌러야 할 패널과 보정 방향을 먼저 보여줍니다.

첫 가동 결과에 링크 누락이나 네이버 최저가 누락이 남아 있으면 `첫 가동을 위한 다음 조치` 카드에 `파트너스 링크 보강`, `네이버 가격 보강`, `수집 진단 보기` 버튼이 같이 나타납니다. 이 버튼들은 각각 링크 보강 큐, 네이버 최저가 보강 패널, 자동 후보 수집 진단 패널로 바로 이동하므로, 첫 API 실행 후 부족한 부분을 화면 안에서 이어서 처리할 수 있습니다.

첫 가동이 `NO_LAUNCH_DATA_SIGNAL`로 멈춘 경우에도 응답에는 `recovery_actions`가 함께 들어갑니다. 기존 검토 대기 후보가 있으면 후보 검토 큐로, 상품별 파트너스 링크가 부족하면 링크 보강 큐로, 네이버 최저가가 비어 있으면 가격 보강 패널로, 후보 자체가 없으면 소싱 진단과 키워드 조건 완화로 보내는 순서입니다. CLI로 `launch:production -- ... confirm`을 실행한 경우에도 같은 복구 액션을 `repair:` 줄로 출력하므로, 브라우저를 보지 않고도 다음 보강 위치를 알 수 있습니다.

첫 가동이 완료되면 같은 `첫 가동을 위한 다음 조치` 카드에 `자동 운영 센터 보기` 버튼이 나타납니다. 이 버튼은 예약 소싱 주기, 실제 소스 사용 여부, 텔레그램 발송 후보, launch gate 대기 사유를 확인하는 자동 운영 센터로 이동합니다. 첫 가동이 완료되거나 검토 대기 후보가 생기면 `검토 대기 상품 보기` 버튼도 나타나며, 관리자 후보 검토 테이블의 `needs_review` 기본 큐로 바로 이동하므로 운영자는 첫 수집 결과를 확인한 뒤 화면을 뒤지지 않고 승인·게시·링크 보강 작업으로 이어갈 수 있습니다.

첫 가동 실행 중 상품 요약 조회, 연결 테스트, 수집, 링크 보강, 가격 보강 단계에서 예상하지 못한 예외가 나도 서버는 `LAUNCH_RUN_FAILED` JSON과 짧은 메시지를 반환합니다. 관리자 화면은 알림창 대신 패널 안에 실행 중, API 오류, 네트워크 오류를 표시하므로 실패 이유를 남긴 채 다시 실행할 수 있습니다. 새 실행을 시작하면 이전 실행 결과 카드를 먼저 비워, 오래된 실패 결과를 새 실행 상태로 착각하지 않게 했습니다.

후보 수집과 보강은 끝났지만 마지막 `launch_confirmed` 확인 기록 저장만 실패한 경우에는 전체 응답을 500으로 잃지 않고 `자동 운영 시작 확인` 실패 단계로 남깁니다. 이때 `FIRST_LAUNCH_CONFIRMATION_FAILED`와 Supabase `sourcing_runs` 쓰기 권한 또는 최신 SQL 적용 상태를 확인하라는 다음 조치를 보여주므로, 운영자는 앞 단계 결과를 보고 같은 첫 가동 버튼을 다시 눌러 스케줄러 확인 기록만 복구할 수 있습니다.

첫 가동이 오류 없이 끝나고 실제 데이터 신호가 확인되면 `sourcing_runs`에 `launch_confirmed` 운영 확인 기록이 남습니다. 실제 데이터 신호는 이번 첫 가동에서 새 후보 수집, 후보 저장·갱신, 상품별 파트너스 링크 보강, 네이버 가격 보강 중 하나 이상이 발생했거나 이미 상품별 파트너스 링크와 고객공개 품질 기준을 모두 통과한 상품이 있는 상태를 뜻합니다. 단순히 예전 검토 대기 후보가 남아 있는 것만으로는 첫 가동 성공으로 보지 않습니다. 연결 테스트가 통과하더라도 변화가 전혀 없고 운영할 고객공개 가능 상품도 없으면 `NO_LAUNCH_DATA_SIGNAL`로 첫 가동 확인을 남기지 않으므로, 키워드 조건이나 API 검색 결과를 먼저 조정해야 합니다. 운영 Cron과 관리자 `자동 운영 센터`의 수동 스케줄 버튼은 이 기록이 생기기 전까지 `FIRST_LAUNCH_NOT_CONFIRMED` 상태로 대기하므로, 환경변수만 채운 직후 검증 없이 자동 수집이나 텔레그램 발송이 먼저 시작되지 않습니다. 이 상태의 스케줄러 응답에는 `RUN_FIRST_LAUNCH` 다음 조치와 `admin-first-launch` 이동 대상이 함께 들어가며, 관리자 화면은 `승인 후 첫 가동 실행으로 이동` 버튼을 보여줍니다.

첫 가동 실행이 끝나면 관리자 페이지의 공유 새로고침 신호가 갱신되어 `자동 운영 센터`도 즉시 다시 조회됩니다. 따라서 성공 직후 스케줄러가 계속 `FIRST_LAUNCH_NOT_CONFIRMED`처럼 보이는 오래된 상태를 유지하지 않고, 수동 소싱과 텔레그램 다이제스트 버튼의 준비 상태를 바로 확인할 수 있습니다.

`launch_confirmed`는 운영 전환 확인용 마커일 뿐 실제 상품 수집 실행으로 계산하지 않습니다. 다음 키워드 위치와 관리자 스케줄러의 최근 소싱 건강도는 `next_keyword_offset`이 남은 실제 소싱 실행 로그만 기준으로 계산해, 첫 가동 확인 기록 때문에 키워드 순환이 0번으로 돌아가거나 최근 수집 시간이 잘못 보이는 일을 막습니다.

관리자 `자동 후보 수집`의 최근 실행 표와 상단 운영 지표도 같은 필터를 사용합니다. 따라서 첫 가동 확인 마커가 0건짜리 수집 실행처럼 보이지 않고, 운영자는 실제 API 소싱이 언제 몇 건을 발견·추가·갱신했는지만 볼 수 있습니다.

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

파트너스 URL 입력 영역은 구매 버튼 준비 상태를 바로 표시합니다. 승인 전에는 쿠팡 파트너스 웹에서 직접 생성한 상품별 링크를 넣고, 승인 후에는 쿠팡 API 딥링크 생성 결과를 `affiliate_url`에 저장해 운영합니다. 공통 골드박스/샘플 링크처럼 상품별 전환 추적에 약한 URL은 보강 대상으로 표시됩니다.

`affiliate_url`은 `https://link.coupang.com/a/짧은코드` 형태의 쿠팡 파트너스 단축 링크만 사용합니다. 일반 쿠팡 상품 주소(`https://www.coupang.com/vp/products/...`)는 상품 확인용 `source_url` 또는 `coupang_url`로만 보관하고, 게시용 구매 CTA로는 인정하지 않습니다. 테스트, 샘플, dryrun, fake처럼 보이는 코드는 저장 전 차단합니다. 링크 검증은 인위적인 제휴 클릭을 만들지 않기 위해 쿠팡 링크를 자동 방문하지 않고 형식과 명백한 샘플 문자열만 확인하므로, 실제 상품 페이지로 열리는지는 쿠팡 파트너스 화면에서 한 번 확인하세요.

자동 후보에 상품 이미지가 없으면 관리자 후보 검토의 `상품 이미지 URL`에서 직접 보완할 수 있습니다. 공식 API나 이용이 허용된 원본의 HTTPS 공개 주소만 사용해야 하며 localhost, 사설 IPv4, 내부망 도메인, 계정 정보나 별도 포트가 포함된 URL은 저장 단계에서 차단합니다. 안전하지 않은 이미지 URL은 공개 품질 기준도 통과하지 못합니다. 저장 전 `새 탭에서 이미지 확인`으로 실제 상품과 맞는 이미지인지 관리자가 확인하세요.

게시 상품은 상품별 쿠팡 파트너스 링크가 있어야 합니다. 관리자 화면의 게시 버튼은 `affiliate_url`이 준비된 상품에서만 활성화되고, 서버 API도 링크가 없는 `published` 상태 변경을 거부합니다. `/products/approval-sample` 캡처용 승인 링크는 심사용 페이지 전용이라 실상품에는 저장 요청부터 거부되며, 공개 딜이나 텔레그램 발송 준비 상태로 인정하지 않습니다.

관리자 API는 `affiliate_url` 저장 단계에서도 일반 쿠팡 상품 URL, 공통 랜딩/골드박스 링크, 형식이 맞지 않는 URL을 거부합니다. 일반 상품 URL은 `source_url` 또는 `coupang_url`에만 보관하고, 구매 버튼에는 상품별 쿠팡 파트너스 링크만 넣어야 합니다. 이미 게시된 상품에서 `affiliate_url`을 빈 값으로 지워 공개 CTA가 깨지는 것도 서버가 차단합니다.

후보 빠른 수정 패널은 서버 검증 실패와 네트워크 오류를 화면에 바로 표시합니다. 예를 들어 승인용 샘플 링크를 실상품에 저장하려고 하면 API의 거부 메시지를 그대로 보여주고, 저장 성공 시에만 목록을 새로고침합니다.

편집 중인 입력값이 고객공개 기준을 통과하면 `저장 후 게시` 버튼이 활성화됩니다. 이 버튼은 판매 가격, 네이버 가격 비교, 상품 이미지, 상품별 파트너스 링크와 링크 목적지를 서버에서 다시 검증한 뒤 저장과 게시를 한 요청으로 처리합니다. 반품가·반품등급이 없는 후보는 확인필요 경고를 붙인 가격·스펙 검수 모드로 게시할 수 있으며, 준비되지 않은 후보는 버튼 위에 실제 보강 사유가 표시되고 게시 요청 자체가 비활성화됩니다.

후보 검토 대시보드는 상품 목록 로딩 실패, 수익 지표 로딩 실패, 승인/게시/비공개/거절 액션 실패, 네트워크 오류를 상단 상태 메시지로 보여줍니다. 상품 목록 API와 상품 상태 변경 API도 예외가 나면 각각 `ADMIN_PRODUCTS_FAILED`, `ADMIN_PRODUCT_MUTATION_FAILED` JSON과 짧은 원인 메시지를 반환하므로, 승인 후 첫 후보 검수에서 DB나 권한 문제가 생겨도 화면에서 바로 확인할 수 있습니다.

후보 검토 대시보드 상단에는 `검토 대기`, `바로 게시 가능`, `링크 보강 필요` 요약 버튼이 있습니다. 첫 가동 후에는 `바로 게시 가능`을 먼저 눌러 상품별 쿠팡 파트너스 링크가 이미 준비된 후보부터 승인·게시하고, 남은 후보는 `링크 보강 필요`로 넘겨 상품별 링크를 보완하면 됩니다. `게시 가능만 보기` 체크박스도 같은 기준으로 현재 필터 안에서 즉시 공개 가능한 후보만 남깁니다.

`바로 게시 가능`은 단순히 링크만 있는 상태가 아니라 상품별 파트너스 링크와 공개 이미지, 판매 가격, 목적지 상품번호 확인이 준비된 상태를 뜻합니다. 반품가·반품등급이 확인되지 않은 상품은 `반품 정보 확인필요` 경고를 붙인 가격·스펙 검수 모드로 공개할 수 있지만, 가격 자체가 없거나 네이버 최저가 대비 불리한 가격, 고가 반품-중 조합, 상품 이미지 누락처럼 구매 판단을 막는 항목이 있으면 일괄 게시 대상에서 제외하고 CTA 칸에 보강 사유를 보여줍니다.

같은 고객공개 준비 기준은 서버 API에도 적용됩니다. 따라서 브라우저 화면을 거치지 않고 상품 상태 변경 API나 대량 링크 입력의 `대량 저장 후 게시`를 호출해도 가격·이미지·상품별 파트너스 링크·목적지 확인 같은 공개 품질 블로커가 있으면 `PUBLIC_QUALITY_BLOCKERS_FOR_PUBLISH` 또는 `PUBLISH_BLOCKED_PUBLIC_QUALITY`로 게시가 막히고, 유효한 상품별 파트너스 링크만 먼저 저장됩니다. 반품 정보 누락은 가격이 확인된 경우 공개 경고로 기록됩니다.

`바로 게시 가능` 후보는 체크박스로 여러 개를 선택한 뒤 `선택 승인+게시`를 눌러 한 번에 공개할 수 있습니다. 이 일괄 작업도 기존 상품별 게시 API를 그대로 사용하므로, 상품별 쿠팡 파트너스 링크가 없거나 승인용 샘플 링크를 재사용한 후보는 게시되지 않고 실패 메시지로 남습니다.

이미 `published` 상태지만 공개 품질 블로커 때문에 사용자 화면과 텔레그램에서 숨겨진 상품은 후보 검토 대시보드의 `공개 보강 대기`를 누르면 바로 모아 볼 수 있습니다. 이 큐에서 가격, 이미지, 네이버 가격, 상품별 파트너스 링크를 보완하면 레거시 게시 상품을 다시 살릴 수 있고, 반품가·등급은 가격·스펙 검수 모드에서 강한 반품 딜로 승격할 때 추가 보완합니다.

게시가 끝나면 `텔레그램 후보 발송으로 이동` 버튼이 나타나며 관리자 `자동 운영 센터`의 발송 후보 영역으로 이동합니다. 실제 발송은 운영자가 직접 누르는 명시적 액션이며, Telegram 또는 launch gate가 준비되지 않은 경우 자동 운영 센터가 대기 사유를 보여줍니다.

사용자 화면의 `/`, `/deals`, `/deals/[id]`, 비교 API는 공개 상태이면서 구매 CTA와 고객공개 품질 기준이 준비된 상품만 노출합니다. 예전에 게시됐지만 제휴 링크가 비어 있거나 공개 품질 블로커가 남은 상품은 관리자에서는 보강 대상으로 보이지만, 공개 전환 퍼널과 텔레그램 발송 후보에서는 제외됩니다. `/admin` 실제 연결 테스트의 `공개 데이터 품질` 카드도 이미 게시된 레거시 상품 중 고객공개 품질 기준을 통과하지 못한 행을 찾아 첫 가동 전에 정리하도록 알려줍니다.

비교함과 최근 본 딜은 구매 직전 보조 기능이므로 localStorage나 비교 API가 실패해도 쿠팡 이동과 상세 탐색을 막지 않습니다. 비교 API는 장애가 나면 `COMPARE_PRODUCTS_FAILED`와 빈 상품 목록을 안전하게 반환하고, 비교 화면은 사용자에게 다시 딜 목록으로 이동할 수 있는 안내를 보여줍니다.

`상품별 파트너스 링크 보강` 큐에서는 제휴 링크가 없거나 목적지 확인이 끝나지 않은 후보를 모아 볼 수 있습니다. 관리자 수동 후보 등록 때 파트너스 링크를 함께 저장한 상품도 이 큐에 들어오며, 각 상품에서 쿠팡 상품 검색을 새 탭으로 열고, 쿠팡 파트너스에서 생성한 상품별 링크를 붙여넣은 뒤 `링크 저장` 또는 `저장 후 게시`를 실행합니다. 승인용 샘플 링크는 `/products/approval-sample` 전용이며, 다른 상품에 저장하거나 일괄 재사용할 수 없도록 관리자 UI와 서버 API가 함께 차단합니다.

실제 쿠팡 상품 후보를 여러 개 확보했다면 `/admin`의 `실제 상품 후보 여러 개 한 번에 추가`에 TSV 형식으로 붙여넣을 수 있습니다. 한 줄의 순서는 `상품명`, `카테고리`, `쿠팡 상품 상세 URL`, `파트너스 링크(선택)`, `브랜드(선택)`, `모델명(선택)`, `이미지 URL(선택)`, `수집 당시 가격(선택)`, `반품가(선택)`, `새상품가(선택)`, `네이버 최저가(선택)`, `반품등급(선택)`, `재고(선택)`, `공개 메모(선택)`이며, 한 번에 최대 40줄입니다. 가격은 숫자나 `1,299,000원` 형식을 허용하고, 등급은 `미개봉·최상·상·중·알수없음·확인필요` 중 하나만 받습니다. 뒤쪽의 가격·등급·재고는 관리자가 실제로 확인한 값만 입력해야 하며, 서버는 잘못된 숫자와 등급을 건너뜁니다. 서버는 쿠팡 상품 상세 URL에서 상품번호를 확인하고, 같은 목록의 중복 상품번호와 샘플·일반 링크를 건너뜁니다. 이미 DB에 있는 쿠팡 상품번호 또는 같은 카테고리·상품명 후보도 자동 갱신하지 않고 건너뛰므로, 검수 완료 상품이 새 TSV 때문에 덮어써지지 않습니다. 기존 상품 수정은 후보 검토 편집기에서 명시적으로 진행합니다. 새 후보는 `needs_review`, 비공개로 저장되며, 입력되지 않은 값은 임의 생성하지 않고 `null` 또는 `확인필요`로 유지하므로 관리자가 실제 쿠팡·반품 정보를 확인한 뒤 게시해야 합니다.

링크를 여러 개 확보한 경우 같은 큐의 `대량 링크 입력`을 사용합니다. `템플릿 복사`는 보강 대상의 상품 ID, 상품명, 쿠팡 검색 URL을 줄 단위로 복사합니다. 쿠팡 파트너스에서 만든 상품별 링크를 각 줄의 상품 ID 옆에 붙여넣고 먼저 `검증만`으로 저장 가능 항목과 차단 사유를 확인한 뒤 `대량 저장`을 누르면 서버가 상품 ID 기준으로만 저장합니다. 제목은 참고용이며, 제목 유사도만으로 자동 연결하지 않습니다. 한 번에 최대 80줄까지 처리하고, 승인용 샘플 링크나 일반 쿠팡 상품 URL은 저장하지 않습니다.

Supabase 운영 DB를 연결하기 전 승인 대기 기간에는 관리자 `승인 대기용 출시 카탈로그`를 임시 보존 수단으로 사용할 수 있습니다. 일반 출시 카탈로그 생성기는 목업·데모가 아닌 실제 소스 상품 중 게시 상태, 판매 가격, 공개 이미지, 상품별 파트너스 링크, 링크 목적지 상품번호 확인, 공개 품질 기준을 모두 통과한 상품을 환경변수 28KB 안에서 최대 40개까지 한 줄 JSON으로 내보냅니다. 자동 소싱 상품은 `last_observed_at`을 요구하고, `manual_admin`·`manual_affiliate_link` 상품은 명시적 게시 검토로 생성된 `manual_catalog_review`가 7일 이내일 때만 허용합니다. 수동 검토를 자동 수집으로 위장하지 않으면서도 승인 직후 관리자 수동 등록 상품을 출시할 수 있는 경로입니다. 일반 생성기에서 상품별 데이터가 너무 큰 경우에는 해당 상품을 건너뛰고 더 작은 검증 상품을 이어서 담습니다. 반품가와 등급이 비어 있는 상품은 가격·스펙 검수 모드로 내보내며 공개 화면에 확인필요를 표시합니다. 생성 결과의 Key는 `RETURNPICK_BOOTSTRAP_CATALOG_JSON`이고, Value는 관리자 화면에서 복사한 JSON입니다. 두 값을 Vercel Production Environment Variables에 등록하고 새 배포를 만들면 Supabase가 없는 서버리스 인스턴스에서도 같은 공개 상품이 복구됩니다.

`Supabase 전 수동 입력` 경로는 별도 안전 규칙을 사용합니다. 실제 상품 TSV를 한 번에 최대 20개까지 받지만, 환경변수 용량 때문에 일부 행만 들어가는 경우에는 부분 공개를 막기 위해 전체 내보내기를 거부합니다. 이 경우 입력 행 수나 공개 메모를 줄여 다시 생성해야 하며, 승인용 샘플 링크·가짜 링크·추정 가격과 재고는 계속 거부됩니다.

출시 카탈로그는 Vercel 환경변수 전체 64KB 한도를 침범하지 않도록 28KB에서 먼저 차단하며, API 비밀값·관리자 메모·원본 provider 응답은 포함하지 않습니다. 이는 공개 상품 보존만 위한 승인 대기용 다리입니다. 클릭 이벤트, 관리자 수정, 가격 관측, 자동 소싱 실행 기록은 저장하지 못하므로 정식 운영 전에는 반드시 Supabase를 연결하고 최신 `sql/schema.sql`을 적용해야 합니다.

관리자에서 `출시 카탈로그 만들기`를 실행하면 응답에 현재 읽은 저장소가 함께 표시됩니다. `영속 저장소: Supabase`가 나오면 운영 DB에서 읽은 결과이고, `임시 저장소: 메모리 fallback`이 나오면 현재 요청에서만 보이는 임시 데이터입니다. 후자의 경우 JSON을 복사해 Vercel Production 환경변수에 넣고 재배포해야 공개 카탈로그가 유지되며, 후보 등록·수정·클릭 집계와 반복 소싱을 계속하려면 Supabase 운영 DB를 먼저 연결해야 합니다.

Production에서 Supabase가 설정되지 않은 동안에는 후보 등록·수정·키워드 변경·가격 보강·링크 검증·소싱 실행·텔레그램 로그 같은 영속 변경 API가 `PERSISTENT_STORAGE_NOT_CONFIGURED`와 함께 `503`으로 종료됩니다. 클릭 이벤트도 성공으로 가장하지 않고 저장되지 않았음을 반환합니다. 이 상태에서 메모리 fallback에 저장된 것처럼 보이는 값을 운영 데이터로 간주하지 않으며, 승인 전 공개는 위의 임시 카탈로그 환경변수 경로만 사용하세요.

이미 검수한 후보를 바로 공개해야 하는 경우 `저장한 상품을 바로 게시 상태로 전환`을 켜고 `대량 저장 후 게시`를 실행합니다. 이때도 상품별 쿠팡 파트너스 링크가 검증된 줄만 `published`와 `is_published=true`로 바뀌며, 차단된 줄은 게시하지 않습니다.

쿠팡 파트너스 API 키가 발급된 뒤에는 같은 큐의 `API로 24개 자동 보강` 버튼을 사용할 수 있습니다. 이 기능은 제휴 링크가 없거나 목적지 확인이 끝나지 않은 기존 후보를 점수순으로 가져와 쿠팡 상품 검색 API로 실제 상품 URL을 찾고, 딥링크 API로 상품별 파트너스 링크를 만든 뒤 `affiliate_url`에 저장합니다. 예약·자동 보강 작업은 파트너스 단축 링크를 서버에서 자동 방문하지 않으므로 인위적인 제휴 방문을 만들지 않습니다. 저장된 링크는 `REMOTE_CHECK_DEFERRED`와 `AFFILIATE_IDENTITY_VERIFICATION_REQUIRED` 상태로 남고, 관리자가 링크 보강 큐에서 명시적으로 `자동 목적지 확인`을 누르거나 브라우저에서 상품 일치를 확인한 뒤에만 게시할 수 있습니다. 링크가 다른 상품으로 이동하거나 쿠팡 요청 제한으로 확인할 수 없는 경우에도 링크는 비공개 후보로 남습니다. 자동 보강은 절대로 상품을 자동 게시하지 않습니다. API 키가 없으면 데이터를 임의 생성하지 않고 `API_NOT_CONFIGURED`로 멈춥니다.

기존 후보에 들어 있던 `source_url` 또는 `coupang_url`을 바로 딥링크로 바꾸지 못해도 자동 보강은 즉시 포기하지 않고 상품명 기반 쿠팡 검색으로 한 번 더 시도합니다. 이때 직접 딥링크 실패 원인은 `DIRECT_DEEPLINK_FAILED`와 함께 항목별 결과에 남겨, 승인 후 첫 보강에서 URL 문제와 검색 매칭 문제를 구분할 수 있습니다.

쿠팡 검색으로 링크를 보강할 때도 검색 결과 중 URL이 있는 첫 상품을 그대로 저장하지 않습니다. 상품명, 브랜드, 모델명, `spec_json`의 RAM/SSD/해상도 같은 토큰을 뽑아 검색 결과 상품명과 맞춰 보고, 관련도가 낮으면 `COUPANG_MATCH_RELEVANCE_TOO_LOW`로 건너뜁니다. 관련도 점수, 매칭 토큰, URL 후보 수, 관련도 부족으로 제외된 후보 수는 `raw_json.affiliate_backfill.match`에 남겨서 승인 후 자동 보강이 엉뚱한 상품 링크를 붙이지 않았는지 확인할 수 있습니다.

자동 보강이 `API_NOT_CONFIGURED`, 매칭 실패, 상품 URL 누락, 저장 실패로 끝난 항목도 운영자가 바로 수동 전환할 수 있도록 최근 결과에 실제 시도한 쿠팡 검색어와 `쿠팡 검색 열기` 링크를 함께 표시합니다. 관련도 검사를 통과하지 못한 항목은 관리자 화면에 관련도 점수, 매칭 토큰, URL 후보 수, 관련도 부족으로 제외된 후보 수를 같이 보여주므로, 상품명 보정이 필요한지 수동 파트너스 링크를 붙여야 하는지 바로 판단할 수 있습니다. 쿠팡 API가 아직 없거나 특정 상품 매칭이 빗나가도 같은 검색어로 쿠팡 상품을 확인한 뒤 쿠팡 파트너스 웹에서 상품별 링크를 생성해 큐에 붙여넣을 수 있습니다.

붙여넣은 파트너스 링크는 후보의 `coupang_url`에서 확인한 상품번호와 실제 최종 이동 상품번호를 비교합니다. 두 번호가 다르면 저장과 게시를 차단하고, 쿠팡의 자동 요청 제한으로 단축 링크를 해석하지 못했거나 후보에 기준 상품번호가 없으면 `브라우저로 직접 열기`로 상품명·옵션을 확인한 뒤 `브라우저 확인 완료`를 명시적으로 눌러야 게시할 수 있습니다. 확인 기록은 현재 링크와 현재 상품번호에 함께 묶이므로 링크를 바꾸거나 원본 상품 URL의 상품번호가 바뀌면 이전 확인은 즉시 무효가 됩니다. 일괄 링크 등록도 같은 고객공개 품질 게이트를 사용해 미확인 또는 불일치 링크를 바로 게시하지 않습니다.

대량 링크 입력은 내부 ReturnPick UUID뿐 아니라 후보의 숫자형 쿠팡 상품번호나 쿠팡 상품 상세 URL도 식별자로 받을 수 있습니다. 같은 상품번호가 여러 후보에 매칭되면 `AMBIGUOUS_SOURCE_PRODUCT_ID`로 저장하지 않으므로, 제목 유사도에 기대어 잘못된 제휴 링크가 붙는 일을 막습니다.

자동 보강 결과에 실패 또는 건너뜀 항목이 있으면 `실패 n개 대량 입력으로 보내기` 버튼이 나타납니다. 이 버튼은 실패 항목의 상품 ID, 상품명, 참고용 쿠팡 검색 URL을 `대량 링크 입력` 창으로 옮기고 클립보드에도 복사합니다. 운영자는 각 줄의 `상품별 파트너스 링크 붙여넣기` 자리에 쿠팡 파트너스에서 만든 실제 상품별 링크를 넣은 뒤 `검증만`과 `대량 저장`을 순서대로 실행하면 됩니다.

상품별 파트너스 링크 보강 큐는 대상 목록 로딩, 수동 링크 저장, 대량 저장, 저장 후 게시, API 자동 보강, 네트워크 오류를 상단 상태 메시지로 구분합니다. 자동 보강 API도 예외가 나면 `AFFILIATE_BACKFILL_FAILED` JSON과 짧은 원인 메시지를 반환하고, 대량 저장 API도 예외가 나면 `BULK_AFFILIATE_LINK_IMPORT_FAILED` JSON과 짧은 원인 메시지를 반환합니다. 요청 개수는 서버에서 안전한 범위로 보정합니다. 승인 후 쿠팡 API 키가 들어간 첫 링크 보강에서 일부 상품이 매칭 실패하거나 딥링크 변환에 실패해도 최근 보강 결과와 항목별 사유를 화면에 남깁니다.

보강 결과 항목은 내부 상태값 대신 `저장 완료`, `저장 가능`, `건너뜀`, `API 키 필요`, `실패`처럼 표시합니다. `상품 ID와 파트너스 링크가 모두 필요합니다`, `승인용 샘플 링크는 실상품에 사용할 수 없습니다`, `쿠팡 검색에서 매칭 상품을 찾지 못했습니다`, `기존 쿠팡 URL을 파트너스 링크로 변환하지 못했습니다` 같은 사유를 함께 보여줘, 승인 후 첫 링크 보강에서 수동 보완이 필요한 항목을 바로 골라낼 수 있습니다.

API 자동 보강 중 특정 상품의 DB 저장만 실패해도 전체 배치를 중단하지 않습니다. 해당 상품은 `AFFILIATE_BACKFILL_UPDATE_FAILED`로 기록하고 다음 상품을 계속 처리하므로, 승인 직후 일부 레거시 데이터나 제약 오류 때문에 나머지 상품의 파트너스 링크 보강까지 멈추는 일을 줄입니다.

`네이버 최저가 보강` 패널은 `naver_lowest_price`가 비어 있는 항목을 공식 네이버 쇼핑 API로 다시 검색합니다. 기본 실행 범위는 게시 상품과 `needs_review` 검토 후보를 함께 포함하므로, 승인 전 후보 검토 테이블에서도 가격 기준과 할인율 판단을 더 빨리 채울 수 있습니다. API 호출량을 줄이고 싶으면 `검토 후보까지 포함`을 끄고 게시 상품만 보강할 수 있습니다. 자동 수집과 수동 보강이 같은 SKU 판정기를 사용하며, 최근 보강 상세에는 실제 네이버 결과 상품명, 강한 일치·조건 일치 상태, 모델·스펙 근거, 액세서리·모델 불일치·다중 옵션 등으로 제외된 후보 수가 표시됩니다. 식별이 부족한 값은 가격 미확정으로 남기며, 서버 API도 예외가 나면 `PRICE_BACKFILL_FAILED` JSON과 짧은 원인 메시지를 반환합니다.

네이버 API가 응답했지만 관련 가격을 못 찾은 상품도 그냥 `매칭 실패`로 끝내지 않습니다. 최근 보강 상세에 실제로 시도한 검색어를 최대 3개까지 보여주고, 각 검색어는 네이버 쇼핑 검색 페이지를 새 탭으로 여는 재검색 링크가 됩니다. 운영자는 이 링크로 상품명을 확인한 뒤 후보 편집기에서 `네이버 최저가`를 수동 보완하거나 상품명·모델명을 정리해 다시 보강할 수 있습니다.

보강 상세는 내부 상태값 대신 `가격 보강 완료`, `매칭 실패`, `오류`, `API 키 필요`처럼 운영자가 바로 이해할 수 있는 상태로 표시합니다. 매칭 실패가 반복되면 상품명, 브랜드, 모델명, RAM/SSD 같은 스펙을 관리자 수정 화면에서 보완한 뒤 다시 실행하세요.

네이버 가격 보강도 상품 단위로 실패를 격리합니다. 특정 상품의 가격 저장, 점수 재계산 저장, 미매칭 로그 저장 중 하나가 실패하면 해당 상품만 `NAVER_PRICE_BACKFILL_UPDATE_FAILED`, `NAVER_PRICE_BACKFILL_SCORE_FAILED`, `NAVER_PRICE_BACKFILL_LOG_FAILED`로 기록하고 다음 상품을 계속 처리합니다.

관리자 상단 운영 대시보드에서는 다음을 확인할 수 있습니다.

- 쿠팡, 네이버, Supabase, 텔레그램, 공개 사이트 URL의 API 준비 상태
- 승인 후 입력해야 할 환경변수 누락 여부와 실제 연결 테스트 결과
- 승인 후 첫 가동 실행 결과와 목업 없는 소싱/링크 보강/가격 보강 단계
- Supabase 테이블은 있지만 최신 컬럼이 빠진 경우 `schema.sql` 재적용 필요 여부
- 검토 대기, 공개 가능, 링크 보강 대기, 평균 점수, 수동 확인 필요 수
- 게시 상태지만 상품별 파트너스 URL이 없어 사용자 화면에서 숨겨진 상품 수
- 최근 수집 결과
- 게시 적합, 수동 확인, 가격 관찰, 보류 우선 분포
- 점수, 할인율, 재고, 위험 플래그를 반영한 검토 우선순위
- 노출 → 상세 진입 → 구매 클릭 수익 퍼널
- 상품별 구매 클릭 수, CTA 전환율, 텔레그램 유입 수
- 공개 가능 상품 수, 링크 보강 대기 수, CTA 준비 상태
- 숨겨진 게시 상품, 품질 보강, 검토 대기, 텔레그램 유입을 우선순위로 정렬한 `수익 회복 플랜`

운영 지표와 수익 퍼널 지표는 각각 `ADMIN_METRICS_FAILED`, `REVENUE_METRICS_FAILED`로 안전한 오류를 반환합니다. 관리자 대시보드는 기본 운영 지표와 수익 퍼널 중 어느 쪽이 실패했는지 구분해 보여주므로, 클릭이 없는 상태와 지표 조회 장애를 혼동하지 않게 합니다. 수익 퍼널은 최근 7일·30일·90일·전체 기간을 선택할 수 있어 출시 직후의 반응과 누적 성과를 분리해 봅니다.
관리자 대시보드의 `공개 가능`은 실제 사용자 페이지와 텔레그램 발송 대상에 포함될 수 있는 상품별 쿠팡 파트너스 링크와 고객공개 품질 기준을 모두 통과한 상품 기준입니다. 명시적 재고가 `0`인 상품은 품절 blocker로 고객 화면과 텔레그램에서 숨기고, 재고 값 자체가 없는 상품은 확인 경고로 남깁니다. `공개 보강 대기`는 상품별 링크, 판매 가격, 이미지, 목적지 확인 같은 blocker 기준으로 집계되며, 반품가·등급 누락은 공개 경고로 별도 표시됩니다. 대시보드에서 `링크 보강 큐로 이동` 또는 `품질 보강 후보로 이동`을 눌러 바로 해당 보강 화면으로 이동할 수 있습니다.

`수익 회복 플랜`은 같은 지표를 운영 순서로 다시 정렬합니다. 상품별 링크가 빠져 숨겨진 게시 상품, 고객공개 품질 보강이 필요한 상품, 검토 대기 후보, 텔레그램 유입이 아직 없는 공개 가능 상품을 차례로 보여주며, 후보 테이블로 이동하는 버튼은 기존 검색·가격·카테고리 필터를 초기화하고 `검토 대기`, `공개 보강 대기` 같은 정확한 큐 필터를 즉시 엽니다.

`상품별 채널 배포 키트`는 실제 공개 가능 상품만 목록에 넣고, 선택한 상품의 상세 URL에 텔레그램·네이버 블로그 UTM을 붙여 채널별 원고를 생성합니다. 원고 복사와 네이버 블로그 등록 채널 열기는 수동으로 확인할 수 있고, 텔레그램은 기존 상품 발송 API로 운영자가 확인한 뒤 명시적으로 보냅니다. 상품이 품질 게이트를 통과하지 못하면 API가 원고 생성 자체를 거절합니다.

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

`/picks`는 구매 전 확인 콘텐츠의 공개 허브입니다. 공개 상품이 아직 없을 때는 승인용 링크가 연결된 직접 검수 콘텐츠를 먼저 보여주고, 이후 `published`이면서 고객공개 품질 기준을 통과한 상품만 자동으로 추가합니다. 허브의 카드 노출은 `web_editorial_card_picks` 채널로 기록하며, 가격·재고·반품등급이 확인되지 않은 값은 만들어내지 않습니다.

## 12. 텔레그램 발송 방법

`.env.local`에 아래 값을 넣습니다.

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NEXT_PUBLIC_SITE_URL=
```

관리자에서 게시된 상품을 선택한 뒤 텔레그램 미리보기를 확인하고 발송합니다. 텔레그램 메시지는 쿠팡 직링크가 아니라 `/deals/[id]?utm_source=telegram` 상세 페이지 링크를 사용하며, 발송 결과는 `telegram_logs`에 저장됩니다. 메시지가 길어지면 Telegram 제한보다 짧게 줄이되 상세 페이지 링크와 제휴 안내는 유지합니다. 발송 요청은 10초 안에 응답하지 않으면 timeout으로 처리하고, Telegram HTTP 오류·네트워크 오류·timeout은 토큰을 노출하지 않는 요약 메시지로 로그에 남깁니다.

API 승인 전 첫 매출 유입은 `/admin`의 `채널별 첫 매출 배포 키트`에서 준비할 수 있습니다. 실제 승인용 파트너스 링크가 설정된 경우에만 Novatech S1 추천 콘텐츠의 텔레그램 원고와 등록된 네이버 블로그용 제목·본문을 서버가 생성합니다. 두 원고 모두 가격·재고를 고정하지 않고 제휴 고지를 포함하며, 쿠팡 직링크 대신 `utm_source=telegram` 또는 `utm_source=naver_blog`가 붙은 ReturnPick 상세 페이지로 연결합니다. Bot token이 없어도 원고를 복사해 수동 게시할 수 있고, Bot 설정이 끝나면 확인한 텔레그램 원고를 같은 패널에서 명시적으로 발송할 수 있습니다.

실제 공개 상품이 게시된 뒤에는 같은 관리자 화면의 `상품별 채널 배포 키트`에서 상품을 선택합니다. 이 키트는 `published`이면서 상품별 파트너스 링크·가격·이미지·목적지 확인을 통과한 상품만 대상으로 하며, 공개 상세 URL에 `utm_source`, `utm_medium`, `utm_campaign=deal_distribution`을 붙인 텔레그램 원고와 네이버 블로그 제목·본문을 만듭니다. 원고에는 반품 정보 확인 상태, 리턴픽 판단, 점수, 추천 이유, 구매 전 주의점, 제휴 고지가 함께 들어갑니다. 공개 품질 기준을 통과하지 못한 상품은 원고 생성 단계에서 다시 차단하므로 링크 보강 전 상품이 외부 채널에 퍼지지 않습니다. 텔레그램은 기존 상품별 발송 API를 통해 운영자가 확인 후 명시적으로 발송하며, 봇이 없으면 원고 복사로 수동 게시할 수 있습니다.

공개 Novatech S1 추천 상세의 `추천 링크 공유`와 `링크 복사`도 쿠팡 직링크가 아니라 제휴 고지와 구매 전 체크가 함께 있는 ReturnPick 상세 주소를 전달합니다. 공유 주소에는 `utm_source=customer_share`가 붙고 성공한 공유 동작만 익명 `share_copy` 이벤트로 기록되어, 관리자 수익 퍼널에서 고객 추천 유입을 구분할 수 있습니다.

카카오톡, 네이버와 SNS 공유 미리보기에는 1200×630 전용 카드가 사용됩니다. 카드에는 상품명, 확인된 핵심 사양, 구매 전 체크 항목, 연출 이미지 표시와 제휴 링크 포함 안내가 함께 노출되며 가격이나 재고를 고정해서 표시하지 않습니다.

수령 체크리스트와 안전 카테고리 가이드에는 공개 추천 상세로 이어지는 실전 사례가 표시됩니다. 가이드에서 곧바로 쿠팡으로 보내지 않고 검수 근거와 제휴 고지가 있는 ReturnPick 상세를 먼저 보여줍니다.

텔레그램 메시지는 `반품가` 또는 `현재 판매가`, `반품 정보`, `할인율`, `좋은 점`, `주의`, `자세히 보기`, `제휴 안내`를 읽기 쉬운 한국어로 고정해 발송합니다. 반품 정보나 가격이 없을 때도 깨진 문구 대신 `확인필요`로 표시하며, 가격 자체가 없는 상품은 발송하지 않습니다.

텔레그램 관리자 패널은 미리보기 생성 중, 발송 중, 성공, API 오류, 네트워크 오류를 상태 메시지로 구분합니다. 서버 API도 잘못된 요청 mode를 거부하고 예외가 나면 `TELEGRAM_ADMIN_FAILED` JSON과 짧은 원인 메시지를 반환하므로, 승인 후 Bot token이나 chat ID가 잘못 들어간 경우 화면에서 바로 확인할 수 있습니다.

## 13. Vercel 배포 방법

1. GitHub 저장소에 프로젝트를 올립니다.
2. Vercel에서 Next.js 프로젝트로 Import합니다.
3. Environment Variables에 `.env.local`과 같은 값을 등록합니다.
4. Supabase SQL이 적용되어 있는지 확인합니다.
5. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 바꿉니다.
6. `/admin` 접속 후 `승인 후 운영 즉시 가동 준비` 패널에서 누락된 환경변수와 연결 테스트 결과를 확인합니다.

## 14. 운영 체크리스트

- 키워드별 최소/최대 가격이 현실적인지 확인
- 반품 정보 `확인필요` 상품은 가격·스펙 검수 모드임을 확인하고, 강한 반품 딜로 소개할 때만 등급·반품가를 추가 보완
- 반품가, 재고, 파트너스 URL을 게시 직전 재확인
- 네이버 최저가가 없거나 오래된 경우 수동 확인
- 텔레그램 발송 전 상세 페이지 링크 확인
- 관리자 수익 퍼널에서 구매 클릭과 CTA 전환율 확인
- 제휴 URL이 없는 상품은 게시되지 않는지 확인
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

ReturnPick은 Vercel Cron 또는 외부 스케줄러로 반복 운영할 수 있습니다. 현재 `vercel.json`은 Vercel Hobby 계정에서도 배포가 막히지 않도록 하루 1회 안전 기본값으로 등록되어 있습니다.

- `/api/cron/sourcing`: 기본 Vercel Cron은 매일 00:00 UTC에 활성 키워드 기준으로 후보를 다시 수집하고 점수화합니다.
- `/api/cron/affiliate-backfill`: 기본 Vercel Cron은 매일 00:05 UTC에 승인 후 상품별 쿠팡 상품 URL을 파트너스 딥링크로 보강합니다. 수집 함수와 분리해 새 후보가 수익 링크 없이 계속 쌓이는 일을 줄입니다.
- `/api/cron/telegram-digest`: 기본 Vercel Cron은 매일 00:10 UTC에 아직 텔레그램에 보낸 적 없는 고객공개 가능 상품 중 점수 높은 상품을 1건 발송합니다.

1시간마다 자동 수집, 상품별 제휴 링크 보강과 텔레그램 후보 발송을 유지하려면 Vercel Pro 이상에서 작업을 `0 * * * *`로 바꾸거나, cron-job.org, GitHub Actions, 서버 Cron 같은 외부 스케줄러가 아래 세 주소를 순서대로 호출하게 설정하세요. 이때 `Authorization: Bearer CRON_SECRET값` 헤더를 반드시 넣어야 합니다.

- `https://배포주소/api/cron/sourcing`
- `https://배포주소/api/cron/affiliate-backfill`
- `https://배포주소/api/cron/telegram-digest`

이 저장소에는 `.github/workflows/returnpick-hourly.yml`도 포함되어 있습니다. GitHub에 연결해 두면 Vercel Hobby에서도 GitHub Actions가 1시간마다 위 세 Cron API를 수집 → 링크 보강 → 텔레그램 순서로 호출할 수 있습니다.

GitHub Actions 1시간 스케줄러 설정:

1. GitHub 저장소 Settings → Secrets and variables → Actions로 이동합니다.
2. Repository secret `RETURNPICK_CRON_SECRET`에 Vercel의 `CRON_SECRET`과 같은 값을 넣습니다.
3. Repository variable `RETURNPICK_SITE_URL`에 `https://returnpick.vercel.app`을 넣습니다. 값을 넣지 않아도 워크플로 기본값은 `https://returnpick.vercel.app`입니다.
4. Actions 탭에서 `ReturnPick Hourly Scheduler`를 수동 실행해 200 응답을 확인합니다.
5. 이후 매시 정각마다 `/api/cron/sourcing`을 먼저 호출하고, `/api/cron/affiliate-backfill`을 실행한 다음 `/api/cron/telegram-digest?limit=1`을 호출합니다.

관리자 페이지의 `자동 운영 센터`에서도 `GitHub Actions 설정 복사` 버튼으로 같은 설정값과 점검 절차를 복사할 수 있습니다.

`승인 후 운영 즉시 가동 준비` 패널에도 `GitHub 스케줄러 체크 복사` 버튼이 있습니다. GitHub Repository secret 값은 Vercel 앱에서 직접 읽을 수 없으므로, 이 체크리스트를 복사해 `RETURNPICK_CRON_SECRET`이 Vercel의 `CRON_SECRET`과 같은지, `RETURNPICK_SITE_URL`이 운영 주소인지, `ReturnPick Hourly Scheduler` 수동 실행이 200 응답인지 확인하세요.

이 방식도 숨은 리다이렉트나 비공식 수집이 아니라, 이미 보호된 ReturnPick Cron API를 정해진 주기로 호출하는 구조입니다. 운영 준비가 끝나기 전에는 API가 `LAUNCH_NOT_READY` 또는 `FIRST_LAUNCH_NOT_CONFIRMED`로 안전하게 대기합니다.

로컬에서도 GitHub Actions 1시간 스케줄러 파일이 정확한지 확인할 수 있습니다. 아래 명령은 `.github/workflows/returnpick-hourly.yml`의 매시 정각 cron, 보호 헤더, 소싱/텔레그램 Cron URL, `RETURNPICK_CRON_SECRET`, `RETURNPICK_SITE_URL` 연결명을 검사하고, GitHub secret 값은 출력하거나 요구하지 않습니다. `doctor:production`과 `doctor:production:launch`에도 이 검사가 포함됩니다.

```powershell
npm run scheduler:check
```

운영 환경변수:

```bash
CRON_SECRET=
CRON_USE_MOCK_FALLBACK=false
SOURCING_TIME_BUDGET_MS=52000
SOURCING_KEYWORD_LIMIT=
SOURCING_ENRICHMENT_CONCURRENCY=2
AFFILIATE_BACKFILL_LIMIT=10
```

`CRON_SECRET`은 Vercel 프로젝트 환경변수에 16자 이상 랜덤 문자열로 설정합니다. Vercel Cron이 호출할 때 이 값이 `Authorization: Bearer ...` 헤더로 전달되며, API는 이 헤더가 맞을 때만 실행됩니다. 로컬 개발 환경에서는 `CRON_SECRET`이 없어도 테스트 호출이 가능합니다.

Cron 라우트는 `?probe=1`을 붙이면 인증만 확인하고 실제 소싱·링크 보강·텔레그램 발송은 시작하지 않습니다. `/admin`의 실제 연결 테스트는 `NEXT_PUBLIC_SITE_URL/api/cron/sourcing?probe=1`, `/api/cron/affiliate-backfill?probe=1`, `/api/cron/telegram-digest?probe=1`을 `CRON_SECRET`으로 호출해, 배포 alias와 Cron 인증이 맞는지 첫 가동 전에 확인합니다. `AFFILIATE_BACKFILL_LIMIT`은 매시 링크 보강 최대 건수이며 기본값 10, 최대 20입니다. 링크 보강과 목적지 검증은 한 번에 최대 52초로 제한되며, 남은 후보는 다음 시간 실행으로 넘겨 Vercel 함수 시간 초과가 전체 예약 흐름을 끊지 않도록 합니다.

예약 실행 중 예외가 발생해도 Cron 라우트는 일반 HTML 오류 대신 `CRON_SOURCING_FAILED`, `CRON_AFFILIATE_BACKFILL_FAILED` 또는 `CRON_TELEGRAM_DIGEST_FAILED` JSON을 반환합니다. 응답에는 실행 시각, 작업 종류, 안전하게 잘린 오류 메시지만 포함되며 API 키나 토큰 원문은 노출하지 않습니다.

운영 배포의 Cron 소싱은 기본적으로 실제 API/허용 소스만 사용합니다. 승인 전 테스트 목적으로만 목업 후보를 자동 수집에 섞고 싶다면 `CRON_USE_MOCK_FALLBACK=true`를 명시하고, 최종승인 후에는 `false`로 돌리세요. 관리자 페이지의 `자동 운영 센터`에서 현재 Cron이 `실제 소스만 사용` 상태인지 바로 확인할 수 있습니다.

운영 배포의 Cron 소싱은 승인용 상품별 링크·Supabase·공개 URL 등 핵심 설정이 준비되기 전에는 `LAUNCH_NOT_READY`로 데이터 작업을 하지 않습니다. 쿠팡 API 키가 없는 동안에는 `COUPANG_API_NOT_READY`로 자동 소싱만 대기하고 수동 링크 운영은 계속할 수 있습니다. 핵심 환경이 준비된 뒤에도 `/admin`의 `승인 후 첫 가동 실행`이 성공해 `launch_confirmed` 기록이 생기기 전에는 `FIRST_LAUNCH_NOT_CONFIRMED`로 대기합니다. 텔레그램 다이제스트는 이 공통 게이트를 통과한 뒤 Bot 설정이 없으면 `TELEGRAM_NOT_READY`로 발송 작업만 대기하며 예약 소싱은 계속 동작합니다. 자동 운영 센터와 수동 실행 응답은 항목명, 누락 환경변수, 다음 조치를 함께 보여주고 해결 패널로 이동시킵니다. 승인 전 화면 확인은 `자동 후보 수집` 섹션의 목업 실행으로 진행하고, 실제 반복 운영은 첫 가동 준비가 끝난 뒤 켜세요.

소싱은 서버리스 함수 시간 제한을 피하기 위해 기본 52초 예산 안에서 가능한 만큼 처리하고 `completed_partial` 상태로 안전하게 끝날 수 있습니다. 실행 로그에는 `next_keyword_offset`이 저장되며, 다음 Cron 또는 관리자 실행은 이 위치부터 이어서 돌기 때문에 앞쪽 키워드만 반복 수집되는 일을 줄입니다. 운영 초기에 API 응답이 느리면 `SOURCING_KEYWORD_LIMIT=8`처럼 키워드 수를 제한하고, 응답이 안정된 뒤에만 `SOURCING_ENRICHMENT_CONCURRENCY=3` 또는 `4`로 단계적으로 늘리세요.

운영 DB 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)가 없으면 Vercel 서버리스 환경에서는 실행 기록과 후보 저장이 장기 유지되지 않습니다. 승인 전 화면 확인은 가능하지만, 1시간 반복 소싱을 실제 운영하려면 Supabase 연결이 먼저 필요합니다. 관리자 `자동 운영 센터`는 이 상태를 `운영 DB 미연결` 경고로 표시합니다.

관리자 `승인 후 운영 즉시 가동 준비` 패널은 상태를 `승인 대기`, `수동 출시 가능`, `API 키 입력됨`, `운영 준비 완료`로 구분합니다. `수동 출시 가능`은 승인용 링크와 Supabase·관리자·Cron·사이트 URL 같은 운영 필수 설정이 갖춰져 상품별 파트너스 링크를 검수·게시할 수 있는 상태입니다. `API 키 입력됨`은 쿠팡 API 자동화 키는 있지만 운영 필수 설정이 남은 상태이고, `운영 준비 완료`는 자동화까지 포함한 운영 필수 환경변수가 모두 채워진 상태입니다. 쿠팡 API·네이버·텔레그램은 별도의 `선택 연동 대기`로 표시되어 핵심 차단 항목과 섞이지 않습니다. 실제 연결 테스트는 Supabase 테이블/컬럼 조회뿐 아니라 `is_strict_coupang_partners_url` DB 함수가 정상 단축 링크만 통과시키는지, `sourcing_runs` 실행 로그와 `affiliate_events` 클릭 이벤트에 짧은 테스트 레코드를 쓸 수 있는지 확인한 뒤 바로 정리합니다. 또한 anon key로 공개 상품·점수·가격 스냅샷이 읽히는지, 비공개로 돌린 뒤에는 다시 숨겨지는지 확인해 실제 사용자 권한 기준 RLS도 검증합니다. 공개 상품 중 제휴 링크가 없거나 `https://link.coupang.com/a/짧은코드` 기준을 만족하지 않는 링크, 승인용 샘플 링크를 재사용한 상품이 있으면 첫 가동을 막아 수익 추적이 깨진 상태로 운영되는 일을 방지합니다. 같은 검사에서 테스트 문자열이 들어간 가짜 파트너스 단축 링크를 공개 상품으로 짧게 저장해 보고 DB 제약이 거부되는지도 확인하므로, `schema.sql`을 최신으로 적용하지 않은 상태도 바로 드러납니다. 마지막으로 공개 Cron 엔드포인트가 `CRON_SECRET`으로 인증되는지 probe 모드로 확인해, Vercel 배포 주소와 예약 실행 인증이 어긋난 상태도 첫 가동 전에 잡습니다. 각 연결 테스트 카드에는 HTTP 상태, 실패 단계, 조회 건수, RLS smoke 결과처럼 비밀키를 제외한 안전한 진단 세부정보가 표시되어 API 키를 넣은 직후 어떤 설정을 고쳐야 하는지 바로 확인할 수 있습니다.

Supabase schema version이 맞지 않으면 관리자 패널에 `Supabase 최신 SQL 적용 필요` 카드가 따로 표시됩니다. 이 카드에는 기대 버전과 현재 DB 버전이 같이 나오므로, Supabase SQL Editor에서 `sql/schema.sql` 전체를 다시 실행하고 Vercel을 재배포한 뒤 실제 연결 테스트를 다시 누르면 됩니다. 카드의 `SQL 적용 체크리스트 복사`를 누르면 로컬 `C:\projects\returnpick\sql\schema.sql` 파일 전체를 실행해야 한다는 안내와 확인 항목을 바로 복사할 수 있습니다.

Supabase 실제 연결 테스트는 실패 유형을 `SUPABASE_SCHEMA_VERSION_MISMATCH`, `SUPABASE_TABLE_OR_COLUMN_MISSING`, `SUPABASE_WRITE_SMOKE_FAILED`, `SUPABASE_PUBLIC_RLS_FAILED`처럼 나눠 표시합니다. 따라서 승인 후 첫 가동 전에 최신 SQL 재적용, service role key 확인, 공개 RLS 정책 재적용 중 무엇을 해야 하는지 관리자 화면에서 바로 볼 수 있습니다.

실제 연결 테스트 중 외부 API timeout, 네트워크 오류, 예상하지 못한 예외가 나도 관리자 API는 HTML 오류 페이지 대신 `API_READINESS_FAILED` JSON과 안전하게 잘린 메시지를 반환합니다. 관리자 화면도 이 오류를 상태 메시지로 표시하고 진행 중 상태를 해제하므로, API 키 입력 직후 문제가 생겨도 새로고침 없이 어느 단계가 막혔는지 다시 확인할 수 있습니다.

각 연결 테스트는 가능한 한 서로 분리해서 실행합니다. 쿠팡, 네이버, Supabase, 텔레그램 중 하나가 예상 밖의 예외를 내도 해당 카드만 `error`로 기록하고 나머지 공개 페이지, Cron, DB, 발송 준비 상태는 계속 확인합니다.

핵심 출시 조건은 Supabase, 쿠팡 파트너스 API, 공개 URL, 관리자 인증, Cron 보호값입니다. 네이버 쇼핑 API와 텔레그램은 선택 기능이므로 값이 없어도 자동 소싱·관리자 검수·사이트 게시는 시작할 수 있습니다. `TELEGRAM_BOT_TOKEN`과 `TELEGRAM_CHAT_ID`가 모두 있을 때만 텔레그램 작업 게이트가 열리며, 실제 연결 테스트는 메시지를 보내지 않고 Telegram `getMe`와 `getChat`으로 Bot 토큰과 chat ID 접근 가능 여부를 확인합니다.

텔레그램 실제 연결 테스트가 실패하면 관리자 화면은 실패 원인을 `TELEGRAM_BOT_TOKEN_INVALID`, `TELEGRAM_CHAT_ACCESS_FAILED`, `TELEGRAM_API_RATE_LIMITED`로 나눠 표시합니다. 따라서 승인 후 첫 발송 전에 BotFather 토큰을 다시 복사해야 하는지, 봇을 채널/그룹에 추가하고 권한을 줘야 하는지, 잠시 후 재시도해야 하는지 바로 구분할 수 있습니다.

같은 실제 연결 테스트는 `NEXT_PUBLIC_SITE_URL/products/approval-sample` 공개 페이지도 직접 확인합니다. 페이지가 200으로 응답하는지, `쿠팡에서 가격 확인` CTA와 쿠팡 파트너스 제휴 고지, `/disclosure` 링크, 승인용 파트너스 URL이 HTML에 포함되는지 검사해 Vercel 도메인·승인용 페이지·제휴 고지 누락을 배포 후에도 잡을 수 있습니다.

`NEXT_PUBLIC_SITE_URL`은 `https://returnpick.vercel.app`처럼 외부에서 접속 가능한 HTTPS 배포 주소여야 합니다. `localhost`, `127.0.0.1`, `.local`, `http://...`, 잘못된 URL 형식은 운영 준비 완료로 보지 않으며, 공개 승인 페이지 검사와 Cron probe도 실행 전에 오류로 표시합니다.

첫 실데이터 수집에서 후보가 0개이면 관리자 `자동 후보 수집` 섹션의 진단 카드를 확인하세요. 이 카드는 provider별 원천 수/통과 수, API 상태, 가격 필터 제외, robots.txt 차단, 시간 예산 부분 완료 여부를 요약하고 다음 행동을 안내합니다. 후보 수집 실행 직후의 상태 메시지에도 같은 진단 제목과 첫 번째 다음 조치를 붙여 보여주므로, 최근 실행 표가 갱신되기 전에도 공급원 오류나 가격 필터 문제를 바로 알아볼 수 있습니다. 공급원 오류가 있어도 보조 소스로 후보가 들어온 경우에는 노란 경고로 표시되며, 키워드 저장·상품 저장 같은 비복구 오류가 있을 때만 실패로 표시됩니다. 승인 전 화면 확인만 목적이라면 목업 대체 허용을 켜고, 승인 후 운영 테스트라면 목업을 끈 상태에서 API 준비도 실제 연결 테스트와 키워드 가격 조건을 먼저 확인하세요.

진단 카드에는 `API 준비도 확인`, `키워드 조건 조정`, `공개웹 설정 확인`, `수집 이어서 실행` 같은 바로가기 버튼도 표시됩니다. 공급원 오류는 준비도 패널로, 가격 필터나 키워드 부족은 소싱 키워드 관리로, 공개 웹 robots/템플릿 문제는 준비도 패널의 공개 웹 점검으로 보내므로 첫 가동 후 0건 원인을 화면 안에서 바로 따라갈 수 있습니다.

CLI에서도 같은 방향의 복구 점검을 볼 수 있습니다. 아래 명령은 비밀값을 출력하지 않고 API 환경값 준비 여부, 활성 키워드와 카테고리 커버리지, 너무 좁은 가격/할인 필터, 최근 소싱 실행의 공급원별 결과와 가격 필터 영향을 요약합니다.

```powershell
npm run sourcing:diagnose
```

Supabase 운영 환경변수가 준비된 상태에서는 같은 명령이 `sourced_products`도 함께 점검합니다. 후보는 있는데 `/deals`나 텔레그램에 보이지 않는 경우 고객공개 상품 수, 숨겨진 게시 상품 수, `상품별 파트너스 링크 필요`, `승인용 샘플 링크 사용 중`, `반품가 확인 필요`, `반품등급 확인 필요`, `상품 이미지 확인 필요`, `네이버 최저가 대비 가격 불리`처럼 한국어 차단 사유를 요약해 어떤 큐를 먼저 고칠지 알려줍니다.

쿠팡 API 키가 감지되면 관리자 `자동 후보 수집`의 `목업 대체 허용` 기본값은 자동으로 꺼집니다. 승인 전에는 목업으로 화면을 확인할 수 있지만, 승인 후 첫 실데이터 수집에서는 목업 상품이 섞이지 않도록 실제 소스 모드가 기본입니다. 서버 API도 요청에 `useMockFallback` 값이 없으면 쿠팡 API 준비 상태를 기준으로 같은 기본값을 적용합니다. 네이버 키 유무는 가격 비교 기능만 켜거나 끄며 목업 차단 기준에는 포함되지 않습니다.

운영 배포에서 쿠팡 API 키가 준비된 뒤에는 누군가 `useMockFallback:true`를 직접 보내도 서버가 `MOCK_FALLBACK_BLOCKED_AFTER_API_READY`로 목업 대체를 끄고 실제 소스로만 실행합니다. 관리자 화면의 체크박스도 같은 상태에서는 잠겨서, 승인 후 운영 데이터에 샘플 상품이 섞이는 일을 방지합니다.

쿠팡/네이버 공식 API 호출은 10초 안에 응답이 없으면 실패로 정리하고 다음 진단으로 넘어갑니다. HTTP 오류가 발생하면 단순히 `401`, `403`, `500`만 표시하지 않고, API가 내려주는 안전한 오류 메시지 일부를 함께 남겨 잘못된 키, 권한 미발급, API 제한, 요청 형식 문제를 더 빨리 구분할 수 있습니다. 비밀키 원문은 로그나 화면에 노출하지 않습니다.

Vercel Cron은 플랜별 실행 주기 제한이 있습니다. Hobby 계정에서 `0 * * * *`를 `vercel.json`에 넣으면 배포가 거부될 수 있으므로, 이 저장소의 기본값은 배포 가능한 하루 1회 Cron입니다. 1시간 운영이 필요하면 Vercel Pro로 올린 뒤 Cron 표현식을 시간 단위로 바꾸거나, 외부 스케줄러가 같은 Cron API를 1시간마다 호출하게 두세요.

로컬 테스트:

```bash
curl http://localhost:3000/api/cron/sourcing
curl http://localhost:3000/api/cron/telegram-digest
```

텔레그램 다이제스트는 예약 실행 때마다 중복 발송을 피하기 위해 `telegram_logs`에서 이미 `sent` 처리된 상품을 제외합니다. 기본 실행은 고객공개 가능 후보 1건만 발송하므로 새 딜이 있을 때만 천천히 채널에 흘러가고, `TELEGRAM_BOT_TOKEN` 또는 `TELEGRAM_CHAT_ID`가 없으면 상품 조회나 로그 쓰기를 시작하지 않고 `TELEGRAM_NOT_READY`로 안전하게 대기합니다. 예약 다이제스트 응답에는 `status`, `sent_count`, `error_count`가 함께 들어가므로 일부 상품 발송이 실패해도 관리자 자동 운영 센터가 성공으로 오해하지 않고 오류 건수를 바로 보여줍니다.

텔레그램 수동 발송과 예약 다이제스트는 모두 고객공개 기준을 통과한 상품만 보냅니다. `is_published=true`, `sourcing_status=published`, 상품별 `https://link.coupang.com/...` 파트너스 링크, 판매 가격, 공개 이미지와 목적지 확인이 준비되지 않은 상품은 미리보기와 발송 API에서 거절됩니다. 반품가·반품등급이 없는 상품은 메시지에 확인필요를 표시한 가격·스펙 검수 모드로 발송할 수 있습니다. 메시지 링크는 쿠팡 직링크가 아니라 `NEXT_PUBLIC_SITE_URL/deals/{id}?utm_source=telegram` 상세 페이지로 보내 신뢰 근거와 제휴 고지를 먼저 보게 합니다.

관리자 페이지의 `자동 운영 센터`에서는 다음 항목을 바로 확인할 수 있습니다.

- 마지막 소싱이 90분 이상 지연됐는지
- 최근 수집에서 발견/추가/갱신/오류가 몇 건인지
- 텔레그램 발송 후보와 24시간 발송 건수
- 제휴 URL 누락, 반품가/등급 확인, 오래된 게시 상품 재검수 큐
- 관리자가 수동으로 `지금 소싱` 또는 `텔레그램 후보 발송`을 실행하는 버튼

수동 실행 또는 상태 조회가 실패하면 화면에 `LAUNCH_NOT_READY`, `COUPANG_API_NOT_READY`, `FIRST_LAUNCH_NOT_CONFIRMED`, `TELEGRAM_NOT_READY`, `SCHEDULER_RUN_FAILED`처럼 비밀키를 제외한 안전한 사유가 바로 표시됩니다. `LAUNCH_NOT_READY`일 때는 `SUPABASE_SERVICE_ROLE_KEY`처럼 핵심 출시에 필요한 누락 환경변수와 다음 조치가 같이 나오고 `준비도 패널로 이동` 버튼이 나타납니다. `COUPANG_API_NOT_READY`는 수동 상품별 링크 운영을 유지하면서 자동 후보 수집만 대기하는 상태입니다. `FIRST_LAUNCH_NOT_CONFIRMED`일 때는 `승인 후 첫 가동 실행으로 이동` 버튼이 나타나며, `TELEGRAM_NOT_READY`는 사이트 운영을 막지 않고 텔레그램 작업만 대기시킵니다. 버튼은 이동 후 대상 패널을 짧게 강조하므로 어떤 준비가 막혔는지 추측하지 않아도 됩니다. 네트워크 문제와 서버 예외도 브라우저 알림에 의존하지 않고 같은 패널 안에 남깁니다.

`/admin`의 실제 연결 테스트 중 `공개 상품 데이터 품질` 카드는 고객공개 기준을 막는 blocker를 집계해 `public_quality_blocker_summary`로 보여줍니다. 예를 들어 상품별 파트너스 링크 누락, 반품가 확인 필요, 상품 이미지 누락 중 무엇이 가장 많은지 바로 알 수 있고, `operator_next_action`에는 최다 blocker부터 보강하라는 다음 조치가 표시됩니다.

관리자 준비도 화면은 각 연결 테스트의 `operator_next_action`을 JSON 세부정보에 묻어두지 않고 `다음 조치` 박스로 따로 보여줍니다. `public_quality_blocker_summary`도 `품질 blocker 요약` 박스로 분리해 표시하므로, 승인 후 첫 가동 전에 가장 많은 공개 보류 사유를 바로 처리할 수 있습니다.

같은 `공개 상품 데이터 품질` 카드에는 `공개 품질 운영 요약`도 표시됩니다. 여기서 공개 상품 수, 고객 공개 가능 수, 고객 화면에서 숨겨진 게시 상품 수, 링크 보강 필요 수, 비정상 링크 수, 승인용 링크 재사용 수, DB 링크 제약 적용 여부를 한눈에 확인할 수 있습니다. API 키 입력 후 첫 가동이 막히면 이 요약을 보고 상품별 파트너스 링크 보강부터 할지, 반품가·반품등급·이미지를 먼저 보완할지 바로 결정할 수 있습니다.

공개 품질 요약에 링크 문제가 있으면 `링크 보강 큐로 이동` 버튼이 나타나고, 반품가·반품등급·이미지 같은 고객공개 품질 blocker가 있으면 `공개 보강 후보로 이동` 버튼이 나타납니다. 버튼을 누르면 해당 관리자 섹션으로 이동하고 강조 표시되므로, 연결 테스트 결과를 보고 바로 보강 작업으로 이어갈 수 있습니다.

네이버 최저가가 비어 있는 경우에는 관리자 페이지의 `네이버 최저가 보강`에서 게시 상품과 검토 후보 누락분을 일괄 재검색할 수 있습니다. 기본값은 `검토 후보까지 포함`이며, API 호출량을 아끼고 싶을 때만 게시 상품 범위로 좁힙니다. `NAVER_CLIENT_ID`와 `NAVER_CLIENT_SECRET`이 없으면 값을 임의로 채우지 않고, 사용자 화면에서는 `새상품 기준가` 또는 `수집 당시 가격`을 `적용 기준가`로 분리 표시합니다.
