# Salasanapalautus — brunbar.fi

## Mitä koodista löytyi ja mitä korjattiin

- `resetPasswordForEmail`-pyynnön kaikki virheet näytettiin aiemmin kirjautumisvirheenä. Viesti ei kertonut, oliko kyse lähetysrajasta, SMTP-vastaanottajarajoituksesta, palvelinvirheestä, CAPTCHAsta vai verkko-ongelmasta. Nyt palautuspyyntö ja salasanan päivitys saavat omat turvalliset, lokalisoidut virheilmoituksensa. Tunnetut Supabase-virhekoodit luokitellaan; raakoja palvelinviestejä, osoitteita tai tokeneita ei tulosteta.
- Tuotannon palautusosoite on nyt yksiselitteisesti `https://brunbar.fi/?auth=recovery`. Paikalliskehityksen localhost-osoite säilyy vain paikallisessa kehityksessä.
- Palautus-/kutsutarkoitus ja URL-virheliput otetaan talteen **ennen** kuin SDK käsittelee URL-fragmentin. Tokeneita ei kopioida tähän tilaan. Myös Dashboard-linkki, joka sisältää `#…&type=recovery` mutta ei `?auth=recovery`-parametria, tunnistetaan.
- Salasanan päivitys näytetään vain SDK:n palauttaman kirjautumisistunnon yhteydessä. Pelkkä kyselyparametri, virheellinen tai vanhentunut linkki ei riitä. Päivitys tehdään edelleen `auth.updateUser`-kutsulla; Supabase tarkistaa istunnon palvelimella.
- Organisaatioiden/jäsenyyden lataus ei käynnisty palautuksen aikana. Puuttuva jäsenyys tai organisaation lukurajoitus ei enää peitä palautuslomaketta tai estä oman salasanan vaihtoa.

Tuotannon lähetysvirheen täsmällistä palvelinsyytä ei voitu vahvistaa, koska tässä istunnossa ei ollut pääsyä Supabasen Auth-lokeihin tai projektiasetuksiin. Dashboardista toimiva lähetys ei todista sovelluksen `/auth/v1/recover`-pyynnön onnistumista: vastaanottaja-, SMTP-, nopeusraja- ja CAPTCHA-tarkistukset pitää tarkistaa tämän pyynnön vastauksesta/lokista. Koodikorjaus ei muuta SMTP:tä tai projektin hallinta-asetuksia automaattisesti.

## Pakolliset tarkistukset Supabase Dashboardissa

Tee nämä oikeassa **brunbar.fi:n käyttämässä projektissa**, jonka julkinen URL on GitHubin `VITE_SUPABASE_URL`-muuttujassa. Älä muuta toisen sivuston projektia. Älä aja migraatioita tai organisaation bootstrapia uudelleen.

1. **Authentication → URL Configuration**
   - **Site URL:** `https://brunbar.fi/`.
   - **Redirect URLs:** lisää täsmälleen `https://brunbar.fi/?auth=recovery`, `https://brunbar.fi/?auth=invite` sekä `https://brunbar.fi/`.
   - Jos Site URL on `http://localhost:3000`, Dashboardin ilman erillistä paluuosoitetta lähettämä linkki ohjautuu sinne. Tämä on Supabasen oletusosoite. Muutos pitää tehdä Dashboardissa; repositorion `supabase/config.toml` ei päivitä olemassa olevaa hosted-projektia.
   - Jos projekti on aidosti jaettu muun toimivan sovelluksen kanssa, älä muuta sen Site URLia sokkona. Säilytä sen osoitteet ja käytä Dashboardin palautuslähetyksessä erikseen brunbarin paluuosoitetta, jos käyttöliittymä sallii sen. Huoltopilotin oma palautuspyyntö määrittää brunbar-osoitteen eksplisiittisesti. Selvitä jaettu Auth-konfiguraatio ennen globaalia muutosta.
2. **Authentication → Emails → Templates → Reset Password** (joissakin näkymissä Authentication → Email Templates)
   - Linkin tulee käyttää Supabasen varmennusosoitetta: `href="{{ .ConfirmationURL }}"`.
   - Poista mahdollinen kovakoodattu `localhost:3000` palautuspohjasta.
   - Älä käytä pelkkää `{{ .SiteURL }}`- tai `{{ .RedirectTo }}`-osoitetta varmennuslinkin korvikkeena. Niissä ei yksinään ole palautuksen varmentavaa tokenia.
   - Tämä staattinen sovellus käyttää SDK:n implicit-palautusta. Älä vaihda pohjaa SSR-ohjeiden `/auth/confirm?token_hash=…`-malliin: sellaista palvelinreittiä ei ole tässä sovelluksessa.
