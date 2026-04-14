# Electric Circuit Builder (elobvod)

Editor elektrických obvodů + zadání pro studenty (Supabase).

## Spuštění

```bash
npm i
npm run dev
```

**Supabase je přednastavený** v `src/lib/supabasePublicDefaults.ts` (sdílený tým projekt, anon klíč jako u každého webu v bundlu – data chrání RLS v databázi). **Nemusíš vytvářet `.env`**, aby to fungovalo lokálně i na GitHub Pages.

### Vlastní Supabase projekt (volitelné)

V kořeni vytvoř `.env` podle `.env.example` – hodnoty z env přepíší výchozí z kódu.

### Databáze

Jednorázově spusť v Supabase (SQL Editor): [`supabase/schema.sql`](supabase/schema.sql).

## GitHub Actions

Build může dál dostávat `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` ze Secrets (přepíší výchozí v době buildu). Pokud secrets chybí, použijí se stejné výchozí hodnoty z repozitáře.

## Původní design

[Figma – Electric Circuit Builder](https://www.figma.com/design/NGEvLzMoRuaf75hurVl2mP/Electric-Circuit-Builder-App--Copy-).
