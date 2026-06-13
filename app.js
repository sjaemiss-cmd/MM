// ===== MM 기말 학습앱 =====
import { SUPA_ENABLED, rpcSignup, rpcLogin, rpcResume, rpcSave } from './supabase.js';

const TOPICS = {
  5: { name: '마케팅 조사', short: 'T5' },
  6: { name: '제품·브랜딩', short: 'T6' },
  7: { name: '유통·공급망', short: 'T7' },
  8: { name: '촉진·IMC', short: 'T8' },
  9: { name: '가격', short: 'T9' },
};
const TOPIC_NUMS = [5, 6, 7, 8, 9];

let QUESTIONS = [], THEORY = [];
const byId = {};

// ----- 상태 -----
const DEFAULT_STATE = () => ({ answered: {}, correct: {}, lastAnswer: {}, wrong: [], bookmarks: [], session: null, updatedAt: 0 });
let state = DEFAULT_STATE();
let auth = null;       // { username, token } 로그인 시
let localOnly = false; // 둘러보기

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ===== 저장 / 동기화 =====
const LS_KEY = 'mmf_state', THEME_KEY = 'mmf_theme', AUTH_KEY = 'mmf_auth';
let pushTimer = null;

function loadLocal() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) state = Object.assign(DEFAULT_STATE(), JSON.parse(raw)); } catch {}
}
function saveLocal() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  scheduleSync();
}
function scheduleSync() {
  if (!auth) return;
  setSync('syncing');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const { error } = await rpcSave(auth.username, auth.token, state);
    setSync(error ? '' : 'on');
  }, 1500);
}
function setSync(s) {
  const d = $('syncDot'); if (!d) return;
  d.className = 'sync-dot' + (s === 'on' ? ' on' : s === 'syncing' ? ' syncing' : '');
  d.title = auth ? (s === 'syncing' ? '동기화 중…' : '동기화됨') : '로컬 저장';
}
// 서버 상태 병합 (최신 우선)
function applyServerState(remote) {
  if (remote && typeof remote === 'object' && Object.keys(remote).length) {
    const rU = remote.updatedAt || 0;
    if (rU >= (state.updatedAt || 0)) {
      state = Object.assign(DEFAULT_STATE(), remote);
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
      return;
    }
  }
  scheduleSync(); // 로컬이 더 최신 → 서버로 올림
}
async function doLoginSuccess(username, token, serverState) {
  auth = { username: String(username).trim().toLowerCase(), token };
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  applyServerState(serverState);
  goHome(); showScreen('home'); setSync('on');
}

// ===== 라우팅 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}
let navStack = [];
function activeScreen() { const a = document.querySelector('.screen.active'); return a ? a.id : ''; }
// 깊은 화면 진입 시 브라우저 히스토리 항목을 쌓는다.
function nav(renderFn) { try { history.pushState({ app: true }, ''); } catch {} navStack.push(renderFn); renderFn(); }
function pushHist() { try { history.pushState({ app: true }, ''); } catch {} }
// 모든 뒤로가기(앱 버튼/하드웨어)는 history.back()으로 통일 → popstate가 실제 이동 처리
function back() { history.back(); }
function goHome() { navStack = []; renderHome(); showScreen('home'); try { history.replaceState({ app: true, root: true }, ''); } catch {} }

