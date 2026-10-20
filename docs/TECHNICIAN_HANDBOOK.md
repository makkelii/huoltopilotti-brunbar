# Asentajan työlista ja digitaalinen käsikirja

Riippuu valmistumisen esitäytöstä (PR #17). Ei uusia migraatioita tai palvelinsopimuksia.

## Muutokset

Asentajan kirjautumisen oletus on avoimet huoltotyöt. Olemassa oleva suora hash-linkki valitsee edelleen kohdesivun. Ylläpitäjän, katselijan ja demon etusivu säilyy. Asentajan nimipohjainen omien töiden suodatin säilyy; se ei ratkaise samannimisten käyttäjien erottelua.

Työlista näyttää työn kuvauksen, kohteen, nykyisen linjan, sijainnin, kiireellisyyden ja tilan sekä suunnitellut työkalut ja varaosat määrineen. Rekisteriosalle näytetään käytettävissä oleva saldo (quantity − reserved); työkalulle ei esitetä kulutussaldoa. Puuttuva tai inaktiivinen viite näkyy puuttuvana. Vapaille nimikkeille ei keksitä saatavuutta.

Haku kattaa työn kuvauksen, laitenimen, sarjanumeron, sijainnin, linjan nimen/tunnisteen/sijainnin ja tarpeiden nimet. Useat hakusanat yhdistetään JA-ehdolla. Tilat, linja, laite, omat työt ja myöhässä olevat yhdistyvät. Kiireelliset työt järjestetään ensin, niiden sisällä määräajan mukaan; valmistuneet ovat viimeisin valmistuminen ensin. Kerralla näytetään 25 tulosta. Suodattimen vaihto palauttaa ensimmäiseen sivuun, eikä sivutus muuta tallennettuja tietoja.

Työn tiedot: kuvaus ja turvallisuus → Ota mukaan → työohje → valinnaiset valmistelutilat → saman laitteen aiemmat huollot → työn suorituspainikkeet. Turvallisuusohjeet ovat näkyvissä myös valinnaisen valmistelulistan ollessa suljettu. Rekisterihallinta, tilojen muuttaminen ja ohjeet säilyvät avattavina lisätietoina. Niitä ei tarvitse kuitata ennen valmistumista.

Saman laitteen valmistuneet huollot näkyvät uusimmasta alkaen. Kolme otsikkoa näytetään ensin ja lisää saa painikkeesta. Avaamalla otsikon näkee alkuperäisen työselosteen, käytetyt työkalut, osamäärät, todellisen ajan ja lisähuomiot nykyisellä MaintenanceHistory-komponentilla. Erilaiset työt nimetään selvästi saman laitteen historiaksi; samankaltaisuutta ei arvata. Kirjaukset eivät ole muokattavissa tässä näkymässä. Laitteen ja Huoltotutkan muut historiapolut säilyvät.

## Rajat ja varmennus

Sivutus rajoittaa DOM-rivejä; datalähde on edelleen olemassa oleva yrityksen snapshot. Uutta palvelinsivutusta ei ole, joten suurten yritysten siirtomäärä vaatii erillisen jatkotyön. Historialla tarkoitetaan snapshotin alkuperäisiä valmistuneita töitä, ei automaattisesti pääteltyjä ohjeita tai samankaltaisuusehdotuksia. Huoltotutkan palvelinhaku säilyy.

Automaattiset regressiot kattavat 120 työn sivutuksen, sivun palautumisen hakua muutettaessa, monisanahaun ja yhdistetyt rajaukset, asentajan oletuksen, katselijan kirjoitussuojan, mukaan otettavat tiedot sekä muuttumattoman historian ja saldot. Selaintesti käy 80 työn listan, haun, käsikirjan, alkuperäisen historian ja suunnitelman mukaisen kahden painalluksen valmistumisen neljässä näyttökoossa.

Koodin mukaiset toimimäärät: tarvittavien työkalujen/varaosien katsominen listalta 1 työn avaamisesta → 0 avaamista. Aiemman saman laitteen kirjauksen avaaminen työn sisältä 1 otsikon avaus; aiemmin erillinen laitteelle siirtyminen ja historian avaaminen. Valmistuminen työn tiedoista 2 painallusta ilman pakollista tekstisyöttöä PR #17:n esitäytöllä. Fyysisellä puhelimella tehtyä käytettävyystutkimusta ei ole tehty.

Huoltopyynnön tietomallia koskeva käyttäjän päätös on vielä avoin. Myöskään ID-pohjaista vastuuhenkilömuutosta tai automaattista historiasta oppimista ei toteuteta tässä PR:ssä.
