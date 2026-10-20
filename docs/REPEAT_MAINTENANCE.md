# Tee sama huolto uudelleen

Valmistuneen työn painike avaa uuden suunnitelman nykyiseen luontilomakkeeseen. Avaaminen tai peruuttaminen ei tee muutospyyntöä eikä luo tietueita. Käyttäjä voi muokata suunnitelmaa ja määriä sekä poistaa tai korvata tarpeita ennen tallennusta.

## Tarpeiden esitäytön etusijajärjestys

1. Käytä toteutuneita rekisterinimikkeitä huoltohistorian `usedItems`-snapshotista. Säilytä tapahtumahetken nimi, tyyppi ja käytetty määrä. Saman nimikkeen `actual`-merkintää ei kopioida toiseen kertaan.
2. Vanhoissa historiatiedoissa, joissa snapshot-nimikettä ei ole, lue positiivinen määrä `actual`-kartasta. Nimi/tyyppi voidaan tunnistaa nykyisestä rekisteristä tai vanhan suunnitelman saman nimikkeen tiedoista.
3. Lisää myös `freeUsage`-nimikkeet vapaina suunniteltuina tarpeina. Älä luo niitä rekisteriin. Vapaiden työkalujen määrä on sisäisesti yksi eikä sitä kysytä käyttäjältä; osien ja tarvikkeiden toteutuneet määrät säilyvät, myös desimaalit.
4. Kun toteutuneita nimikkeitä on, ne korvaavat vanhan suunnitelman kaikki varaosa-, tarvike- ja työkalurivit. Älä täydennä puuttuvaa toteumaluokkaa automaattisesti vanhasta suunnitelmasta. Turvallisuus-, dokumentti- ja henkilöstöohjeet säilyvät suunnitelmasta.
5. Vain jos toteutuneita nimikkeitä ei ole, kopioi vanhat suunnitellut tarpeet varavaihtoehdoksi.

Tarpeet saavat uudet tunnisteet ja kuittaamattoman tilan. Aktiivinen, oikeantyyppinen yrityksen rekisteriviite säilyy. Puuttuva/käytöstä poistettu tai tyyppiä vaihtanut nimike kopioidaan nimellisenä vapaana tarpeena näkyvällä huomautuksella. Alkuperäistä rekisteriä ei muuteta. Jos vanhasta toteumasta puuttuu myös palautettavissa oleva nimi, näytä puutteesta huomautus; älä keksi nimikettä, näytä UUID:ta tai korvaa toteumaa vanhalla suunnitelmalla.

Aiempi C-vaiheen erillinen ”ehdotukset vanhasta toteumasta” -askel on poistettu: toteutuneet tarpeet esitäytetään suoraan käyttäjän muokattavaksi suunnitelmaksi.

## Historian, varaston ja oikeuksien säilyminen

Uudella työllä on uusi luonnostunniste, nykyinen käyttäjä, tämän päivän määräaika, planned-tila, tyhjä toteuma ja toisto oletuksena pois. Vanhaa suorittajaa, kuittauksia, valmistumisaikaa, työaikaa, havaintoja tai historia-/auditointi-/varastotapahtumia ei kopioida. Suunnittelu ei kuluta saldoa. Uuden työn todellinen käyttö on kirjattava erikseen sen valmistuessa.

Laite ja linja päätellään aktiivisesta nykyisestä rekisteristä; arkistoitua/poistettua laitetta varten valitaan toinen aktiivinen laite. Kopiointi ei aktivoi rekisterikohteita. Käytetään tavallista `private_mutate/job`-polkua: revisio, jäsenyys, yrityskohtaiset viiteavaimet ja aktiivisuussuojaukset säilyvät. Katselijalle painiketta ei näytetä; palvelimen roolitarkistus estää suoran kirjoitusyrityksen. Asentaja voi luoda suunnitelman.

## Varmennus ja käyttöönotto

Regressiot kattavat suunnitelman ja toteuman erilaiset määrät, kaikki rekisterinimikeluokat, vapaan käytön, sekakäytön ilman kaksoiskopioita, tyhjän toteuman varavaihtoehdon, vanhan actual-kartan, pelkän frozen-snapshotin, puuttuvat/käytöstä poistetut rekisteriviitteet, tuntemattoman nimikkeen, muokkauksen/poiston/peruuttamisen, historian ja saldon säilymisen sekä käyttöoikeudet.

Playwright testaa toteumaan ja varasuunnitelmaan perustuvat polut työpöydällä, iPhonen ja Androidin kokoisilla näytöillä sekä tabletilla. PostgreSQL-testit varmistavat toteumasta muodostettujen rekisteri- ja vapaiden suunnitelmarivien tallentumisen ilman uutta kulutusta, historiasnapshotin muutosta tai rekisterin automaattista täydentämistä; myös suorat katselijan ja vieraan yrityksen RPC-kutsut estetään. Testit käyttävät synteettistä dataa ja eristettyä PostgreSQL-konttia.

Korjaus on frontendin esitäyttölogiikkaan eikä vaadi uutta Supabase-migraatiota. Tarkista oma korjaus-PR main-haaraan ja julkaise vasta erikseen hyväksytysti. Tuotantotietokantaa ei muuteta tässä työssä. Frontendin palautus palauttaa aiemman esitäyttötavan, mutta ei muuta jo tallennettuja suunnitelmia tai historiaa.

Korjauksen varmennus 20.10.2026: lint, typecheck, build + verify:build, 149 Vitest-testiä, 111 integraatiotestiä, PostgreSQL-testit ja 12 julkaisusuojaustestiä läpäisivät. Korjatun testin jälkeen koko neljän näyttökoon 80 Playwright-testin regressio läpäisi; myös vanha smoke-polku varmennettiin erikseen.
