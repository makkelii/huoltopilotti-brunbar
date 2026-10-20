# C → D → F → E: tarkistus ja käyttöönotto

Kaikki vaiheet ovat erillisiä, edeltäjän haaraan perustuvia PR:iä:

| Vaihe | PR | Base | Migraatio |
|---|---|---|---|
| C: huollon uudelleenluonti | [#12](https://github.com/makkelii/huoltopilotti-brunbar/pull/12) | main | ei |
| D: historian tietopankki | [#13](https://github.com/makkelii/huoltopilotti-brunbar/pull/13) | feat/repeat-maintenance | 202610200010_history_knowledge_base.sql |
| F: lopullinen rekisteristä poistaminen | [#14](https://github.com/makkelii/huoltopilotti-brunbar/pull/14) | feat/history-knowledge-base | 202610200011_registry_retirement.sql |
| E: työnkulkujen viimeistely | feat/workflow-polish (oma PR) | feat/registry-retirement | ei |

## Hyväksytty käyttöönotto myöhemmin

1. Tarkista ja yhdistä C → D → F → E. Päivitä aina seuraavan stacked PR:n base mainiin edeltäjän yhdistyttyä ja varmista, että diff sisältää vain kyseisen vaiheen. Squash/rebase-yhdistäminen voi vaatia seuraavien haarojen rebasen; älä yhdistä edeltäviä committeja uudelleen vahingossa.
2. Varmista lähtöskeema 001–009. Testaa tuotantokopiota vastaavassa erillisessä ympäristössä päivitys ensin `202610200010_history_knowledge_base.sql`, sitten `202610200011_registry_retirement.sql`. Älä muokkaa tai suorita uudelleen vanhoja migraatioita.
3. Ota normaali varmistus, arvioi backfillin lukot/kesto todellisella tietomäärällä ja sovi ajankohta. Suorita tuotantomigraatiot vain käyttäjän erillisellä hyväksynnällä. D:n backfill muuttaa vain johdettua hakuindeksiä. F lisää tilamerkinnät ja RPC-suojaukset; se ei poista olemassa olevia kohteita automaattisesti.
4. Julkaise frontend vasta tarvittavien migraatioiden jälkeen erikseen hyväksyttynä. Tämä toimeksianto ei käynnistä julkaisuworkflow'ta, muuta Pages-/DNS-asetuksia tai yhdistä PR:iä.
5. Hyväksytyssä tuotannon smoke-tarkistuksessa käytä erillistä testiorganisaatiota: kirjautuminen, linja/laite, vapaa kirjaus, suunnitelma vs. toteuma ja saldo, historia, uudelleenluonnin peruuttaminen/tallennus, tietopankkihaku ja roolien mukaiset toiminnot. Testaa arkistointi/palautus/poisto vain tarkoitukseen luodulla testikohteella; varmista historian löytyminen sen jälkeen.

## Riskit ja palautus

- Migraatio 010 tarvitsee riittävästi aikaa koko historian indeksointiin. Synteettinen 5 000 tietueen testi ei ole tuotantomittakaavan suorituskykytakuu. Vanha koko snapshotin lataus on edelleen käytössä muissa näkymissä.
- Ennen 010:tä puuttuvia tapahtumahetken sijoituksia/tunnisteita ei voi päätellä luotettavasti; käyttöliittymä kertoo puuttuvasta historiallisesta metatiedosta.
- 011:n poisto on palautumaton rekisteritoiminto. Historiaa varten säilyvät fyysiset ankkurit ja viitteet; niitä ei saa hävittää migraation palautuksella. Vanhan frontendin palautus pitää arvioida erikseen, koska vanha asiakas ei tunne poistotilaa. Säilytä palvelimen 011-suojaukset ja vältä vanhaa snapshot-muunnosta.
- 011 kiristää myös vanhojen fyysisten tyhjän tietueen poistokutsujen ehtoja. Päivitä asiakas ennen tämän toiminnon käyttöä.
- Selainvarmennus kattaa neljä emuloitua kokoa Chromiumilla; fyysinen iOS/Safari kannattaa tarkistaa ennen laajaa käyttöönottoa.

Vaihekohtaiset toteutus- ja palautusrajat: `REPEAT_MAINTENANCE.md`, `KNOWLEDGE_BASE.md`, `REGISTRY_RETIREMENT.md`, `EXPERIENCE_AUDIT.md`.

Tuotantomigraatioita, julkaisuja ja yhdistämisiä ei ole tehty.
