# Valmistumislomakkeen hakupäivitys (20.10.2026)

Ajetut tarkistukset: `npm run lint`, `npm run typecheck`, `npm test` (**70 testiä**), `npm run test:integration` (**33**, yksikkötestien osajoukko), `npm run build`, `npm run verify:build`, `npm run test:deployment` (**12**) ja `npm run test:db` (erillinen PostgreSQL 16). `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` läpäisi **16 testiä** työpöytä- ja mobiilinäkymissä.

Uudet testit kattavat haun nimellä, tuotenumerolla ja tunnisteella, 5 000 demonimikkeen sivutuksen, palvelinhaun rajauksen ja enintään 26 rivin HTTP-pyynnön, aktiivisuuden ja tyyppisuodatuksen, tyhjät/hylätyt hakutulokset, uudelleenyrityksen, vanhentuneen vastauksen hylkäämisen, valinnan, määrän muokkauksen, poistamisen ja kaksoisvalinnan eston. Selaimessa testataan näppäimistövalinta, Escape ja kohdistuksen palautuminen, muuttumaton työkalusaldo, osakulutus ja pysyvä historia. Uusi SDK/HTTP-skenaario löytää tuotteen, jota ei ole sovelluksen ladatussa inventaariossa, ja tallentaa valmistumisen nykyisellä transaktio-RPC-sopimuksella.

Tietokannan migraatioita, RLS:ää ja kulutustransaktiota ei muutettu. Nykyinen PostgreSQL-testaus tarkistaa edelleen organisaatiorajat, oikeudet, muuttumattoman historian ja samanaikaisen viimeisen varaosan kulutuksen. Supabasen HTTP-vastaukset on selaintesteissä mockattu: tuotannon PostgREST-palvelua, hakukyselyn suorituskykyä tai tuotantoasetuksia ei väitetä testatuiksi. Demon 5 000 tietueen testi osoittaa sivutuksen toiminnan, ei tuotantopalvelun kuormituskestoa. Käyttö ja käyttöönotto: [COMPLETION_ITEM_SELECTION.md](COMPLETION_ITEM_SELECTION.md).

---

# Huoltohistoria- ja yrityseristyspäivityksen testit (20.10.2026)

Paikallisesti ajetut komennot: lint, typecheck, build ja verify:build; Vitest **59 testiä**, integraatio-osajoukko **22 testiä**, Playwright **14 testiä** työpöydällä ja mobiilissa sekä deployment-suojaukset **12 testiä**. `npm run test:db` suorittaa kaikki kolme migraatiota erillisessä PostgreSQL 16 -kontissa, yrityseristyksen ja samanaikaisen viimeisen varaosan kulutuksen testit sekä uuden `history.sql`-kokonaisuuden.

Uudet tarkistukset: suorituskerran muuttumaton tilannekuva, toistuvan työn erillinen uusi historia, työkalun säilyvä saldo, todellinen työaika, tarvikkeen nimen muuttumattomuus historiassa rekisterimuutoksen jälkeen, vanhan huollon avaaminen laitteen historiasta sivun päivityksen jälkeen, käytöstä poistettu varaosa, usean jäsenyyden oletusorganisaatio ja epäselvän jäsenyyden esto. Tietokanta testaa myös toisen erikseen sallitun yrityksen kutsun, teknikon oikeuksien korotuksen eston ja yksilöllisen oletusjäsenyyden. Alkuperäiset kirjautumisen, palautuksen ja kutsujen testit säilyvät.

Huoltohistorian suojaus esti aluksi vanhan testifixtuurin valmistuneen työn uudelleenosoituksen: kutsutesti erotettiin omaksi yrityksekseen, joten historiaa ei enää tarvitse muuttaa testin valmistelussa. Tämä vastaa tarkoitettua tuotantokäyttäytymistä.

Supabasen tuotantoyhteyttä, Auth-asetuksia, oikeita sähköposteja tai tuotantokannan asennettua skeemaa ei testattu. Selain käyttää oikeaa Supabase SDK:ta mockatuilla HTTP-vastauksilla; SQL-testi käyttää oikeaa PostgreSQL:ää minimaalisilla Auth/Storage-fixtuureilla. Uutta migraatiota ei ajettu tuotantoon, käyttäjiä ei kutsuttu eikä sivustoa julkaistu.

Aiemmat validointiraportit alla ovat aiempien versioiden tuloksia.

---

# Executed validation — brunbar.fi preparation

Tests ran in the local implementation environment with Node 24.19, npm 11.9, installed Chromium and Docker PostgreSQL 16.15. No live Supabase project credentials were supplied. No Pages/DNS/custom-domain settings were changed. No live accounts were created, no real invitations/recovery messages were sent, and no deployment or payment activation was performed.

