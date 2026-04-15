# Modul „Úkoly“ (TasksSheet) — vložení do jiného nástroje

Cíl: **stejný Supabase projekt** a tabulky jako v Elobvodu, **stejné sloupce** a RLS. Hostitel dodá routing, URL pro studenty a volitelně vlastní Supabase klient / knihovnu / branding.

## Veřejný import

```ts
import {
  TasksSheet,
  type TasksSheetProps,
  type TasksSheetSupabaseConfigInfo,
  TASK_LIBRARY,
  resolveStudentLink,
  resolveLibraryImageSrc,
  parseAssignmentIdFromUrlOrUuid,
  CIRCUIT_ASSIGNMENTS_TABLE,
  CIRCUIT_SUBMISSIONS_TABLE,
  type TaskLibraryEntry,
} from '@/features/tasks';
```

## Props `TasksSheet` (embed)

| Prop | Význam |
|------|--------|
| `open`, `onOpenChange` | Řízení sheetu (povinné). |
| `resolveAssignmentPublicUrl?(id)` | Absolutní URL stránky úkolu pro studenta. Výchozí: `assignmentPublicUrl` z Elobvodu (`origin` + Vite `base` + `/ukol/`). |
| `getSupabase?()` | Vlastní klient; jinak globální `getSupabase()` z `@/lib/supabase`. |
| `getSupabaseConfigInfo?()` | Pro text chyb při „Failed to fetch“; jinak globální z `@/lib/supabase`. |
| `taskLibrary?` | Pole `TaskLibraryEntry[]`; výchozí export `TASK_LIBRARY` z `taskLibrary.ts`. **Memoizuj** (`useMemo`), pokud skládáš pole v renderu. |
| `assignmentsTable?` | Název tabulky zadání (výchozí `circuit_assignments`). Sloupce musí odpovídat schématu. |
| `assignmentUrlPathSegment?` | Segment v cestě před UUID (výchozí `ukol`). Musí souhlasit s `resolveAssignmentPublicUrl` i s routou hostitele. Používá se i při parsování pole „Editovat úkol“. |
| `brandLabel?` | Malý text vlevo nahoře (výchozí `Elobvod`). `brandLabel=""` → skrytý. |
| `sidebarIntro?` | Úvodní odstavec pod „Úkoly“ v levém panelu. |

### Příklad hostitele

```tsx
import { useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TasksSheet, type TaskLibraryEntry } from '@/features/tasks';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

export function HostLessonTools() {
  const [tasksOpen, setTasksOpen] = useState(false);

  const taskLibrary = useMemo<TaskLibraryEntry[]>(
    () => [
      { key: 'a', title: 'Úvodní obvod', assignmentId: '…-uuid-…' },
    ],
    [],
  );

  return (
    <>
      <button type="button" onClick={() => setTasksOpen(true)}>Úkoly</button>
      <TasksSheet
        open={tasksOpen}
        onOpenChange={setTasksOpen}
        getSupabase={() => supabase}
        getSupabaseConfigInfo={() => ({ url: import.meta.env.VITE_SUPABASE_URL ?? null })}
        resolveAssignmentPublicUrl={(id) => `${window.location.origin}/courses/lesson-1/assign/${id}`}
        assignmentUrlPathSegment="assign"
        taskLibrary={taskLibrary}
        brandLabel="Můj LMS"
        sidebarIntro="Zadání sdílíš odkazem; odevzdání studentů zůstává v Elobvodu, pokud tam vede tvoje URL."
      />
    </>
  );
}
```

## Parsování odkazu / UUID

`parseAssignmentIdFromUrlOrUuid(raw, pathSegment?)` — stejná logika jako pole „Editovat úkol“. Host může použít pro vlastní formuláře.

## Databázový kontrakt

- Schéma: `supabase/schema.sql` v tomto repu.
- Tabulka zadání: `circuit_assignments` (`id`, `title`, `instruction_text`, `instruction_image`, `instruction_steps` jsonb, `created_at`).
- Odevzdání (student): `circuit_submissions` — modul Úkoly do něj přímo nezasahuje, ale studentská stránka ano.

RLS: pro vytváření/načítání zadání v tomto UI typicky **SELECT + INSERT** na `circuit_assignments` (konkrétní politiky viz `schema.sql`).

## Soubory ke zkopírování do hosta (bez monorepa)

Minimální sada závislostí z tohoto projektu:

- `src/app/components/tasks/**`
- `src/app/utils/instructionSteps.ts`
- `src/app/utils/appUrl.ts` — jen pokud nepřepíšeš vše přes `resolveAssignmentPublicUrl` / vlastní `taskLibrary` s `studentUrl`
- `src/lib/supabase.ts` (+ `supabasePublicDefaults.ts`) — jen pokud **nepoužíváš** `getSupabase` prop
- `src/lib/circuitTables.ts`
- Shadcn UI používané v `TasksSheet`: `sheet`, `dialog`, `button`, `label`, `textarea`, …
- **Dialog kreslení:** `CircuitCanvas`, `ComponentPalette` a jejich závislosti — nebo dialog v hostu zjednodušit (nahrát jen obrázek ze souboru).

Alias `@` → `src` (viz `vite.config.ts`).

## NPM závislosti

- `@supabase/supabase-js`
- `react`, `react-dom`
- `lucide-react`, `sonner`
- Tailwind + shadcn (nebo ekvivalent tříd)

## Kontrolní seznam

- [ ] Stejné tabulky / sloupce jako `schema.sql` (nebo vlastní `assignmentsTable` se stejným tvarem řádku)
- [ ] RLS povoluje potřebné operace
- [ ] `resolveAssignmentPublicUrl` a `assignmentUrlPathSegment` odpovídají routě hostitele
- [ ] Studenti mají stále funkční stránku úkolu (v Elobvodu nebo fork s `/ukol/:id` / vlastní cesta)
- [ ] `taskLibrary` memoizované, pokud není konstanta mimo komponentu
- [ ] Otestováno: vytvoření zadání, kopie odkazu, načtení z knihovny, edit z URL
