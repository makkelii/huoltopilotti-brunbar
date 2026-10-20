# Työnkulkujen auditointi – PR B

Lähtökohta: main da10bad (PR:t 7–9 yhdistetty). Auditointi perustuu koodiin,
paikalliseen demodataan, simuloituun Supabaseen ja erilliseen PostgreSQL-testikantaan.
Tuotantokäyttöä tai tuotantotietokantaa ei käytetä testaukseen.

## Havainnot ennen toteutusta

| Polut | Vakavuus | Havainto | Ratkaisu tässä PR:ssä |
|---|---|---|---|
| A, B, C, J, K | Merkittävä | Työn luonti näyttää kaikki laitteet ja valitsee ensimmäisen hiljaisesti. Linjaa tai laitetta ei esitäytetä kortilta. | Yhteinen haettava laite/linjavalinta, tyhjä alkuvalinta ja kontekstin esitäyttö. |
| B, G, H | Kriittinen | Rajatun laitevalinnan lisääminen ilman tallennusvalidointia voisi säilyttää piilotetun väärän laitteen. | Rajauksen vaihto tyhjentää sopimattoman valinnan. Tallennus tarkistaa laitteen ja rajauksen. Palvelin säilyttää tenant-FK:n ja revisiolukon. |
| D, N, K | Merkittävä | Työ kopioi pohjan, mutta tarpeita ei voi muokata. Pohja vaatii rekisteriviitteen tarvikkeille. | Sama tarpeiden editori työlle ja pohjalle; vapaat ja rekisteriin sidotut tarpeet. |
| E, N | Merkittävä | Suunnitellut tarpeet näkyvät valmistumisessa vain rekisteriviitteiden tekstiluettelona. | Yksittäinen käyttäjän vahvistama käyttöehdotus; ei automaattista kulutusta. |
| E, L | Kriittinen | Katselijalle näkyy työn suorituspainikkeita ja tarpeiden tilavalitsin vaikka RPC estää kirjoituksen. | Roolikohtainen piilotus/lukitus myös työn tiedoissa. |
| F | Merkittävä | Työstä/historiasta ei ole suoraa siirtymää laitteeseen tai nykyiseen linjaan. | Yhteinen kohdenavigointi, nykyinen linja nimetty selvästi. |
| D | Merkittävä | Pohjat löytyvät vain asetuksista. | Yhteys huoltotöistä pohjiin ja pohjasta uuden työn luontiin. |
| I | Merkittävä | Tarpeita ja kontekstia puuttuu mobiilin luontipolusta; laitevalinta voi olla pitkä. | Responsiivinen yhteinen lomake ja haettavat valitsimet. |
| M | Kriittinen | Pohjaeditorin tallennuspainikkeella ei ole omaa kaksoispainalluksen suojaa. | Odottava tila ja synkroninen lukko; lomake säilyy epäonnistuessa. Työn tallennus käyttää olemassa olevaa yhteistä lukkoa. |
| G, H | Tarkistettu | Siirto/arkistointi irrottaa vain laitesuhteen. Historia ja työt säilyvät. | Säilytetään 007:n toteutus ja testit. |
| E | Tarkistettu | Valmistuminen lukitsee organisaation ja kulutettavat rekisteriosat; historia on muuttumaton. | Säilytetään, laajennetaan vapaisiin suunnitelmiin liittyvät testit. |

## Rajaus ja jatkojärjestys

1. Tämä PR: laitevalinta, esitäytöt, suunnitellut tarpeet, valmistumisen ehdotukset,
   roolivirheet ja liittyvä kohdenavigointi.
2. Seuraava erillinen työnkulku-PR: vastuuhenkilön ID-pohjainen osoitus.
   Työlistan yhdisteltävät suodattimet sisältyvät tähän PR:ään. Nykyinen nimipohjainen
   osoitus voi olla epäselvä samannimisillä asentajilla; tätä ei muuteta historian yli.
3. PR C: saman huollon uudelleenluonti; PR D: rakenteinen tietopankkihaku.
4. Myöhempi viimeistely: suuret varasto-/tutkalistat ja kaikkien lomakkeiden kenttäkohtaiset
   virhetilat. Tässä keskitytään tavalliseen huollon suunnittelu–suoritus–historiapolkuun.

Laitteen sarjanumero ja sijainti erottavat samannimisiä laitteita. Jos myös nämä
puuttuvat tai ovat samoja, yrityksen on täydennettävä laitetietoja; UUID:ta ei näytetä.
Tuotantolinja päätellään aina laitteen nykyisestä suhteesta, sitä ei kopioida työlle.

## Toteutuksen tarkistus ja regressiosuojaus

| Polut | Varmennus |
|---|---|
| A, K | Vanhojen tilannekuvien testit, ensimmäisen laitteen luontitesti ja uusi työ ilman linjaa; tyhjän rekisterin valmistumisen selaintesti. |
| B, C | Laitekortin esitäytön integraatiotesti sekä linjalta alkava työpöytä- ja puhelinselaimen luontipolku. |
| D | Yhteinen tarve-editori, työn pohjakopio ilman muutosta alkuperäiseen; PostgreSQL-pohjaversiot ja historian vertailu. |
| E, N | Sekä vapaa että rekisteriin sidottu suunnitelma ja toteuma; erikseen vahvistettava ehdotus, muokattavat määrät, PostgreSQL-kulutus ja muuttumaton snapshot. |
| F | Uusi selaintesti avaa valmistuneesta työstä laitteen ja laitteen nykyisen linjan. |
| G, H | PR A:n siirto-, irrotus-, arkistointi- ja rinnakkaisuustestit ajetaan edelleen. |
| I | Koko suunnittelu–valmistuminen–historia-polku iPhone 13 -kokoisessa Chromiumissa; aiempi 360 px näkymän testi säilyy. |
| J | 200 samannimisen laitteen sarjanumerohaku ja 30 tuotantolinjan hakurajaus integraatiotesteissä. Tämä ei ole tuotannon kuormitustesti. |
| L | Katselijan painikkeet ja lukitut tilavalinnat, asentajan pohjajulkaisun esto sekä yritysten väliset laite-, tarve- ja historiarajat PostgreSQL:ssä. |
| M | Epäonnistuneen työn tallennuksen luonnos ja sama ID, rinnakkaisen klikkauksen esto, pohjaeditorin vastaava testi ja revisioristiriidat tietokannassa. |

Lisäkorjaukset tarkistuksen aikana: valmistuneen työn muokkauspainike avaa historian,
katselijalta piilotetaan myös vian kirjaaminen, uuden vian luonnokselle luodaan oma ID,
sekä keskeneräinen tallennus lukitsee lomakkeen ja estää sulkemisen. Pohjaversioiden
vaihtuessa editori alustetaan uudesta hyväksytystä versiosta, jotta vanha luonnos ei
huomaamatta korvaa uudempaa pohjaa. Työlistan oletus on avoimet työt; historiatyöt
löytyvät edelleen erillisellä tilasuodattimella. Tyhjä lista erottaa hakurajauksen
ja tavallisen aloitustilanteen. Näihin liittyvät vanhat selaintestit käyttävät jatkossa
valmistuneiden tilasuodatinta historian avaamiseen.