3. **Authentication → Sign In / Providers → Email**
   - Email/password käytössä ja julkinen signup edelleen pois käytöstä.
   - Säilytä sähköpostivarmennus, salasanavaatimukset ja muut suojausasetukset. Älä poista CAPTCHAn kaltaista suojausta palautusvirheen peittämiseksi. Jos Auth palauttaa `captcha_failed`, sovelluksen CAPTCHA-integraatio tarvitsee erillisen korjauksen; tämä muutos tunnistaa virheen mutta ei ohita varmennusta.
4. **Authentication → Emails / SMTP Settings**
   - Tarkista varmennettu lähettäjä, SMTP-palvelin, portti ja tunnistautuminen suoraan Supabasen hallinnassa. Älä laita SMTP-salasanaa GitHub Variablesiin, frontendin ympäristöön tai keskusteluun.
   - Supabasen oletuslähetin rajoittaa vastaanottajia ja lähetystiheyttä eikä ole tuotannon toimitustakuu. `email_address_not_authorized` viittaa vastaanottajarajoitukseen. `over_email_send_rate_limit`/HTTP 429 edellyttää odottamista ja lähetysrajojen tarkistusta; älä yritä toistuvasti peräkkäin.
5. **Logs → Auth** (tai Authentication → Logs)
   - Tarkista epäonnistuneen `/recover`-pyynnön ajankohta ja virhekoodi. HTTP 500 / `unexpected_failure` voi liittyä lähetyspalveluun; tarkka syy on katsottava lokista, ei pääteltävä käyttöliittymän yleisviestistä.
   - Jos tarvitaan selaimen verkkotarkistus, katso `/auth/v1/recover`-vastauksen **status ja virhekoodi**, älä jaa Authorization-/apikey-otsakkeita, sähköpostiosoitteita, palautuslinkkejä tai sessiotokeneita. Varmista myös, että `redirect_to` on URL-dekoodattuna `https://brunbar.fi/?auth=recovery`.

## Testaus asetusten tallennuksen jälkeen

1. Koodimuutos on vietävä hyväksytyn manuaalisen frontend-julkaisun kautta tuotantoon, jotta se näkyy käyttäjille. Pelkkä commit ei julkaise sivustoa. Tässä korjaustyössä julkaisua ei käynnistetä.
2. Pyydä **uusi** palautusviesti Huoltopilotin “Unohtuiko salasana?” -toiminnolla. Vanha jo lähetetty viesti säilyttää vanhan redirectin; asetusten korjaus ei muuta sitä jälkikäteen.
3. Avaa uusin sähköpostilinkki. Supabasen tulee ensin varmentaa token ja ohjata sitten brunbar.fi:hin. Tarkista, että näkyy “Aseta uusi salasana”. Älä muokkaa tokenia tai ohita varmennusvaihetta käsin.
4. Aseta uusi vähintään 12 merkin vahva salasana. Käytä projektin vahvempaa salasanakäytäntöä, jos sellainen on asetettu. Kokeile kirjautumista uudella salasanalla normaalissa istunnossa.
5. Testaa myös Dashboardin lähettämä **uusi** palautusviesti. Sen tulee palata brunbar.fi:hin myös ilman `auth`-kyselyparametria, kun Supabasen palautusfragmentti on mukana.
6. Vanhentuneen tai jo käytetyn linkin tulee johtaa uuden palautuspyynnön lomakkeeseen, ei salasanan päivitykseen ilman varmennettua istuntoa.

## Suoritetut paikalliset testit ja rajat

Yksikkö-/integraatiotestit kattavat tuotannon tarkan palautusosoitteen, Dashboard-fragmentin tunnistamisen, session tarpeen, vanhentuneen linkin, jäsenyyskyselyjen estämisen palautuksen aikana ja turvalliset virheviestit. Desktop-/mobiiliselaintestit käyttävät oikeaa Supabase-JavaScript-SDK:ta simuloituja Auth-vastauksia vasten sekä sovelluksen että Dashboard-tyyppisellä linkillä.

Ne eivät ole todiste tuotannon SMTP-toimituksesta, Auth-asetuksista tai aidon palautustokenin toimivuudesta. Niitä ei ole tässä ympäristössä voitu varmistaa.

Viralliset ohjeet:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp
