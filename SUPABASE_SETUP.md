# Supabase 설정 (로그인 + 진도 동기화 켜기)

앱은 로그인 없이도(둘러보기) 완전히 동작하지만, **아이디/비번 로그인 + 기기 간 진도 동기화**를 켜려면
아래 2가지를 한 번만 해주면 됩니다. 프로젝트: `pevawxrjyyrutgiwhfnn`

## 1단계 — 테이블 생성 (SQL Editor)

Supabase 대시보드 → **SQL Editor** → New query → 아래 붙여넣고 **Run**:

```sql
-- 사용자별 진도 상태 (앱 상태 객체를 통째로 저장)
create table if not exists public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- 모의고사 점수 이력
create table if not exists public.quiz_results (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  mode text, score int, total int,
  taken_at timestamptz default now()
);

-- RLS: 본인 데이터만 접근
alter table public.user_state enable row level security;
alter table public.quiz_results enable row level security;

create policy "own_state" on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_results" on public.quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 2단계 — 이메일 확인 끄기 (중요!)

아이디/비번만으로 가입·로그인하려면 이메일 확인을 꺼야 합니다.

Supabase 대시보드 → **Authentication** → **Sign In / Providers** → **Email** →
**"Confirm email"** 토글을 **OFF** → Save.

> 이걸 안 끄면 가입 시 가짜 이메일로 확인메일을 보내려다 막혀서 로그인이 안 됩니다.

## 끝!

이제 앱에서 아이디/비밀번호로 **회원가입 → 로그인**하면 진도가 클라우드에 저장되고,
다른 기기(폰↔PC)에서 같은 계정으로 로그인하면 진도가 따라옵니다.

- 키(URL/anon key)는 `supabase.js`에 이미 들어 있습니다. anon key는 공개되어도 안전합니다(접근은 위 RLS로 차단).
- 아이디는 내부적으로 `<아이디>@mmstudy.com` 형식으로 저장됩니다(사용자는 아이디만 입력).
