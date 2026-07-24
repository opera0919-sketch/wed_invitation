# 청첩장 명단 (wed_invitation)

두 사람이 함께 관리하는 **청첩장 하객 명단 웹앱**입니다.
하객 전달 현황, 모임·지출 정산, 모바일 청첩장 링크/멘트 복사를 한 화면에서 관리합니다.

- **주소:** https://opera0919-sketch.github.io/wed_invitation/
- **본체:** `wedding-list.jsx` (단일 파일 React 컴포넌트)
- **백엔드:** Supabase (`private-job` 프로젝트, `wed_` 접두사 테이블) — 두 관리자 기기 간 실시간 동기화
- **접근:** 등록된 공동 관리자(이메일)만. 자세한 내용은 [`AGENTS.md`](./AGENTS.md), 스키마는 [`supabase/schema.sql`](./supabase/schema.sql).

## 처음 시작하기
1. Supabase 대시보드에서 **한 번만**: `Authentication → Email → "Confirm email" 끄기`.
2. 앱에서 이메일·비밀번호로 가입/로그인 (`opera0919@gmail.com` 은 기본 관리자로 등록되어 있음).
3. 설정 탭 → **공동 관리자**에 배우자 이메일을 추가하면 두 사람이 함께 관리할 수 있습니다.

## 로컬 빌드
```bash
cp wedding-list.jsx web/src/wedding-list.jsx
cd web && npm ci && npm run build
```
