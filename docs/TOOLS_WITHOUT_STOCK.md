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

Tarvitaan vain uusi migraatio:
`supabase/migrations/202610200004_tools_without_stock.sql`.
Se korvaa nykyisen sisäisen private_mutate_v2-funktion. Julkinen private_mutate
säilyttää käyttöoikeustarkistukset, inactive-tarkistuksen ja historian tallennuksen.
RLS-käytäntöjä, vanhoja migraatioita tai bootstrap-skriptejä ei muuteta eikä ajeta
uudelleen tuotannossa. Migraatio ei päivitä tai poista nykyisiä tietorivejä.

Hyväksynnän jälkeen aja ainoastaan uusi migraatio oikean Supabase-projektin SQL
Editorissa ennen käyttöliittymän julkaisua. Ilman migraatiota vanha palvelin estää
nollasaldoisten työkalujen käytön. Julkaisua, PR:n yhdistämistä tai tuotantokannan
migraatiota ei ole tehty osana kehitystyötä.

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
