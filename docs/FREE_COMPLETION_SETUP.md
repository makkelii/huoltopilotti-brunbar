# Vaihe 1: historian selkeytys ja vapaat kirjaukset

Työkalun voi kirjoittaa nimellä ja varaosan nimellä sekä positiivisella määrällä.
Yksikkö on valinnainen (oletus kpl). Rekisteristä valinta löytyy avattavasta osiosta.
Vapaakirjauksista ei synny rekisteririvejä, varastomuutoksia tai kulutustapahtumia.
Rekisteriosat kuluvat edelleen olemassa olevassa lukitussa transaktiossa.

Valmistuneen työn näkymä näyttää vain huollon tiedot. Teknisiä tunnisteita tai
raakoja aikaleimoja ei näytetä. Suomenkielinen aika näytetään Suomen aikavyöhykkeessä
(Europe/Helsinki); alkuperäinen aikaleima säilyy. Vanhaa historiaa ei päivitetä.
Puuttuva vanha nimi näytetään tekstillä ”Aiemmin kirjattu nimike” tai ”Ei kirjattu”.
Suorittajan tallennettua nimeä käytetään ensisijaisesti; jos historiassa on vain
sähköposti ja samalle suorittajatunnisteelle löytyy jäsenyydestä nimi, näytetään nimi.

## Tarvittava uusi migraatio

`supabase/migrations/202610200005_free_completion_usage.sql`.

Migraatio edellyttää aiempien 001–004 migraatioiden olevan jo käytössä. Niitä ei
ajeta uudelleen. Migraatio lisää validoivan RPC-kerroksen ja päivittää tulevien
historiatietueiden muodostusta. Vapaat kirjaukset tallentuvat `freeUsage`-taulukoksi
muuttumattomaan snapshotiin. Uusille historiatietueille tallennetaan myös laitteen
nimi. Rekisterien, jäsenyyksien, RLS-käytäntöjen tai olemassa olevan historian
sisältöön ei tehdä muutoksia.

Valmistuminen, vapaat kirjaukset, varaosakulutus ja seuraavan toistuvan työn luonti
onnistuvat tai peruuntuvat yhtenä transaktiona. Seuraavaan työhön ei kopioida edellisen
suorituksen vapaita kirjauksia. Kaksoistallennuksen estävät käyttöliittymän lukko ja
palvelimen revision sekä valmistumistilan tarkistus.

Vain omistajan hyväksynnän jälkeen: suorita uusi migraatio oikean projektin
Supabase SQL Editorissa ennen käyttöliittymän julkaisua. PR:n yhdistäminen tai sen
validate-workflow ei julkaise sivustoa tai suorita tuotantokannan migraatiota.
Ilman tätä migraatiota vapaakirjausten pysyvää palvelintallennusta ei tueta.
