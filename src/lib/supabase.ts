import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim());

let _client: SupabaseClient | null = null;

/** Supabase klient; null pokud chybí env proměnné. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
