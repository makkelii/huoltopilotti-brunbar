# Vaihe 2: navigaatio ja lomakkeet

Tämä PR rakentuu historian ja vapaiden kirjausten PR:n päälle. Se ei lisää
Supabase-migraatiota. Vaiheen 1 migraatio 202610200005 tarvitaan edelleen.

- Etusivu, Huoltotyöt, Laitteet ja Huoltotutka muodostavat päätoiminnot.
- Varaosat ja työkalut näkyvät selvästi valinnaisena rekisterinä.
- Huoltopohjat ja raportit löytyvät hallinnan ryhmästä. Asetukset ja käyttäjähallinta
  säilyvät nykyisellä paikallaan. Olemassa olevat URL-fragmentit toimivat edelleen.
- Asentajan oletusnäkymä on Huoltotyöt ja Omat työt -suodatin. Suodattimen voi
  poistaa, jolloin myös yrityksen muut työt ovat nähtävissä nykyisten oikeuksien mukaan.
  Tämä on näkymäsuodatin; se ei muuta käyttöoikeuksia tai RLS:ää.
- Uusissa laite- ja työrekisterilomakkeissa perustiedot ovat ensin, harvemmin
  tarvittavat tiedot avautuvat Lisätiedot-kohdasta. Suljetut kentät ovat edelleen
  osa lomaketta, joten tallennus säilyttää vanhat arvot.
- Nimikelomakkeessa työkalulle ei kysytä määrää tai yksikköä. Kalibrointi,
  tunnisteet, valmistaja ja käytöstä poisto ovat saatavilla Lisätiedot-kohdasta.
- Tuotantotilassa ei esitetä demotilan korttia. Tietokannan sisäiset tunnisteet
  eivät näy myöskään nimikehaussa tai huoltotutkan tuloksissa.
- Raporttien tarkemmat huoltotiedot avautuvat pyynnöstä ja käyttävät samaa
  historian esitystapaa kuin laitteelta avattu huolto.

Tarkistukset kattavat asentajan omien/kaikkien töiden näkymän, lisäkenttien arvojen
säilymisen, nimikelomakkeen käytön mobiilissa, aiemmat toiminnot ja vaiheen 1
kirjaukset. PR:tä ei yhdistetä eikä julkaista ilman omistajan hyväksyntää.

Yhdistämisjärjestys: ensin vaiheen 1 PR, sitten tämä PR main-haaraan. Tässä PR:ssä
base on toistaiseksi vaiheen 1 kehityshaara, jotta katselmoinnissa näkyy vain
navigaatio- ja lomakemuutos.
