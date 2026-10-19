# Private two-user setup — https://brunbar.fi/

This guide prepares real Supabase data for one owner and one technician at https://brunbar.fi/. **This is preparation only. Nothing is deployed, merged or migrated automatically; 585.fi remains untouched.** No passwords, service-role keys, database connection strings or SMTP credentials should be posted into chat, committed, or stored in GitHub Variables. Keep them in the appropriate Supabase Dashboard or local secret configuration. This PR does not merge, deploy, create live accounts, send invitations or change the published site automatically.

## Shared-project stop condition

Before any later live setup, determine whether the project already serves another application. Do not change shared Site URL, signup/provider settings, session rules, SMTP templates, existing redirect entries or `APP_ORIGIN` merely to follow fresh-install instructions. If required private Auth settings conflict with an existing application, stop and plan separation explicitly; do not reset, recreate or migrate an existing database as part of this preparation. Steps describing new project/provider setup apply only to a new or confirmed Huoltopilotti-only installation. Existing correct settings and accounts stay in place.

## 1. Prepare a private Supabase project

1. **If Huoltopilotti already has a Supabase project, reuse it and preserve its data. Do not create a replacement database or reset it.** Record its applied migrations and existing owner/memberships. Only if no project exists, create one in Supabase Dashboard with a suitable EU region, keeping its database password in your password manager.
2. In **Authentication → Sign In / Providers → Email**, enable email/password authentication, keep email confirmation enabled, and **turn off Allow new users to sign up / Enable sign ups**. Dashboard wording varies. Also disable anonymous sign-ins and every OAuth provider you do not need. The frontend has no signup or organization-creation screen, but disabling server-side public signup is essential.
3. In **Authentication → Settings / Security and Protection**, set a minimum password length of 12 or stronger, suitable rate limits, and review session time limits. Prefer a short inactivity/session timeout for shared industrial devices. The frontend uses Supabase's refresh-token management and clears application state on sign-out or session loss. Tokens persist only in the Supabase auth storage key; application records are not stored in browser storage in private mode.
4. In **Authentication → URL Configuration**, set **Site URL** to `https://brunbar.fi/` only when this project is dedicated to Huoltopilotti and the change will not alter another working application. In a shared project, preserve the existing Site URL and existing redirect entries; add the following exact brunbar redirect entries without removing any old ones. Explicit recovery/invitation redirects in this implementation point to brunbar.fi independently of the shared Site URL. Review default email links before changing any shared setting. Add these **Redirect URLs**:
   - `https://brunbar.fi/`
   - `https://brunbar.fi/?auth=invite`
   - `https://brunbar.fi/?auth=recovery`
   Avoid wildcard redirects. For local integration testing only, add the corresponding exact URLs under `http://localhost:5173/`; remove them when no longer needed. Hash page navigation uses `#assets` etc.; auth callbacks use the same static entrypoint and do not require server rewrites.
5. Configure **Authentication → Emails → SMTP Settings** using a verified sender and credentials entered directly in Supabase. The default provider has restrictive delivery limits and recipient restrictions. Set invite/recovery link expiry to at most two days; the application invitation authorization expires after two days regardless of the email token's setting. Retain the default secure `{{ .ConfirmationURL }}` in invitation and password-recovery templates. Do not replace it with a raw frontend URL: Supabase must verify the one-time token first. Disable email-provider click tracking if it breaks or prefetches authentication links. Test delivery after deployment.

`supabase/config.toml` supplies matching root-domain settings for a local Supabase project. It does not automatically change a hosted project's Auth dashboard settings. Do not run a blanket config push against a shared project: preserve other applications' settings. Review hosted settings separately; do not assume deploying an Edge Function disables signup.

## 2. Apply database migrations

Use **SQL Editor** in the selected project (preferred without sharing a connection string):

1. **Existing production database:** apply only migrations not already applied; do not replay, reset or recreate tables. This brunbar preparation adds no schema migration. If this project has never had Huoltopilotti migrations applied, run the complete `supabase/migrations/202610190001_core.sql` once.
2. Run `supabase/migrations/202610190002_private.sql` once. On a project already using the first migration, apply only the second. The second preserves existing normalized records, adds persistent application metadata and replaces direct client writes with the validated RPC API. Do not re-run either file on an initialized database.
3. Check that both SQL executions succeeded. Run `select tablename, rowsecurity from pg_tables where schemaname='public';` and confirm every application table has `rowsecurity = true`.
4. Do **not** run `supabase/tests/bootstrap.sql` on Supabase: it is a disposable PostgreSQL test fixture, not deployment SQL. Do not insert demo fixtures or copy localStorage data. A new production organization starts empty.

If you already use the Supabase CLI, you can instead authenticate locally, link the project and run `supabase db push` through a secure local environment. Reconcile migration history first if files were previously applied in SQL Editor. Avoid destructive reset commands on the live project.

## 3. Provision the owner without public signup

