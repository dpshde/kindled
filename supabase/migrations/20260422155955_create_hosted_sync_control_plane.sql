create extension if not exists pgcrypto;

create table if not exists public.user_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  turso_database_name text not null unique,
  turso_primary_url text not null,
  provisioned_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_app_version text
);

alter table public.user_vaults enable row level security;

drop policy if exists "user_vaults_select_own" on public.user_vaults;
create policy "user_vaults_select_own"
  on public.user_vaults
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_vaults_update_own" on public.user_vaults;
create policy "user_vaults_update_own"
  on public.user_vaults
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.devices (
  device_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  last_sync_at timestamptz,
  last_seen_at timestamptz not null default now(),
  app_version text
);

create index if not exists idx_devices_user_id on public.devices(user_id);

alter table public.devices enable row level security;

drop policy if exists "devices_select_own" on public.devices;
create policy "devices_select_own"
  on public.devices
  for select
  using (auth.uid() = user_id);

drop policy if exists "devices_insert_own" on public.devices;
create policy "devices_insert_own"
  on public.devices
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "devices_update_own" on public.devices;
create policy "devices_update_own"
  on public.devices
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
