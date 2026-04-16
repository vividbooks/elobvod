-- Supabase → SQL Editor → spusť celý soubor.
--
-- Tabulky jsou pojmenované circuit_* aby nekolidovaly s existující tabulkou public.assignments
-- (např. LMS s class_id, title, type, …).

create table if not exists public.circuit_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  instruction_text text not null default '',
  instruction_image text,
  instruction_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.circuit_assignments add column if not exists title text not null default '';
alter table public.circuit_assignments add column if not exists instruction_text text not null default '';
alter table public.circuit_assignments add column if not exists instruction_image text;
alter table public.circuit_assignments add column if not exists instruction_steps jsonb not null default '[]'::jsonb;
alter table public.circuit_assignments add column if not exists created_at timestamptz not null default now();

create table if not exists public.circuit_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.circuit_assignments (id) on delete cascade,
  student_name text not null,
  circuit_encoded text not null,
  student_note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.circuit_submissions add column if not exists assignment_id uuid references public.circuit_assignments (id) on delete cascade;
alter table public.circuit_submissions add column if not exists student_name text not null default '';
alter table public.circuit_submissions add column if not exists circuit_encoded text not null default '';
alter table public.circuit_submissions add column if not exists student_note text not null default '';
alter table public.circuit_submissions add column if not exists created_at timestamptz not null default now();

create index if not exists circuit_submissions_assignment_id_idx on public.circuit_submissions (assignment_id);

grant usage on schema public to anon, authenticated;
grant select, insert on public.circuit_assignments to anon, authenticated;
grant select, insert on public.circuit_submissions to anon, authenticated;

alter table public.circuit_assignments enable row level security;
alter table public.circuit_submissions enable row level security;

drop policy if exists "circuit_assignments_select" on public.circuit_assignments;
drop policy if exists "circuit_assignments_insert" on public.circuit_assignments;
drop policy if exists "circuit_submissions_select" on public.circuit_submissions;
drop policy if exists "circuit_submissions_insert" on public.circuit_submissions;

create policy "circuit_assignments_select" on public.circuit_assignments for select using (true);
create policy "circuit_assignments_insert" on public.circuit_assignments for insert with check (true);

create policy "circuit_submissions_select" on public.circuit_submissions for select using (true);
create policy "circuit_submissions_insert" on public.circuit_submissions for insert with check (true);

notify pgrst, 'reload schema';
