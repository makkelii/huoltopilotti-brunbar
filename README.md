# Huoltopilotti

Finnish-first maintenance management with Finnish, English and German interfaces. React 19, TypeScript, Vite, Tailwind, Radix/shadcn-style components and Lucide. Configured production URL: **https://brunbar.fi/**.

## Private two-user deployment

Read **[docs/PRIVATE_SETUP.md](docs/PRIVATE_SETUP.md)** for the complete Supabase and GitHub setup. No credentials need to be shared in chat.

Configured builds provide email/password sign-in, password recovery, invitation password setup and secure SDK session management. Authenticated users load real shared PostgreSQL records. An organization owner/admin manages equipment, inventory adjustments and approved preparation templates; the invited technician works on shared jobs, readiness, consumption and confirmed faults. Public signup and organization creation are disabled for the initial deployment. Provisioning the organization is a one-time database-administrator action; the second user joins through a verified email invitation.

Supabase schema/API includes tenant RLS, composite foreign keys, append-only history and stock movements, immutable approved template versions, guarded mutation RPCs and optimistic organization revisions. Maintenance completion, part/consumable consumption, audit/history and next recurring job commit atomically. Concurrent stale writes fail visibly; no automatic blind retries overwrite records or consume stock twice.

## Preview and separate demo

```sh
npm ci
npm run dev
```

Open the printed URL at `/`. Without public Supabase configuration, only the clearly labeled synthetic demo is available. With configuration, the default route is private sign-in; `/?demo=1` opens the isolated browser-local demo. Never enter confidential data in demo mode.

Copy `.env.example` to gitignored `.env.local` and set **public** Supabase URL/publishable key to test configured mode. Do not put secret/service-role keys in `VITE_*` variables. Build-time validation rejects known privileged key formats. Setting public config is not sufficient by itself: apply migrations, disable hosted public signup, provision the owner and deploy the invitation Edge Function using the setup guide.

The same equipment/job/readiness/troubleshooting UI supports both modes. Production application records never read or write demo localStorage. Only preferences and Supabase session state persist in the browser in private mode. Failed server operations show errors and never fall back to synthetic data. Manual reload and idle polling synchronize shared data.

## Features

- Responsive dashboard, equipment and inventory forms, maintenance creation/editing, assignments, due dates, recurrence and reports.
- Huoltovalmius preparation checks for tools, parts, consumables, safety, documents and personnel. The initial private version has one organization-wide preparation template with explicit owner approval and version history.
- Completion records actual usage and decreases parts/consumables, not reusable tools. Completed jobs are immutable through the API.
- Huoltotutka retrieves verified same-organization fault records using explainable word matching; no paid AI API, fabricated evidence or automatic safety authorization.
- CSV exports with spreadsheet escaping and browser print/save-to-PDF.
- Light/dark themes, onboarding and preserved synthetic demo workflows.
- Billing remains disabled. No Stripe work is enabled by this change.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:db               # disposable Docker PostgreSQL, no production credentials
npm run build
npm run verify:build
npm run test:deployment
npx playwright install --with-deps chromium
npm run test:e2e
```

`docs/VALIDATION.md` records executed commands and verification limits. PostgreSQL tests use actual RLS/transactions with minimal Auth/Storage fixtures. SDK/frontend/Edge-handler tests use mocked service boundaries. They do not claim live Supabase email delivery, Edge deployment or production-host verification.

## Deployment and remaining work

The source-repository workflow only validates; it cannot deploy Pages. A separate manual-only workflow is locked to the dedicated `makkelii/huoltopilotti-brunbar` repository, the `main` branch and confirmed `brunbar.fi` Pages domain. The CNAME template is staged outside `public/` and copied only into the dedicated deployment artifact. See `docs/BRUNBAR_DEPLOYMENT.md` for Finnish setup, DNS, HTTPS, cutover and rollback instructions, and `docs/HOSTING_INSPECTION.md` for verification limits and protection of 585.fi.

This branch includes PR #2 (still open at inspection), preserving all Supabase implementation. Do not copy the old demo-only main into the new repository. No database schema or bootstrap reset is introduced here. The existing `invite-technician` function is retained unchanged; brunbar uses `invite-technician-brunbar` with `BRUNBAR_APP_ORIGIN` so legacy `APP_ORIGIN` remains untouched.

No live hosting, custom domain, DNS, Auth settings or database has been changed. Live Supabase configuration, email delivery and operator acceptance tests remain necessary. Billing stays disabled.

Password recovery setup and Finnish troubleshooting: [docs/PASSWORD_RECOVERY.md](docs/PASSWORD_RECOVERY.md). Hosted Supabase URL/SMTP/template configuration must be verified independently; frontend commits do not change it.
