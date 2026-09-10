# Shelf Price Scanner

## Kako postaviti online (GitHub + Vercel)

### Upload sa telefona (bez terminala)

GitHub mobilna app/sajt obično ne dozvoljava da odjednom prevučeš celu fasciklu — samo pojedinačne fajlove. Trik je da prvo "uđeš" u `src` folder tako što napraviš jedan fajl tamo, pa onda ostale uploaduješ dok si već unutar tog foldera:

1. U repozitorijumu klikni **Add file → Create new file**
2. Za naziv fajla upiši **`src/main.jsx`** (sa kosom crtom — GitHub će sam napraviti `src` folder) i nalepi sadržaj `src/main.jsx` iz zipa. **Commit new file.**
3. Sad klikni na `src` folder da uđeš u njega. Tu klikni **Add file → Upload files** i izaberi `App.jsx` i `supabaseClient.js` iz raspakovanog zipa (ova dva zajedno, jer si već unutar `src` foldera, tako i ostaju).
4. Vrati se na koren repozitorijuma (klikni ime repozitorijuma pri vrhu). Tu klikni **Add file → Upload files** i izaberi `package.json`, `vite.config.js`, `index.html`, `README.md` — ovi idu u koren, van `src` foldera.

Na kraju struktura treba da izgleda:
```
package.json
vite.config.js
index.html
README.md
src/
  main.jsx
  App.jsx
  supabaseClient.js
```

### Upload sa računara (lakše, ako imaš pristup)
- Otpakuj zip u folder
- Na github.com otvori repo → **Add file → Upload files**
- Prevuci ceo sadržaj foldera (uključujući `src` fasciklu) — desktop browser ovo ispravno prepoznaje i zadrži strukturu

### Vercel
Ako je repo već povezan sa Vercel-om, svaki push/commit automatski pokreće novi build — ne treba ništa dodatno da radiš na Vercel strani.


### Lokalno testiranje (opciono, pre postavljanja online)
```bash
npm install
npm run dev
```
Otvori link koji terminal ispiše (obično `http://localhost:5173`).

## Šta dalje treba doraditi
- Prava baza proizvoda (uvoz iz kase) umesto ručnog dodavanja
- Tvoj pravi Excel template za štampu
- Automatsko slanje mejla (ako želiš, umesto ručnog preuzimanja i deljenja fajla)
