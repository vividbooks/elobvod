#!/usr/bin/env bash
# Načte .env v kořeni repa a nastaví GitHub Actions secrets pro CI build (GitHub Pages).
# Jednorázově: gh auth login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Nainstaluj GitHub CLI: brew install gh" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Nejsi přihlášený k GitHubu. Spusť: gh auth login" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Chybí .env (zkopíruj z .env.example a doplň klíče)." >&2
  exit 1
fi

# shellcheck source=/dev/null
set -a
source ".env"
set +a

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "V .env musí být VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY." >&2
  exit 1
fi

ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
REPO=""
if [[ "$ORIGIN" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
  REPO="${BASH_REMATCH[1]%.git}"
fi
if [[ -z "$REPO" ]]; then
  echo "Nepodařilo se zjistit repo z git remote (očekávám github.com/org/repo)." >&2
  exit 1
fi

echo "Nastavuji secrets na $REPO …"
gh secret set VITE_SUPABASE_URL --repo "$REPO" --body "$VITE_SUPABASE_URL"
gh secret set VITE_SUPABASE_ANON_KEY --repo "$REPO" --body "$VITE_SUPABASE_ANON_KEY"
echo "Hotovo. Na GitHubu spusť znovu workflow (nebo pushni prázdný commit), ať se buildne s novými hodnotami."
