-- Aru: таблицы клиенток и журнал примерок
-- Вставить целиком в Supabase → проект aru → SQL Editor → New query → Run
-- 24.10.2026

-- 1. Клиентки: одна строка на один аккаунт (одна подписка, один ключ)
create table if not exists public.clients (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  license_key             text not null unique,      -- ключ из Gumroad
  gumroad_sale_id         text,                      -- номер покупки в Gumroad
  gumroad_subscription_id text,                      -- номер подписки в Gumroad
  plan                    text not null default 'monthly',
  status                  text not null default 'active',   -- active / expired / cancelled / refunded
  paid_until              timestamptz,               -- оплачено до
  tryons_limit            integer not null default 30,      -- примерок в месяц
  tryons_used             integer not null default 0,       -- использовано в текущем месяце
  period_start            timestamptz not null default now(), -- начало текущего месяца подписки
  last_checked_at         timestamptz,               -- когда последний раз сверялись с Gumroad
  created_at              timestamptz not null default now()
);

-- 2. Журнал: каждая примерка и каждый анализ (для лимита «не чаще N в час»)
create table if not exists public.usage_log (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,              -- tryon / analysis
  created_at timestamptz not null default now()
);
create index if not exists usage_log_user_time on public.usage_log (user_id, created_at desc);

-- 3. Защита: клиентка видит только свою строку, менять ничего не может.
--    Все изменения делает только сервер (Edge Functions).
alter table public.clients   enable row level security;
alter table public.usage_log enable row level security;

drop policy if exists "client reads own row" on public.clients;
create policy "client reads own row" on public.clients
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "client reads own usage" on public.usage_log;
create policy "client reads own usage" on public.usage_log
  for select to authenticated using (auth.uid() = user_id);

grant select on public.clients, public.usage_log to authenticated;
grant all on public.clients, public.usage_log to service_role;
grant usage, select on sequence public.usage_log_id_seq to service_role;

-- Проверка: должно показать две таблицы
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('clients', 'usage_log');
