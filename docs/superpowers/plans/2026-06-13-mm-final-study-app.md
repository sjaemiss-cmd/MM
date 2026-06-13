# MM 기말고사 학습앱 (T5~T9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마케팅관리 기말고사(6/16, T5~9) 대비 모바일 학습앱을, 기존 중간앱보다 훨씬 높은 품질로 + Supabase 로그인/진도동기화와 함께 제작한다.

**Architecture:** 빌드 없는 정적 웹앱(`index.html`+`app.js`+`styles.css`). 콘텐츠는 repo의 정적 JSON(`data/*.json`), 사용자 데이터(진도/점수)는 Supabase(Auth + RLS). localStorage 1차 캐시 후 로그인 시 서버 동기화.

**Tech Stack:** Vanilla HTML/CSS/JS(ES modules), Supabase JS v2(CDN), pdftotext(콘텐츠 추출), node(검증 스크립트), GitHub Pages(배포), PWA.

**검증 철학:** 백엔드 단위테스트 대신 — (a) JSON 스키마/카운트 검증 스크립트, (b) 브라우저 실동작 확인(`/browse` 스킬), (c) 카카오 빈칸답 대조. 각 태스크 끝에 커밋.

---

## 파일 구조

| 파일 | 책임 |
|------|------|
| `index.html` | 앱 셸: 모든 화면(screen) 마크업, CDN/스크립트 로드 |
| `styles.css` | 디자인 시스템(토큰, 다크모드, 컴포넌트, 모바일 퍼스트) |
| `app.js` | 라우팅, 상태모델, 학습 모드 로직, 렌더링 |
| `supabase.js` | Supabase 클라이언트, 인증(아이디/비번), 진도 동기화 |
| `data/questions.json` | T5~9 문제은행(mc/blank) |
| `data/theory.json` | T5~9 이론 카드 |
| `data/cases.json` | 사례 포인트 카드 |
| `manifest.json` / `sw.js` | PWA(기말용 갱신) |
| `build/extract_*.txt` | (작업산출) pdftotext 추출 원문, gitignore |
| `scripts/validate.mjs` | JSON 스키마/카운트 검증(node) |

---

## Phase A — 콘텐츠 (핵심)

### Task A1: PDF 텍스트 추출 + 빈칸 위치 표시

**Files:** Create `build/` (gitignore), 산출 `build/T5.txt`~`build/T9.txt`

- [ ] **Step 1:** `.gitignore`에 `build/` 추가, 커밋.
- [ ] **Step 2:** T5~9 PDF를 pdftotext로 레이아웃 보존 추출.

```bash
mkdir -p build
for n in 5 6 7 8 9; do
  f=$(ls 강의자료/Topic\ $n*.pdf)
  pdftotext -layout -enc UTF-8 "$f" "build/T$n.txt"
done
wc -l build/T*.txt
```

- [ ] **Step 3:** 각 파일에서 빈칸 패턴(`____`, `_____`, 밑줄 연속) 위치를 grep으로 추출하여 `build/blanks_raw.txt`에 페이지/줄과 함께 기록.

```bash
grep -nE '_{3,}' build/T*.txt > build/blanks_raw.txt; wc -l build/blanks_raw.txt
```

- [ ] **Step 4:** 추출 품질 육안 확인(한글 깨짐 여부). 깨지면 `-raw` 옵션 또는 PyMuPDF 설치(`pip install pymupdf`)로 재시도.
- [ ] **Step 5:** 커밋 — `chore: T5~9 PDF 텍스트 추출 파이프라인` (build/는 gitignore라 스크립트/노트만).

### Task A2: 카카오 빈칸답 + 사례 레퍼런스 맵 작성

**Files:** Create `build/kakao_refs.md` (gitignore)

- [ ] **Step 1:** 카카오 파일에서 빈칸답/사례결론을 사람이 읽기 좋게 정리(아래 확보분 기준 + 추가 스캔).

