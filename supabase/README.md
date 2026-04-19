# Supabase schema & migrations

This directory holds the canonical, source-controlled definition of the
Supabase backend Nexus talks to. Everything the app expects to exist in
production — tables, policies, triggers, buckets — lives here so we can
diff it in git and re-apply it cleanly to a fresh project.

## Contents

- `migrations/0001_user_data_rls.sql` — creates the `public.user_data`
  table, enables row-level security with owner-only policies, wires
  Realtime, and configures the `avatars` storage bucket with matching
  RLS policies.

## Applying a migration

Either run the SQL file directly from the Supabase Dashboard **SQL Editor**,
or pipe it through the CLI:

```bash
supabase db reset            # destructive; only on a throwaway project
# or:
supabase db push             # applies migrations in dependency order
```

All statements are idempotent — re-running `0001_user_data_rls.sql`
against an existing project is safe.

## Invariants after applying

- A signed-in user can only read/write their own row in `user_data`
  (`auth.uid() = user_id`).
- Avatar uploads must live under `${userId}/...` — other prefixes are
  rejected at the storage-policy layer.
- The `user_data` table is part of the `supabase_realtime` publication
  so multi-device sync keeps working.
