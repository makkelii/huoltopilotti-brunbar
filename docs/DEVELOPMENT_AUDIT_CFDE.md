# Kehitysauditointi C → D → F → E

Tarkistettu lähtötilanne 20.10.2026: main e2ccb21, PR #11 yhdistetty.
GitHubin avoimet PR:t #4 ja #5 ovat vanhoja vaihtoehtoisia kirjaus-/navigaatiovaiheita;
niiden aihepiirit on toteutettu uudempien yhdistettyjen PR:ien kautta. Ne eivät sisällä
C–F-toteutuksia eikä niitä yhdistetä tai suljeta tässä toimeksiannossa.
Mainin koodista, migraatioista ja etähaaroista ei löytynyt C–F-toteutuksia.

## Todellinen nykyinen toteutus

- React 19, TypeScript, Vite, Supabase Auth/PostgreSQL, Radix Dialog ja Playwright.
- Kuusi pääosiota; pohjat ja raportit toissijaisia näkymiä.
- Neljä roolia: owner/administrator hallitsevat rekistereitä; technician suunnittelee ja
  suorittaa huoltoja; viewer lukee. SQL/RLS ratkaisee oikeudet myös suorissa kutsuissa.
- `assets` ja `production_lines`: vapaaehtoinen yksitasoinen linjasuhde, arkistointi,
  palautus ja riippuvuuksista vapaan kohteen fyysinen poisto (009). Linjan arkistointi
  irrottaa kaikki laitteet. Nykyinen sijoitus ei ole historiallinen suorituspaikka.
- `maintenance_jobs` ja `job_requirements`: nimi, kuvaus, työohjeet, arvio, määräaika,
  nimipohjainen vastuuhenkilö, toisto ja vapaat/rekisteriin sidotut tarpeet. Valmis työ
  on muuttumaton, toteuma erillinen suunnitelmasta.
- `maintenance_history`: valmistumishetken JSON-snapshot, suorittaja, toteuma ja päivä.
  UPDATE/DELETE-suojaukset. Vanhoja puuttuvia tietoja ei keksitä.
- `inventory`/`stock_movements`: vain todellinen rekisteritarvikekulutus vähentää saldoa;
  työkalut ja vapaat kirjaukset eivät muuta saldoa. `inactive` suodatetaan valitsimista.
- Pohjat: yksi yrityskohtainen versioitu suunnitelma; kopio työn luontiin. Ei omaa
  laiteviitettä. Työn muutokset eivät muuta pohjaa.
- Huoltotutka: selaimessa tehtävä rajattu sanahaku vain `fault_reports`-havainnoista.
  Ei palvelinpuolen laajaa huoltohistoriahakua eikä ulkoista tekoälyä.
- `private_snapshot` lataa nykyisin myös kaikki huoltosnapshotit. Uuden tietopankkihaun
  tulee käyttää erillistä sivutettua SQL-hakua tämän vanhan reitin laajentamisen sijaan.
- Migraatiot 001–009 on tarkastettu. Aiemmat migraatiot säilytetään muuttumattomina.
- Lähtötilan viimeksi suoritettu täysi varmennus: 124 Vitest-, 86 integraatio-, 28 selain-
  ja 12 julkaisusuojaustestiä sekä PostgreSQL-testit; myös PR #11:n GitHub Actions läpäisi.

## Toteutusjärjestys ja riippuvuudet

1. C: puhdas suunnitelmaluonnos valmistuneesta huollosta, vanhentuneiden viitteiden
   käsittely ja käyttäjän vahvistamat toteumaehdotukset. Nykyinen työnluonti-RPC riittää.
2. D: erillinen tenant-rajattu, indeksoitu ja sivutettu PostgreSQL-tietopankki,
   suomenkielinen full-text/prefix-haku ja laite-/linja-/aika-/tyyppirajaukset.
3. F: palautumaton rekisteristä poistaminen tombstone-tilalla, säilyttäen fyysiset
   viitetietueet ja historian. Ei pakotettua DELETEä historian yli. Säilytetään D:n haku.
4. E: yhteinen viimeistely kaikkien yllä olevien polkujen päälle ja lisävarmennus
   Android-, tabletti-, iPhone- ja työpöytäkoossa. Ei toista design systemiä.

Jokainen vaihe testataan ja avataan omana PR:nään. Yhdistämättömän vaiheen seuraaja
perustuu edellisen haaraan ja PR:n base on kyseinen haara. Varsinaiset PR-linkit ja
migraatiojärjestys täydennetään vaiheiden dokumentteihin. Tuotannossa ei tehdä toimenpiteitä.

## Toteutunut kokonaisuus

- C [#12](https://github.com/makkelii/huoltopilotti-brunbar/pull/12): tarkistettava uusi suunnitelma vanhasta valmistuneesta työstä, ei historia- tai varastomuutosta luontivaiheessa. Ei migraatiota.
- D [#13](https://github.com/makkelii/huoltopilotti-brunbar/pull/13): erillinen painotettu, indeksoitu PostgreSQL-haku, suomenkielinen taivutus/prefix, sivutus ja tapahtumahetken sijoitus. Migraatio 010.
- F [#14](https://github.com/makkelii/huoltopilotti-brunbar/pull/14): arkistoitujen laitteiden ja linjojen palautumaton rekisteristä poistaminen historialliset ankkurit säilyttäen. Migraatio 011.
- E `feat/workflow-polish`: kuuden osion auditoidut työnkulut, oikeuksien selitykset, varaston tila-/koodihaku, historian latauksen kilpailutilanteen esto, kutsun kaksoislähetyksen esto ja neljän näyttökoon regressio. Ei migraatiota.

Vaihekohtaiset dokumentit kuvaavat toteutuksen ja rajoitukset. Yhteinen tarkistus-, yhdistämis- ja käyttöönottojärjestys on [CFDE_ROLLOUT.md](CFDE_ROLLOUT.md). Kaikki testidata on synteettistä. Tuotantoa tai muita repositorioita ei muuteta.
