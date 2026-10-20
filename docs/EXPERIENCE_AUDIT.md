# PR E – käyttöliittymän ja työnkulkujen viimeistely

20.10.2026. Riippuu PR F #14:stä, D #13:sta ja C #12:sta. Base on `feat/registry-retirement`. Ei uutta SQL-migraatiota, autentikoinnin muutosta tai julkaisumuutosta.

## Kuuden pääosion auditointi

| Osio | Tarkastettu toiminta | Ratkaisu / korjaus |
|---|---|---|
| Etusivu | työjonot, myöhässä olevat, viimeisimmät valmistumiset, kuusi pääosiota | säilytetty nykyiset jonot ja navigaatio; regressiot kaikissa näyttökoissa |
| Huoltotyöt | luonti/muokkaus, linja → laite, suunnitelma/toteuma, vapaat kirjaukset, historia, uudelleenluonti, virheen jälkeinen luonnos | toimivat polut säilytetty; katseluoikeus selitetään; uusi yhtenäinen käyttäjäpolku varmistaa historian ja saldon molempien valmistumisten yli |
| Laitteet | luonti, linjasijoitus, haku, arkistointi/palautus ja lopullinen poisto | oikeuden puuttuminen selitetään; arkistointi/palautusdialogin vanha saavuttamaton fyysisen poiston haara siivottu; F:n tunnistevahvistus säilyy |
| Varasto | varaosat, työkalut ilman saldoa, käytöstä poisto, haku, suunnittelu ja toteutunut kulutus | korjattu muokkauspainikkeen näkyminen asentajalle/katselijalle; tila aktiiviset/kaikki/poistetut; haku myös valmistajalla, tuotekoodilla ja sijainnilla; kuvaava hakukenttä, tyhjän tuloksen ohje ja selitys vapaan kirjauksen mahdollisuudesta |
| Huoltotutka | rajaukset, haku, alkuperäisen kirjauksen lataus, virheet, vanhentuneet vastaukset | estetty alkuperäisen kirjauksen kaksoislataus, näytetään lataus, hylätään vastaus haun/rajausten vaihtuessa; rajausvaihtoehtojen latauksen uusinta, rajausten tyhjennys hakusana säilyttäen; pitkät tekstit lyhennetty tuloskortissa, alkuperäinen edelleen kokonainen |
| Asetukset | omat asetukset, roolien hallinta, kutsut, virheet | hallintaoikeus selitetään; kutsujen synkroninen lukko ja odottava painike estävät kaksoislähetyksen; epäonnistuminen säilyttää osoitteen ja sallii uusinnan |

Tablettiregressio löysi taulukon näkymättömän saavutettavuusotsikon ylivuodon vierityssäiliöstä. Vierityssäiliö toimii nyt myös absoluuttisesti sijoitetun otsikon asemointikontekstina; taulukko vierii edelleen ja saavutettava otsikko säilyy. Leveyttä tarkistavaa testiä ei poistettu tai löysennetty.

Nykyiset turvallisuusohjeet ja tarkistukset työn suoritusvaiheessa säilyvät. Valmistunut historia ei näytä työn aloittamisen turvallisuusvaroitusta. Rekisteriä ei tarvita huollon kirjaamiseen. Suunnitteluvaihe ei kuluta varastoa, vapaat nimikkeet eivät muuta saldoa, työkaluilla ei ole määrää tai saldoa. Käyttöliittymän oikeudet täydentävät palvelimen rooli-/tenant-tarkistuksia, eivät korvaa niitä.

## Testit ja mobiilikäyttö

Playwright ajaa koko regressiosarjan neljässä Chromium-profiilissa: työpöytä, iPhone 13, Pixel 7 ja iPad Mini. Tabletissa on leveä navigaatio, sillä CSS:n valikkoraja on 760 px; `isMobile: false` ohjaa myös testien navigaatiovalintaa. Kyseessä on näyttökokojen ja kosketusprofiilien emulointi, ei fyysisten laitteiden tai Safarin sertifiointi.

Uusi `experience.spec.ts` käy läpi linjan ja laitteen luonnin, suunnitellun rekisterivaraosan, valmistumisen, oikean saldon, historian, uuden huollon luonnin vanhasta, sen valmistumisen ilman oletettua kulutusta, tietopankkihaun, arkistoinnin, palautuksen, lopullisen poiston ja alkuperäisen historian avaamisen. Historiatietueita verrataan kokonaisina, eikä pelkkää onnistumistekstiä hyväksytä todisteeksi. Leveyden ylitys tarkistetaan myös valmistumis- ja poistodialogeissa.

Oikea Supabase SDK käy kirjautumisen ja uudelleenlatauksen polut synteettisen HTTP-sopimuspalvelimen kautta kaikissa neljässä koossa. Erillinen katselijapolku todentaa hallintapainikkeiden ja valmistumisen puuttumisen sekä sen, ettei käyttöliittymä lähetä muutospyyntöjä. Todelliset palvelinsuojausten ohitusyritykset, roolit, tenant-eristys ja transaktiot testataan PostgreSQL:ssä.

Uudet integraatiotestit kattavat myös asentajan/katselijan oikeuksien selitykset, varaston käytöstä poiston rajauksen, koodihakua, saldon säilymistä, kutsun virhettä/kaksoislähetystä sekä haun vanhentunutta lähdevastausta ja rajausvaihtoehtojen uusintaa. Aiemmat lomakevirheiden luonnoksen säilymisen ja kaksoistallennuksen eston testit säilyvät.

## Rajat

- Ei suurta ulkoasuuudistusta, uusia pääosioita tai animaatioita. Nykyiset vähintään 44 px:n painikkeet, vieritettävät taulukot ja näytölle mahtuvat dialogit säilytetään.
- Tavalliset laite- ja varastorekisterit perustuvat edelleen yrityksen snapshottiin, ja pitkät taulukot vierivät. Tässä vaiheessa ei toteuteta niille uutta palvelinsivutusta tai virtualisointia. Tietopankkihaku on erillinen indeksoitu ja sivutettu palvelinhaku.
- Demohaku on yksinkertaistettu paikallinen esitys; PostgreSQL:n suomenkielinen taivutus/prefix-haku varmennetaan SQL-testeillä. Historiallisesti tuntemattomia sijoituksia ei täydennetä arvauksin.
- Tuloskortin 500 merkin ote ei muuta tietokannan tai alkuperäisen kirjauksen sisältöä.
- Roolien muuttaminen ja kutsut tarvitsevat tuotannossa valmiiksi asennetun kutsufunktion ja oikeat ylläpitäjän oikeudet. Tuotantoon ei lähetetä testikutsuja.

Yhteinen käyttöönottosuunnitelma: [CFDE_ROLLOUT.md](CFDE_ROLLOUT.md). Tässä vaiheessa ei tehdä tuotantotoimenpiteitä.

Varmennetut paikalliset tarkistukset: ESLint, typecheck, build ja verify:build, 141 Vitest-testiä, 103 integraatiotestiä, PostgreSQL:n puhdas asennus sekä päivitys- ja turvallisuusregressiot ja 12 julkaisusuojaustestiä läpäisivät. Kaikki 76 Playwright-testiä läpäisivät kokonaisajon neljässä näyttökoossa tablettiylivuodon korjauksen jälkeen.
