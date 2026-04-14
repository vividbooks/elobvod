import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim());

/** Pro toasty / UI – vysvětluje, proč kolega po git clone nic nevidí v .env. */
export const SUPABASE_ENV_SETUP_SHORT =
  'Zkopíruj v kořeni projektu: .env.example → .env a doplň VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API). Soubor .env se do Gitu nedává – každý vývojář si ho vytvoří lokálně nebo dostane hodnoty bezpečně od týmu.';

let _client: SupabaseClient | null = null;

/** Supabase klient; null pokud chybí env proměnné. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
