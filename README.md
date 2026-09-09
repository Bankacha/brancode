# Shelf Price Scanner

## Kako postaviti online (GitHub + Vercel)

### 1. Napravi novi repozitorijum na GitHub-u
- Idi na github.com → **New repository**
- Nazovi ga npr. `shelf-price-scanner`
- Ostavi ga privatnim ako želiš (nije javna prodavnica podataka, samo aplikacija)
- Klikni **Create repository**

### 2. Otpremi ovaj kod na GitHub
Na svom računaru, otpakuj ovaj zip fajl u folder, zatim u terminalu unutar tog foldera:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TVOJ-USERNAME/shelf-price-scanner.git
git push -u origin main
```

(Zameni `TVOJ-USERNAME` tvojim GitHub korisničkim imenom.)

### 3. Poveži sa Vercel-om
- Idi na vercel.com → **Add New → Project**
- Izaberi repozitorijum `shelf-price-scanner`
- Vercel će automatski prepoznati da je Vite/React projekat — ne treba ništa menjati
- Klikni **Deploy**

Za 1-2 minuta dobićeš pravi link (npr. `shelf-price-scanner.vercel.app`) koji radi na telefonu, sa kamerom i pravim preuzimanjem fajlova.

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