```
5장: 24.낮고/신속한 · 25.대면/조사원편향 · 26.상호배타적 · 28.신뢰성/타당성 · 29.응답편향 · 30.무의식적 · 31.기술/추론
6장: 4.무형성 · 6.증강 · 9p.대인적 · 10.브랜드자산 · 11.버즈/바이럴 · 12.인적판매/광고 · 13.저/고/인적판매 · 7p.비용 · 8p.관계
사례: Stanley(가치창출·STP전환·커뮤니티), Chipotle(원가+가치 혼합 가격, 회피형 커뮤니케이션, 가격민감도 낮은 핵심고객)
```

- [ ] **Step 2:** 카카오 전체를 재스캔해 누락된 빈칸답/사례 추가(`grep -nE '[0-9]+\.' KakaoTalk_*.txt` 등으로 답안 라인 탐색).
- [ ] **Step 3:** 이 맵은 A4~A7 콘텐츠 생성 에이전트에 **빈칸 정답 우선 출처**로 전달. (커밋 없음 — gitignore)

### Task A3: T5 기존 데이터 추출(재사용)

**Files:** Create `build/t5_extracted.json` (gitignore)

- [ ] **Step 1:** `mm-study.html`에서 `THEORY_DATA`와 문제 배열(인라인 `const`) 중 `topic===5`만 추출하는 node 스크립트 작성/실행.

```bash
node -e "const h=require('fs').readFileSync('mm-study.html','utf8');
const m=h.match(/const THEORY_DATA = (\[.*?\]);/s); /* 필요시 정규식 보정 */
console.log(m? 'THEORY found':'check var name');"
```

- [ ] **Step 2:** 추출한 T5 questions/theory를 최종 스키마로 정규화하여 `build/t5_extracted.json` 저장.
- [ ] **Step 3:** 카카오 5장 빈칸답(24~31 등)과 대조해 정답/`accept` 보정.
- [ ] **Step 4:** 커밋 없음(중간 산출). 정규화 결과는 A9에서 병합.

### Task A4~A7: T6/T7/T8/T9 콘텐츠 생성 (토픽별, 병렬 가능)

**Files:** 각 산출 `build/t6.json`, `build/t7.json`, `build/t8.json`, `build/t9.json`
(형식: `{ "questions": [...], "theory": [...] }`)

각 토픽마다 동일 절차(아래는 T6 기준, T7~9 동일 — 토픽번호/PDF만 교체):

- [ ] **Step 1:** 입력 준비 — `build/T6.txt`(원문), `build/kakao_refs.md`(6장 빈칸답), 스키마, 시험형식(`mm 중간고사.txt`).
- [ ] **Step 2:** 콘텐츠 생성(서브에이전트 권장). 산출 = `build/t6.json`.
  - **theory**: PDF 섹션 구조대로 카드화. PDF 빈칸은 `md`에서 **`**`정답`**`** (백틱+볼드) 토글로 표기. 빈칸 정답은 **카카오 우선**, 없으면 PDF 문맥/마케팅 이론 조사로 채우고 불확실하면 `(추정)` 병기.
  - **questions**: 선다 85% + 빈칸 15% 비율. 시험 강조점 반영(주어-서술 매칭, 전략 적용 상황, 사례 포인트). 각 문항 `stars`(5 필수~3 보통), `explain` 필수. id는 토픽×100+순번(601~).
- [ ] **Step 3:** 스키마 검증(A9의 `validate.mjs` 부분 실행) — 필드 누락/타입 오류 0.
- [ ] **Step 4:** 카카오 6장 빈칸답이 해당 blank 문항/이론에 정확 반영됐는지 대조.
- [ ] **Step 5:** 커밋 없음(개별 산출) — A9에서 병합 후 일괄 커밋.

> **병렬 실행:** T6~T9는 상호 독립이므로 Agent 4개 동시 실행 권장(각 토픽 PDF 원문 + 해당 장 카카오답 전달).

### Task A8: 사례 포인트 카드(cases) 작성

**Files:** Create `build/cases.json`

