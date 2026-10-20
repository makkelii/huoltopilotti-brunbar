# PR C – Tee sama huolto uudelleen

Pohja main e2ccb21. Valmistuneen työn painike avaa uuden suunnitelman nykyiseen
luontilomakkeeseen. Avaaminen tai peruuttaminen ei tee RPC-kutsua eikä luo tietueita.
Käyttäjä muokkaa nimeä, kuvausta, ohjeita, laitetta, määräaikaa, vastuuhenkilöä ja tarpeita.
Laite ja linja päätellään aktiivisesta nykyisestä rekisteristä; arkistoitua/puuttuvaa laitetta
varten valitaan toinen aktiivinen laite. Rekisteriä tai linjaa ei aktivoida kopioinnissa.

Tarpeet saavat uudet tunnisteet ja kuittaamattoman tilan. Puuttuva/käytöstä poistettu
nimike kopioidaan vapaana tarpeena näkyvällä varoituksella, jotta käyttäjä voi korvata sen.
Jos suunniteltuja tarvikkeita ei ollut, vanhan toteuman nimelliset rivit ovat erillisissä,
käyttäjän lisättävissä ehdotuksissa. Tuntemattoman nimikkeen UUID:ta ei käytetä nimenä.

Uudella työllä on uusi pysyvä luonnostunniste, nykyinen käyttäjä, tämän päivän määräaika,
planned-tila, tyhjä toteuma ja toisto oletuksena pois. Vanhaa suorittajaa, kuittauksia,
valmistumisaikaa, työaikaa, havaintoja, historia-/auditointi-/varastotapahtumia ei kopioida.
Toisto voidaan ottaa käyttöön tietoisesti tavallisessa lomakkeessa. Historian mahdollisesti
puuttuvia ohjeita ei päätellä toteumaselostuksesta.

Käytetään tavallista `private_mutate/job`-polkua: revisio, jäsenyys, yrityskohtaiset
viiteavaimet ja 009:n aktiivisuussuojaukset säilyvät. Katselijalle painiketta ei näytetä.
Suunnittelu ei kuluta saldoa tai muuta vanhaa työtä. Vanha historia säilyy ennallaan.

## Varmennus ja käyttöönotto

Lint, typecheck, build, verify:build, 128 Vitest-testiä, 90 integraatiotestiä,
PostgreSQL-testit ja 30 Playwright-testiä työpöytä/iPhone-profiileilla sekä 12
julkaisusuojaustestiä läpäisivät. Käytetään synteettistä dataa, simuloitua Supabasea ja
erillistä verkotonta PostgreSQL 16 -konttia, ei tuotantoa. Aiemmat kaksoistallennus-,
rooli-, tenant-, arkisto- ja kulutussuojaukset ajetaan myös tämän vaiheen testeissä.

Uutta migraatiota ei tarvita. Migraatioiden 001–009 on oltava käytössä. Tarkista PR,
kokeile uudelleenluonti ja peruutus testiympäristössä, yhdistä vasta käyttäjän päätöksellä.
Tuotantojulkaisua tai yhdistämistä ei tehdä tässä työssä. Frontendin palautus ei muuta dataa.
Seuraava PR D kohdistetaan tämän vaiheen haaraan, jos tätä PR:ää ei ole vielä yhdistetty.
