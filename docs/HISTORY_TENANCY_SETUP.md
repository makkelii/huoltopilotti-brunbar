# Huoltohistoria ja usean yrityksen tuki – turvallinen käyttöönotto

## Toteutus ja rajat

Laitteet → **Huoltohistoria** avaa vain kyseisen laitteen valmistuneet huollot, uusin ensin. Merkinnän avaaminen näyttää suoritetun työn. Valmistumiseen kirjataan tehdyt toimenpiteet muistiinpanokenttään, erilliset lisähuomiot, todellinen työaika sekä käytetyt työkalut ja osat määrineen. Työn kuvaus on erillinen suunnittelukenttä. Valmistumisajankohta ja kirjautunut suorittaja tulevat palvelimelta. Suunniteltu kesto ja toteutunut työaika pidetään erillään.

Jokainen suorituskerta on oma työ omalla UUID:llä sekä oma `maintenance_history`-tietue. Toistuvan työn valmistuminen luo seuraavan suunnitellun työn. Historiatietue sisältää muuttumattoman JSON-tilannekuvan työstä, vaatimuksista, todellisesta suorittajasta ja käytettyjen rekisteritarvikkeiden tiedoista. Yksikkö ja tuotenumero säilyvät siinä myöhempien muutosten jälkeen. Tietokantatriggerit estävät valmiin työn ja historian muokkauksen sekä poiston, myös tavallisella ylläpitäjän SQL-kutsulla. Historiaa luetaan Supabasesta jokaisessa uudessa istunnossa.

Varasto ja työkalut -näkymässä voi suodattaa työkalut, varaosat ja kulutustarvikkeet. Rekisteriin lisättiin yksikkö, ulkoinen tunniste ja käytöstäpoistomerkintä. Käytöstä poistettua tarviketta ei voi kirjata uuteen suoritukseen; vanha historia säilyy. Työkaluja ei kuluteta varastosta. Oma paikallinen osavarasto vähenee edelleen yhdessä huollon valmistumisen kanssa. `stock_movements` on erillinen kulutusloki. Ulkoista varastorajapintaa tai ulkoisen järjestelmän saldon muutosta ei toteutettu. `externalId` on varaus tulevaa integraatiota varten, ei toimiva synkronointi. Lainaus, työkalukohtainen historiaraportti ja tarkastuspäivien työnkulut ovat jatkokehitystä; kalibrointipäivän nykyinen kenttä säilyy.

Vanhoista huolloista ei voi palauttaa tallentamatta jäänyttä valmistumishetken nimeä, yksikköä tai todellista työaikaa. Migraatio säilyttää olemassa olevat tiedot ja merkitsee ne `legacyReconstructed`-lipulla. Käyttöliittymä näyttää tästä huomautuksen. Vanhojen kulutusrivien puuttuvien nimien sijasta näytetään tunniste, eikä nykyistä rekisterinimeä esitetä varmana historiallisena tietona.

## SQL-migraatiot – suorita vasta hyväksytyn PR:n jälkeen

Tuotantoon ei ole ajettu SQL:ää tästä työstä. Ota ensin Supabasen varmuuskopio ja testaa palautus-/PITR-valmius. Kokeile migraatiota projektin erillisessä testikopiossa.

1. Varmista, että `202610190001_core.sql` ja `202610190002_private.sql` on jo suoritettu. **Älä suorita niitä tai `private-bootstrap.sql`:ää uudelleen.** Nykyinen Brunbar-organisaatio, jäsenet ja tiedot jätetään ennalleen.
2. Tarkista avoimet kutsut: samaan sähköpostiin ei saa olla voimassa olevia kutsuja useaan yritykseen. Epäselvä kutsu estetään, ei hyväksytä sattumanvaraisesti.
3. Suorita vain uusi `supabase/migrations/202610200003_history_tenancy.sql` Supabasen SQL Editorissa ylläpitäjänä. Se on transaktio; virhe peruu sen. Migraatio ei ole uudelleenajettava. Se lisää sarakkeet, historiatilannekuvat ja suojaukset sekä korvaa julkiset RPC-kääreet säilyttäen vanhan transaktiologiikan sisäisinä funktioina. Sisäisten funktioiden suoritus ei ole sallittu selainrooleille.
4. Varmista RLS kaikissa tauluissa, myös uudessa `organization_access_settings`-taulussa. Sen oletus on **ei selainkäyttöä**. Tarkista `maintenance_history.snapshot` ja olemassa olevien jäsenyyksien lukumäärät.
5. Testaa erillisillä kahden yrityksen käyttäjillä: toisen yrityksen UUID:n syöttäminen RPC:lle on estettävä. Testaa myös REST-taulujen luku ja suora kirjoitus. Pelkkä käyttöliittymän toimivuus ei vahvista tätä.

Vanha selainversio voi yhä kirjata valmistumisen migraation jälkeen: jos todellista työaikaa ei lähetetä, se jää tuntemattomaksi eikä arvioitua kestoa esitetä toteutuneena aikana. Uusi versio vaatii käytetyn ajan lomakkeella. Tee frontend-päivitys pian migraation jälkeen ja varmista uuden version latautuminen. Migraation valmistuttua ei pidä palauttaa vanhaa SQL-versiota tai poistaa historiasaraketta.

## Yritykset ja kirjautuminen

