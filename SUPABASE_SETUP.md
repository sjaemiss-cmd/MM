# Supabase 설정 — SQL 한 번만 실행하면 끝

이메일 인증을 쓰지 않습니다. 아이디/비번을 Postgres 함수(bcrypt)로 직접 처리하므로
**확인메일·rate limit·대시보드 토글이 전부 필요 없습니다.** 아래 SQL 한 블록만 실행하세요.

## 실행 방법
Supabase 대시보드 → **SQL Editor** → **New query** → 아래 전체 붙여넣기 → **Run**.
프로젝트: `pevawxrjyyrutgiwhfnn`

```sql
create extension if not exists pgcrypto;

create table if not exists public.mm_users (
  username   text primary key,
  pass_hash  text not null,
  token      text,
  state      jsonb not null default '{}',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.mm_users enable row level security;
-- 정책 없음 → anon 직접접근 차단. 아래 SECURITY DEFINER 함수로만 접근.

create or replace function public.mm_signup(p_user text, p_pass text)
returns text language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_user));
begin
  if length(u) < 2 then return 'ERR_INPUT'; end if;
  if length(p_pass) < 4 then return 'ERR_INPUT'; end if;
  if exists (select 1 from mm_users where username = u) then return 'ERR_EXISTS'; end if;
  insert into mm_users(username, pass_hash) values (u, crypt(p_pass, gen_salt('bf')));
  return 'OK';
end $$;

create or replace function public.mm_login(p_user text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_user)); r public.mm_users%rowtype; t text;
begin
  select * into r from mm_users where username = u;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.pass_hash = crypt(p_pass, r.pass_hash) then
    t := encode(gen_random_bytes(18), 'hex');
    update mm_users set token = t where username = u;
    return jsonb_build_object('ok', true, 'token', t, 'state', r.state);
  end if;
  return jsonb_build_object('ok', false);
end $$;

create or replace function public.mm_resume(p_user text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_user)); r public.mm_users%rowtype;
begin
  select * into r from mm_users where username = u;
  if not found or r.token is null or r.token <> p_token then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'state', r.state);
end $$;

create or replace function public.mm_save(p_user text, p_token text, p_state jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_user)); r public.mm_users%rowtype;
begin
  select * into r from mm_users where username = u;
  if not found or r.token is null or r.token <> p_token then return 'ERR_AUTH'; end if;
  update mm_users set state = p_state, updated_at = now() where username = u;
  return 'OK';
end $$;

grant execute on function public.mm_signup(text,text)        to anon, authenticated;
grant execute on function public.mm_login(text,text)         to anon, authenticated;
grant execute on function public.mm_resume(text,text)        to anon, authenticated;
grant execute on function public.mm_save(text,text,jsonb)    to anon, authenticated;
```

## 끝!
이제 앱에서 **아이디/비번으로 회원가입 → 로그인**하면 진도가 클라우드에 저장되고,
다른 기기(폰↔PC)에서 같은 계정으로 로그인하면 진도가 따라옵니다.

- 비밀번호는 bcrypt로 해시되어 저장됩니다(평문 저장 안 함).
- `mm_users` 테이블은 RLS로 잠겨 있고, 위 함수(SECURITY DEFINER)로만 접근됩니다.
- anon key는 `supabase.js`에 임베드(공개되어도 안전).
- SQL 실행 전에도 앱은 **"로그인 없이 둘러보기"**로 완전히 동작합니다(진도는 기기에만 저장).
