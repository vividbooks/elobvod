import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from './supabasePublicDefaults';

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || SUPABASE_PUBLIC_URL;
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  SUPABASE_PUBLIC_ANON_KEY;

export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim());

let _client: SupabaseClient | null = null;

/** Supabase klient; null jen při úplně prázdné konfiguraci (nemělo by nastat). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
