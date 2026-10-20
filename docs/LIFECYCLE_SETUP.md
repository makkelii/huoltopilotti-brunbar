# Laitteiden ja tuotantolinjojen elinkaari – PR B.1

Pohja: main 21d8e23, PR #10 yhdistetty. Havaitut puutteet ja muiden rekisterien
jatkokehitys on dokumentoitu tiedostossa [LIFECYCLE_AUDIT.md](LIFECYCLE_AUDIT.md).

## Käyttäjän toiminnallisuus

Laitteet-osiossa on nykyisten aktiivisten laitteiden, tuotantolinjojen ja ilman linjaa
olevien laitteiden lisäksi **Arkistoidut laitteet** ja **Arkistoidut tuotantolinjat**.
Arkistoidut kohteet merkitään selvästi; ne eivät tule aktiivisten laitteiden oletuslistaan.
Kaikki saman yrityksen roolit voivat lukea arkistoa ja historiaa. Elinkaarimuutokset
kuuluvat omistajalle ja ylläpitäjälle kuten muutkin laite- ja linjarekisterin muutokset.

### Laite

- **Arkistoi laite** avaa vahvistuksen, jossa näkyvät nimi, sarjanumero ja säilyvät tiedot.
  Avoimet työt estävät vahvistamisen. Samat ehdot tarkistetaan uudelleen palvelimella.
- Arkistoidun laitteen tunnistetiedot, vanhat työt, huoltohistoria ja vikahistoria säilyvät.
  Huoltotutka saa edelleen löytää vanhat viat. Arkistoidulle laitteelle ei voi luoda
  uusia töitä tai vikakirjauksia. Toiston aktiivisen työn luonti estetään myös tietokantatriggerillä.
- **Palauta aktiiviseksi** sallii aktiivisen linjan valinnan tai laitteen jättämisen ilman linjaa.
  Vain edelleen aktiivinen aiempi linja voidaan esitäyttää. Epäkelpoon linjaan ei palata.
- **Poista pysyvästi** näkyy vain, kun tunnettuja säilytettäviä riippuvuuksia ei ole.
  Nimi ja sarjanumero näytetään erillisessä vahvistuksessa. Palvelin tarkistaa tilanteen
  aina uudelleen ja säilyttää FK-suojaukset. Historiaa sisältävä laite jää arkistoitavaksi.

### Tuotantolinja

Arkistointipainikkeen nimi on nyt **Arkistoi tuotantolinja**, jotta arkistointi erottuu
pysyvästä poistosta. Linjan omassa näkymässä vahvistuksessa näkyvät nimi, laitteiden määrä,
avointen töiden määrä ja irrotuksen selitys. Kaikki laitteet, myös arkistoidut, irrotetaan
linjasta 007:n käytännön mukaisesti. Laitteita tai töitä ei poisteta eikä valmisteta.

**Palauta tuotantolinja** palauttaa vain linjan. Se ei muuta yhtään laitesijoitusta.
Aktiivisen tunnisteen yksilöllisyys tarkistetaan olemassa olevalla indeksillä. Jos tunniste
on otettu käyttöön toisella aktiivisella linjalla, palautus estetään. Ratkaise ristiriita
muokkaamalla toisen aktiivisen linjan tunnistetta harkitusti ja yritä palautusta uudelleen.

Tyhjän virhelinjan voi poistaa pysyvästi joko aktiivisena tai arkistoituna. Linja, jolla
on laitteita, säilytettäviä JSON-viittauksia tai aiempia laitesijoituksia auditissa,
säilytetään arkistossa. Arkistoinnin irrotustietoja ei hävitetä poistamisen mahdollistamiseksi.
Linjan historia kuvaa edelleen sen **nykyisten laitteiden** historiaa, ei menneitä sijoituksia.

### Avoimet ja toistuvat työt

Nykyisessä mallissa ei ole peruutettua työtä. Arkistointi ei keksi valmistumista tai peru
avoimia töitä. Käsittele avoin työ asianmukaisesti. Toistuvassa työssä poista tarvittaessa
ensin toisto työn muokkauksessa, jotta valmistuminen ei luo seuraavaa avointa työtä.
Jos työn pitäisi peruuntua tekemättä, jätä laite toistaiseksi aktiiviseksi: hallittu peruutus
on erillinen jatkokehityskohde. Älä kirjaa tekemätöntä työtä valmiiksi arkistoinnin vuoksi.

## Tietokanta ja palvelinsuojaus

Tarvitaan `supabase/migrations/202610200009_equipment_lifecycle.sql` migraation 008 jälkeen.
Vanhoja migraatioita ei muuteta. Uusi nullable `assets.archived_at` ei arkistoi vanhoja
laitteita eikä kirjoita niiden tunnistetietoja tai historiaa uudelleen. Migraatio lisää
riippuvuustarkistukset, indeksit ja aktiivisen laiteviitteen triggerit.

