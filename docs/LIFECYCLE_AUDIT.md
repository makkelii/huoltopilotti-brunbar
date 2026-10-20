# Elinkaaren auditointi – PR B.1

Lähtökohta: main 21d8e23, PR #10 yhdistetty. Tarkastelu perustuu nykyiseen
koodiin, migraatioihin 001–008 ja paikallisiin testeihin. Tuotantotietoja ei muuteta.

## Nykyiset puutteet ja ratkaisu

- Laitteilla ei ole arkistointitilaa, palautusta tai poistamisen RPC:tä. Kyse on
  puuttuvasta toiminnosta, ei pelkästä rooli- tai näkyvyysongelmasta.
- Linjan arkistointi löytyy vasta linjan omasta näkymästä. 007 irrottaa kaikki
  laitteet turvallisesti, mutta snapshot piilottaa arkistoidun linjan kokonaan.
  Arkistonäkymä ja palauttaminen puuttuvat.
- Tavalliset laitevalitsimet ja koontilaskurit käsittelevät kaikki laitteet aktiivisina.
  Arkistoinnin lisääminen edellyttää myös palvelinrajoja ja toistuvan työn suojausta.
- Huoltotyöt ja vikailmoitukset viittaavat laitteisiin yrityskohtaisten FK-avainten
  kautta ilman laitepoiston cascadea. Historia viittaa työhön ja on muuttumaton.
  Näitä suojauksia säilytetään.
- Inventaarion yhteensopivuus ja pohjan ohjeet voivat sisältää JSON-/tekstiviitteitä.
  Poistaminen tarkistaa myös nämä konservatiivisesti. Auditointia säilytetään
  poistamisesta huolimatta, ja poistettu UUID varataan auditin avulla uudelleenkäytöltä.
- Linja, jolla on ollut laitesijoituksia, säilytetään arkistossa: sijoitusauditin
  from/to-viitteet tai arkistoinnin irrotusmäärä estävät pysyvän poiston.

## Päätökset

Omistaja/ylläpitäjä voi arkistoida, palauttaa ja poistaa riippuvuuksista vapaan kohteen.
Asentaja ja katselija voivat lukea arkistoa/historiaa. Avoin työ estää laitearkistoinnin;
nykyisessä mallissa ei ole peruutettua tilaa eikä sitä keksitä tässä PR:ssä.
Toistuva työ käsitellään avoimena työnä. Sen valmistuminen luo normaalisti seuraavan
avoimen työn, joten toisto on ensin poistettava työn muokkauksessa ja avoin työ
suoritettava asianmukaisesti. Arkistoitua laitetta ei voi käyttää uuteen tai siirrettyyn
työhön, uuteen vikailmoitukseen tai toiston automaattiseen aktiiviseen työhön.

Linja-arkistointi säilyttää 007:n irrotusperiaatteen. Linjan palautus ei siirrä yhtään
laitetta takaisin. Laitteen palautuksessa valitaan aktiivinen linja tai ei linjaa;
arkistoituun linjaan ei palata hiljaisesti. Tunnisteristiriita estää linjan palautuksen.

## Rajattu muiden rekisterien auditointi

- Varastossa on `inactive`-tuki ja käytön estot, mutta yhtenäinen arkisto/palautus/
  poisto ei ole kattavasti tarjolla käyttöliittymässä. Jatkokehitys erillisessä PR:ssä.
- Varastoerän pysyvä poisto vaatii kulutus-, vaade- ja auditointiriippuvuuksien erillisen
  suunnitelman; tätä ei toteuteta laitepoiston sivuvaikutuksena.
- Kesken olevan työn peruuttaminen vaatii uuden tilan, roolit, syyn ja toiston
  semantiikan. Tässä estetään laitteen arkistointi avoimen työn yli.
- Käytössä on yksi versioitu huoltopohja. Pohjan poistaminen käytöstä sekä usean
  pohjan hallinta kuuluvat erilliseen kokonaisuuteen; vanhat versiot/historia säilyvät.
- Huoltotutka saa edelleen näyttää arkistoidun laitteen vanhat vikahavainnot.
  Arkistointia ei käytetä historian hakusuodattimena. Nimi ja arkistomerkintä säilyvät.

## Regressiosuojaus

Vaatimukset 1–7 katetaan reducer-, React- ja PostgreSQL-testeillä: arkistointi, valitsimien
rajat, arkiston löydettävyys, palautus, historian pysyvyys sekä riippuvaisen ja tyhjän
laitteen poistokelpoisuus. Vaatimukset 8–11 katetaan samoilla tasoilla linjojen arkistoinnin,
irrotuksen, palautuksen, tunnisteristiriidan ja tyhjän aktiivisen/arkistoidun linjan poistossa.

Vaatimus 12 testataan demon valmistumissuojalla sekä PostgreSQL-triggerillä, joka estää
aktiivisen työn luonnin arkistoidulle laitteelle myös sisäisessä toistopolussa. Vaatimukset
13–14 testataan katselijan/asentajan lukunäkymillä, suoran kirjoittamisen ja sisäisten
funktioiden estoilla sekä yritysten välisillä RPC- ja RLS-tarkistuksilla. Vaatimus 15
katetaan revisioristiriidoilla ja kahden PostgreSQL-yhteyden arkistointi/työnluontikilpailulla.
Vaatimus 16 katetaan koko uuden elinkaaripolun Playwright-ajolla sekä työpöydällä että
puhelinprofiililla. Samassa ajossa säilyvät PR B:n suunnittelu- ja toteumatestit.

Tarkistuksessa korjattiin myös arkistoidusta laitteesta avatun kohdenäkymän suodattimen
vaihto: kohdistus tyhjenee, joten arkistoitu laite ei jää näkyviin aktiivisten listaan.
Palautuksen linjavalinta lukitaan tallennuksen ajaksi. Pysyvä poisto ei etene, jos
päivittynyt tilanne tuo kohteelle säilytettäviä riippuvuuksia.