1. **Skip this section when the owner, organization and `private_deployment` marker already exist.** Keep their UUIDs, roles and records. For a new installation only, in **Authentication → Users → Invite user**, enter the owner's email. Use the Dashboard/admin invitation; never enable public signup just to create the owner. If the UI asks for a redirect URL, choose `https://brunbar.fi/?auth=invite`.
2. The owner accepts the invitation email. Supabase confirms the email before redirecting. The new frontend supports password setup for `?auth=invite`. If the existing published demo does not support it yet, confirm the email now and use **Authentication → Users → Send password recovery** after the new build is explicitly deployed. Recovery uses the canonical callback above. No password is needed in SQL or chat.
3. Copy the owner's non-secret **User UID** from Authentication → Users. Open `supabase/private-bootstrap.sql` in SQL Editor, replace the placeholder UUID with this UID and change the organization label. Execute it once after the email is confirmed.
4. This transaction creates exactly one private organization, its owner membership and the private-deployment marker. It fails if already initialized, so repeating the guide does not overwrite existing organizations. No browser endpoint can invoke this bootstrap or create organizations.
5. Check `select o.name, m.role, m.display_name from public.organizations o join public.memberships m on m.organization_id=o.id;`. There should initially be one owner in your organization. Display names default to verified email addresses and are also used for technician assignment in this initial version.

The owner may initially see a “workspace could not be loaded” message before step 3; this is intentional. An authenticated account without membership has no access and does not receive a demo fallback.

## 4. Deploy the secure invitation Edge Function

1. Install the Supabase CLI locally and authenticate through its supported login flow. Link this repository to the selected project, keeping any CLI token/password outside source control.
2. Deploy only the invitation function: `supabase functions deploy invite-technician-brunbar`. Its configuration uses `verify_jwt = false` because the handler explicitly validates the bearer token through `auth.getUser()` on **every** request; it does not trust decoded claims. This supports current publishable keys. Do not remove this verification from the handler.
3. Preserve any existing global `APP_ORIGIN` value: the legacy function may rely on it. Do not redeploy the old `invite-technician` function or change its secrets. The new function deliberately uses the separate `BRUNBAR_APP_ORIGIN` setting instead. In **Edge Functions → Secrets**, set `BRUNBAR_APP_ORIGIN` to `https://brunbar.fi`. The `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` built-in Edge secrets are normally provided automatically. Verify they are available in the Edge runtime; never copy the service-role key into GitHub or frontend environment variables. Invitation redirects are server-selected as `https://brunbar.fi/?auth=invite`; request bodies cannot override them.
4. Check the function is deployed. Do not deploy or enable the billing function; Stripe is out of scope.

The function checks the authenticated caller, manager membership and the single private-deployment organization. It reserves the one remaining user slot before sending a Supabase admin invite. The database creates a **technician** membership only when the invited email becomes confirmed, before the invitation expires. A caller cannot choose an owner role. Concurrent requests cannot reserve more than two total members/pending invitations. Unconfirmed accounts cannot access records.

## 5. Configure GitHub Actions public variables

In `makkelii/huoltopilotti-brunbar`, open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Add:

| Repository variable | Value | Visibility |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Project's API URL, e.g. `https://<project-ref>.supabase.co` | Public browser config |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project's **publishable** key (`sb_publishable_…`), or legacy **anon** JWT | Public browser config |

Find these in Supabase **Project Settings → API Keys / Connect**. Never choose a secret key (`sb_secret_…`) or a `service_role` JWT. RLS and authenticated RPCs, not secrecy of the public key, protect records.

The workflow supplies `VITE_BASE_PATH=/` explicitly. The dedicated deployment additionally requires `BRUNBAR_DEPLOYMENT_APPROVED=true`; see BRUNBAR_DEPLOYMENT.md. No secret GitHub Actions variables are needed for the frontend. Edge secrets and database/SMTP credentials stay in Supabase. For local development only, copy `.env.example` to gitignored `.env.local` and populate public configuration there. The legacy frontend variable `VITE_SUPABASE_ANON_KEY` is supported locally; the Actions workflow uses `VITE_SUPABASE_PUBLISHABLE_KEY`.

When public configuration is missing, local development clearly shows that only the synthetic demo is available. Manual deployment fails if the required public configuration variables are absent, preventing accidental replacement of the private deployment with an unconfigured demo build.

## 6. Prepare an independent deployment — do not deploy the source repository

Follow **BRUNBAR_DEPLOYMENT.md** for the separate `makkelii/huoltopilotti-brunbar` repository, dedicated Pages custom domain, exact DNS values, HTTPS verification and brunbar-only rollback. Read **HOSTING_INSPECTION.md** first: the live Pages arrangement could not be verified, so reusing any existing 585.fi Pages site is forbidden.

The brunbar branch includes unmerged PR #2. Copy this reviewed branch into the new empty repository, or review/integrate PR #2 first and then these changes. Do not copy the old README/demo-only main. No merge or repository creation is automatic.

