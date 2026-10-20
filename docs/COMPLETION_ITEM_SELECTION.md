# Huollon valmistumisen tuotevalinta

## Käyttö

1. Avaa huoltotyö ja valitse **Kirjaa valmistuminen**.
2. **Käytetyt varaosat ja tarvikkeet → Lisää** avaa haun vain varaosille ja kulutustarvikkeille. **Käytetyt työkalut → Lisää** hakee vain työkaluja.
3. Kirjoita vähintään kaksi merkkiä nimestä, tuotenumerosta, ulkoisesta tunnisteesta tai rekisterin UUID-tunnisteesta. Näet nimen, tuotenumeron ja tyypin. Varaosille näytetään käytettävissä oleva saldo: määrä miinus varaukset. Käytöstä poistetut tuotteet jätetään pois. Jo valittua tai saldoltaan käyttämätöntä tuotetta ei voi lisätä uudelleen.
4. Valittu varaosa/tarvike ilmestyy kompaktiin listaan. Muokkaa käytettyä määrää tai poista valinta roskakoripainikkeesta. Määrän on oltava positiivinen, ja desimaalit ovat sallittuja. Yksikkö tulee rekisterituotteelta ja näytetään määrän vieressä. Vanhoille tuotteille ilman yksikköä käytetään käyttöliittymässä kappaleyksikköä. Muuta rekisterin yksikkö ylläpitäjänä ennen kirjausta, jos tuote ei ole kappaletavaraa; valmistumisessa ei tehdä yksikkömuunnoksia tai anneta syöttää saldoon nähden ristiriitaista yksikköä.
5. Valittu työkalu merkitään käytetyksi. Käyttö tallentuu historiaan määränä yksi, mutta varastosaldo ei vähene. Valinnan voi poistaa ennen valmistumista.
6. **Suunnitellut tarvikkeet** on avattava viitelista. Niistä ei muodostu toteutunutta käyttöä ilman erillistä valintaa. Huollon voi valmistaa myös ilman käytettyjä tuotteita.
7. Kirjaa käytetty aika, tehdyt toimenpiteet ja tarvittaessa lisähuomiot. Vahvista valmistuminen. Lomakkeesta poistetut tuotteet eivät mene kulutuskirjaukseen.

Hakudialogiin siirrytään näppäimistöllä Lisää-painikkeesta. Kohdistus siirtyy hakukenttään. Tuloksiin ja sivutukseen pääsee Tab-näppäimellä ja tuloksen voi valita Enterillä. Escape sulkee vain haun ja palauttaa kohdistuksen avaavaan painikkeeseen. Tyhjä tila, lataus ja hakuvirhe kerrotaan myös ruudunlukijalle. Hakuvirheessä voi yrittää uudelleen menettämättä jo valittuja tuotteita. Suomen-, englannin- ja saksankieliset tekstit sisältyvät muutokseen.

## Haku ja tietoturva

Kirjautuneen käyttäjän haku käyttää Supabasen tavallista autentikoitua PostgREST-rajapintaa ja nykyisen `inventory`-taulun RLS-lukukäytäntöä. Jokaisessa kyselyssä on organisaatio-, tyyppi- ja aktiivisuusehto. Sivulla näytetään enintään 25 tuotetta; palvelimelta pyydetään 26 riviä seuraavan sivun tunnistamiseen. Järjestys on nimi + UUID, ja Edelliset/Seuraavat-painikkeet hakevat vain kyseisen sivun. Kirjoittamisen viive on 250 ms ja hakupituus enintään 100 merkkiä. Vanhentuneet pyynnöt perutaan ja niiden vastaukset ohitetaan. Hakuteksti lainataan PostgREST-suodattimeen, jotta se ei voi muuttaa hakuehtojen rakennetta. LIKE-merkit `%` ja `_` haetaan literaaleina; `*` on PostgRESTin tukema jokeri. Yritys- ja tyyppirajaus säilyy myös jokerihaussa.

Hakudialogia varten ei ladata koko varastoa eikä haun tarvitse luottaa aiempaan selainvälimuistiin. Sovelluksen nykyinen yleinen `private_snapshot` sisältää edelleen varastorekisterin muita näkymiä varten; sen koko sovelluksen laajuista sivutusta ei muutettu tässä PR:ssä. Demon haku toimii erillisellä paikallisella aineistolla, ja tulokset rajataan samoin sivuihin. Palvelinhaun suorituskyky todella suurissa aineistoissa kannattaa mitata ennen mahdollista erillistä trigram-/hakuehtoindeksointia; tässä muutoksessa ei lisätä tietokantarakenteita.

Valmistuminen käyttää edelleen vain `private_mutate`-RPC:n `complete`-operaatiota. Palvelin tarkistaa organisaation, roolin, revision, käytöstäpoiston ja todellisen varastotilanteen sekä tekee kulutuksen ja historiakirjauksen samassa transaktiossa. Selain ei tee suoria varastopäivityksiä. Kirjautuneessa tilassa ei enää tarvitse arvioida kulutusta mahdollisesti vanhentuneen selainlistan perusteella; vasta palvelimen vahvistama snapshot päivittää näkymän. Virheessä lomake jää auki eikä näytetä onnistumista tai yritetä kulutusta uudelleen automaattisesti.

## Käyttöönotto

- Tämä PR **ei lisää SQL-migraatioita**, muuta RLS-käytäntöjä tai edellytä uutta Edge Functionia tai Supabase-asetusta.
- Nykyisen main-version huoltohistoriomigraatio `202610200003_history_tenancy.sql` on aiemman PR:n edellytys. Jos sitä ei ole vielä asennettu, noudata erikseen [HISTORY_TENANCY_SETUP.md](HISTORY_TENANCY_SETUP.md)-ohjetta hyväksynnän ja varmuuskopioinnin jälkeen. Älä suorita vanhoja migraatioita tai bootstrapia uudelleen.
- Tarkista ja hyväksy tämä PR ennen yhdistämistä. Frontend julkaistaan nykyisellä manuaalisella brunbar-työnkululla vasta erillisellä julkaisuluvalla. DNS- tai Pages-asetuksia ei tarvitse muuttaa.
- Tarkista julkaistussa sovelluksessa haku, yhden osan ja työkalun valinta, määrän muokkaus, poisto, valmistuminen ja historian avaaminen testiyrityksessä.

Tuotantomigraatioita, tuotantokutsuja tai brunbar.fi-julkaisua ei tehty. Alkuperäiseen Huolto-repositorioon tai 585.fi:hin ei tehty muutoksia. Automaattiset selainkokeet käyttävät oikeaa SDK:ta mockatuilla HTTP-vastauksilla; tuotannon Supabase-hakua tai sen asetuksia ei tässä ympäristössä voitu testata.