// 브라우저/하드웨어 뒤로가기 처리
let rootBackAt = 0;
window.addEventListener('popstate', () => {
  const s = activeScreen();
  if (s === 'quiz') { saveSession(); toast('진행 상황 저장됨'); goHome(); return; }
  if (s === 'result') { goHome(); return; }
  if (s === 'list' || s === 'theory') {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    if (prev) prev(); else goHome();
    return;
  }
  // 루트(home/login): 사이트 이탈 방지 — 항목을 다시 쌓아 머무른다
  const now = Date.now();
  try { history.pushState({ app: true, root: true }, ''); } catch {}
  if (s === 'home' && now - rootBackAt > 1500) toast('첫 화면입니다');
  rootBackAt = now;
});

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ===== 통계 =====
function stats() {
  const total = QUESTIONS.length;
  const done = Object.keys(state.answered).length;
  const correct = Object.values(state.correct).filter(Boolean).length;
  const rate = done ? Math.round(correct / done * 100) : 0;
  return { total, done, correct, rate, wrong: state.wrong.length };
}
function topicStat(n) {
  const qs = QUESTIONS.filter(q => q.topic === n);
  const done = qs.filter(q => state.answered[q.id]).length;
  const correct = qs.filter(q => state.correct[q.id]).length;
  const mastery = qs.length ? Math.round(correct / qs.length * 100) : 0;
  return { total: qs.length, done, correct, mastery };
}

// ===== HOME =====
function renderHome() {
  setSync(auth ? 'on' : '');
  $('avatarBtn').textContent = auth ? auth.username.slice(0, 2).toUpperCase() : (localOnly ? '👤' : '?');
  const s = stats();
  const body = $('homeBody');
  body.innerHTML = '';

  const greet = el('div', 'greet');
  greet.innerHTML = `<div><div class="hi">안녕하세요${auth ? ', ' + auth.username : ''} 👋</div>
    <div class="sub">마케팅관리 기말 · T5~T9 · 6/16 시험</div></div>`;
  body.appendChild(greet);

  const hero = el('div', 'card pad');
  hero.innerHTML = `<div class="progress-hero">
    <div class="ring" style="--p:${s.total ? Math.round(s.done / s.total * 100) : 0};position:relative">
      <div class="inner"><div class="pct">${s.total ? Math.round(s.done / s.total * 100) : 0}%</div><div class="pl">진도</div></div>
    </div>
    <div class="hero-stats">
      <div class="s"><div class="n">${s.done}<span style="font-size:13px;color:var(--faint)"> / ${s.total}</span></div><div class="l">푼 문제</div></div>
      <div class="s"><div class="n">${s.rate}%</div><div class="l">정답률</div></div>
      <div class="s"><div class="n" style="color:var(--no)">${s.wrong}</div><div class="l">오답</div></div>
      <div class="s"><div class="n" style="color:var(--warn)">${state.bookmarks.length}</div><div class="l">즐겨찾기</div></div>
    </div></div>`;
  body.appendChild(hero);

  const mast = el('div', 'card pad');
  let mh = `<h2 class="sec" style="margin-bottom:14px">토픽별 숙련도</h2><div class="mastery">`;
  for (const n of TOPIC_NUMS) {
    const ts = topicStat(n);
    const weak = ts.done > 0 && ts.mastery < 50;
    mh += `<div class="mrow"><div class="mlabel">${TOPICS[n].short} ${TOPICS[n].name}</div>
      <div class="mbar"><div class="mfill ${weak ? 'weak' : ''}" style="width:${ts.mastery}%"></div></div>
      <div class="mpct">${ts.mastery}%</div></div>`;
  }
  mh += `</div>`;
  mast.innerHTML = mh;
  body.appendChild(mast);

  if (state.session && state.session.qids && state.session.qids.length) {
    const ss = state.session;
    const r = el('div', 'resume-card');
    r.innerHTML = `<div><div class="rt">이어서 풀기</div><div class="rs">${modeLabel(ss.mode)} · ${ss.idx + 1}/${ss.qids.length}번</div></div><div class="rgo">계속 ›</div>`;
    r.onclick = resumeSession;
    body.appendChild(r);
  }

  const menu = el('div', 'menu');
  menu.appendChild(menuItem('violet', '📖', '이론 학습', '개념 카드 + 빈칸 암기', () => nav(renderTheoryTopics)));
  menu.appendChild(menuItem('amber', '📝', '모의고사', '기말형식 55문항 (객관식46 + 주관식9)', () => startMode('mock')));
  menu.appendChild(menuItem('blue', '📚', '전체 학습', `T5~T9 ${QUESTIONS.length}문항 순서대로`, () => startMode('all')));
  menu.appendChild(menuItem('blue', '🎯', '토픽별 학습', '원하는 토픽만 집중', () => nav(renderTopicPick)));
  menu.appendChild(menuItem('green', '✏️', '빈칸만 학습', '주관식 빈칸 집중', () => startMode('blank')));
  menu.appendChild(menuItem('red', '🔁', '오답 복습', '틀린 문제만 다시', () => startMode('wrong'), s.wrong));
  menu.appendChild(menuItem('amber', '⭐', '즐겨찾기', '저장한 문제 다시', () => startMode('bookmark'), state.bookmarks.length));
  body.appendChild(menu);

  body.appendChild(el('div', 'tiny', `<div style="text-align:center;padding:8px 0 12px">총 ${QUESTIONS.length}문항 · ${THEORY.length} 이론카드 · ${auth ? '☁ ' + auth.username + ' 진도 동기화 중' : (localOnly ? '이 기기에만 저장 (로그인 시 동기화)' : '')}</div>`));
}

