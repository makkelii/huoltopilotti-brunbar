# PR B: huollon suunnittelu ja yhtenäiset työnkulut

Pohjana main da10bad (PR #9). Auditointi ja jatkojärjestys: [WORKFLOW_AUDIT.md](WORKFLOW_AUDIT.md).

## Käyttö

- Laitteen **Uusi huoltotyö** esitäyttää laitteen ja sen nykyisen linjan.
- Linjan samanniminen toiminto rajaa laitteet linjaan mutta jättää laitteen käyttäjän valittavaksi.
- Yleisessä luonnissa mitään laitetta ei valita hiljaisesti. Linjat näkyvät vain, jos niitä on.
  Kaikki laitteet ja ilman linjaa olevat laitteet ovat erillisiä rajauksia.
- Suuret valinnat saa rajattua kirjoittamalla. Nimen lisäksi näkyvät sarjanumero ja sijainti.
  Laitteen vaihtaminen ei luo työlle erillistä linjaviittausta. Linjasuhde kuuluu edelleen laitteelle.
- Suunniteltuja tarpeita voi lisätä, poistaa ja niiden määriä muuttaa sekä luonnissa että muokkauksessa.
  Rekisterin käyttö on vapaaehtoista. Kulutustarvikkeet, varaosat, työkalut, turvallisuusohjeet,
  dokumentit ja henkilöstötarpeet käyttävät olemassa olevaa luokitusta.
- Työohjeet ja valmistelut tallentuvat työn omaan `instructions`-kenttään. Arvioitu aika käyttää
  nykyistä `duration` / `estimated_minutes`-tietoa.
- Huoltopohjan tarpeet kopioidaan työhön. Työn muokkaus ei muuta pohjaa.
  Pohjan dokumentti- ja turvallisuusrivit kopioituvat ohjeina; erillistä pohjan vapaatekstikenttää
  nykyisessä yhden pohjan mallissa ei ole. Työn työohjeita voi täydentää kopioinnin jälkeen.
- Pohjiin pääsee huoltotöistä nykyisen kuuden pääkohdan navigaation sisällä.
- Työn tiedoissa näkyvät kuvaus, ohjeet ja suunnitellut tarpeet. Katselija voi lukea tiedot,
  mutta ei muuttaa valmistelutiloja tai suorittaa työtä.
- Valmistuessa suunnitelma tarjoaa rivikohtaisen **Vahvista käyttöön** -toiminnon.
  Pelkkä suunnitelma ei esivalitse mitään toteumaan. Rekisteriosan ehdotus rajautuu saatavilla olevaan
  määrään, jonka käyttäjä näkee ja voi muuttaa. Nollasaldoinen tai käytöstä poistettu osa ei ole vahvistettavissa.
- Toteuman määriä voi muuttaa ja rivejä poistaa. Vapaat kulutustarvikkeet kirjataan toteuman
  vapaiden varaosien ryhmään, kuten PR #7:ssä; niistä ei synny varastotapahtumaa.
- Työstä ja historiasta pääsee laitteeseen tai laitteen **nykyiseen** linjaan.
  Nykyistä linjaa ei esitetä historiallisena suorituspaikkana.
- Työlista näyttää oletuksena avoimet työt. Valmistuneet löytyvät tilasuodattimesta ja laitteen/
  linjan historiasta. Linja-, laite-, tila-, erääntymis- ja omien töiden rajaukset toimivat yhdessä.

## Tietokanta ja turvallisuus

Tarvitaan `202610200008_planned_requirements.sql` migraation 007 jälkeen.
Se ei lisää tauluja eikä kirjoita vanhoja rivejä uudelleen. `job_requirements.item_id` on jo
nullable: vapaassa suunnitelmassa se jätetään tyhjäksi. Rekisteriviite validoidaan aina yrityksen,
kategorian ja käytettävyyden suhteen. Sama sisäinen validointi palvelee töitä ja pohjia.
Työkalujen suunnittelumäärä normalisoidaan sisäisesti yhdeksi; käyttäjältä ei kysytä määrää.

Migraatio korvaa sisäisen `private_mutate_v2`-funktion vain pohjan validointikohdan muutoksella.
Ulommat revisio-, jäsenyys-, historia-, toteuma- ja tuotantolinjasuojaukset säilyvät ketjussa.
Sisäiset apufunktiot eivät ole asiakkaan kutsuttavissa. RLS:ää, suorien kirjoitusten estoja,
varastotapahtumia tai historiatriggereitä ei poisteta tai muuteta.

Suunnitelma ei kuluta, varaa tai oikaise saldoja. Vain valmistumisen `actual`-rekisteriviitteet
voivat kuluttaa varastoa nykyisessä lukitussa transaktiossa. `freeUsage` pysyy erillisenä.
Toistuva työ perii suunnitelman, muttei edellisen toteumaa. Historiaan jää valmistumishetken
suunnitelma ja toteuma; käyttöliittymä esittää historiassa toteutuneet tiedot.

Lomake sulkeutuu vasta vahvistetun tallennuksen jälkeen. Epäonnistuminen säilyttää luonnoksen.
Yhteinen synkroninen tallennuslukko estää rinnakkaiset RPC-kutsut. Uusi työ säilyttää luonnoksen
saman ID:n myös uusintayrityksessä, joten epäonnistunut jälkiluku ei luo toista työtä.
Pohjaeditorilla on vastaava paikallinen lukko. Revisioristiriitaa ei yritetä automaattisesti uudelleen.

## Käyttöönotto

1. Tarkista PR ja varmuuskopioi tietokanta normaalin käytännön mukaan.
2. Kokeile migraatiot 001–008 erillisessä testiympäristössä ja käy läpi uuden työn luonti,
   vapaa ja rekisteriin sidottu suunnitelma, valmistuminen sekä historia.
3. Hyväksy tuotantomigraatio erikseen ja suorita 008 ennen uuden käyttöliittymän julkaisua.
4. Julkaise käyttöliittymä nykyisellä hyväksytyllä prosessilla vasta tämän jälkeen.
5. Tarkista oman yrityksen käyttäjäroolit ja tavallinen huoltopolku.

Tässä työssä ei suoriteta tuotantomigraatiota, yhdistetä PR:ää tai julkaista käyttöliittymää.
Vanha käyttöliittymä toimii migraation jälkeen. Tarvittaessa palauta edellinen frontend-versio;
älä poista vapaita suunnitelmarivejä tai muuta valmistunutta historiaa palautuksessa.

## Testauksen rajat

Vitest ja Playwright käyttävät paikallista demodataa tai simuloitua Supabase-rajapintaa.
PostgreSQL-testit suoritetaan erillisessä PostgreSQL 16 -kontissa ilman verkkoa.
Testit eivät ole näyttö tuotannon todellisesta käyttäjäkuormasta tai oikeasta Supabase-ympäristöstä.
Suuren valitsimen testi käyttää 200 samannimistä laitetta eri sarjanumeroilla.
Vastuuhenkilön osoitus on edelleen nimipohjainen; samannimisten asentajien ID-pohjainen osoitus
on erikseen dokumentoitu jatkokehityskohde.

## Suoritetut tarkistukset

- `npm run lint`: läpäisi.
- `npm run typecheck`: läpäisi.
- `npm run build` ja `npm run verify:build`: läpäisivät.
- `npm test`: 115 testiä läpäisi.
- `npm run test:integration`: 77 testiä läpäisi (näitä sisältyy myös edelliseen ajoon).
- `npm run test:db`: läpäisi; migraatiot 001–008, vanhan datan päivitys,
  tenant- ja roolirajat, vapaat suunnitelmat, historian pysyvyys ja rinnakkaiset kirjoitukset.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`:
  26 testiä läpäisi työpöytä- ja iPhone 13 -profiileilla.
- `npm run test:deployment`: 12 testiä läpäisi.

Uuden lomakkeen työpöytä- ja mobiilikuvakaappaukset tarkistettiin paikallisella testidatalla.
