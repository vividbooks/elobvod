import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from './supabasePublicDefaults';

function isPlaceholderSupabaseUrl(v: string): boolean {
  return /YOUR_PROJECT/i.test(v) || /YOUR[_-]?SUPABASE/i.test(v);
}

function sanitizeEnvSupabaseUrl(v: unknown): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  if (!s) return null;
  if (isPlaceholderSupabaseUrl(s)) return null;
  return s;
}

function sanitizeEnvAnonKey(v: unknown): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  if (!s) return null;
  // typicky placeholder v .env.example je prázdný; nechceme ale „accidentally“ ignorovat reálný klíč
  return s;
}

const envUrl = sanitizeEnvSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const envAnonKey = sanitizeEnvAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

const url = envUrl ?? SUPABASE_PUBLIC_URL;
const anonKey = envAnonKey ?? SUPABASE_PUBLIC_ANON_KEY;

export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim());

let _client: SupabaseClient | null = null;

export function getSupabaseConfigInfo() {
  return {
    url: url?.trim() || null,
    usingDefaults: !envUrl && !envAnonKey,
    hasEnvUrl: Boolean(envUrl),
    hasEnvAnonKey: Boolean(envAnonKey),
  };
}

/** Supabase klient; null jen při úplně prázdné konfiguraci (nemělo by nastat). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
