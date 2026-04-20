# Iltavahti Push Backend

Cloudflare Workers -pohjainen backend joka lähettää ajastettuja web-push
-muistutuksia Iltavahti-sovelluksen käyttäjille.

## Mitä tämä tekee

- `/subscribe` — käyttäjä rekisteröi push-subscriptionin ja nukkumaanmenoajan
- `/message` — service worker hakee tämän kun push saapuu
- Cron joka minuutti: käy kaikki tilaajat läpi ja lähettää pushin jos on
  erääntynyt muistutus (2h, 1h, 30min ennen nukkumaanmenoa tai aika)

## Setup askel askeleelta

### 1. Luo Cloudflare-tili

https://dash.cloudflare.com/sign-up — ilmainen, sähköposti + salasana.
Ei vaadi luottokorttia Workers/D1:n ilmaisiin rajoihin.

### 2. Asenna paikalliset työkalut

```bash
cd backend
npm install
```

Tämä asentaa `wrangler`-komennon paikallisesti.

### 3. Kirjaudu sisään

```bash
npx wrangler login
```

Tämä avaa selaimen, hyväksy pyydetty oikeus.

### 4. Luo D1-tietokanta

```bash
npx wrangler d1 create iltavahti-db
```

Output näyttää `database_id = "xxxxx"`. Kopioi ID ja korvaa
`REPLACE_AFTER_D1_CREATE` tiedostossa `wrangler.toml`.

### 5. Aja schema

```bash
npm run db:init
```

### 6. Generoi VAPID-avainpari

```bash
node scripts/generate-vapid.mjs
```

Se tulostaa kaksi base64url-merkkijonoa. Tallenna molemmat: public key
tarvitaan myös frontendissä.

### 7. Aseta salaisuudet Workersiin

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
# liitä skriptin tulostama PUBLIC

npx wrangler secret put VAPID_PRIVATE_KEY
# liitä skriptin tulostama PRIVATE

npx wrangler secret put VAPID_SUBJECT
# kirjoita: mailto:sinun@email.fi
```

### 8. Aseta CORS_ORIGIN

Muokkaa `wrangler.toml`:ssa `CORS_ORIGIN` PWA:n domainiksi, esim.
`https://kapesiv.github.io` (ei `/adhd` perään).

### 9. Deployaa

```bash
npm run deploy
```

Output näyttää URL-osoitteen muodossa
`https://iltavahti-backend.SINUN-SUBDOMAIN.workers.dev`. Kopioi tämä.

### 10. Konfiguroi frontend

Repon juuressa:

```bash
cp .env.example .env
```

Muokkaa `.env`:

```
VITE_PUSH_BACKEND_URL=https://iltavahti-backend.SINUN-SUBDOMAIN.workers.dev
VITE_VAPID_PUBLIC_KEY=<step 6:n PUBLIC>
```

Rakenna ja deployaa frontend GitHub Pagesiin kuten ennenkin.

### 11. Testaa

1. Avaa PWA puhelimessa (iPhonella: lisää kotiruutuun Safarissa)
2. Suorita onboarding
3. Paina "Tilaa push-muistutukset" idle-sivulla
4. Hyväksy notifikaatiolupa
5. Muuta nukkumaanmenoaikaa testattavaksi: esim. herätys 2 min päähän
   nykyhetkestä + 2h unta → bedtime nyt → pitäisi saada "now"-push
   seuraavan cronin aikana

## Debug

```bash
# Live logs (tail)
npx wrangler tail

# Paikallinen kehitys
npm run dev

# Tarkista D1:n tila
npx wrangler d1 execute iltavahti-db --command="SELECT * FROM push_subscriptions"
npx wrangler d1 execute iltavahti-db --command="SELECT * FROM delivery_log ORDER BY sent_at DESC LIMIT 10"
```

## Tärkeitä huomioita

- **iOS Safarilla** push toimii vain jos PWA on **lisätty kotiruutuun**
  (Jaa → "Lisää kotiruutuun"). Tämä on Applen rajoitus.
- **Notifikaation on oltava näkyvä** — SW on kutsuttava
  `showNotification` joka pushilla, muuten selain perui subscriptionin.
  Tämä on jo toteutettu.
- **Cron minimi = 1 min**. Muistutukset menevät ±30s sisällä oikeaan
  aikaan.
- **Ilmainen tier**: 100 000 requesta/päivä, D1 5GB tallennusta + 5M
  lukutietokantaa/päivä. Tämä riittää tuhansille käyttäjille.
- **Delivery log** kirjaa jokaisen yrityksen. Voit tarkistaa miksi push
  ei mennyt: `SELECT * FROM delivery_log WHERE success = 0`.
