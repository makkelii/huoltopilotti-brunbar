# PR F – lopullinen rekisteristä poistaminen

Riippuvuus: PR D #13 (`feat/history-knowledge-base`), joka riippuu PR C #12:sta. Tämä haara sisältää vain F:n lisäyksen suhteessa D:hen.

## Riippuvuuskartta ja valittu malli

| Kohde | Riippuvuus | Säilytys |
|---|---|---|
| Laite | huoltotyöt ja niiden toistuminen, vikailmoitukset, huoltohistorian JSON-snapshotit | fyysinen laiterivi ja tunnisteet säilyvät |
| Tuotantolinja | laitteiden nykyinen sijoitus, haun tapahtumahetken sijoitus | fyysinen linjarivi ja historiallinen hakuindeksi säilyvät |
| Huolto | valmistumishistoria, varastotapahtumat, toteutunut käyttö | mitään rivejä tai snapshotteja ei muuteta |
| Pohjat | yleiset suunnittelupohjat; uuden työn laite valitaan aktiivisesta rekisteristä | pohjia ei poisteta eikä rekisteristä poistettua laitetta palauteta |
| Auditointi | kohteen UUID ja payload | ennen-tila, ihmisen luettava tunniste, tekijä ja aika säilyvät |

Migraatio `202610200011_registry_retirement.sql` lisää `registry_removed_at`-merkinnän. Tämä on palautumaton rekisteritoiminto, ei tietojen anonymisointi tai fyysinen hävittäminen. Viiteavaimia ei poisteta, CASCADE-poistoja ei lisätä. Historiaa tai vanhoja migraatioita ei kirjoiteta uudelleen.

Normaali snapshot erottaa poistetut kohteet historiallisiksi `removedAssets`/`removedProductionLines`-ankkureiksi. Niitä ei tarjota uusille töille, vikailmoituksille tai palautukselle. Valmistunut työ sekä sen nimi ja hakutulos löytyvät edelleen. Yrityksen omat historialliset ankkurit voivat säilyä RLS:n sallimassa lukuyhteydessä; tämä ei ole GDPR-poistotoiminto.

## Ehdot ja yhteensopivuus

Vain omistaja/ylläpitäjä voi poistaa arkistoidun kohteen. Laitteen avoimet työt estävät poistamisen. Arkistoinnin olemassa oleva palvelinsuoja estää uudet työt ja toistumisen arkistoidulle laitteelle. Linjan arkistointi irrottaa nykyiset laitesijoitukset aiemman sopimuksen mukaisesti; lopullinen poisto ei siirrä laitteita. Mahdollinen jäljellä oleva laiteviite estää linjan poiston.

Vahvistukseen kirjoitetaan sarjanumero, linjalla linjatunniste; puuttuvan tunnisteen tapauksessa nimi. Sama tarkistus tehdään palvelimella. UUID:ta ei näytetä vahvistuskoodina. Dialogi näyttää historian olemassaolon, säilytyksen ja palautumattomuuden. Palvelimen virhe säilyttää syötteen. Käyttöliittymä odottaa RPC-vahvistusta ja estää kaksoispainallukset.

Vanhat tyhjien tietueiden fyysiset `asset_delete`/`production_line_delete`-RPC-haarat ovat edelleen rajattuja riippuvuustarkistuksilla, mutta vaativat nyt lisäksi arkistoinnin ja kirjoitetun tunnisteen. Normaali käyttöliittymä käyttää vain historiaa säilyttävää poistamista. Vanha asiakas ei voi ohittaa vahvistusta vanhalla poistokutsulla.

Kaikki muutokset käyttävät organisaation rivin lukkoa ja revision tarkistusta samassa transaktiossa auditoinnin kanssa. Poistettua riviä ei voi muokata/palauttaa vanhallakaan RPC-reitillä; tietokantarajoite estää poistomerkinnän yhdistämisen aktiiviseen tilaan. RLS ja sisäisten funktioiden käyttöoikeudet säilyvät.

## Haku ja historialliset tiedot

D:n jäädytetyt tapahtumatiedot ja sivutus säilyvät. Haku lisää merkinnät laitteen ja historiallisen linjan rekisteristä poistamisesta. Ennen migraatiota 010 puuttuneita historiallisia sijoituksia ei keksitä: tuntemattomuus näkyy edelleen. Demohaun yksinkertaistettu toteutus ei vastaa PostgreSQL:n kielihakua.

## Käyttöönotto ja palautusrajat

1. Tarkista/yhdistä C, sitten D, sitten F. Päivitä stacked PR:n base edeltäjän yhdistyttyä.
2. Testaa kopiossa migraatiot 001–009 → 010 → 011; ota normaali varmistus ja sovi käyttökatko tarvittaessa.
3. Suorita tuotannossa 010 ja sitten 011 vain erillisellä hyväksynnällä ennen uuden frontendin julkaisua. Tässä työssä ajetaan vain eristettyä Docker-PostgreSQL:ää.
4. Julkaisun jälkeen hyväksytty tarkistus: roolit, arkistointi/palautus, testikohteen tunnistevahvistus, historian ja haun säilyminen. Älä käytä oikeaa tuotantolaitetta poistamisen kokeiluun.

Migraation poistaminen ei ole turvallinen palautus sen jälkeen, kun kohteita on poistettu rekisteristä. Säilytä 011 ja historialliset ankkurit myös frontendin palautuksessa; vanha frontend ei saa tarjota poistettuja kohteita uudelleen. Mahdollinen tietojen korjaus tehdään erillisenä tarkastettuna migraationa, ei normaalina palautustoimintona.

## Testaus

Testit kattavat aktiivisen/avoimia töitä sisältävän kohteen eston, tunnisteen, roolit ja tenant-eristyksen, suorat RPC-kutsut, auditoinnin, historian/vikojen/varaston säilymisen, kaksoispoiston, poistettujen hakemisen, palautuksen ja uuden työn eston sekä samanaikaisen poiston ja palautuksen. Päivityspolku vertaa vanhoja kokonaisia tietueita ennen/jälkeen 011:n. Historia-, vapaan käytön, suunnittelun, uudelleenluonnin ja tietopankin SQL-regressiot ajetaan myös uusimman skeeman päällä. Selainpolut ajetaan työpöydällä ja iPhonen kokoisella näytöllä.
