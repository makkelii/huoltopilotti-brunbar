# Käytettävyysanalyysi ja vaiheistus

## Nykytilan havainnot

Historia käyttää samaa avattavaa näkymää kuin avoin työ: siinä näkyvät valmistelu,
turvallisuusvaroitus, ISO-aikaleima ja työn tunniste. Puuttuvan nimiketiedon
varatietona näkyy tunniste. Valmistumislomakkeen päätoiminto on epämääräinen
”Vahvista”. Rekisterin perustaminen on käytännössä ehtona tarvike- ja työkalukirjauksille.
Navigaatiossa raportit ja laitekohtainen historia tarjoavat osin saman asian.
Laite-, työ- ja nimikelomakkeissa perustiedot ja harvoin tarvittavat kentät sekoittuvat.

## Julkiset vertailukohteet (20.10.2026)

- [MaintainX: työn valmistuminen](https://help.getmaintainx.com/complete-a-work-order):
  työn suoritus, aika, osat ja kommentit erotellaan omiksi toiminnoikseen.
- [MaintainX: laitteet](https://help.getmaintainx.com/viewing-assets):
  huoltohistoria löytyy laitteelta; mobiilissa selkeä laitelista.
- [Limble: työn valmistuminen](https://help.limblecmms.com/en/articles/3497506-how-to-complete-a-task):
  ensin ohjeet ja tarkistukset, lopuksi aika ja valmistuminen. Mobiilissa omat työt
  ovat suora sisäänkäynti.
- [Limble: mobiilikäyttö](https://help.limblecmms.com/en/articles/11698403-using-the-new-limble-mobile-app):
  työt ja laitteet päätoimintoina.
- [UpKeep: työn osiot](https://help.onupkeep.com/en/articles/15545270-how-to-view-and-process-work-orders-on-web-new):
  perustiedot, tehtävät, aika ja osat ovat erillisiä osioita.
- [UpKeep: mobiilityön suodatus](https://help.onupkeep.com/en/articles/6578001-how-to-filter-work-orders-on-mobile):
  omien töiden ja tilan suodatus tukevat asentajan työnkulkua.

Sovellamme työnkulun periaatteita, emme kopioi ulkoasua tai koodia.

## Vaihe 1 – oma pull request

1. Erillinen luettava historiakomponentti: laite, paikallinen päivämäärä, suorittaja,
   aika, tehdyt työt, osat, työkalut ja lisähuomiot. Vanhojen tietojen puuttuvat nimet
   esitetään ymmärrettävällä varatekstillä. Tietokannan historiaa ei kirjoiteta uudelleen.
2. Vapaiden työkalujen ja osien lisäys. Osalla nimi ja positiivinen määrä, työkalulla
   nimi. Rekisterivalinta säilyy vaihtoehtona. Vapaakirjaukset eivät luo nimikkeitä
   tai varastotapahtumia.
3. Palvelimen validoima tallennus samaan valmistumistransaktioon ja muuttumattomaan
   historian snapshotiin. Uusi migraatio, ei tuotantoajoa ilman hyväksyntää.
4. Lyhyt valmistumislomake ja kaksoistallennuksen esto. Turvaohjeet säilyvät avoimessa työssä.

## Vaihe 2 – erillinen pull request vaiheen 1 päälle

Selkeytetään navigaation ryhmittely, nimet ja mobiilikäyttö. Asentajalle olennaiset
työt ensin, rekisterit valinnaiseksi ryhmäksi, huoltopohjat hallinnan yhteyteen.
Harvemmin käytetyt lomakekentät avattaviin lisätietoihin. Nykyiset raportit, pohjat,
rekisterit, oikeudet ja käyttäjähallinta säilyvät käytettävissä.

## Hyväksyntäraja

PR:t jäävät avoimiksi. Migraatiot, PR:ien yhdistäminen ja brunbar.fi:n julkaisu
odottavat omistajan hyväksyntää. DNS- tai Pages-asetuksia ei muuteta.
