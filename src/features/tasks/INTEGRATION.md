# Integrace bloku Úkoly do jiné aplikace

Cíl: **stejný Supabase projekt**, tabulky `circuit_assignments` a `circuit_submissions`, stejné sloupce a RLS. Mění se jen hostitelská aplikace (routing, `base` URL, UI kolem).

## 1. Databáze

- Spusť / udržuj `supabase/schema.sql` v cílovém projektu (nebo stejné schéma ručně).
- Tabulky: `circuit_assignments`, `circuit_submissions` (názvy exportuje `CIRCUIT_ASSIGNMENTS_TABLE` / `CIRCUIT_SUBMISSIONS_TABLE`).
- Pro tento blok stačí obvykle **SELECT + INSERT** na `circuit_assignments` (vytvoření zadání, načtení pro knihovnu / draft). Úprava existujícího řádku přes UI zde typicky děláš jako **nový insert** po načtení draftu.

## 2. Proměnné prostředí

Host musí mít stejné veřejné Supabase proměnné jako tato aplikace (viz `src/lib/supabase.ts`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nebo vlastní inicializace `getSupabase()` kompatibilní s `@/lib/supabase` — `TasksSheet` volá `getSupabase()` z tohoto projektu.

## 3. Odkazy pro studenty (`/ukol/:id`)

Výchozí chování používá `assignmentPublicUrl` z `src/app/utils/appUrl.ts` (`origin` + Vite `BASE_URL` + `/ukol/:uuid`).

V **jiné aplikaci** předej vlastní builder:

```tsx
import { TasksSheet } from '@/features/tasks';

<TasksSheet
  open={open}
  onOpenChange={setOpen}
  resolveAssignmentPublicUrl={(id) =>
    `${window.location.origin}/tvoje-cesta/ukol/${id}`
  }
/>
```

Knihovna úkolů (`TASK_LIBRARY` v `taskLibrary.ts`) bere stejný builder přes `resolveStudentLink(entry, getUrl)` — uvnitř `TasksSheet` se to propojuje automaticky.

## 4. Co zkopírovat / závislosti

Minimálně související moduly z tohoto repozitáře:

- `src/app/components/tasks/**`
- `src/app/utils/instructionSteps.ts`
- `src/app/utils/appUrl.ts` (nebo vlastní URL logika + `resolveAssignmentPublicUrl`)
- `src/lib/supabase.ts`, `src/lib/supabasePublicDefaults.ts` (pokud používáš výchozí klient)
- `src/lib/circuitTables.ts`
- UI: komponenty z `src/app/components/ui/*` používané v `TasksSheet` (sheet, dialog, button, …)
- **Editor kreslení v dialogu** tahá `CircuitCanvas` + `ComponentPalette` — buď je zkopíruj se závislostmi, nebo ten dialog v hostu zjednoduš / nahraď.

Alias `@` → `src` (viz `vite.config.ts`).

## 5. Import z tohoto monorepa

```ts
import {
  TasksSheet,
  TASK_LIBRARY,
  resolveStudentLink,
  CIRCUIT_ASSIGNMENTS_TABLE,
} from '@/features/tasks';
```

## 6. Kontrolní seznam

- [ ] Stejné tabulky a sloupce jako ve `schema.sql`
- [ ] RLS politiky umožňují potřebné operace (select/insert na assignments)
- [ ] Env Supabase v hostu
- [ ] `resolveAssignmentPublicUrl` odpovídá routě, kde student vidí úkol
- [ ] `import.meta.env.BASE_URL` v hostu sedí s veřejnými odkazy (nebo vždy vlastní builder)
- [ ] Zkopírovány / nahrazeny závislosti: canvas, shadcn UI, `sonner`, `lucide-react`
