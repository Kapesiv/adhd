# ADHD-app: Tausta ja periaatteet

Tämä dokumentti kuvaa KENELLE tätä sovellusta tehdään,
MIKSI olemassa olevat ratkaisut eivät toimi, ja MILLÄ
PERIAATTEILLA tämä sovellus eroaa muista.

Kaikki tekniset päätökset pitää arvioida tätä vasten.

## Kenelle

Sovellus on suunniteltu ihmisille joilla on VAIKEA ADHD ja
erityisesti näitä oireita:

- Ilta venyy tuntikausia yli nukkumaanmenoajan, ilman että
  ihminen itse huomaa ajan kuluvan.
- "Revenge bedtime procrastination" – tunne että ilta on
  ainoa oma aika, joten sitä ei haluta päästää menemään.
- Hyperfocus illalla: peli, YouTube, Reddit, työ vie niin
  että klo 3 aamulla on ensimmäinen pysähdys.
- Koko yön valvominen – joskus iltarytmin katkeaminen johtaa
  siihen että ihminen ei saa enää unta ollenkaan ennen työpäivää.
- Aamuherätys on kaaos: ei kuule herätystä, nukkuu läpi,
  herää kun pomo soittaa.
- TÄMÄN SEURAUKSET OVAT OIKEITA: toistuva myöhästyminen
  aiheuttaa varoituksia, irtisanomisia, taloudellista
  katastrofia. Käyttäjä elää pelossa että menettää työpaikan
  omien aivojensa takia.

Tämä ei ole "ADHD-henkilö joka välillä valvoo liian myöhään".
Tämä on ihminen jonka elämä järkkyy koska aivot eivät anna
mennä nukkumaan.

## Mikä ADHD-aivoissa vaikeuttaa nukkumaanmenoa

Nämä ovat neurologisia mekanismeja, ei "laiskuutta":

1. **Time blindness / ajantajun puute**: Aika on joko "nyt"
   tai "ei nyt". Kellonaika 23:00 ja 02:00 tuntuu samalta.
   Kolme tuntia voi kulua tuntuen 20 minuutilta.

2. **Hyperfocus**: Kun aivot löytävät stimulaatiota (peli,
   video, mielenkiintoinen aihe), dopamiinijärjestelmä lukitsee
   huomion. Irtautuminen on fyysisesti vaikeaa – kuin yrittäisi
   lopettaa syömästä kesken nälkäkohtauksen.

3. **Dopamiinin puute & iltainen "herkistyminen"**: Monella
   ADHD-ihmisellä dopamiini on alhaalla, ja ilta on ainoa
   aika jolloin aivot saavat sitä (ei työvelvoitteita, saa
   tehdä mitä haluaa). Nukkuminen tuntuu "luovuttamiselta".

4. **Executive function -häiriö**: Toimeenpanofunktiot
   (aloittaminen, lopettaminen, vaihtaminen) ovat heikkoja.
   Vaikka ihminen TIETÄÄ että pitäisi mennä nukkumaan, aivot
   eivät tee sitä toiminnaksi.

5. **Revenge bedtime**: Tietoisesti tai tiedostamatta ihminen
   pidentää iltaa koska kokee että päivällä ei ollut omaa aikaa.
   Uni koetaan ajan "varastamisena".

6. **Sisäinen kello häiriintynyt**: Monella ADHD:lla on
   myöhästynyt uni-valverytmi (DSPS) – aivot eivät tuota
   melatoniinia "normaaliin" aikaan.

7. **Habituaatio**: ADHD-aivot suodattavat pois toistuvat
   ärsykkeet POIKKEUKSELLISEN NOPEASTI. Herätyskello,
   muistutus, punainen ikoni – kaikki katoaa taustakohinaan
   muutamassa päivässä.

## Miksi olemassa olevat ratkaisut eivät toimi

**To-do-listat ja kalenterit**: Olettavat että käyttäjä muistaa
katsoa niitä. ADHD:lla työmuisti on heikko, joten ne unohtuvat.

**Pomodoro-ajastimet ja nukkumaanmenomuistutukset**: Yksi
notifikaatio joka näytetään, vilkaistaan ja unohdetaan.
Habituaatio tappaa tehon viikossa.

**Herätyskellot (standard)**: Yksi soitto, jonka voi nukkuen
sammuttaa. Jos käyttäjä nukahti vasta klo 4, yksi herätys
klo 7 ei herätä.