`private_snapshot` säilyttää kaikki laitteet ja täydentää niiden `archivedAt`/`canDelete`
tiedot. `productionLines` sisältää aktiiviset linjat kuten ennen; uusi
`archivedProductionLines` tuo 007:n arkistoimat linjat takaisin hallittaviksi. Historiat
luetaan edelleen muuttumattomista valmistumishetken snapshoteista.

Uudet mutaatiot ovat `asset_archive`, `asset_restore`, `asset_delete`,
`production_line_restore` ja `production_line_delete`. Linjan arkistointi delegoituu
edelleen 007:n toteutukseen. Kaikki käyttävät samaa yrityksen revisiolukkoa ja tarkistavat
roolin sekä kohteen yrityksen palvelimella. Sisäisiä apufunktioita ei voi kutsua asiakkaana.
RLS tai suorien kirjoitusten estot eivät muutu.

Poistaminen tarkistaa työt, historian, viat, yhteensopivuusviittaukset, pohjat ja työn/
historian säilytettävät JSON-viittaukset. Linjalla tarkistetaan myös laitesijoitusauditit.
Varmuuden vuoksi UUID:n sisältävä vanha JSON-viite voi estää poiston; tällöin käytetään
arkistoa eikä rikota viittausta. Viiteavaimia tai historiaa ei poisteta cascaden avulla.

Jokaisesta elinkaarimutaatiosta jää toiminto, tekijä ja kohteen aiemmat tiedot auditointiin.
Poistetun kohteen UUID:ta ei voi herättää uudelleen tavallisella tallennuksella.
Auditointitieto ei itsessään estä tyhjän virhekohteen poistoa, mutta sitä ei koskaan poisteta
kohteen mukana. Käyttöliittymän poistokelpoisuus on apu; tietokanta tekee lopullisen päätöksen.

Käyttöliittymä päivittää rekisterin vasta palvelimen tallennuksen ja sitä seuraavan lukemisen
jälkeen. Virhe jättää kohteen ja vahvistuksen näkyviin. Paikallinen ja yhteinen tallennuslukko
estävät rinnakkaiset painallukset. Revisioristiriitaa ei yritetä automaattisesti uudelleen.

## Käyttöönotto ja palautussuunnitelma

1. Tarkista PR sekä migraatio ja varmista ajantasainen varmuuskopio.
2. Aja migraatiot 001–009 erillisessä testiympäristössä. Tarkista arkistointi, avoimen työn
   esto, palautus, tunnisteristiriita, turvallinen poisto ja vanhan historian avaaminen.
3. Hyväksy tuotantomigraatio erikseen. Suorita 009 ennen uuden käyttöliittymän julkaisua.
4. Julkaise frontend normaalilla hyväksytyllä menettelyllä ja käy läpi oman yrityksen tavallinen polku.

Tätä ohjetta ei suoriteta automaattisesti eikä tuotantotietokantaan ole otettu yhteyttä.
Migraatio ei tee pysyviä poistoja. Ne edellyttävät myöhemmin käyttäjän erillistä vahvistettua toimintoa.

Älä palauta tietokantaa pudottamalla arkistointisaraketta tai poistamalla auditointia.
Vanha frontend ei osaa suodattaa arkistoituja laitteita, vaikka palvelin estää niiden uuden käytön.
Jos arkistointia on jo käytetty, suosi korjaavaa frontend-julkaisua tai arvioi palautus erikseen;
älä tulkitse vanhan käyttöliittymän listaa aktiivisten laitteiden luetteloksi.

## Testit ja rajat

- lint ja typecheck: läpäisivät.
- build ja verify:build: läpäisivät.
- `npm test`: 124 testiä läpäisi.
- `npm run test:integration`: 86 testiä läpäisi (sisältyvät myös edelliseen ajoon).
- PostgreSQL 16: migraatiot 001–009, vanhat suojaukset, elinkaari, riippuvuudet, roolit,
  tenant-rajat ja rinnakkainen arkistointi/uuden työn luonti läpäisivät.
- Playwright `CI=1`: 28 testiä läpäisi työpöydällä ja iPhone 13 -profiililla.
- Julkaisusuojaukset: 12 testiä läpäisi.

Käyttöliittymätestit käyttävät demodataa tai simuloitua Supabasea. PostgreSQL ajetaan
verkottomassa kertakäyttökontissa. Tuotantokäyttöä, oikeaa Supabase-ympäristöä tai pitkän
historian kuormitusta ei väitetä testatuksi. Demon paikallinen elinkaarimalli ei korvaa
palvelimen auditoituja riippuvuustarkistuksia; ne varmennetaan PostgreSQL-testeillä.
