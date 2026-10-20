# PR D – Huoltohistorian tietopankki

Riippuu PR C:stä #12 (`feat/repeat-maintenance`). Tämän PR:n base on kyseinen haara.
Yhdistä ensin C; vaihda tämän PR:n kohteeksi main vasta sen jälkeen. Älä yhdistä vanhoja
vaihtoehtoisia PR:iä #4/#5 tähän ketjuun.

## Toiminta

Huoltotutka etsii valmistuneita huoltoja ja vikakirjauksia. Nimi, kuvaus, työohjeet,
työselostus, lisähuomiot, laitenimi, tunnettu tunniste/linja sekä käytetyt osat ja työkalut
indeksoidaan palvelimella. Rajaukset: laite, historiallinen linja, päivämäärät Helsingin
kalenterissa ja tapahtumatyyppi. Rajaukset toimivat hakusanojen kanssa. Sivulla on 20
osumaa, enintään yksi ylimääräinen rivi haetaan seuraavan sivun tunnistamiseksi.
Tuloksen voi avata alkuperäiseen muuttumattomaan huoltoon tai vikakirjaukseen. Huollosta
voi jatkaa C:n uudelleenluontiin. Osuma esitetään aiempana tapauksena, ei diagnoosina.

`private_history_search` tarkistaa jäsenyyden ja rajaa jokaisen kyselyn yritykseen.
`private_history_record` lukee yhden alkuperäisen kirjauksen samalla rajalla. Hakuehdot
välitetään RPC-parametreina, ei dynaamisena SQL:nä. Suodattimen vieras UUID ei voi tuoda
vieraita rivejä. Hakutauluun ei anneta suoria asiakasoikeuksia; RLS on päällä ja vain
rajatut security-definer-funktiot voivat lukea sitä. Sisäiset indeksointifunktiot on suljettu.

## Haku ja relevanssi

- PostgreSQL:n Finnish/Snowball-sanakannan taivutusvartalot ja simple-konfiguraation
  sananalkuhaku yhdistetään jokaiselle vähintään kahden merkin sanalle.
- Useat sanat yhdistetään AND-ehdolla; kukin voi osua vartalona tai sananalkuna.
- Kirjainkoolla ei ole merkitystä. Tunnisteiden välimerkit normalisoidaan indeksissä.
- Paino A: vikakuvaus, korjaustoimenpide ja laitetunniste. B: otsikko, osat ja työkalut.
  C: laitenimi ja tunnettu linjanimi. `ts_rank_cd` ja tarkan fraasin lisäpaino järjestävät
  tulokset; päivä, lähdetunniste ja tapahtumatyyppi ratkaisevat tasatilanteet vakaasti.
- Kenttäosumat kerrotaan vain, jos kaikki hakusanat osuvat siihen kenttään. Muuten
  näytetään yhdistetty kenttäosuma. Pisteitä tai teknisiä tunnisteita ei esitetä.
- GIN-indeksi tukee yhdistettyä vektoria. Yritys/aika- ja viiteindeksit tukevat rajauksia.
  Trigrammia arvioitiin, mutta prefix+Finnish-vartalot täyttävät tämän vaiheen vaatimukset
  ilman uutta laajennusriippuvuutta. Kirjoitusvirheiden sumeaa korjaamista ei luvata.

Tyhjä tai vain lyhyitä merkkejä sisältävä haku palauttaa tyhjän vastauksen. Hakuteksti on
rajattu 200 merkkiin, sivunumero 0–5000. Historiallisia suodatinvaihtoehtoja palautetaan
korkeintaan 5000 laitteelle/linjalle. Hakusivu ei lataa kaikkia lähdekirjauksia; avaus lukee
vain valitun lähteen. Sovelluksen vanha yleinen snapshot lataa edelleen historiaa muita
näkymiä varten; sen erillinen laaja sivutusuudistus ei kuulu tähän hakutoteutukseen.

## Historialliset tunnistetiedot

Uuden huollon tai vian jälkeen AFTER-triggeri tallentaa hakuindeksiin tapahtumahetken
laitenimen, sarjanumeron ja linjan. Myöhempi laitesiirto tai rekisterin nimeäminen ei
kirjoita niitä uudelleen. Vanhojen lähteiden backfill jättää puuttuvan linjan ja tunnisteen
puuttuviksi. Nimi tulee ensisijaisesti huoltosnapshotista; vanha vika voi käyttää rekisterin
nimeä ja tästä kerrotaan puutteellisen metadatan merkinnässä. Nykyistä sijoitusta ei
väitetä historialliseksi. Arkistoidut laitteet tunnistetaan ja vanhat tapaukset löytyvät.

Hakutaulu on johdettu indeksi; lähteen historiarivejä ei muuteta. Indeksin palautus/bakfill
säilyttää jo tallennetut tapahtumahetken identiteettitiedot ON CONFLICT -polussa.
PR F täydentää tämän myöhemmin rekisteristä poistettujen kohteiden tilamerkinnöillä.
Demon haku on paikallinen sanapisteytys eikä vastaa kaikkia SQL:n kieliopillisia ominaisuuksia.
Tuotantopolku käyttää aina palvelin-RPC:tä, ei demon hakualgoritmia.

## Migraatio ja käyttöönotto

Tarvitaan `202610200010_history_knowledge_base.sql` olemassa olevien 001–009 jälkeen.
Migraatio rakentaa ainoastaan uuden indeksitaulun, sen backfillin, triggerit ja luku-RPC:t.
Se ei muokkaa vanhoja lähderivejä. 009→010-testissä verrataan historia, laitteet ja viat
kokonaisina JSON-riveinä ennen/jälkeen ja varmistetaan backfillin kattavuus ilman keksittyä linjaa.

Varmuuskopioi, testaa migraatio erillisessä testiympäristössä ja hyväksy tuotantomigraatio
erikseen ennen uuden frontendin julkaisua. Tarkista haku, vanha historia, uusi valmistuminen
ja vanhan laitteen siirto testissä. Frontend voidaan palauttaa edelliseen versioon poistamatta
indeksiä. Älä poista lähdehistoriaa palautuksessa. Backfillin kesto riippuu todellisen historian
määrästä; suunnittele tuotannon ajo testiympäristön havaintojen perusteella.

Läpäisty: lint, typecheck, build, verify:build, 131 Vitest-testiä, 93 integraatiotestiä,
PostgreSQL 16 -testit (5000 synteettistä tapausta), 32 Playwright-testiä työpöytä/iPhone
ja 12 julkaisusuojausta. SQL-testit kattavat taivutukset, sekoitetut prefix-haut, tunnisteet,
monisanaisuuden, sivutuksen, suodattimet, arkiston, historiallisen linjan, injektiosyötteet,
roolit ja yritysrajat. Käyttöliittymässä testataan myös vanhentuneen vastauksen torjunta
ja virheen jälkeen säilyvä kysely. Tuotantoympäristöä tai kuormitus-SLA:ta ei väitetä testatuksi.