**Sleep tracker -sovellukset**: Seuraavat unta mutta eivät
puutu käyttäytymiseen. Data ilman toimintaa.

**Focus/blokkausappit (Cold Turkey, Freedom yms)**: Estävät
sivustoja, mutta käyttäjä voi aina vaihtaa laitteeseen,
puhelimeen, tablettiin. Eivät osaa sopeutua tilanteeseen.

**Sleep hygiene -neuvot**: "Älä katso ruutua ennen nukkumaan
menoa", "pidä säännöllinen rytmi". Nämä neuvot olettavat että
aivot toimivat normaalisti. Eivät toimi.

## Mitä vaaditaan että oikeasti toimisi

Nämä ovat sovelluksen ehdottomat suunnitteluperiaatteet:

### 1. Anti-habituaatio: muutu, älä toistu
- Sama varoitus joka ilta = katoaa viikossa aivoista
- Interaktiot, värit, elementtien järjestys ja sisällöt
  satunnaistetaan
- "Ennustettavuus on kuolema" tälle tuotteelle

### 2. Pakotettu aktiivinen toiminta
- Ei "OK"-nappeja jotka voi klikata nukkuen
- Vaadi kirjoittamista, raahaamista, valintaa kolmesta
- Mikä tahansa joka vaatii AJATUKSEN, ei vain motorista toimintoa

### 3. Henkilökohtaisuus
- Geneerinen teksti ei tehoa
- Käyttäjän oma ääni, oma kuva, omat sanat "illan itselle"
- Aamu-Minä kirjoittaa viestejä Ilta-Minulle

### 4. Ulysses-sopimus (itsestä sitoutuminen)
- Aamulla käyttäjä päättää illan säännöt
- Illalla sääntöjä on vaikea peruuttaa (60s viive + varoitus)
- Hyödynnä kontrastia: virkeä Kasperi suojelee väsynyttä
  Kasperia

### 5. Portaittainen intensiteetti
- Älä pakota alusta asti – se opettaa kiertämään
- Aloita lempeästi, kovene ajan myötä
- Neljä tasoa: gentle → warning → urgent → overdue

### 6. Seurausten näkyväksi tekeminen
- ADHD-aivot unohtavat abstraktit seuraukset
- Näytä konkreettisesti: "Jos saat potkut, menetät X, Y, Z"
- Käyttäjän omat kuvat ja tekstit, EI pelottelua

### 7. Sosiaalinen ulottuvuus (valinnainen, mutta tehokas)
- Tukihenkilö saa viikkoraportin automaattisesti
- Ei salassa: käyttäjä on ITSE valinnut tämän
- Tieto että joku toinen tietää = tehokkain motivaattori

### 8. Hätäuloskäynti
- Joka ilta ei voi mennä nukkumaan ajoissa (kriisit, lapset,
  töitä)
- "Tämä ilta on poikkeus" -toiminto, kirjoitetaan syy
- MUTTA: yli 2x/viikko -> sovellus varoittaa

### 9. Ei syyllistämistä
- Sovellus ei KOSKAAN sano että käyttäjä epäonnistui
- "Olet hukkatapaus" -viestit tuhoavat ADHD-ihmisen
  itsetunnon nopeammin kuin mikään muu
- Sen sijaan: "Tämä ilta meni näin, huomenna uusi yritys"

### 10. Käyttäjä voi AINA nähdä mitä sovellus tekee
- Ei piilotettuja esto-algoritmeja
- Ei "sinulle parhaaksi" -paternaliteettia
- Käyttäjä hallitsee kaikkea, sovellus vain pakottaa
  VALITTUJEN sääntöjen noudattamista

## Tärkein yhteenveto

Tämä sovellus ei ole "yet another productivity app". Se on
**käyttäjän itsensä kanssa tehty sopimus** jonka sovellus
vain valvoo. Aamu-käyttäjä päättää säännöt. Ilta-käyttäjä
ei voi niitä helposti perua. Sovellus on tämän sopimuksen
ruumiillistuma.

Jokainen ominaisuus pitää arvioida kysymyksellä:
"Auttaako tämä oikeasti ihmistä jonka työpaikka on vaarassa
koska aivot eivät anna mennä nukkumaan – vai onko tämä
vain sympatianumero?"

Jos ominaisuus ei läpäise tätä testiä, sitä ei tehdä.