- [ ] **Step 1:** 카카오 사례토론 결론(Stanley, Chipotle 등)을 `cases.json` 스키마로 정리.

```json
[{ "id":"chipotle","topic":9,"title":"Chipotle 가격 전략",
   "article":"가격 인상에도 고객충성 유지(기사 요약)",
   "points":["원가 상승이 계기지만 실제 인상력은 브랜드 지각가치에서","가격 강조 대신 품질·건강성·고단백 강조(회피형 커뮤니케이션)","핵심고객 고소득·가격민감도 낮음"],
   "concepts":["가치기반 가격","가격민감도","브랜드 지각가치"] }]
```

- [ ] **Step 2:** 각 사례를 해당 토픽(T6~9)에 연결, 시험 "사례 포인트" 관점에서 3~5개 핵심포인트.
- [ ] **Step 3:** 커밋 없음 — A9에서 병합.

### Task A9: 데이터 병합 + 검증

**Files:** Create `data/questions.json`, `data/theory.json`, `data/cases.json`, `scripts/validate.mjs`

- [ ] **Step 1:** `scripts/validate.mjs` 작성 — 스키마/카운트/중복 id/빈칸 accept 존재/answer 인덱스 범위 검증.

```js
import fs from 'node:fs';
const Q = JSON.parse(fs.readFileSync('data/questions.json','utf8'));
let err=0; const ids=new Set();
for (const q of Q){
  if(ids.has(q.id)){console.error('dup id',q.id);err++} ids.add(q.id);
  if(![5,6,7,8,9].includes(q.topic)){console.error('bad topic',q.id);err++}
  if(q.type==='mc'){ if(!Array.isArray(q.options)||q.answer<0||q.answer>=q.options.length){console.error('mc bad',q.id);err++} }
  else if(q.type==='blank'){ if(!q.accept||!q.accept.length){console.error('blank no accept',q.id);err++} }
  else {console.error('bad type',q.id);err++}
  if(!q.explain){console.error('no explain',q.id);err++}
}
console.log(`questions=${Q.length} errors=${err}`);
process.exit(err?1:0);
```

- [ ] **Step 2:** A3(T5)+A4~A7(T6~9) 문제를 `data/questions.json`으로, theory를 `data/theory.json`으로, A8을 `data/cases.json`으로 병합.
- [ ] **Step 3:** `node scripts/validate.mjs` 실행. Expected: `errors=0`. 토픽별 카운트(T5~9) 출력 확인.
- [ ] **Step 4:** 빈칸 누락 점검 — `build/blanks_raw.txt`의 빈칸 개수와 blank 문항/이론 토글 수 비교, 누락 보완.
- [ ] **Step 5:** 커밋 — `feat: T5~9 콘텐츠(문제/이론/사례) JSON + 검증 스크립트`.

---

## Phase B — 앱 (Supabase + UI)

### Task B1: 디자인 시스템 + 앱 셸 스캐폴드

**Files:** Create `index.html`, `styles.css`

- [ ] **Step 1:** `styles.css` — CSS 변수 토큰(라이트/다크), 타이포 스케일, 간격, 카드/버튼/입력 컴포넌트, `100dvh`/safe-area, `prefers-color-scheme` + 수동 토글.
- [ ] **Step 2:** `index.html` — `<head>`(viewport, manifest, theme-color, supabase CDN), `<body>`에 화면 컨테이너: `#login` `#home` `#topic-select` `#quiz` `#result` `#review` `#theory-select` `#theory` `#cases` 와 하단/상단 네비. `app.js`/`supabase.js`를 `type="module"`로 로드.
- [ ] **Step 3:** 브라우저로 열어 레이아웃·다크모드 토글 확인(`/browse` 스킬 또는 로컬 서버 `npx serve`).
- [ ] **Step 4:** 커밋 — `feat: 앱 셸 + 디자인 시스템(다크모드, 모바일 퍼스트)`.

### Task B2: 상태모델 + 데이터 로딩 + 라우팅