In the **new dedicated repository only**, configure Pages → GitHub Actions and custom domain `brunbar.fi`, public variables listed above, `BRUNBAR_DEPLOYMENT_APPROVED=true`, and the `brunbar-production` environment. Explicitly run **Deploy brunbar.fi (dedicated repository only)** from `main` with `confirm_domain=brunbar.fi` only after approving the cutover. It will refuse `makkelii/Huolto`, a non-main ref, an unapproved domain, missing public configuration, or a Pages domain other than brunbar.fi. The source-repository workflow only validates and uploads a non-deployed build artifact.

The app is mounted at `/` and emits `/assets/` links. Check `https://brunbar.fi/`, `https://brunbar.fi/#assets`, password recovery and invite redirects. Do not modify 585.fi's DNS, hosting, custom-domain setting or published files. Do not dispatch historical source-repository deployment workflows.

## 7. Invite the technician from the application

1. Sign in as the owner at `https://brunbar.fi/`. Add a real asset and an inventory item first. You should see your organization name and “Private workspace”, with no seeded machines or demo records.
2. Open **Settings → Team**, enter the technician's email, and select **Invite technician**. This is the first action that sends the real invitation email; do it only when ready.
3. The technician accepts the one-time email link and sets a password. The account is assigned technician access to the **same organization**, without selecting or creating an organization.
4. Both users can create/update jobs, prepare work, complete work and record confirmed faults. The owner/admin manages assets, inventory adjustments, template approvals and invitations. Technicians can read shared equipment/inventory and consume parts only through completion transactions. No third user slot is available through this invitation mechanism.
5. If SMTP fails, the function returns an error and removes the unused reservation. If a function/network response is lost after sending, a pending invitation may remain. Inspect `private_invitations` in SQL Editor and the Auth user's state before resending. To revoke an unaccepted invitation, delete its pending `private_invitations` row in SQL Editor and remove the unconfirmed Auth user using the Dashboard. Never delete accepted memberships just to resend mail. Existing Auth users cannot be invited with the admin invite API; review those users manually rather than silently granting membership.

## 8. Verify live behavior (must be done after your configuration)

Use two separate browser profiles/devices:

1. Owner adds an asset, then technician reloads or waits up to 15 seconds with no form open. Both should see the same record.
2. Technician creates a job assigned to a real member. Owner sees it. Set up a preparation template as owner, with real tools/parts/safety/document/personnel requirements; new jobs copy the approved requirements. There is one organization-wide preparation template in this initial version. Existing job requirements stay unchanged by subsequent template revisions.
3. Set stock to one for a spare part and create two jobs. Try consuming it concurrently. Only one completion should succeed; the other must reload and resolve the conflict. Verify history and stock movements; reusable tools must not be consumed. Completed jobs cannot be edited or completed again.
4. Record a confirmed fault and search matching words as the other user. Results must reference only your organization's verified records. Matching remains deterministic and is not a diagnosis or a permit to start work.
5. Test password recovery, expired/reused invite links, wrong password, sign-out and a second tab. Signed-out users must see the sign-in screen. Accounts without membership must see an access error. Open `https://brunbar.fi/?demo=1` to check that synthetic data stays isolated; demo reset must not affect private records.
6. Verify an outsider cannot register using the public Auth API (signup disabled) and cannot create an organization. Run security checks against a separate test project if testing other organizations. Do not use the service-role key to test RLS—it bypasses RLS.

Local automated tests cover SDK/HTTP contracts with mocks and actual PostgreSQL permission/transaction behavior. They do not prove your live project's SMTP delivery, Auth dashboard configuration, redirect allowlist, Edge deployment, DNS or hosting headers. No successful live Supabase integration is claimed before these steps.

## Operation and limitations

- Authenticated records are loaded from PostgreSQL through `private_snapshot` and saved via `private_mutate`, never demo localStorage. UI preferences and the SDK's session are separate browser state. Separate devices share PostgreSQL records; polling runs every 15 seconds when no editing dialog is open. A manual **Reload data** action is available in Settings.
- Stale revisions fail rather than overwrite concurrent work. After a conflict, reload and reapply your change. If a write response is lost, it may have committed: reload before retrying. Completion is atomic and guarded against duplicate consumption; the UI never retries it blindly.
- Current scope supports one shared organization and two initial accounts, one default preparation template, and no application data-deletion UI. Use reviewed server/admin procedures for membership changes, record deletion and GDPR requests. Photos/QR workflows, advanced reservations and notifications are not added in this PR. Stripe stays inactive.
- Back up before migrating. Enable and monitor Supabase backups, retain audit/history records according to your policy, review access periodically, and use production SMTP. Revoke sessions through Supabase Dashboard when a device is lost.

## Password recovery troubleshooting

For localhost redirects, failed recovery requests, SMTP/rate limits and recovery email templates, follow **[PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md)**. It distinguishes frontend fixes from hosted settings, preserves security checks, and explains why an old emailed link must be replaced after correcting the project Site URL.
