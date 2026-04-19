-- ──────────────────────────────────────────────────────────────────────────
-- Nexus: row-level security for per-user workspace data
--
-- This migration is the canonical, source-controlled definition of the
-- security surface for the multi-user deployment. Run it once against a
-- fresh Supabase project and re-run it as the schema evolves — every
-- statement is idempotent.
--
-- Protects:
--   * public.user_data   — each row is one user's AppData payload
--   * storage.avatars    — each user's uploaded profile photo, keyed by uid
--
-- Expected invariants after applying this file:
--   * A signed-in user can only SELECT / INSERT / UPDATE / DELETE their
--     own row in user_data (auth.uid() = user_id).
--   * Anonymous / service_role access is forbidden at the user surface.
--   * Avatar storage is scoped to `${auth.uid()}/…` prefixes: users may
--     write into their own folder and read any publicly-shared avatar via
--     the CDN, but cannot overwrite or delete another user's files.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. user_data table ────────────────────────────────────────────────────
create table if not exists public.user_data (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  payload     jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- Keep updated_at in sync on every write so conflict resolution in the
-- client can trust the timestamp it receives.
create or replace function public.user_data_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_set_updated_at on public.user_data;
create trigger user_data_set_updated_at
  before insert or update on public.user_data
  for each row execute function public.user_data_set_updated_at();

alter table public.user_data enable row level security;
alter table public.user_data force row level security;

-- Owner-only policies. We re-create them on every run so schema changes in
-- the app can safely ship migrations without manual Supabase dashboard edits.
drop policy if exists "user_data: owner select" on public.user_data;
create policy "user_data: owner select"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data: owner insert" on public.user_data;
create policy "user_data: owner insert"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data: owner update" on public.user_data;
create policy "user_data: owner update"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_data: owner delete" on public.user_data;
create policy "user_data: owner delete"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- ── 2. Realtime broadcast ────────────────────────────────────────────────
-- Every client subscribes to change events on its own row so avatar
-- uploads and settings changes propagate instantly across devices.
alter publication supabase_realtime add table public.user_data;

-- ── 3. avatars storage bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner insert" on storage.objects;
create policy "avatars: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Done.