| Command | Result |
| --- | --- |
| `npm run build` | Passed; root `/assets/` asset base, Supabase split into its own bundle |
| `npm run verify:build` | Passed; emitted root asset files exist, no legacy application deployment URLs in browser JS |
| `npm run test:deployment` | 12 passed: dedicated repo/ref/manual approval/domain guards, validation-only source workflow, staged CNAME and build validation |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 37 passed across domain, demo UI, authentication, repository, brunbar invitation-handler and public-config tests |
| `npm run test:integration` | 15 passed (UI/authentication/repository subset of the above) |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` | 6 passed: three scenarios on desktop and mobile Chromium |
| `npm run test:db` | Passed: both migrations, tenant permissions, shared records, invitations, and real concurrent last-part consumption |
| `npm audit --omit=dev --audit-level=high` | Zero production dependency vulnerabilities reported |
| `git diff --check` | Passed |

## Boundaries actually tested

- Browser tests run the actual Supabase JavaScript SDK against intercepted Auth/PostgREST HTTP contract responses: password sign-in, server snapshot, guarded asset write, reload persistence, no demo-localStorage writes and sign-out. Existing demo equipment/job editing, readiness, completion, inventory consumption, history and troubleshooting workflows still pass on desktop/mobile. HTTP interception is not a live Supabase integration test.
- Unit/integration tests cover recovery redirect requests, authenticated password updates, absent membership, session loss, late-response rejection, production write failure without fake success, deterministic same-organization verified evidence, reserved-stock checks, recurrence, human approval and CSV escaping.
- Invitation handler tests cover invalid/missing tokens, browser origin enforcement, denied reservation/permissions, server-selected redirect and failed-delivery cleanup. Actual `auth.getUser()`, admin invite delivery and Deno Edge deployment remain service-boundary integration checks for the operator.
- PostgreSQL tests run actual SQL/roles/RLS and functions in a disposable PostgreSQL 16 container, with minimal `auth.uid()`, Auth user and Storage table fixtures. They verify shared owner/technician records, viewer restrictions, anonymous/outsider/other-organization access denial, tenant reference constraints, direct-write rejection across tables, immutable completion, actual consumption, stock/history rollback, recurring job creation, fault persistence, invite confirmation/single-use/fixed technician role and the two-user limit. All public application tables are checked for enabled RLS.
- Two independent database sessions race different jobs for a single spare part. Exactly one completion commits; the other receives a stale-revision conflict. Assertions check zero remaining stock, exactly one history record, one consumption movement and one committed revision.
- Public-config tests reject privileged secret-key/service-role JWT formats, partial configuration and remote non-HTTPS endpoints.

Early failures exposed asynchronous demo test expectations, an invitation fixture's assignment foreign key and a short-viewport sidebar scrolling issue. These were fixed before successful final runs.

## Not verified live

Hosted Supabase Auth settings, public signup disablement, SMTP delivery, recovery/invite token expiry and redirect allowlists, deployed Edge Functions, production RLS grants as installed in the selected project, Storage HTTP access, custom-domain DNS/proxy mapping, live two-device sessions and hosting security headers require the PRIVATE_SETUP.md acceptance checklist. The Deno entrypoint itself was not executed in the Supabase Edge runtime; its extracted handler was tested in Vitest. No live success is inferred from mocks or local SQL fixtures.

No full WCAG audit, Safari/Firefox run, high-volume load test, background reminders, advanced reservations or Stripe integration is claimed.

## Hosting and preservation checks

PR #2 was open/unmerged at inspection; this branch includes its exact head (`84fdfa6`). `git diff 84fdfa6 -- supabase/migrations supabase/private-bootstrap.sql supabase/functions/invite-technician` produced no changes. Real databases were not touched; the PostgreSQL suite ran only in its disposable local container. The frontend now invokes the separately named `invite-technician-brunbar`; tests verify its exact root callback and rejection of the legacy origin. The old function remains intact.

The read-only Pages query returned Forbidden, so live hosting independence was not verified. The prepared deployment rejects the source repository and account-level repository, requires the dedicated repository and manual approval, checks its Pages custom domain read-only, and stages CNAME only in its deployment artifact. No workflow was dispatched. See HOSTING_INSPECTION.md for the exact limits and BRUNBAR_DEPLOYMENT.md for manual DNS/HTTPS/rollback steps.

## Password recovery fix validation

The recovery fix adds canonical production callback tests, safe error-code classification, callback capture before SDK URL consumption, session-gated password updates, expired-link handling and tests excluding organization reads during recovery. Executed on the brunbar repository checkout: build, root asset validation, lint, TypeScript, 55 unit/integration tests, the 20-test integration subset, 12 deployment guards and 14 desktop/mobile browser tests passed. Browser recovery scenarios exercise the actual SDK against mocked Auth HTTP responses, including Dashboard-style fragments without query parameters. No live email or production token was tested. Database schema/policies and Edge Functions were not changed by this fix; the PostgreSQL suite was not rerun for this frontend-only change.