function menuItem(color, icon, title, desc, onClick, badge) {
  const b = el('button', 'mitem');
  b.innerHTML = `<div class="ic ${color}">${icon}</div>
    <div class="mtext"><div class="mt">${title}</div><div class="md">${desc}</div></div>
    ${badge ? `<span class="badge">${badge}</span>` : '<span class="chev">›</span>'}`;
  b.onclick = onClick;
  return b;
}
function modeLabel(m) {
  return { all: '전체 학습', mock: '모의고사', blank: '빈칸 학습', wrong: '오답 복습', bookmark: '즐겨찾기', topic: '토픽 학습' }[m] || m;
}

// ===== 토픽 선택 =====
function renderTopicPick() {
  $('listTitle').textContent = '토픽 선택';
  const b = $('listBody'); b.innerHTML = '';
  const list = el('div', 'list');
  for (const n of TOPIC_NUMS) {
    const ts = topicStat(n);
    const row = el('button', 'lrow');
    row.innerHTML = `<div><div class="lt">${TOPICS[n].short}. ${TOPICS[n].name}</div><div class="lsub">${ts.done}/${ts.total} 완료 · 정답률 ${ts.done ? Math.round(ts.correct / ts.done * 100) : 0}%</div></div>
      <div class="lcnt"><div class="mini-bar"><div class="mini-fill" style="width:${ts.mastery}%"></div></div></div>`;
    row.onclick = () => startMode('topic', n);
    list.appendChild(row);
  }
  b.appendChild(list);
  showScreen('list');
}

// ===== 큐 구성 =====
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function byStars(a) { return a.slice().sort((x, y) => (y.stars || 3) - (x.stars || 3)); }

function buildQueue(mode, topic) {
  const mc = QUESTIONS.filter(q => q.type === 'mc');
  const multi = QUESTIONS.filter(q => q.type === 'multi');
  const blank = QUESTIONS.filter(q => q.type === 'blank');
  switch (mode) {
    case 'all': return QUESTIONS.slice().sort((a, b) => a.id - b.id);
    case 'topic': return QUESTIONS.filter(q => q.topic === topic).sort((a, b) => a.id - b.id);
    case 'blank': return shuffle(blank);
    case 'wrong': return QUESTIONS.filter(q => state.wrong.includes(q.id));
    case 'bookmark': return QUESTIONS.filter(q => state.bookmarks.includes(q.id));
    case 'mock': {
      const m = byStars(shuffle(mc)).slice(0, 43);
      const mu = shuffle(multi).slice(0, 3);
      const bl = byStars(shuffle(blank)).slice(0, 9);
      return [...shuffle(m), ...mu, ...bl];
    }
    default: return QUESTIONS.slice();
  }
}