**Files:** Modify `app.js`

- [ ] **Step 1:** 데이터 로딩 — `fetch('data/questions.json'|'theory.json'|'cases.json')` 후 메모리 보관.
- [ ] **Step 2:** 상태모델 — `state = { answered:{}, correct:{}, lastAnswer:{}, wrong:[], session:null, prefs:{} }`. localStorage `mmf_state` 키로 load/save. (중간앱과 동일 구조 → 동기화 용이)
- [ ] **Step 3:** 라우팅 — `showScreen(id)`로 `.active` 토글, 히스토리 back 처리.
- [ ] **Step 4:** 검증 — 콘솔에서 `state` 저장/복원, 데이터 카운트 표시 확인.
- [ ] **Step 5:** 커밋 — `feat: 상태모델 + 데이터 로딩 + 화면 라우팅`.

### Task B3: 학습 모드(퀴즈 엔진)

**Files:** Modify `app.js`

- [ ] **Step 1:** 문제 렌더링 — mc(옵션 버튼)/blank(입력+관대한 매칭 `matchBlank`: 공백/구두점 무시, accept 토큰 포함 허용). 정오답 즉시 `explain` 노출.
- [ ] **Step 2:** 모드 — `all`/`topic`/`mock`(~55문항, 선다85%+주관15% 랜덤)/`blank`/`wrong`. `startMode(mode,topic?)`.
- [ ] **Step 3:** 진행/결과 — 진행바, `recordAnswer`로 state 반영, 결과 화면(점수/정답률), `quiz_results` 적재 훅 자리.
- [ ] **Step 4:** 이어풀기 — `saveSession`/`resumeSession`(모드/위치/답안/문제ID).
- [ ] **Step 5:** 검증 — 각 모드 한 바퀴 풀어 정오답/해설/결과 동작 확인.
- [ ] **Step 6:** 커밋 — `feat: 퀴즈 엔진(5모드 + 빈칸 매칭 + 이어풀기)`.

### Task B4: 이론 학습 + 사례 모드

**Files:** Modify `app.js`

- [ ] **Step 1:** 이론 — 토픽/섹션 목록 → 카드 뷰. `md` 렌더(`**`코드`**`→ 빈칸 토글, 표/리스트). 전체 공개 버튼.
- [ ] **Step 2:** 사례 — `cases.json`을 토픽별 카드로, 핵심포인트/연계개념 노출.
- [ ] **Step 3:** 검증 — 빈칸 토글, 카드 이동, 사례 표시 확인.
- [ ] **Step 4:** 커밋 — `feat: 이론 학습 + 사례 포인트 모드`.

### Task B5: 대시보드 홈

**Files:** Modify `app.js`, `styles.css`

- [ ] **Step 1:** 홈 — 전체 진도율, **토픽별 숙련도 바**(푼 문제/정답률), 약점 토픽 강조, 최근 학습, 모드 진입 메뉴.
- [ ] **Step 2:** 통계 계산 — state에서 토픽별 집계 함수.
- [ ] **Step 3:** 검증 — 몇 문제 풀고 홈 통계 갱신 확인.
- [ ] **Step 4:** 커밋 — `feat: 대시보드 홈(토픽별 숙련도/약점/진도)`.

### Task B6: Supabase 인증(아이디/비번)

