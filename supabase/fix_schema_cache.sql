-- Když API hlásí: „Could not find the '…' column … in the schema cache“

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'circuit_assignments'
order by ordinal_position;

alter table public.circuit_assignments add column if not exists instruction_text text not null default '';
alter table public.circuit_assignments add column if not exists instruction_image text;
alter table public.circuit_assignments add column if not exists created_at timestamptz not null default now();

notify pgrst, 'reload schema';