// ===== 퀴즈 =====
let qz = null;

function startMode(mode, topic) {
  const queue = buildQueue(mode, topic);
  if (!queue.length) {
    toast(mode === 'wrong' ? '오답이 없습니다 👍' : mode === 'bookmark' ? '즐겨찾기가 비어 있어요' : '문제가 없습니다');
    return;
  }
  qz = { mode, topic, queue, idx: 0, checked: false, selected: [], score: 0, scored: (mode === 'mock') };
  pushHist();
  showScreen('quiz');
  renderQ();
}

function resumeSession() {
  const ss = state.session;
  const queue = ss.qids.map(id => byId[id]).filter(Boolean);
  if (!queue.length) { state.session = null; saveLocal(); goHome(); return; }
  qz = { mode: ss.mode, topic: ss.topic, queue, idx: Math.min(ss.idx, queue.length - 1), checked: false, selected: [], score: ss.score || 0, scored: ss.scored };
  pushHist();
  showScreen('quiz');
  renderQ();
}
function saveSession() {
  if (!qz || qz.mode === 'wrong') return;
  state.session = { mode: qz.mode, topic: qz.topic, qids: qz.queue.map(q => q.id), idx: qz.idx, score: qz.score, scored: qz.scored };
  saveLocal();
}

function renderQ() {
  const q = qz.queue[qz.idx];
  qz.checked = false; qz.selected = [];
  const n = qz.idx + 1, tot = qz.queue.length;
  $('qNum').textContent = `${n} / ${tot}`;
  $('qTopic').textContent = `${TOPICS[q.topic].short}`;
  $('qProg').style.width = (n / tot * 100) + '%';
  $('qStar').style.display = (q.stars >= 5) ? '' : 'none';
  $('qMulti').style.display = (q.type === 'multi') ? '' : 'none';
  $('qText').innerHTML = renderQText(q.q);
  $('qExplain').style.display = 'none';
  const bm = $('qBookmark');
  bm.textContent = state.bookmarks.includes(q.id) ? '★' : '☆';
  bm.classList.toggle('on', state.bookmarks.includes(q.id));
  bm.onclick = () => toggleBookmark(q.id);

  const opts = $('qOpts'), blankWrap = $('qBlankWrap');
  opts.innerHTML = ''; blankWrap.style.display = 'none'; opts.style.display = 'none';

  if (q.type === 'blank') {
    blankWrap.style.display = 'flex';
    const inp = $('qBlank'); inp.value = ''; inp.className = 'blank-in'; inp.disabled = false;
    $('qHint').textContent = `힌트: ${(q.answer || '').length}글자`;
    inp.oninput = updateFoot;
    inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) checkCurrent(); };
    setTimeout(() => inp.focus(), 120);
  } else {
    opts.style.display = 'flex';
    const isMulti = q.type === 'multi';
    q.options.forEach((opt, i) => {
      const o = el('button', 'opt' + (isMulti ? ' multi-style' : ''));
      o.innerHTML = `<span class="mark"></span><span>${opt}</span>`;
      o.onclick = () => isMulti ? toggleMulti(i, o) : checkMc(i);
      o._idx = i;
      opts.appendChild(o);
    });
  }
  updateFoot();
}
function renderQText(t) { return String(t).replace(/_{2,}/g, '<span class="bk">&nbsp;&nbsp;&nbsp;&nbsp;</span>'); }

