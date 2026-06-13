// ===== Supabase: 인증(아이디/비번) + 진도 동기화 =====
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL = 'https://pevawxrjyyrutgiwhfnn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmF3eHJqeXlydXRnaXdoZm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzk5MDEsImV4cCI6MjA5NjkxNTkwMX0.Z93tbrgQRUVKeRxKhokh50ygt8yxfs-81KZXQaF1ym4';

export const SUPA_ENABLED = !!(SUPA_URL && SUPA_ANON && !SUPA_URL.includes('YOUR_'));

export const sb = SUPA_ENABLED
  ? createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// 아이디 → 내부 합성 이메일 (사용자는 아이디만 입력)
// 주의: Supabase는 .local 등 일부 도메인을 거부 → 유효 도메인 사용
const toEmail = (id) => `${String(id).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@mmstudy.com`;

export async function signUp(id, pw) {
  if (!sb) return { error: { message: 'Supabase 미설정' } };
  const { data, error } = await sb.auth.signUp({ email: toEmail(id), password: pw });
  return { data, error };
}

export async function signIn(id, pw) {
  if (!sb) return { error: { message: 'Supabase 미설정' } };
  const { data, error } = await sb.auth.signInWithPassword({ email: toEmail(id), password: pw });
  return { data, error };
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
}

export async function currentUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

export function onAuth(cb) {
  if (!sb) return;
  sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
}

// 사용자 아이디(이메일 앞부분) 표시용
export function displayId(user) {
  if (!user?.email) return '학습자';
  return user.email.split('@')[0];
}

// ----- 진도 동기화 -----
export async function pullState() {
  if (!sb) return null;
  const u = await currentUser();
  if (!u) return null;
  const { data, error } = await sb.from('user_state').select('state, updated_at').eq('user_id', u.id).maybeSingle();
  if (error) { console.warn('pullState', error.message); return null; }
  return data; // { state, updated_at } | null
}

export async function pushState(state) {
  if (!sb) return { error: 'no sb' };
  const u = await currentUser();
  if (!u) return { error: 'no user' };
  const { error } = await sb.from('user_state').upsert(
    { user_id: u.id, state, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) console.warn('pushState', error.message);
  return { error };
}

export async function saveResult(mode, score, total) {
  if (!sb) return;
  const u = await currentUser();
  if (!u) return;
  await sb.from('quiz_results').insert({ user_id: u.id, mode, score, total });
}
