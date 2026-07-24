# 청첩장 명단 (wed_invitation) — 프로젝트 스펙

두 사람이 함께 관리하는 **청첩장 하객 명단 웹앱**. 하객 전달 현황, 모임/지출 정산, 모바일 청첩장 링크·멘트 복사를 한 화면에서 관리한다. (원본은 localStorage 단일 HTML 앱이었고, 실사용을 위해 React + Supabase 로 이식·확장했다.)

## 구조 / 배포
- **앱 본체:** `wedding-list.jsx` — 단일 파일 React 컴포넌트(로컬 import 없음, 자체 완결). Supabase URL·anon 키가 상단에 하드코딩됨.
- **빌드:** `web/` (Vite + React). CI가 빌드 시 `wedding-list.jsx` → `web/src/wedding-list.jsx`로 복사 후 `web`에서 `npm ci && npm run build`. `web/src/wedding-list.jsx`는 `.gitignore` 처리(빌드 산출물).
- **배포:** GitHub Pages 자동배포. `.github/workflows/deploy-web.yml`이 `web/**`·`wedding-list.jsx`·워크플로우 파일을 `main`에 push할 때 트리거. base 경로는 `/wed_invitation/`.
- **주소:** `https://opera0919-sketch.github.io/wed_invitation/`
- **빌드 검증(로컬):** `cp wedding-list.jsx web/src/wedding-list.jsx && cd web && npm ci && npm run build`

## 백엔드 (Supabase)
- **프로젝트:** `private-job` (ref: `kialuqypzhtiazpfamvs`). 이 프로젝트의 **하위 항목**으로 `wed_` 접두사 테이블을 사용한다.
- **테이블:** `wed_managers`(허용 목록), `wed_users`(프로필), `wed_guests`, `wed_meetings`, `wed_settings`(단일 행). 전체 스키마는 `supabase/schema.sql`.
- **인증:** Supabase 이메일 + 비밀번호. 외부 OAuth 설정이 필요 없다.
- **접근 제어(사적 정보 보호):** 하객 명단은 실명이 담긴 사적 정보라 **누구나 볼 수 없게** 했다. `wed_managers`에 등록된 이메일만 RLS 로 읽기/쓰기 가능. 시드 관리자는 `opera0919@gmail.com`. 배우자는 설정 탭에서 이메일을 추가해 초대한다(기존 관리자만 추가 가능하므로 무단 가입이 끼어들 수 없음).
- **실시간 동기화:** `wed_*` 테이블이 `supabase_realtime` 퍼블리케이션에 등록되어, 한쪽이 고치면 다른 기기에 즉시 반영된다.
- **오프라인:** 로드 실패 시 localStorage 캐시(`wed_invite_cache_v1`)로 마지막 데이터를 보여준다.

### ⚠️ 최초 1회 대시보드 설정 (이메일+비번 로그인용)
비밀번호 로그인이 메일 확인 없이 바로 되게 하려면 대시보드에서 한 번만:
`Authentication → Sign In / Providers → Email → "Confirm email" 끄기`.
(켜져 있으면 가입 후 확인 메일의 링크를 눌러야 하는데, 그 링크의 리다이렉트가 프로덕션 주소로 설정돼 있지 않아 불편하다.)

## 기능
- **하객:** 이름·구분(신부/신랑/공동)·관계·전달 여부/방식/전달자·참석 여부·메모. 전달 현황·종이 청첩장 잔량·**참석 현황 요약**. 겹지인(같은 이름 다른 구분) 자동 감지 → 공동으로 합치기. **일괄 편집**(다중 선택 → 전달완료/미전달·구분 변경·삭제), **연락처에서 추가**(Web Contact Picker API, 안드로이드 크롬 다중선택 · 미지원 기기는 안내 토스트, 전화번호는 메모에 저장).
- **모임:** 날짜·장소·성격·참석자·지출(항목/금액/결제자/분류). 완료 처리 시 참석자 자동 전달완료. 참석자 **그룹 추가**(구분·관계 단위 한번에), 지난 모임인데 지출이 비면 **하단 알림 배너**.
- **정산:** 신부/신랑 예산 대비 지출, 하객 구분별 배분(머릿수 비율), 큰 모임 순, 하객명단 CSV 내려받기.
- **설정:** 결혼식 날짜·예산·종이 수량, 모바일 청첩장 링크/멘트, **공동 관리자 관리**, 겹지인 기록 초기화, 전체 지우기. (텍스트 입력은 한글 IME 안전을 위해 blur 시 저장 — `LocalText`.)

## 디자인
- 캐주얼 톤: 본문 **Pretendard**, 제목/숫자 **Jua**(둥근 글꼴). 따뜻한 크림 배경 + 부드러운 색(신부 로지핑크/신랑 페리윙클/공동 골드). 폰트는 `web/index.html`에서 CDN 로드.
- 카카오톡 친구 API 는 개인용으로 사용 불가(비즈앱 심사 + 상호 인증 필요)라 채택하지 않음. 대신 웹 표준 Contact Picker API 사용.

## 작업 규칙
1. "사용자가 보는 화면/웹" 요구는 **`wedding-list.jsx`에서** 작업한다.
2. 배포를 일으키려면 `wedding-list.jsx` 또는 `web/` 변경이 필요하다.
3. 스키마 변경은 Supabase 마이그레이션으로 반영하고 `supabase/schema.sql`도 함께 갱신한다.
4. **추측 금지** — 실패 원인은 실제 응답/에러/빌드부터 확인한다.
5. prod(main) push 는 사용자 확인 후 진행한다.
6. 요청하지 않은 기능을 임의로 추가하지 않는다.
