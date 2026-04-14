# Electric Circuit Builder (elobvod)

Editor elektrických obvodů + zadání pro studenty (Supabase).

## Lokální vývoj – povinný krok: `.env`

**Na GitHubu nejsou a nesmí být** soubory s `VITE_SUPABASE_ANON_KEY` – jde o tajný klíč. Po `git clone` proto **vždy** vytvoř vlastní `.env`:

```bash
cp .env.example .env
```

Pak v `.env` doplň:

- `VITE_SUPABASE_URL` – URL projektu (např. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` – **anon public** klíč. Obojí najdeš v Supabase: **Project Settings → API**.

Hodnoty si v týmu **předejte mimo Git** (Slack šifrovaně, 1Password, interní wiki) – každý je zkopíruje do svého lokálního `.env`.

Bez tohoto kroku aplikace při „Vytvořit zadání“ zobrazí chybu, že Supabase není nastavený – to není chyba kódu z GitHubu, chybí jen lokální konfigurace.

### Databáze

Jednorázově spusť SQL z repozitáře v Supabase (SQL Editor): [`supabase/schema.sql`](supabase/schema.sql).

## Spuštění

```bash
npm i
npm run dev
```

## GitHub Actions / nasazení

Pro build v CI je potřeba v repozitáři nastavit **Secrets** (Settings → Secrets and variables → Actions):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Stejné hodnoty jako v lokálním `.env`. To **nepomůže kolegovi na lokálu** – ten si musí vytvořit `.env` stejně jako výše.

## Původní design

Návrh v [Figma](https://www.figma.com/design/NGEvLzMoRuaf75hurVl2mP/Electric-Circuit-Builder-App--Copy-).
