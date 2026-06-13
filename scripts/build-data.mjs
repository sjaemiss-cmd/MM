// T5~9 + multi 문항/이론을 data/*.json 으로 병합하고 검증한다.
import fs from 'node:fs';

const topics = [5, 6, 7, 8, 9];
let questions = [];
let theory = [];

for (const n of topics) {
  const d = JSON.parse(fs.readFileSync(`build/t${n}.json`, 'utf8'));
  questions.push(...d.questions);
  theory.push(...d.theory);
}
const multi = JSON.parse(fs.readFileSync('build/multi.json', 'utf8'));
questions.push(...multi.questions);

// ---- 검증 ----
let err = 0;
const ids = new Set();
for (const q of questions) {
  if (ids.has(q.id)) { console.error('dup id', q.id); err++; }
  ids.add(q.id);
  if (![5, 6, 7, 8, 9].includes(q.topic)) { console.error('bad topic', q.id, q.topic); err++; }
  if (!q.explain) { console.error('no explain', q.id); err++; }
  if (q.type === 'mc') {
    if (!Array.isArray(q.options) || q.options.length < 2) { console.error('mc bad options', q.id); err++; }
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) { console.error('mc bad answer', q.id); err++; }
  } else if (q.type === 'blank') {
    if (!Array.isArray(q.accept) || !q.accept.length) { console.error('blank no accept', q.id); err++; }
  } else if (q.type === 'multi') {
    if (!Array.isArray(q.options) || q.options.length < 3) { console.error('multi bad options', q.id); err++; }
    if (!Array.isArray(q.answers) || q.answers.length < 2) { console.error('multi bad answers', q.id); err++; }
    else for (const a of q.answers) if (a < 0 || a >= q.options.length) { console.error('multi answer oob', q.id); err++; }
  } else { console.error('bad type', q.id, q.type); err++; }
}
for (const t of theory) {
  if (![5, 6, 7, 8, 9].includes(t.t)) { console.error('theory bad topic', t); err++; }
  if (!t.md || !t.title) { console.error('theory missing field', t); err++; }
}

// ---- 통계 ----
const byTopic = {};
for (const q of questions) {
  byTopic[q.topic] = byTopic[q.topic] || { mc: 0, blank: 0, multi: 0 };
  byTopic[q.topic][q.type]++;
}
console.log('=== 문항 통계 (토픽별) ===');
for (const n of topics) {
  const b = byTopic[n] || { mc: 0, blank: 0, multi: 0 };
  console.log(`T${n}: mc ${b.mc} / blank ${b.blank} / multi ${b.multi} = ${b.mc + b.blank + b.multi}`);
}
const totMc = questions.filter(q => q.type === 'mc').length;
const totBlank = questions.filter(q => q.type === 'blank').length;
const totMulti = questions.filter(q => q.type === 'multi').length;
console.log(`총: ${questions.length}문항 (mc ${totMc} / blank ${totBlank} / multi ${totMulti}), 이론 ${theory.length}카드`);
console.log('errors =', err);

if (err === 0) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/questions.json', JSON.stringify(questions, null, 1));
  fs.writeFileSync('data/theory.json', JSON.stringify(theory, null, 1));
  console.log('-> data/questions.json, data/theory.json 작성 완료');
} else {
  process.exit(1);
}
