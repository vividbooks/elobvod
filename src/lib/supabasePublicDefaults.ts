/**
 * Výchozí připojení ke sdílenému Supabase projektu (vividbooks / elobvod).
 * Anon klíč je v prohlížeči u každého SPA – omezení dat dělá Row Level Security v databázi.
 *
 * Přepsání: nastav VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY (např. v .env) pro vlastní projekt.
 */
export const SUPABASE_PUBLIC_URL = 'https://jjpiguuubvmiobmixwgh.supabase.co';

export const SUPABASE_PUBLIC_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGlndXV1YnZtaW9ibWl4d2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODIxNjksImV4cCI6MjA3MTk1ODE2OX0.0gn-vUWjEv9wVuoBblTgJ7JW9z65yrYaOTROCPoykHo';
