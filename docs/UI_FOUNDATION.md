# Käyttöliittymäuudistus, vaihe 1

## Lähtötila ja rajaus

Tutkittu main `1ad9302` (PR #7 yhdistetty). Tarkastettu `App`, `AuthGate`,
`CompletionItems`, `MaintenanceHistory`, tyylit, Supabase-snapshot ja mutaatiot
sekä nykyiset yksikkö-, selain- ja PostgreSQL-testit.

| Alue | Havainto ja päätös |
| --- | --- |
| Navigaatio | Päivittäiset työt, raportit ja pohjat kilpailivat huomiosta. Kuusi pysyvää pääkohtaa; raportit ja huoltopohjat säilyvät suorina toimintoina Asetuksissa. Vanhat `#reports`- ja `#templates`-linkit toimivat. |
| Etusivu | Rekisterimäärät, huoltovalmius ja esimerkkitoiminta peittivät seuraavan tehtävän. Korvataan todellisista huoltotöistä muodostetuilla työjonoilla ja valmistuneilla töillä. |
| Huoltotyöt | Nykyinen haku, tilasuodatin, työohjeet, turvallisuus ja PR #7:n kirjaus säilyvät. Varsinainen lista- ja työtilauudistus seuraavaan PR:ään. |
| Laitteet ja historia | Laitteen huoltohistoria ja PR #7:n muuttumaton esitys säilyvät. Laitekorttien tietohierarkia ja vikahistorian viimeistely myöhemmin. |
| Varasto ja työkalut | Varaosien saldot, vapaat kirjaukset ja työkalujen saldottomuus säilyvät. Rekisterin ja asetusten rakenteellinen uudistus myöhemmin. |
| Huoltotutka | Nykyinen vahvistetun vikatiedon haku ja kirjaus säilyvät. Työnkulun uudistus myöhemmin. |
| Käyttäjät ja asetukset | Käyttöoikeudet ja kutsuminen säilyvät. Näyttönimi otetaan nykyisen käyttäjän yritysjäsenyydestä, sähköposti vain varalla. |
| Mobiili | Vanha sivupaneeli ei hallinnut kohdistusta. Nykyiseen Radix-dialogiin perustuva valikko hallitsee kohdistuksen, Escape-sulkemisen ja taustan lukituksen. |

## Julkiset vertailukohdat

Tutustuttu 20.10.2026 toimittajien omiin julkisiin ohjeisiin:

- [MaintainX: View and Filter Work Orders](https://help.getmaintainx.com/view-and-filter-work-orders): tehtävälista, omat työt ja tilan mukainen ryhmittely.
- [Limble: Overview & Navigation](https://help.limblecmms.com/en/articles/7157630-limble-overview-navigation): yleiskuvan ja tehtäväkohtaisen navigaation roolit.
- [UpKeep: How to Filter Work Orders on Mobile](https://help.onupkeep.com/en/articles/6578001-how-to-filter-work-orders-on-mobile): käyttäjälle osoitettujen töiden ja tilan mukainen mobiilihaku.

Sovellettu yleisiä työnkulkumalleja; ulkoasua tai lähdekoodia ei kopioitu.

## Yhtenäiset suunnitteluperiaatteet

1. Tehtävä ennen rekisteriä: etusivu vastaa kysymykseen mitä tehdään seuraavaksi.
2. Yksi selkeä päätoiminto ja kuusi pääkohdetta, samassa järjestyksessä kaikilla näytöillä.
3. Rauhallinen liuskekiven ja vihreän paletti, kevyt reunaviiva varjon sijaan.
4. Semanttiset värit, yhteiset välit, kulmat ja typografia. Tilalla on aina tekstivastine.
5. Painikkeiden ja syötekenttien vähimmäiskorkeus 44 px, mobiilissa syötefontti 16 px,
   näkyvä näppäimistökohdistus, olemassa olevat lomakeotsikot ja virheilmoitukset.
6. Tyhjä tila kertoo mitä puuttuu ja miten jatkaa; tyhjään yritykseen ei luoda demotietoja.
7. Yhteinen perusta `src/ui-foundation.css`; vanhat ominaisuuskohtaiset asettelut
   säilyvät `styles.css`:ssä seuraaviin hallittaviin PR:iin. Ei uutta UI-kirjastoa.
8. Myös vanhojen laitekorttien ja Huoltotutkan tekniset tunnisteet korvataan
   luettavalla sarjanumerolla/mallilla ja vahvistetun havainnon päivämäärällä.

## Etusivun tietosäännöt

Etusivu käyttää samaa yrityskohtaista Supabase-snapshotia ja päivitysmekanismia kuin
muu sovellus. Se ei hae toisen yrityksen tietoja eikä suorita uusia mutaatioita.

- Myöhässä: avoimet huollot, joiden eräpäivä on ennen tätä päivää.
- Erääntyy pian: tänään ja seuraavat 7 kalenteripäivää, molemmat rajat mukana.
- Työn alla: `progress`-tilassa olevat työt.
- Omat työt: nykyisen jäsenen näyttönimelle osoitetut avoimet työt nykyisen
  snapshotin `technician`-kentän mukaisesti. Vaihe säilyttää nykyisen nimen
  perusteella toimivan kohdistusmallin; käyttäjätunnukseen perustuva laajempi
  kohdistusuudistus ei kuulu tähän PR:ään.
- Viimeksi valmistuneet: enintään viisi valmistunutta työtä suoritusajan mukaan.
- Työjonot voivat sisältää saman työn: luvut kuvaavat suodattimia, eivät yhteen
  laskettavaa kokonaismäärää. Työjonossa näytetään enintään kahdeksan työtä,
  koko lista avautuu Kaikki huoltotyöt -painikkeesta.
- Päivän raja on Europe/Helsinki. Suoritusajat käyttävät PR #7:n yhteistä esitystä.
- Katselijalle ei näytetä etusivun uuden työn luontitoimintoa. Palvelimen
  käyttöoikeustarkistukset säilyvät ennallaan.

## Käyttöönotto ja palautus

Uutta Supabase-migraatiota ei tarvita. PR #7:n olemassa olevat migraatiot 001–006
säilyvät koskemattomina ja niiden tulee olla aiemman julkaisun mukaisesti käytössä.
Auth, RLS, revisiot, varastotransaktiot, auditointi ja muuttumattomuustriggerit eivät muutu.

Tarkista PR ja yhdistä se hyväksynnän jälkeen. Julkaise tämän jälkeen nykyisellä
`Deploy brunbar.fi` -työnkululla sen nykyisiä hyväksyntä- ja kohderajauksia käyttäen.
Tämä työ ei yhdistä PR:ää, suorita tuotantomigraatioita tai käynnistä julkaisua.
Tarvittaessa palauta edellinen käyttöliittymäversio nykyisellä julkaisumenettelyllä;
tietokannan palautusta ei tarvita.

Ei muutoksia 585.fi:hin, `makkelii/Huolto`-repositorioon, DNS:ään, Pages-asetuksiin
tai julkaisutyönkulkuihin.

## Tarkistukset

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run verify:build`,
`npm test`, `npm run test:integration`, `npm run test:db`, `npm run test:deployment`
ja `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`.

Regressiot kattavat kalenterirajat, omat työjonot, valmistuneiden järjestyksen,
tyhjän tuotantotilan, näyttönimen valinnan, kuusi navigaatiokohdetta, vanhat suorat
linkit, tumman teeman sekä mobiilivalikon kohdistusloukun ja Escape-sulkemisen.
Selainkoot: työpöytä ja iPhone 13 sekä erillinen 360 px:n leveyden tarkistus.
Selain-HTTP-pyynnöt käyttävät testivastauksia; erilliset PostgreSQL-testit käyttävät
aitoa, kertakäyttöistä paikallista PostgreSQL 16 -kantaa. Tuotantokantaan ei yhdistetä.
