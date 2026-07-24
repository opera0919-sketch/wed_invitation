-- ============================================================
-- 청첩장 명단 — Supabase 스키마
-- 프로젝트: "private-job" (ref: kialuqypzhtiazpfamvs)
-- 이 프로젝트의 하위 항목으로 wed_ 접두사 테이블을 사용한다.
-- Supabase 대시보드 → SQL Editor 에서 실행하면 재현된다.
-- (이미 마이그레이션 wed_invitation_init 로 적용되어 있음)
-- ============================================================

-- 공동 관리자 허용 목록 (여기 있는 이메일만 접근 가능)
create table if not exists public.wed_managers (
  email      text primary key,
  added_by   text default '',
  created_at timestamptz default now()
);

-- 관리자 프로필 (누가 표시했는지 표기용)
create table if not exists public.wed_users (
  id          uuid primary key,          -- auth.users.id
  email       text default '',
  name        text default '',
  emoji       text default '💍',
  color       text default '',
  profile_set boolean default false,
  created_at  timestamptz default now()
);

-- 하객 명단
create table if not exists public.wed_guests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  side         text default '신부',      -- 신부 / 신랑 / 공동
  relation     text default '',
  delivered    boolean default false,
  method       text default '대면',       -- 대면 / 모바일
  deliverer    text default '함께',       -- 신부 / 신랑 / 함께
  attending    text default '미정',       -- 미정 / 참석 / 불참
  memo         text default '',
  delivered_at text default '',
  created_by   text default '',
  updated_by   text default '',
  created_at   timestamptz default now()
);

-- 모임
create table if not exists public.wed_meetings (
  id           uuid primary key default gen_random_uuid(),
  date         text default '',
  place        text default '',
  type         text default '공동',       -- 신부 / 신랑 / 공동
  status       text default '',           -- 예정 / 완료 / '' (날짜 기준 자동)
  attendee_ids jsonb default '[]'::jsonb,
  expenses     jsonb default '[]'::jsonb, -- [{id,label,amount,payer,category}]
  created_by   text default '',
  updated_by   text default '',
  created_at   timestamptz default now()
);

-- 설정 (단일 행 싱글턴)
create table if not exists public.wed_settings (
  id           int primary key default 1,
  wedding_date text default '',
  budget_b     text default '',
  budget_g     text default '',
  paper_total  text default '',
  link         text default '',
  msg          text default '',
  skips        jsonb default '[]'::jsonb, -- 겹지인 "다른 분" 판단 기록 ["id|id"]
  updated_at   timestamptz default now(),
  constraint wed_settings_singleton check (id = 1)
);
insert into public.wed_settings (id) values (1) on conflict (id) do nothing;

-- 허용 목록 헬퍼: 현재 로그인 이메일이 관리자인가? (security definer → RLS 우회)
create or replace function public.wed_is_manager()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.wed_managers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function public.wed_is_manager() from anon, public;

-- 최초 관리자 시드
insert into public.wed_managers (email, added_by)
values ('opera0919@gmail.com', 'seed')
on conflict (email) do nothing;

-- ── RLS: 관리자만 읽기/쓰기 ──
alter table public.wed_managers enable row level security;
alter table public.wed_users    enable row level security;
alter table public.wed_guests   enable row level security;
alter table public.wed_meetings enable row level security;
alter table public.wed_settings enable row level security;

drop policy if exists wed_managers_all on public.wed_managers;
create policy wed_managers_all on public.wed_managers
  for all to authenticated using (public.wed_is_manager()) with check (public.wed_is_manager());

drop policy if exists wed_users_select on public.wed_users;
create policy wed_users_select on public.wed_users
  for select to authenticated using (public.wed_is_manager());
drop policy if exists wed_users_upsert on public.wed_users;
create policy wed_users_upsert on public.wed_users
  for insert to authenticated with check (public.wed_is_manager() and id = auth.uid());
drop policy if exists wed_users_update on public.wed_users;
create policy wed_users_update on public.wed_users
  for update to authenticated using (public.wed_is_manager() and id = auth.uid())
  with check (public.wed_is_manager() and id = auth.uid());

drop policy if exists wed_guests_all on public.wed_guests;
create policy wed_guests_all on public.wed_guests
  for all to authenticated using (public.wed_is_manager()) with check (public.wed_is_manager());
drop policy if exists wed_meetings_all on public.wed_meetings;
create policy wed_meetings_all on public.wed_meetings
  for all to authenticated using (public.wed_is_manager()) with check (public.wed_is_manager());
drop policy if exists wed_settings_all on public.wed_settings;
create policy wed_settings_all on public.wed_settings
  for all to authenticated using (public.wed_is_manager()) with check (public.wed_is_manager());

-- ── Realtime ──
alter publication supabase_realtime add table public.wed_guests;
alter publication supabase_realtime add table public.wed_meetings;
alter publication supabase_realtime add table public.wed_settings;
alter publication supabase_realtime add table public.wed_users;
alter publication supabase_realtime add table public.wed_managers;
