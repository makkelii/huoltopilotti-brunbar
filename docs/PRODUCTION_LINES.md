# Tuotantolinjat ja laitehierarkia – PR A

## Lähtötilanne ja toteutussuunnitelma

Tutkittu main `0228cd1` (PR #8 yhdistetty), nykyiset `assets`, `maintenance_jobs`,
`maintenance_history`, `job_requirements`, `private_snapshot` ja `private_mutate`
sekä niiden käyttöoikeudet ja testit. PR #7:n pysyvät historiatilannekuvat ja vapaat
kirjaukset sekä PR #8:n kuuden kohdan navigaatio ovat jo käytössä ja säilytetään.

Kokonaisuus toteutetaan hallittavissa vaiheissa:

1. **PR A, tämä muutos:** vapaaehtoinen yrityskohtainen tuotantolinja, laitteiden
   liittäminen/siirtäminen ja Laitteet-osion linjanäkymät.
2. **PR B:** suunnitellut tarpeet olemassa olevan `job_requirements`-rakenteen ja
   huoltopohjien pohjalta. Rekisteri- ja vapaat suunnittelurivit, erillään toteumasta.
3. **PR C:** valmiin huollon uudelleenluonti muokattavaksi ehdotukseksi. Ei vanhaa
   toteumaa, valmistumistilaa, turvallisuuskuittauksia tai varastotapahtumia uuteen työhön.
4. **PR D:** yrityksen historiatiedon tekstihaku ja linja-/laitesuodatus sekä
   Huoltotutkan sovittaminen tietopankkiin.
5. **PR E:** työlistojen, mobiilin, varaston, asetusten ja käyttöönoton viimeistely.

PR B–E:tä ei toteuteta automaattisesti ennen tämän PR:n tarkistusta.
Jatkokehityksen tavoite on löytää aiempi tieto ja tehdä seuraava työ nopeasti;
tuotantolinja–laite riittää ilman rajattoman syvää hierarkiaa. Julkisissa
[MaintainX](https://help.getmaintainx.com/view-and-filter-work-orders)-,
[Limble](https://help.limblecmms.com/en/articles/7157630-limble-overview-navigation)- ja
[UpKeep](https://help.onupkeep.com/en/articles/6578001-how-to-filter-work-orders-on-mobile)-
ohjeissa aiemmin tutkitut tehtäväkeskeiset navigointi- ja suodatusmallit soveltuvat
jatkosuunnittelun vertailukohdiksi. Ulkoasua tai lähdekoodia ei kopioida.

## Käyttöliittymä

Päänavigaatiossa on edelleen kuusi kohtaa. Tuotantolinjat löytyvät **Laitteet**-osiosta:

- **Kaikki laitteet:** myös vanhat ja ilman linjaa olevat laitteet.
- **Tuotantolinjat:** linjan nimi, vapaaehtoinen tunniste ja sijainti sekä laite- ja
  avoimien töiden määrät. Haku toimii myös linjan nimen ja tunnisteen perusteella.
- **Ilman tuotantolinjaa:** laitteet, joiden linjaa ei ole valittu tai joiden linja
  on poistettu käytöstä.

Omistaja tai ylläpitäjä lisää ja muokkaa tuotantolinjoja. Vain nimi on pakollinen;
tunniste, sijainti ja kuvaus ovat valinnaisia. Annettu tunniste on yksilöllinen
yrityksen aktiivisten linjojen joukossa, kirjainkoosta riippumatta.

Laitetta luotaessa tai muokattaessa linjavalinnasta voi valita linjan tai **Ei
tuotantolinjaa**. Linjan **Lisää laite tälle linjalle** esitäyttää valinnan mutta
käyttäjä voi muuttaa sitä. Varaosia, työkaluja tai huoltopohjia ei tarvitse perustaa.
Laitteen tekniset tiedot ovat avattavassa lisätieto-osiossa.

Linjan näkymässä ovat laitteet, avoimet huoltotyöt ja koottu huoltohistoria.
Työstä avautuu nykyinen työnäkymä ja historiasta nykyinen muuttumaton
historiatilannekuva. Olemassa oleva laitekohtainen Huoltohistoria-toiminto säilyy.

**Koottu historia tarkoittaa linjan nykyisten laitteiden historiaa.** Kun laite
siirretään, sen koko historia kulkee laitteen mukana. Näkymä ei väitä laitteen
olleen nykyisellä linjalla menneen huollon suoritushetkellä. Vanhoihin
historiatilannekuviin ei lisätä jälkikäteen linjatietoa.

**Poista linja käytöstä** pyytää yhden selkeän vahvistuksen. Linja arkistoidaan,
laitteiden linjaviittaus tyhjennetään ja laitteet jäävät näkyviin. Laitteita,
huoltotöitä, pohjia, varastotapahtumia ja historiaa ei poisteta. Arkistoidun
linjan metatiedot säilyvät tietokannassa. Arkistoidun linjan palautus ei kuulu PR A:han.

Asentajat ja katselijat voivat katsella linjoja ja niihin liittyvää tietoa omien
nykyisten käyttöoikeuksiensa mukaisesti; hallintapainikkeet ovat vain omistajalle
ja ylläpitäjälle. Palvelin tarkistaa samat oikeudet.

## Tietomalli ja turvallisuus

Uusi `production_lines`-taulu sisältää yrityksen, nimen, tunnisteen, sijainnin,
kuvauksen ja tekniset luonti-/arkistointitiedot. `assets.production_line_id` on
NULL-sallittu. Yhdistetty viiteavain `(organization_id, production_line_id)`
varmistaa tietokannassa, että laite ja linja kuuluvat samaan yritykseen.
Fyysinen linjan poistaminen on estetty, jos linjaan viitataan; sovellus arkistoi
linjan atomisesti ja irrottaa laitteet siitä.

RLS sallii linjatietojen lukemisen vain yrityksen jäsenille. Suorat asiakkaan
kirjoitukset on estetty. Luonti, muokkaus, siirto ja arkistointi kulkevat nykyisen
`private_mutate`-rajapinnan organisaation revisiolukon kautta. Vanha revisio
hylätään ilman sokeaa uudelleenyritystä. Arkistoitua tai toisen yrityksen linjaa ei
voi valita. Sisäiset delegointifunktiot eivät ole asiakkaan kutsuttavissa.

Snapshot käyttää laitteiden relaatioviittausta ensisijaisena tietona, ei asiakkaan
JSON-metatietoa. Vanhan asiakkaan laitemuokkaus ilman uutta kenttää säilyttää
nykyisen linjan; eksplisiittinen NULL irrottaa laitteen linjasta. Vanhan
selainkohtaisen demon puuttuva `productionLines` tulkitaan tyhjäksi listaksi.

Linjan muutokset ja arkistointi sekä laitteen linjan vaihtuminen kirjataan
auditointiin. Suoritus-, kulutus-, toistuvuus- ja historiatransaktiot delegoidaan
aiemmalle toteutukselle. Historiatriggerit, RLS ja aiemmat migraatiot säilyvät.

## Migraatio ja käyttöönotto

**Uusi Supabase-migraatio tarvitaan:**
`supabase/migrations/202610200007_production_lines.sql`.

Migraatio on lisäys migraatioiden 001–006 päälle. Se ei päivitä olemassa olevien
laitteiden tietokenttiä tai historiarivejä. Kaikki vanhat laitteet näkyvät aluksi
ilman tuotantolinjaa. Rivimäärien, tietosisällön ja vanhan snapshotin latautumisen
säilyminen testataan erikseen 006→007-päivityksessä.

Käyttöönotto erillisellä hyväksynnällä:

1. Tarkista PR ja ota nykyisen tuotantokannan normaali varmuuskopio.
2. Varmista, että migraatiot 001–006 ovat käytössä. Testaa 007 ensin erillisessä
   testiympäristössä normaalilla Supabase-menettelyllä.
3. Aja hyväksytty 007 vain oikeaan `brunbar.fi`-projektin Supabase-kantaan.
4. Yhdistä tarkistettu PR ja julkaise käyttöliittymä nykyisellä hyväksytyllä
   `Deploy brunbar.fi` -menettelyllä. Migraatio ennen uutta käyttöliittymää.
5. Tarkista vanhat laitteet, yhden linjan luonti ja laitesiirto sekä laitekohtaisen
   historian latautuminen. Käyttäjät voivat liittää vanhoja laitteita vähitellen.

Vanha käyttöliittymä voi toimia uuden migraation kanssa. Käyttöliittymän palautus
ei vaadi linjatietojen poistamista tai tietokantamigraation purkamista. Älä pudota
uutta taulua tai saraketta palautuksen yhteydessä, jos niihin on jo tallennettu tietoja.

Tässä kehitystyössä migraatio suoritetaan vain kertakäyttöiseen paikalliseen
PostgreSQL-testikantaan. Tuotantomigraatioita, yhdistämistä tai julkaisua ei tehdä.
Ei muutoksia 585.fi:hin, `makkelii/Huolto`-repositorioon, DNS:ään,
Pages-asetuksiin, tuotannon Supabase-asetuksiin tai julkaisutyönkulkuihin.

## Varmennus

- lint, typecheck, build ja juurihakemistobuildin tarkistus.
- Kaikki yksikkö- ja integraatiotestit; uudet testit linjan luonnille/muokkaukselle,
  tunnisteille, vanhoille laitteille, siirroille, irrottamiselle, arkistoinnille,
  käyttöoikeuksille, kootulle historialle ja RPC-sopimukselle.
- Aidot PostgreSQL 16 -testit: RLS, roolit, yritysrajat, yhdistetty viiteavain,
  vanhan datan säilyminen, vanhan asiakkaan yhteensopivuus, revisioristiriita,
  auditointi, historian ja saldojen säilyminen sekä arkistoinnin ja laitesiirron
  samanaikainen kilpailu. Aiemmat toistuvuus- ja kulutustestit ajetaan edelleen.
- Playwright työpöydällä ja iPhone 13 -koossa: rekisteritön aloitus, linjojen hallinta,
  laitteen siirtäminen, uuden laitteen esitäytetty linja, historia, arkistointi,
  uudelleenlataus ja Supabase SDK:n RPC-sopimus testivastauksilla.
- Kaikki aiemmat julkaisusuojaustestit.

Suunniteltujen varaosien uusi syöttö, kulutuksen uudenlainen vahvistaminen ja
Tee sama huolto uudelleen -toiminnon testit kuuluvat vasta PR B/C:hen. Nykyisten
vapaiden kirjausten ja kulutuksen regressiotestit ajetaan tässäkin vaiheessa.
