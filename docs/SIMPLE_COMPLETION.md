# Vapaa huoltokirjaus ja selkeä huoltohistoria

## Käyttö

Valmistumislomakkeella kirjataan ensin tehdyt työt ja todellinen työaika minuutteina.
Varaosat, työkalut ja lisähuomiot ovat valinnaisia. Lisää varaosa / Lisää työkalu
avaa vapaan kirjauksen; rekisterihaku on erillinen vaihtoehto samassa ikkunassa.
Työkalulle kirjataan vain nimi. Vapaalle varaosalle kirjataan nimi ja positiivinen
määrä (myös desimaalit). Virheellisen tai keskeneräisen lisäyksen voi sulkea.

Vapaat rivit eivät luo nimikkeitä eivätkä muuta saldoja. Rekisterivaraosan kulutus
menee edelleen `actual`-kentässä transaktion sisällä. Vapaiden rivien `freeUsage`
on erillinen, palvelimella validoitu lista. Rivin mukana lähetetyt tunnisteet eivät
vaikuta varastoon. Enintään 100 vapaata riviä, nimessä enintään 200 merkkiä ja
varaosan määrä välillä 0 < määrä <= 100000000.

Historia näyttää huollon ja laitteen nimet, suoritusajan, suorittajan, todellisen
ajan, tehdyt työt, käytetyt varaosat määrineen, työkalut ja lisähuomiot. Suomenkielinen
aika esitetään Europe/Helsinki-vyöhykkeessä, esimerkiksi `20.10.2026 klo 08.29`.
Tekniset tunnisteet ja suunniteltujen vaatimusten raakadata eivät kuulu esitykseen.
Aloitusvaroitus ja tarkistuslista säilyvät työn valmistelussa. Niitä ei esitetä
valmistuneen työn historiassa.

## Supabase-migraatio

**Uusi migraatio tarvitaan:** `202610200006_free_completion_usage.sql`.
Se suoritetaan migraatioiden 001–005 jälkeen ennen uuden käyttöliittymän julkaisua.
Tässä kehitystyössä migraatiot ajetaan vain eristettyyn paikalliseen PostgreSQL-
testikantaan. Tuotantokantaan ajaminen vaatii erillisen hyväksynnän.

Migraatio päivittää valmistumisen RPC:n ja historian tilannekuvan muodostamisen.
`freeUsage` ja laitteen nimi tallentuvat valmistumishetken muuttumattomaan
historiatilannekuvaan. Rekisterin työkalujen ja varaosien tilannekuvat sekä
tekniset tunnisteet säilyvät tietokannassa. Auditointitapahtumien käsittely,
yrityskohtaiset RLS-käytännöt ja muuttumattomuustriggerit säilyvät.

`private_mutate_v2`-funktion määrittely toistetaan migraatiossa, jotta toistuvan
huollon seuraava työ ei peri edellisen suorituksen vapaita kirjauksia, työaikaa,
lisähuomioita tai muita valmistumiskenttiä. Muu rekisteri- ja kulutuskäsittely
säilyy. Yrityksen revisiolukko, työn lukko ja varastorivien lukot estävät
samanaikaiset ristiriidat ja kaksoiskulutuksen. Vanhoja historiarivejä ei päivitetä.
Vanhojen asiakkaiden valmistumiset ilman `freeUsage`-kenttää hyväksytään edelleen.

Vanhasta historiasta käytetään olemassa olevaa tilannekuvaa. Jos tuotenimeä ei
ole tallennettu, käytetään saatavilla olevaa rekisteri-/vaatimustietoa tai
luettavaa puuttuvan nimen ilmoitusta. UUID:tä ei näytetä nimen korvikkeena.
Puuttuva todellinen työaika esitetään viivana, ei suunniteltuna työaikana.

## Varmennus

- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run verify:build`
- `npm test` ja `npm run test:integration`
- `npm run test:db`: PostgreSQL 16:n kertakäyttöinen Docker-kanta ilman verkkoyhteyttä;
  validaatiot, sekakirjaus, pelkkä vapaa kirjaus, saldot, yrityseristys, muuttumaton
  historia, vanhan historian säilyminen 005→006-päivityksessä, toistuvuus ja
  kahden samanaikaisen suorittajan kilpailu.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`:
  työpöytä ja iPhone 13 -kokoinen Chromium; tyhjä rekisteri, vapaat rivit,
  rekisterihaku, palvelimen valmistumiskutsu, uudelleenlataus ja historian esitys.
  Selaintestien Supabase-pyynnöt reititetään testeissä; niitä täydentävät aidot
  PostgreSQL-transaktiotestit. Tuotannon Supabase-yhteyttä ei käytetä.
- `npm run test:deployment`: olemassa olevat julkaisurajausten testit.

Työ ei muuta julkaisutyönkulkuja, DNS:ää, Pages-asetuksia, 585.fi-sivustoa eikä
alkuperäistä `makkelii/Huolto`-repositoriota. PR:ää ei yhdistetä automaattisesti.