function checkMc(idx) {
  if (qz.checked) return;
  const q = qz.queue[qz.idx];
  qz.selected = [idx];
  const correct = idx === q.answer;
  [...$('qOpts').children].forEach(o => {
    if (o._idx === q.answer) o.classList.add('correct');
    if (o._idx === idx && !correct) o.classList.add('wrong');
    if (o._idx === idx) o.querySelector('.mark').textContent = '✓';
  });
  finishCheck(q, correct);
}
function toggleMulti(idx, node) {
  if (qz.checked) return;
  const pos = qz.selected.indexOf(idx);
  if (pos >= 0) { qz.selected.splice(pos, 1); node.classList.remove('sel'); node.querySelector('.mark').textContent = ''; }
  else { if (qz.selected.length >= 2) { toast('정답 2개만 선택하세요'); return; } qz.selected.push(idx); node.classList.add('sel'); node.querySelector('.mark').textContent = '✓'; }
  updateFoot();
}
function checkCurrent() {
  if (qz.checked) return;
  const q = qz.queue[qz.idx];
  if (q.type === 'blank') {
    const inp = $('qBlank'); const val = inp.value.trim();
    if (!val) return;
    const correct = matchBlank(val, q.accept || [q.answer]);
    inp.classList.add(correct ? 'correct' : 'wrong'); inp.disabled = true;
    finishCheck(q, correct);
  } else if (q.type === 'multi') {
    if (qz.selected.length !== 2) return;
    const set = new Set(q.answers);
    const correct = qz.selected.length === q.answers.length && qz.selected.every(i => set.has(i));
    [...$('qOpts').children].forEach(o => {
      if (set.has(o._idx)) o.classList.add('correct');
      else if (qz.selected.includes(o._idx)) o.classList.add('wrong');
    });
    finishCheck(q, correct);
  }
}
function finishCheck(q, correct) {
  qz.checked = true;
  recordAnswer(q, correct);
  if (qz.scored && correct) qz.score++;
  showExplain(q, correct);
  saveSession();
  updateFoot();
}
function showExplain(q, correct) {
  const e = $('qExplain');
  e.className = 'explain' + (correct ? '' : ' bad');
  let ansLine = '';
  if (!correct) {
    if (q.type === 'blank') ansLine = `<div>정답: <span class="ans">${q.answer}</span></div>`;
    else if (q.type === 'multi') ansLine = `<div>정답: <span class="ans">${q.answers.map(i => q.options[i]).join(', ')}</span></div>`;
    else ansLine = `<div>정답: <span class="ans">${q.options[q.answer]}</span></div>`;
  }
  e.innerHTML = `<div class="et">${correct ? '✅ 정답' : '❌ 오답'}</div>${ansLine}<div style="margin-top:4px">${q.explain || ''}</div>`;
  e.style.display = 'block';
}
function matchBlank(val, accepts) {
  const norm = (s) => String(s).toLowerCase().replace(/[\s.,·()/'"`\-_]/g, '');
  const u = norm(val);
  if (!u) return false;
  for (const a of accepts) {
    const na = norm(a);
    if (!na) continue;
    if (u === na) return true;
    if (na.length >= 2 && (u.includes(na) || na.includes(u))) return true;
  }
  return false;
}
function recordAnswer(q, correct) {
  state.answered[q.id] = true;
  state.correct[q.id] = correct;
  if (correct) { state.wrong = state.wrong.filter(id => id !== q.id); }
  else if (!state.wrong.includes(q.id)) state.wrong.push(q.id);
  saveLocal();
}
function toggleBookmark(id) {
  const i = state.bookmarks.indexOf(id);
  if (i >= 0) { state.bookmarks.splice(i, 1); toast('즐겨찾기 해제'); }
  else { state.bookmarks.push(id); toast('⭐ 즐겨찾기 추가'); }
  const bm = $('qBookmark');
  bm.textContent = state.bookmarks.includes(id) ? '★' : '☆';
  bm.classList.toggle('on', state.bookmarks.includes(id));
  saveLocal();
}

function updateFoot() {
  const q = qz.queue[qz.idx];
  const primary = $('qPrimary'), skip = $('qSkip');
  const isLast = qz.idx === qz.queue.length - 1;
  if (qz.checked) {
    skip.style.display = 'none';
    primary.style.display = '';
    primary.textContent = isLast ? '결과 보기' : '다음 ›';
    primary.disabled = false;
    primary.onclick = nextQ;
  } else {
    skip.style.display = '';
    skip.textContent = '건너뛰기';
    skip.onclick = nextQ;
    if (q.type === 'mc') {
      primary.textContent = '문제를 선택하세요';
      primary.disabled = true;
      primary.onclick = null;
    } else if (q.type === 'blank') {
      primary.textContent = '확인';
      primary.disabled = !$('qBlank').value.trim();
      primary.onclick = checkCurrent;
    } else {
      primary.textContent = `확인 (${qz.selected.length}/2)`;
      primary.disabled = qz.selected.length !== 2;
      primary.onclick = checkCurrent;
    }
  }
}
function nextQ() {
  if (qz.idx >= qz.queue.length - 1) { endQuiz(); return; }
  qz.idx++;
  renderQ();
}
function quitQuiz() {
  saveSession();
  toast('진행 상황 저장됨');
  goHome();
}
function endQuiz() {
  state.session = null;
  saveLocal();
  showResult();
}

// ===== 결과 =====
function showResult() {
  const tot = qz.queue.length;
  const correct = qz.queue.filter(q => state.correct[q.id]).length;
  const pct = tot ? Math.round(correct / tot * 100) : 0;
  const body = $('resultBody');
  let msg = pct >= 90 ? '완벽해요! 🏆' : pct >= 70 ? '좋아요! 👍' : pct >= 50 ? '조금만 더! 💪' : '복습이 필요해요 📖';
  body.innerHTML = `
    <div class="result-ring" style="--p:${pct};position:relative"><div class="inner"><div class="big">${pct}%</div><div class="sm">정답률</div></div></div>
    <h1 class="page" style="text-align:center">${msg}</h1>
    <div class="result-detail">총 <b>${tot}</b>문항 · 정답 <b style="color:var(--ok)">${correct}</b> · 오답 <b style="color:var(--no)">${tot - correct}</b></div>
    <div style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <button class="btn primary block lg" id="rHome">홈으로</button>
      ${tot - correct > 0 ? '<button class="btn ghost block" id="rWrong">오답만 다시 풀기</button>' : ''}
    </div>`;
  $('rHome').onclick = () => history.back();
  if ($('rWrong')) $('rWrong').onclick = () => startMode('wrong');
  showScreen('result');
}

// ===== 이론 =====
function renderTheoryTopics() {
  $('listTitle').textContent = '이론 학습';
  const b = $('listBody'); b.innerHTML = '';
  const list = el('div', 'list');
  for (const n of TOPIC_NUMS) {
    const cnt = THEORY.filter(t => t.t === n).length;
    const row = el('button', 'lrow');
    row.innerHTML = `<div><div class="lt">${TOPICS[n].short}. ${TOPICS[n].name}</div><div class="lsub">개념 카드 ${cnt}장</div></div><div class="lcnt">›</div>`;
    row.onclick = () => nav(() => renderTheorySections(n));
    list.appendChild(row);
  }
  b.appendChild(list);
  showScreen('list');
}
function renderTheorySections(topic) {
  $('listTitle').textContent = `${TOPICS[topic].short}. ${TOPICS[topic].name}`;
  const b = $('listBody'); b.innerHTML = '';
  const cards = THEORY.filter(t => t.t === topic);
  const secs = [...new Set(cards.map(c => c.s))];
  const list = el('div', 'list');
  const all = el('button', 'lrow');
  all.innerHTML = `<div><div class="lt">📚 전체 보기</div><div class="lsub">이 토픽 ${cards.length}장 모두</div></div><div class="lcnt">›</div>`;
  all.onclick = () => nav(() => openTheory(cards, `${TOPICS[topic].short} 전체`));
  list.appendChild(all);
  for (const s of secs) {
    const sc = cards.filter(c => c.s === s);
    const stitle = sc[0].st || s;
    const row = el('button', 'lrow');
    row.innerHTML = `<div><div class="lt">${s} ${stitle}</div><div class="lsub">${sc.length}장</div></div><div class="lcnt">›</div>`;
    row.onclick = () => nav(() => openTheory(sc, `${s} ${stitle}`));
    list.appendChild(row);
  }
  b.appendChild(list);
  showScreen('list');
}
let thState = null;
function openTheory(cards, title) {
  thState = { cards, idx: 0, title };
  renderTheoryCard();
  showScreen('theory');
}
function renderTheoryCard() {
  const { cards, idx } = thState;
  const c = cards[idx];
  $('thTitle').textContent = thState.title;
  $('thNum').textContent = `${idx + 1} / ${cards.length}`;
  const b = $('thBody'); b.innerHTML = '';
  const card = el('div', 'card pad th-card');
  card.innerHTML = `<div class="th-title">${c.title}</div>${renderMd(c.md)}`;
  b.appendChild(card);
  const reveal = el('button', 'reveal-all', '🔍 빈칸 전체 공개 / 가리기');
  reveal.onclick = () => { const all = card.querySelectorAll('.bkt'); const anyHidden = [...all].some(x => !x.classList.contains('show')); all.forEach(x => x.classList.toggle('show', anyHidden)); };
  b.appendChild(reveal);
  card.querySelectorAll('.bkt').forEach(s => s.onclick = () => s.classList.toggle('show'));
  $('thPrev').disabled = idx === 0;
  $('thPrev').style.opacity = idx === 0 ? .4 : 1;
  $('thNext').textContent = idx === cards.length - 1 ? '완료' : '다음 ›';
}
function thNext() { if (thState.idx < thState.cards.length - 1) { thState.idx++; renderTheoryCard(); } else back(); }
function thPrev() { if (thState.idx > 0) { thState.idx--; renderTheoryCard(); } }

function renderMd(md) {
  const lines = String(md).split('\n');
  let html = '', inUl = false, tbl = [];
  const flushUl = () => { if (inUl) { html += '</ul>'; inUl = false; } };
  const flushTbl = () => {
    if (!tbl.length) return;
    let t = '<table>';
    tbl.forEach(r => { const cells = r.split('|').filter(x => x.trim() !== ''); if (cells.every(c => /^[-\s]+$/.test(c))) return; t += '<tr>' + cells.map(c => `<td>${inline(c.trim())}</td>`).join('') + '</tr>'; });
    t += '</table>'; html += t; tbl = [];
  };
  for (let line of lines) {
    if (line.includes('|') && line.trim().startsWith('|')) { flushUl(); tbl.push(line); continue; }
    flushTbl();
    const t = line.trim();
    if (!t) { flushUl(); continue; }
    if (t.startsWith('- ') || t.startsWith('* ')) {
      const indent = /^(\s|\t)+/.test(line) && line.search(/\S/) >= 2;
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li class="${indent ? 'in' : ''}">${inline(t.slice(2))}</li>`;
    } else { flushUl(); html += `<p>${inline(t)}</p>`; }
  }
  flushUl(); flushTbl();
  return html;
}
function inline(s) {
  const blanks = [];
  s = s.replace(/\*\*`([^`]+)`\*\*/g, (_, m) => { blanks.push(m); return ` ${blanks.length - 1} `; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/ (\d+) /g, (_, i) => `<span class="bkt">${blanks[+i]}</span>`);
  return s;
}

// ===== 인증 UI =====
let authMode = 'login';
function setupAuth() {
  const idIn = $('loginId'), pwIn = $('loginPw'), msg = $('authMsg'), btn = $('authBtn'), toggle = $('authToggle');
  toggle.onclick = () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    btn.textContent = authMode === 'login' ? '로그인' : '회원가입';
    toggle.innerHTML = authMode === 'login' ? '계정이 없나요? <b>회원가입</b>' : '이미 계정이 있나요? <b>로그인</b>';
    msg.textContent = '';
  };
  btn.onclick = doAuth;
  pwIn.onkeydown = (e) => { if (e.key === 'Enter') doAuth(); };
  $('skipLogin').onclick = () => { localOnly = true; goHome(); showScreen('home'); };

  async function doAuth() {
    const id = idIn.value.trim(), pw = pwIn.value;
    msg.className = 'auth-msg';
    if (!id || !pw) { msg.classList.add('err'); msg.textContent = '아이디와 비밀번호를 입력하세요'; return; }
    if (pw.length < 4) { msg.classList.add('err'); msg.textContent = '비밀번호는 4자 이상이어야 합니다'; return; }
    btn.disabled = true; const orig = btn.textContent; btn.textContent = '처리 중…';
    try {
      if (authMode === 'signup') {
        const { result, error, setup } = await rpcSignup(id, pw);
        if (error) { msg.classList.add('err'); msg.textContent = setup ? '서버 설정 필요: SUPABASE_SETUP.md의 SQL을 실행하세요' : '오류: ' + error.message; return; }
        if (result === 'ERR_EXISTS') { msg.classList.add('err'); msg.textContent = '이미 가입된 아이디입니다'; return; }
        if (result === 'ERR_INPUT') { msg.classList.add('err'); msg.textContent = '아이디 2자+, 비밀번호 4자+ 입력'; return; }
        // 가입 성공 → 바로 로그인
      }
      const { data, error, setup } = await rpcLogin(id, pw);
      if (error) { msg.classList.add('err'); msg.textContent = setup ? '서버 설정 필요: SUPABASE_SETUP.md의 SQL을 실행하세요' : '오류: ' + error.message; return; }
      if (!data || !data.ok) { msg.classList.add('err'); msg.textContent = '아이디 또는 비밀번호가 올바르지 않습니다'; return; }
      await doLoginSuccess(id, data.token, data.state);
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }
}

// ===== 헤더 =====
function setupHeader() {
  $('themeBtn').onclick = toggleTheme;
  $('avatarBtn').onclick = () => {
    if (auth) {
      if (confirm(`${auth.username} 로그아웃 할까요?`)) { localStorage.removeItem(AUTH_KEY); auth = null; location.reload(); }
    } else { showScreen('login'); }
  };
  $('listBack').onclick = back;
  $('thBack').onclick = back;
  $('quitBtn').onclick = () => history.back();
  $('thNext').onclick = thNext;
  $('thPrev').onclick = thPrev;
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  $('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
  let t = localStorage.getItem(THEME_KEY);
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
}

// ===== 초기화 =====
async function loadData() {
  const [q, t] = await Promise.all([
    fetch('./data/questions.json').then(r => r.json()),
    fetch('./data/theory.json').then(r => r.json()),
  ]);
  QUESTIONS = q; THEORY = t;
  QUESTIONS.forEach(x => byId[x.id] = x);
}

async function init() {
  initTheme();
  $('themeBtn').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  setupAuth(); setupHeader();
  loadLocal();
  try { await loadData(); } catch (e) { document.body.innerHTML = '<p style="padding:40px;text-align:center">데이터 로드 실패. 로컬 서버에서 열어주세요.</p>'; return; }

  if (SUPA_ENABLED) {
    let resumed = false;
    try {
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (saved && saved.username && saved.token) {
        const { data } = await rpcResume(saved.username, saved.token);
        if (data && data.ok) { auth = saved; applyServerState(data.state); resumed = true; }
        else localStorage.removeItem(AUTH_KEY);
      }
    } catch {}
    if (resumed) { goHome(); showScreen('home'); setSync('on'); }
    else showScreen('login');
  } else {
    showScreen('login');
  }

  try { history.replaceState({ app: true, root: true }, ''); } catch {}
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('./sw.js'); } catch {} }
}
init();
