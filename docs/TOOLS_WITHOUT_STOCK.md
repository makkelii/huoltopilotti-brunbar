# Työkalut ilman saldoseurantaa

Työkalun saatavuus perustuu aktiiviseen rekisterimerkintään. Työkalun saldoa tai
varauksia ei käytetä huollon valmistumisen ehtona. Työkalua ei kuluteta eikä sen
lisäämisestä tai muokkaamisesta muodosteta varastotapahtumaa. Varaosien ja
kulutustarvikkeiden määrät, varaukset ja kulutuskirjaukset toimivat ennallaan.

Työkalujen quantity/reserved-kentät säilyvät yhteensopivuuden vuoksi. Vanhoja arvoja
tai huoltohistorian snapshot-tietoja ei muuteta. Uusi työkalu saa sisäisesti määrän
0; käytön valinta tallentuu nykyisellä RPC-sopimuksella actual-kenttään arvona 1.
Käyttö näkyy historiassa nimellä ja tunnisteella sekä merkinnällä ”Käytetty”.
Rekisterin inactive-valinta estää uuden käytön mutta säilyttää aiemman historian.
Yksittäiset tunnisteelliset työkalut voivat edelleen olla omia rekisteririvejään.

## Tuotantoon vienti – vain omistajan hyväksynnän jälkeen

Main-haarassa on jo PR #3:n työkalukorjaus. Täydentävä korjaus piilottaa myös
rekisterin yksikkökentän työkaluilta säilyttäen vanhan arvon, esittää raportissa
käytön muodossa ”Käytetty” ja estää vanhan `adjust_stock`-RPC:n käyttämisen
varastomuutokseen työkalulle. Raportti käyttää tallennettua historiatilannekuvaa,
jotta rekisterin myöhempi nimenmuutos ei muuta suorituksen työkalunimeä.

Migraatioiden järjestys hyväksynnän ja varmuuskopioinnin jälkeen:

1. Tarkista asennetut migraatiot. Älä suorita bootstrapia tai jo asennettuja
   migraatioita uudelleen. Aiemmat `core`, `private` ja `history_tenancy`
   -migraatiot ovat edellytyksiä.
2. Jos `202610200004_tools_without_stock.sql` ei ole vielä asennettu, suorita se
   ensin Supabasen SQL Editorissa. Se päivittää sisäisen valmistumis-/rekisteri-RPC:n
   niin, ettei aktiivisen työkalun käyttö riipu vanhasta saldosta tai varauksista.
3. Suorita uusi `202610200005_tool_stock_guard.sql`. Jos 004 on jo asennettu,
   tarvitaan vain 005. Se korvaa ainoastaan `adjust_stock`-funktion ja pitää sen
   roolirajoitukset, yritysrajauksen sekä lukitusjärjestyksen ennallaan. Työkalun
   oikaisuyritys palauttaa virheen, eikä saldoa, revisiota tai tapahtumalokia muuteta.
   Varaosan ja kulutustarvikkeen varastomuutokset toimivat edelleen.
4. Tarkista testiyrityksessä nollasaldoisen työkalun käyttö ja valmistuminen,
   historia sekä varaosan kulutus. Hyväksy frontendin manuaalinen julkaisu erikseen.

Kumpikaan migraatio ei lisää, poista tai muuta tauluja/sarakkeita eikä päivitä
olemassa olevia inventaario- tai historiatietorivejä. Vanhoja työkalujen saldoja ja
varastotapahtumia ei poisteta. Työkalun vanhoja sisäisiä määräarvoja ei näytetä
käyttäjälle. Uusia työkalujen varastotapahtumia ei muodosteta sovelluksen
rekisteri-, valmistumis- tai varasto-RPC:istä. Julkiseen selainkäyttöön kielletty
sisäinen varastofunktio säilyy kiellettynä.

SQL-tiedostot on ajettu vain erilliseen PostgreSQL-testikantaan. Tuotannon Supabasea
ei ole muutettu tai testattu tässä työssä. DNS-/Pages-asetuksia, 585.fi:tä tai
alkuperäistä Huolto-repositoriota ei muuteta. Uutta PR:ää ei yhdistetä eikä brunbar.fi:tä
julkaista automaattisesti.

## Tarkistukset

- Käyttöliittymä: työkalun lisääminen ilman määrää, nimikelajin vaihto ja rekisterin
  saldosarakkeiden piilotus työkalusuodattimella.
- Valinta: aktiivinen työkalu toimii myös määrällä 0 ja varauksilla 5.
- Domain: työkalun saldo säilyy; varaosa kuluu; käytöstä poistettu työkalu estetään.
- PostgreSQL: nollasaldoisen työkalun toistuva käyttö, ei varastotapahtumia,
  käytöstä poisto RPC:llä ilman määräkenttää, muuttumaton historia ja inactive-esto.
  Lisäksi nykyiset yrityseristys-, käyttöoikeus- ja samanaikaisuustestit.
- Selaintesti: palvelimelta haettava nollasaldoinen työkalu valitaan varaosan kanssa
  ilman määräkenttää; valmistumisen RPC-sopimus tarkistetaan.

Täydentävät testit tarkistavat myös vanhan työkalun muokkauksen ilman määrä- tai
yksikkökenttää, kalibroinnin/tunnisteen/sijainnin ja sisäisten arvojen säilymisen,
raportin muuttumattoman työkalunimen, suoran varasto-RPC:n työkalukiellon,
muuttumattoman revision/lokin hylätyssä kutsussa sekä varaosien ja kulutustarvikkeiden
saldo-oikaisujen, roolien ja yritysrajojen säilymisen.
