-- Aru: хранилище фото клиенток, разборы и примерки (выполнено 25.10.2026 через Claude)
alter table public.clients alter column license_key drop not null;
alter table public.clients add column if not exists source text not null default 'gumroad';  -- gumroad | manual (Kaspi)
alter table public.clients add column if not exists note text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-files','client-files', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create table if not exists public.client_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  face_path text, body_path text,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.analyses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null, model text,
  created_at timestamptz not null default now()
);
create table if not exists public.tryons (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('look','hair')), key text not null,
  status text not null default 'done', image_path text, model text, error text,
  created_at timestamptz not null default now()
);
alter table public.client_profile enable row level security;
alter table public.analyses enable row level security;
alter table public.tryons enable row level security;
create policy "own profile read" on public.client_profile for select using (auth.uid() = user_id);
create policy "own analyses read" on public.analyses for select using (auth.uid() = user_id);
create policy "own tryons read" on public.tryons for select using (auth.uid() = user_id);
grant select on public.client_profile, public.analyses, public.tryons to authenticated;
grant all on public.client_profile, public.analyses, public.tryons to service_role;
grant usage, select on sequence public.analyses_id_seq, public.tryons_id_seq to service_role;
alter table public.tryons add column if not exists custom_text text;  -- свой вариант её словами (26.10.2026)
