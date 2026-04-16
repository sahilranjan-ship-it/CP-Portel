# CP AS Partner

Role-based referral management platform for contractor partners, IS, Scheduling, VM and Admin.

## Stack

- React 19
- TypeScript
- Vite
- Supabase auth and relational backend

## What is included

- Role-specific dashboards for CP, IS, Scheduling, VM and Admin
- Connected lead flow from referral to BA collection and payout
- Supabase auth client with Google OAuth sign-in
- Demo fallback mode when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set
- Supabase migration under [supabase/migrations/001_initial_schema.sql](/Users/user/Desktop/CP AS Partner/supabase/migrations/001_initial_schema.sql)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the app:

```bash
npm run dev
```

4. Apply the schema to Supabase:

```bash
supabase db push
```

5. Enable Google auth in Supabase:

```text
Supabase Dashboard -> Authentication -> Providers -> Google
```

- Enable the Google provider
- Add your Google OAuth client ID and secret
- Add your local and production redirect URLs
- Save the provider before testing login

## Auth expectations

- Supabase Auth is the system of record.
- Google OAuth must be enabled in Supabase for live login.
- App access is resolved from `public.user_master`, not client-side role switching.
- Suggested roles: `cp`, `is`, `scheduling`, `vm`, `admin`.
- Each live user should have a `user_master` row with:
  - `email`
  - `role`
  - `auth_user_id` linked after first successful authentication

## Product structure

- CP dashboard: profile, KPI cards, lead tabs, journey tracker, earnings, lead submission form
- IS dashboard: SLA view, qualification KPIs, call queue, disposition details
- Scheduling dashboard: scheduling TAT, meeting queue, assignment fields, notification flow
- VM dashboard: CP master, onboarding, agreement tracking, lead creation fields
- Admin dashboard: control tower KPIs, lead master, CP overview, performance panels, payouts, agreements and escalations

## Notes

- The current frontend ships with seeded data so the UI is fully navigable before backend wiring is complete.
- The app now uses a repository layer:
  - [src/data/demo-repository.ts](/Users/user/Desktop/CP AS Partner/src/data/demo-repository.ts) for local preview mode
  - [src/data/supabase-repository.ts](/Users/user/Desktop/CP AS Partner/src/data/supabase-repository.ts) for live Supabase mode
- Once Supabase env vars are present, the provider switches to the live repository automatically.
- `code-review-graph` is installed and configured for Codex on this machine.
- Project commands:
  - `npm run graph:build`
  - `npm run graph:update`
  - `npm run graph:watch`
  - `npm run graph:status`
- `graph:update` falls back to `build` when the folder is not a git repository yet.
- Recommended next backend steps:
  - populate `user_master` and `cp_master.linked_user_id` with real CP login mappings
  - store `auth.users.user_metadata.role` and `full_name` consistently
  - apply [supabase/migrations/002_role_ownership_and_rls.sql](/Users/user/Desktop/CP AS Partner/supabase/migrations/002_role_ownership_and_rls.sql) to enable owner-scoped policies for CP, IS, Scheduling and VM
  - ensure submitted leads receive `is_owner_id` and scheduled leads receive `scheduling_owner_id`