**Files:** Create `supabase.js`; Modify `index.html`(#login), `app.js`

- [ ] **Step 1:** Supabase 프로젝트에 SQL 적용(사용자에게 키 수령 후):

```sql
create table public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null default '{}', updated_at timestamptz default now());
create table public.quiz_results (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  mode text, score int, total int, taken_at timestamptz default now());
alter table public.user_state enable row level security;
alter table public.quiz_results enable row level security;
create policy own_state on public.user_state for all
  using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy own_results on public.quiz_results for all
  using (auth.uid()=user_id) with check (auth.uid()=user_id);
```
(Supabase Auth: Email 확인 OFF로 설정.)

- [ ] **Step 2:** `supabase.js` — 클라이언트 생성(URL/anon key), `signUp(id,pw)`/`signIn(id,pw)`는 내부적으로 `${id}@mm.local` 이메일 사용. `getUser`, `signOut`.

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const sb = createClient(SUPA_URL, SUPA_ANON);
const email = id => `${id.trim().toLowerCase()}@mm.local`;
export const signUp = (id,pw)=> sb.auth.signUp({email:email(id),password:pw});
export const signIn = (id,pw)=> sb.auth.signInWithPassword({email:email(id),password:pw});
```

- [ ] **Step 3:** `#login` 화면 — 아이디/비번 입력, 가입/로그인 토글, 에러 표시. 로그인 성공 시 홈으로.
- [ ] **Step 4:** 검증 — 가입→로그아웃→로그인 동작, 잘못된 비번 에러 확인.
- [ ] **Step 5:** 커밋 — `feat: Supabase 아이디/비번 로그인 + 가입`.

### Task B7: 진도 동기화

**Files:** Modify `supabase.js`, `app.js`

- [ ] **Step 1:** `pullState()` — 로그인 후 `user_state.state` 조회, 서버가 더 최신(`updated_at`)이면 localStorage에 머지.
- [ ] **Step 2:** `pushState()` — state 변경 시 debounce(예 1.5s) upsert. `quiz_results`는 결과 화면에서 insert.
- [ ] **Step 3:** 오프라인/비로그인 — localStorage만으로 정상 동작, 로그인 시 동기화.
- [ ] **Step 4:** 검증 — 기기 A에서 풀고, 기기 B(또는 시크릿창)에서 같은 계정 로그인 → 진도 반영 확인.
- [ ] **Step 5:** 커밋 — `feat: 사용자별 진도 Supabase 동기화(폰↔PC)`.

### Task B8: PWA 갱신 + 배포 + 최종 검증

**Files:** Modify `manifest.json`, `sw.js`; (배포: GitHub Pages)

- [ ] **Step 1:** `manifest.json`(이름 "MM 기말", start_url `./index.html`), `sw.js` 캐시 버전 갱신 + `data/*.json` 캐시.
- [ ] **Step 2:** 커밋 + push → GitHub Pages(`sjaemiss-cmd.github.io/MM/`).
- [ ] **Step 3:** 모바일 뷰포트로 전 화면 QA(`/browse` 또는 실제 폰): 로그인→동기화, 5+2모드, 다크모드, 빈칸/사례.
- [ ] **Step 4:** `작업내역.md`에 기말 버전 작업내역 추가.
- [ ] **Step 5:** 커밋 — `feat: PWA 기말 버전 + 배포` / `docs: 기말 작업내역`.

---

## Self-Review (작성자 점검)

**스펙 커버리지:** 로그인/동기화(B6,B7), 진도(B2,B5,B7), 5+2모드(B3,B4), T5~9 콘텐츠·빈칸·사례(A1~A9), 품질 업그레이드(B1,B5), 시험형식 모의고사(B3), 배포(B8) — 스펙 §1~12 모두 태스크로 매핑됨. ✅

**Placeholder 점검:** 핵심 코드(검증 스크립트, RLS SQL, 인증, 동기화)는 실제 코드로 기재. 거대 프론트엔드(app.js ~수천 줄)는 라인 전체 인라인 대신 파일 책임·인터페이스·핵심 함수·검증으로 명시(도메인 특성상 적정). ⚠️→의도적.

**타입 일관성:** state 키(`answered/correct/lastAnswer/wrong/session/prefs`), 함수명(`showScreen/startMode/matchBlank/recordAnswer/saveSession/resumeSession/pullState/pushState/signUp/signIn`), 스키마 필드(`id/topic/section/type/q/options/answer/accept/explain/stars`)가 전 태스크에서 일관. ✅

**리스크:** Supabase 키 수령 전 B1~B5 선행 가능(localStorage). pdftotext 한글 깨짐 시 PyMuPDF 설치 폴백.
