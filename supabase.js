// ===== Supabase: 아이디/비번 로그인(이메일 불필요) + 진도 동기화 =====
// GoTrue 이메일 인증 대신, Postgres 함수(SECURITY DEFINER + pgcrypto)로 직접 처리.
// 이메일 발송이 없으므로 확인메일/rate limit 이슈가 없다. SUPABASE_SETUP.md의 SQL 1회 실행만 필요.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL = 'https://pevawxrjyyrutgiwhfnn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldmF3eHJqeXlydXRnaXdoZm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzk5MDEsImV4cCI6MjA5NjkxNTkwMX0.Z93tbrgQRUVKeRxKhokh50ygt8yxfs-81KZXQaF1ym4';

export const SUPA_ENABLED = !!(SUPA_URL && SUPA_ANON && !SUPA_URL.includes('YOUR_'));
export const sb = SUPA_ENABLED ? createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } }) : null;

const norm = (id) => String(id).trim().toLowerCase();

// 서버 함수 미설치(=SQL 미실행) 감지
function setupNeeded(error) {
  const m = (error?.message || '') + (error?.code || '');
  return /could not find the function|pgrst202|schema cache|does not exist|42883/i.test(m);
}

export async function rpcSignup(id, pw) {
  if (!sb) return { error: { message: 'no sb' } };
  const { data, error } = await sb.rpc('mm_signup', { p_user: norm(id), p_pass: pw });
  if (error) return { error, setup: setupNeeded(error) };
  return { result: data }; // 'OK' | 'ERR_EXISTS' | 'ERR_INPUT'
}
export async function rpcLogin(id, pw) {
  if (!sb) return { error: { message: 'no sb' } };
  const { data, error } = await sb.rpc('mm_login', { p_user: norm(id), p_pass: pw });
  if (error) return { error, setup: setupNeeded(error) };
  return { data }; // { ok, token?, state? }
}
export async function rpcResume(id, token) {
  if (!sb) return { data: { ok: false } };
  const { data, error } = await sb.rpc('mm_resume', { p_user: norm(id), p_token: token });
  if (error) return { data: { ok: false }, error };
  return { data };
}
export async function rpcSave(id, token, state) {
  if (!sb) return { error: 'no sb' };
  const { data, error } = await sb.rpc('mm_save', { p_user: norm(id), p_token: token, p_state: state });
  return { result: data, error };
}