Julkista rekisteröitymistä tai yrityksen luontia ei avata. Yksi jäsenyys valitaan automaattisesti käyttäjän Supabase-tunnisteella. Useita jäsenyyksiä omaavalle käyttäjälle vaaditaan täsmälleen yksi `memberships.is_default=true`; ilman sitä kirjautuminen pysähtyy selkeään jäsenyysvirheeseen. Osittainen yksilöllinen indeksi estää kaksi oletusjäsenyyttä. Selain ei saa muokata jäsenyyksiä suoraan. URL:sta tai localStoragesta ei lueta yritysvalintaa. Palvelimen RPC ja RLS tarkistavat aina todellisen jäsenyyden; oletus ei myönnä jäsenyyttä toiseen yritykseen eikä poista jo myönnettyjä jäsenyyksiä.

Tarvittaessa Supabasen ylläpitäjä määrittää oletuksen hallitussa transaktiossa (korvaa UUID:t):

```sql
begin;
update public.memberships set is_default=false where user_id='KAYTTAJAN_UUID';
update public.memberships set is_default=true
where user_id='KAYTTAJAN_UUID' and organization_id='OLETUSYRITYKSEN_UUID';
-- Varmista ennen commitia: täsmälleen yksi oletus ja oikea yritys.
commit;
```

Uusi yritys luodaan vain erikseen tarkistetulla ylläpitäjän SQL-menettelyllä: luo `organizations`-rivi ja omistajan `memberships`-rivi käyttäen jo varmennettua Auth-käyttäjätunnistetta. Älä muuta nykyistä `private_deployment`-riviä äläkä käytä vanhaa bootstrapia. Lisää uuden yrityksen UUID ja hyväksytty käyttäjäraja `organization_access_settings`-tauluun. Uuden yrityksen alkudata on tyhjä. Älä kopioi Brunbarin tai demon tietoja. Tämä ei luo käyttäjiä tai lähetä kutsuja automaattisesti.

Brunbar säilyttää nykyisen kahden käyttäjän rajan, ellei ylläpitäjä erikseen hyväksy sille asetusriviä. Muut yritykset saavat kutsua käyttäjiä vasta asetusrivin jälkeen. Nykyinen `invite-technician-brunbar`-Edge Function palvelee samalla brunbar.fi-alkuperällä kaikkia sallittuja yrityksiä; roolit ja kutsupaikat tarkistetaan tietokannassa. Funktiota tai Auth-redirect-asetuksia ei tarvitse muuttaa tämän PR:n vuoksi. Kutsu luo vain teknikon jäsenyyden varmennetulle sähköpostille. Sama sähköposti ei voi saada kahta päällekkäistä kutsua eri yrityksiin; olemassa olevan Auth-käyttäjän lisäjäsenyys vaatii ylläpitäjän tarkistuksen.

Asetuksissa omistaja voi muuttaa oman yrityksen muun jäsenen roolia. Ylläpitäjä voi hallita teknikko-/katselijarooleja, mutta ei myöntää ylläpitäjän oikeuksia. Omistajuuden siirto, oman roolin muutos ja jäsenen poistaminen on jätetty erilliseen ylläpitäjän menettelyyn: historialliset viiteavaimet estävät vaaralliset poistot. Roolimuutokset kirjataan audit-lokiin. Kutsujen manuaalinen peruminen on kuvattu PRIVATE_SETUP-ohjeessa; erillistä kutsulistan käyttöliittymää ei lisätty.

## Historian korjaukset ja tietosuoja

Valmistunutta tietuetta ei korjata tavallisella UPDATE/DELETE-kutsulla eikä poistamalla suojaustriggeriä. Jos suoritus on virheellinen, tee hyväksytty täydentävä huoltotapahtuma, jonka muistiinpano viittaa alkuperäisen työn UUID:hen ja kertoo korjauksen syyn, tekijän ja hyväksynnän. Jos tarvitaan virallinen korjausketju, toteuta erillinen vain lisättävä korjaustaulu ja hyväksyntä-RPC omana tarkistettuna migraationaan. Nykyinen tapahtuma pysyy todisteena. Henkilötietojen poistopyynnöt ja säilytysajat vaativat erillisen tietosuojatarkistuksen: käyttäjän poisto ei saa huomaamatta katkaista historiaa tai sen viiteavaimia.

## Julkaisu brunbar.fi:hin

1. Tarkista PR, testitulokset ja varmuuskopio. Hyväksy migraation ajo erikseen.
2. Tee yllä olevat SQL-tarkistukset ja migraatio. Tarkista omistajan sekä teknikon kirjautuminen, salasanan palautus ja olemassa oleva historia.
3. Yhdistä PR vasta hyväksynnän jälkeen. Käynnistä nykyinen manuaalinen brunbar-julkaisutyönkulku vasta erillisellä julkaisuluvalla. GitHub Pages-, DNS-, domain- tai 585.fi-asetuksiin ei tarvita muutoksia.
4. Varmista tuotannossa yhdellä sovitulla testihuollolla valmistuminen, uuden istunnon historia, osan määrä ja muuttumaton työkalutieto rekisterin muokkauksen jälkeen. Käytä testiyritystä, älä kuluta oikeita varaosia kokeiluna.
5. Jos frontendissa ilmenee virhe, palauta aiempi frontend-artefakti erillisellä hyväksynnällä. Säilytä tietokannan lisäykset ja historia; älä nollaa kantaa.

Tämän työn testit käyttävät mockattua Supabase-rajapintaa ja erillistä PostgreSQL 16 -testikantaa. Ne eivät osoita tuotannon Supabase-projektin, SMTP:n tai sähköpostitoimituksen toimivuutta. Tuotantoon ei ollut tässä työssä Supabase-yhteyttä.
