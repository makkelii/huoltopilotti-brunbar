# Asentajalähtöinen uudistus – auditointi ja toteutusjärjestys

Auditoinnin lähtökohta: `main` / `46a025324bcdaa7ea46d0d67dfe0fe5bfc61e6c6`, 20.10.2026. Tarkastus perustuu tämän repositorion lähdekoodiin ja testiaineistoon; tuotantoon ei oteta yhteyttä.

## Arkkitehtuuri ja säilytettävät ominaisuudet

React 19 / TypeScript / Vite. `App.tsx` kokoaa työnkulut; erilliset komponentit hoitavat varaston nimikehaun, historiakirjaukset, laitteet ja suunnitellut tarpeet. `Repository` välittää yrityskohtaisen snapshotin ja RPC-muutokset Supabaseen. Demotila käyttää erillistä selaintallennusta. Näitä tiloja ei yhdistetä.

Tietomalli sisältää yrityksen, jäsenyydet ja roolit (owner, administrator, technician, viewer), linjat, laitteet, nimikkeet, huoltotyöt, tarpeet, huoltohistorian, vikailmoitukset, varastotapahtumat ja pohjaversiot. `Requirement` on suunnitelma, `actual` ja `freeUsage` ovat toteuma. Historiaan jää nimien ja käytettyjen nimikkeiden tilannekuva. Työkaluja ei kuluteta varastosta.

Palvelimen organisaatiorevisio ja rivien lukot suojaavat rinnakkaisia muutoksia. Valmistuminen tapahtuu yhtenä RPC-transaktiona: käyttö validoidaan, rekisterivaraosia kulutetaan, historia luodaan ja mahdollinen toistuva työ luodaan. RLS, yrityskohtaiset viitteet, muuttumattomuustriggerit ja palvelimen roolitarkistukset säilyvät. `savingRef` estää käyttöliittymän rinnakkaistallennukset. Katselijan muutosyritykset estetään myös palvelimella.

Laitteiden ja linjojen hallinta, arkistointi/palautus, lopullinen rekisteripoisto, historiallisten tunnisteiden säilyminen ja Huoltotutkan indeksoitu sivutettu haku ovat jo toteutettuja. Niitä ei kirjoiteta uudelleen. `repeatPlan` käyttää toteutuneita rekisteri- ja vapaita nimikkeitä ja vasta niiden puuttuessa suunnitelmaa; lähdehistoria, toteuma ja saldot eivät muutu. Tämä toteutus säilytetään regressiotesteineen.

## Havaitut ongelmat ja prioriteetit

| Prioriteetti | Nykytilan havainto                                                                                                                                 | Toteutus                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0           | Valmistuminen tyhjentää actual/freeUsage-listat ja tehdyn työn tekstin. Suunnitelma avataan erikseen ja jokainen nimike lisätään erikseen.         | Esitäytä paikallinen muokattava luonnos. Yksi lopullinen vahvistus nykyiseen transaktioon.                                                                                 |
| P0           | CompletionItems näyttää vain oman selected-tilansa, joten pelkkä actual-kartan esitäyttö piilottaisi kulutusta.                                    | Alusta näkyvät rekisteririvit luonnoksesta ja varmista näkyvä poistaminen/määrän muokkaus.                                                                                 |
| P0           | Sama rekisterinimike voi esiintyä useana suunnitelmarivinä. Puuttuva viite ei saa muuttua saldottomaksi vapaaksi riviksi.                          | Summaa osamäärät, työkalu kerran, puuttuva/väärä/inaktiivinen viite näkyvään tarkistusilmoitukseen. Älä leikkaa määriä saatavuuteen hiljaisesti.                           |
| P1           | Työlista näyttää laitteen ja linjan mutta ei kuvausta, mukaan otettavia nimikkeitä tai varastotilannetta. Haku kattaa vain työn ja laitteen nimen. | Näytä olennaiset tiedot riveillä myös mobiilissa; laajenna haku sijaintiin, linjaan ja tarpeisiin. Rajaa kerralla renderöitävät työt ja järjestä kiireelliset.             |
| P1           | Työn kuvaus ja pitkä ohje tulevat ennen mukaan otettavia tarpeita. Saman laitteen historia on erillisessä laitenäkymässä.                          | Selkeä Ota mukaan -osio ennen pitkiä ohjeita; viimeisimmät saman laitteen valmistuneet huollot avautuvina alkuperäisinä kirjauksina.                                       |
| P2           | Työn luonti kysyy suunnittelutietoja jo pyynnön yhteydessä.                                                                                        | Erillinen kevyt huoltopyyntöpolku edellyttää päätöstä siitä, onko pyyntö huoltotyö vai erillinen käsiteltävä tietue. Ei uutta tilaa tai tietokantamuutosta ilman päätöstä. |
| P2           | Oma työ tunnistetaan nykyisin asentajan nimestä; samannimiset henkilöt ovat epäselviä.                                                             | ID-pohjainen vastuutus vaatii oman yhteensopivuusratkaisun. Säilytä nykyinen suodatus ja dokumentoi raja.                                                                  |

## Työnkulut ja kirjausmäärät

1. Avaa avoimet työt → näe kohde, kiireellisyys ja tarpeet → avaa työ yhdellä painalluksella.
2. Valmistaudu Ota mukaan -osion avulla. Tarpeiden valinnaisia tilavalitsimia ei tarvitse kuitata.
3. Avaa saman laitteen aiempi huolto työn sisältä. Näytä aina alkuperäinen tallennettu toteuma, ei arvattua samankaltaisuutta.
4. Tee työ → avaa valmistuminen → tarkista esitäytetty luonnos → korjaa vain poikkeamat → Kirjaa valmiiksi.
5. Uusi huolto vanhasta käyttää olemassa olevaa repeatPlan-polkua ja tavallista suunnitelman tallennusta.

Suunnitelman mukaisen työn valmistuminen työn tiedoista: ennen 2 peruspainallusta + suunnitelman avaaminen + N nimikkeen lisäämistä + pakollinen tekstisyöttö; jälkeen 2 painallusta ja 0 pakollista tekstisyöttöä. Työlistasta mukaan lukien työn avaus: 3 painallusta. Todellinen aika ja käyttö ovat käyttäjän tarkistettavia, eivät automaattisesti todettua toteumaa. Esitäytetty työseloste kertoo nimenomaan suunnitelman mukaisesta suorituksesta ja on muokattava.

## PR-jako ja rajat

1. Valmistumisen esitäyttö + tämä auditointi, suoraan main-haaraan.
2. Työlista ja työn käsikirja, riippuu ensimmäisen PR:n App/i18n-muutoksista; riippuvuus nimetään PR:ssä.

Ei uusia migraatioita, tuotantokutsuja, julkaisua tai julkaisuasetusten muutoksia. Huoltopyynnön tietomalli ja ID-vastuutus jäävät erikseen päätettäviksi. Tavalliset rekisterit ja työlista käyttävät edelleen yrityksen snapshotia: käyttöliittymän sivutus vähentää DOM-määrää, ei muuta palvelimen datamäärää. Turvallisuusohjeita tai suunnittelijan toimintoja ei poisteta.
