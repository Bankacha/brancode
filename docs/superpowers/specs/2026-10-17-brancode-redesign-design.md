# Brancode redizajn („Pijaca“) — dizajn

Datum: 2026-10-17 · Grana: `redesign` · Handoff: [`docs/design/redesign-handoff/`](../../design/redesign-handoff/README.md)

## Cilj

Novi izgled i nekoliko promena toka po handoff-u „Pijaca“. Cilj je brži rad jednom rukom na telefonu u radnji: manje tapova po artiklu, skeniranje u nizu, i manje grešaka u štampi zahvaljujući pregledu pre slanja.

Postojeća logika ostaje ista, osim promena navedenih ovde: Supabase, Excel izlaz, slanje mejla i uvoz lifleta.

Handoff je izvor za vizuelne detalje: tokene, mere, tekstove i izgled ekrana 01–09. Ovaj dokument ga ne ponavlja. Beleži odluke, odstupanja od handoff-a i tehnički pristup. Gde se razlikuju, važi ovaj dokument.

## Odluke

1. **Telefoni:** aplikacija mora da radi na Androidu i iPhonu. U radnji su danas samo Android telefoni, ali aplikacija treba da bude spremna i za druge radnje.
2. **Čitač barkoda:** na Androidu ostaje ugrađeni `BarcodeDetector`, a na iPhonu zxing (wasm), koji je deo aplikacije. Na Androidu se oba porede i zadržava se bolji. Podešavanja kamere se popravljaju (rezolucija, fokus, izbor sočiva), jer je verovatni uzrok slabog hvatanja mutna slika.
3. **Excel izlaz se ne menja.** Pregled štampe prati njega, a ne stil cenovnika iz mocka (Bricolage, male decimale gore).
4. **Pregled štampe nije presudan.** Ako se pokaže da ne odgovara printu, A4 pregled i mali pregled cenovnika se izbacuju. Izbor formata i dugmad Pošalji i Excel ostaju.
5. **„Nije u bazi“:** čuvanje takvog artikla iz izmene ga upisuje u bazu i prebacuje u „Spremno“. Liflet sam ne upisuje ništa novo.
6. **Lista:** dugi pritisak (oko 500 ms) otvara izmenu, a X uklanja red. To važi u obe grupe. Tap na red ne radi ništa. Redovi „Za proveru“ imaju X umesto strelice `>`.
7. **Stilovi:** Tailwind v4, koji podržava iOS 16.4+ (iPhone 8 i noviji).
8. **Navigacija:** React Router (`BrowserRouter` + `Routes`, bez framework režima).
9. **Logo:** novi znak („Nišan“, 3c) ide na sve PWA ikonice, uz novu maskable ikonicu.
10. **Više radnji** nije deo ovog posla. Redizajn samo ne sme da zakuca ništa novo što bi to otežalo.

## Obim

**Ulazi:**
- ekrani 01–09;
- promene toka: skeniranje u nizu, izmena posle skeniranja, dugi pritisak, pregled štampe sa izborom formata, statusi;
- novi čitač i podešavanja kamere;
- logo i ikonice;
- Tailwind, React Router i podela koda;
- Vitest za `lib/`.

**Ne ulazi:**
- više radnji;
- izmene Excel izlaza;
- izmene šeme baze ili RLS-a;
- izmene `api/send-email.js`.

## Faze

Sve faze idu na granu `redesign`, sa commit-ovima po fazama i jednim PR-om na `main` na kraju. Posle svake faze aplikacija radi i može se isprobati na telefonu preko Vercel preview linka, koji koristi pravu bazu. Između faza izgled sme biti mešovit, jer je to samo na grani.

1. **Temelj:**
   - Tailwind i tokeni;
   - fontovi kao npm paketi;
   - React Router sa postojećim ekranima i `vercel.json`;
   - podela `App.jsx` na `screens/`, `sheets/`, `components/` i `lib/`;
   - Vitest;
   - logo, ikonice i manifest;
   - ažurirani `CLAUDE.md` i `.claude/rules/`.

   Ponašanje ostaje kao danas. Stari ekrani privremeno zadržavaju inline stilove (stare konstante idu u `lib/legacyTheme.js`, koji se briše na kraju faze 4).
2. **Početna i lista:** 01, 02, meni, 07, 08 i 09.
3. **Pregled štampe:** `PriceTag`, raspored u `lib/priceTags.js` i ekran 06.
4. **Skeniranje:** `lib/scanner.js`, ekrani 03, 04 i 05, poređenje čitača.

## Arhitektura

### Stilovi i fontovi

- **Tailwind v4:** preko `@tailwindcss/vite`. Tokeni iz handoff-a (boje, fontovi, zaobljenja, senke) definišu se jednom, u `src/index.css` u bloku `@theme`. U komponentama nema hex vrednosti ni inline stilova. Izuzetak su vrednosti izračunate u toku rada, kao dimenzije cenovnika u pregledu.
- **Fontovi:** Bricolage Grotesque, DM Sans, DM Mono i Oswald (za pregled cene), kao fontsource paketi. Ulaze u build i rade bez interneta. Učitavanje IBM Plex fonta sa Google Fonts se uklanja.
- **Pritisnuto dugme:** `active:scale-[.97]`, oko 100 ms.
- **Animacije:** sheet ulazi odozdo za oko 250 ms (ease-out), a pozadina se postepeno pojavljuje.
- **Računar:** sadržaj je u centriranoj koloni širine do 480 px.

### Struktura

```
src/
  main.jsx
  index.css            Tailwind + @theme tokeni
  App.jsx              rute, zajedničko stanje, otvoreni sheet, statusi
  auth/                AuthGate (samo provera prijave), Login
  screens/             Home, Scan, ManualEntry, PrintPreview
  sheets/              BottomSheet (zajednički), Edit, LeafletImport, ConfirmClear, Menu
  components/          PriceTag, Toast, Field, Button, Logo
  lib/
    priceTags.js       PRICE_TAG_STYLES, raspored po stranama, buildWorkbookBuffer
    products.js        pretraga (barcodeCandidates) i čuvanje u Supabase
    printQueue.js      lista za štampu u localStorage (ključ `print-queue`, isti oblik kao danas)
    scanner.js         kamera + čitač
    email.js           slanje mejla
    format.js          prikaz i parsiranje cene (sr-RS)
  promoLeaflet.js      kao danas + onProgress(strana, ukupno)
```

`barcodeCandidates` prelazi u `lib/products.js`, a `promoLeaflet.js` ga uvozi odatle.

### Rute i istorija

| Adresa | Ekran |
|---|---|
| `/` | početna i lista (02) |
| `/skeniranje` | kamera (03) |
| `/rucni-unos` | ručni unos (05) |
| `/pregled` | pregled štampe (06) |

- **Prijava** nije ruta: `AuthGate` pokazuje `Login` dok ne postoji sesija.
- **Sheet-ovi** nemaju adrese, ali pri otvaranju upisuju korak u istoriju (`history.pushState`). Sistemsko „nazad“ zato prvo zatvara sheet, pa tek onda vraća na prethodni ekran.
- **`vercel.json`:** sve adrese osim `/api/*` vraćaju `index.html`. Service worker već isključuje `/api/` iz navigacionog fallback-a.

### Stanje

Bez biblioteke za stanje.

- **`App`** drži listu (preko `printQueue`), otvoren sheet i trenutni status (toast).
- **Izabrani format** (`shelf | fridge | fruit`) pamti se na uređaju pod ključem `print-format`, a podrazumevan je `shelf`.
- **Sesija skeniranja** (`count`, `lastItem`) živi u ekranu za skeniranje i resetuje se kad se kamera zatvori.
- **Odjava i email** korisnika prelaze iz `AuthGate` u meni „…“.

## Ekrani i tokovi

### 01 · Prijava

Prijava je po handoff-u. Greška se prikazuje samo posle neuspele prijave.

### 02 · Početna i lista

- **Zaglavlje:** „brancode“ levo. Desno su dugmad za uvoz lifleta i meni „…“.
- **Tamna kartica:**
  - Gore piše „N cenovnika“, a ispod „M traže proveru pre štampe“. Kad je M = 0, piše „Sve je spremno za štampu“.
  - „Pregled“ vodi na `/pregled` i onemogućeno je kad je lista prazna.
- **Grupe:**
  - „Za proveru · nije u bazi“ (`notInDb`) pojavljuje se samo kad postoji. Redovi su na danger-bg, sa X.
  - „Spremno · N“ ima link „Obriši sve“ (otvara 08).
- **Red:** naziv, barkod, cena u formatu sr-RS („1.249,99“) i X.
  - Dugi pritisak od oko 500 ms otvara izmenu (04), uz `navigator.vibrate(10)` gde postoji. Pomeranje prsta otkazuje dugi pritisak (skrol).
  - Sistemski meni i selekcija teksta su isključeni na redovima.
- **Uklanjanje:** X odmah uklanja red i prikazuje status „Uklonjeno: <naziv>“ sa „Vrati“, oko 4 s. „Vrati“ vraća red na isto mesto.
- **Donja traka:** ručni unos (`/rucni-unos`), „Skeniraj“ (`/skeniranje`) i štampa (`/pregled`, onemogućeno kad je lista prazna). Lista ima donji padding da je traka ne pokrije.
- **Prazno stanje:** kartica „0 cenovnika“ i tekst „Skeniraj prvi artikal“.

### Meni „…“

Meni nije dizajniran. To je sheet sa:
- emailom prijavljenog korisnika;
- „Obriši listu“ (otvara 08, onemogućeno kad je lista prazna);
- „Odjavi se“.

U fazi 4 privremeno dobija i izbor čitača (ugrađeni ili zxing), koji se uklanja posle poređenja.

### 07 · Uvoz lifleta

1. Dugme odmah otvara izbor fajla, bez prethodne potvrde. Fajl se bira sinhrono u click handler-u.
2. Dok se fajl čita, prikazuje se status „Čitam liflet… strana X / Y“, preko `onProgress` iz `parseLeafletPdf`.
3. Zatim se otvara sheet: „Pročitano N artikala“, ime fajla i dve kartice („u bazi, cena se ažurira“ i „nisu u bazi, samo u listu“).
   - Info blok „Trenutna lista (K) biće zamenjena…“ prikazuje se samo kad lista nije prazna.
   - Dugme glasi „Zameni listu i uvezi“, a kad je lista prazna „Uvezi u listu“.
4. Logika uvoza ostaje kao danas. PDF se ne šalje nikuda.

### 08 · Potvrda brisanja

Po handoff-u. Briše se samo lista na telefonu.

### 09 · Statusi

- **Prikaz:** iznad donje trake, jedan po jedan, a noviji zamenjuje stariji.
- **Uspeh** nestaje posle oko 2,5 s.
- **Greška** ostaje dok se ne reši ili zatvori, sa akcijom:
  - „Ponovi“ ponavlja neuspelu operaciju;
  - „Upiši ručno“ vodi na `/rucni-unos`.
- **Učitavanje** je tamno, sa napretkom u DM Mono.

### Zajedničko za sheet-ove

- **Zatvaranje:** prevlačenjem nadole, tapom na pozadinu ili sistemskim „nazad“. Dok traje operacija (čuvanje, čitanje), sheet ne može da se zatvori.
- **Sheet preko kamere (03):** ne zatvara se tapom na pozadinu. Prevlačenje nadole ili „nazad“ znači odustajanje: artikal se ne dodaje, a kamera nastavlja.

### 06 · Pregled štampe

- **`lib/priceTags.js`:**
  - Sadrži `PRICE_TAG_STYLES`, sa istim vrednostima kao danas.
  - Sadrži funkciju rasporeda: lista + format → strane → redovi cenovnika. Koristi isto računanje kao današnji prelom strana (`tagRowsPerPage`).
  - `buildWorkbookBuffer` koristi tu funkciju za prelome, a Excel fajl ima isti sadržaj i raspored kao danas.
- **`PriceTag`** crta jedan cenovnik u milimetrima:
  - Širina kolone se pretvara iz Excel jedinica kao `w·7+5` px na 96 dpi, pa u mm. Visina reda iz tačaka u mm.
  - Poravnanje je po formatu, a okvir tanak.
  - Za voće se crta barkod (JsBarcode, iste proporcije kao u Excel-u).
  - Cena: Oswald, ista veličina kao u Excel-u. Kad ne staje, smanjuje se do širine ćelije (imitacija „shrink to fit“).
  - Naziv: `'Bahnschrift SemiBold', 'Bahnschrift'`, sa zamenom Barlow Semi Condensed 600. Prelama se kao `wrapText`.
- **A4 strana** se crta u stvarnoj veličini (210×297 mm, margine iz `PAGE_MARGINS_IN`, cenovnici od gornje leve margine) i umanjuje sa `transform: scale` na širinu ekrana.
- **Ekran:**
  - Zaglavlje: nazad, „Pregled štampe“ i „N kom“.
  - Segment Raf / Frižider / Voće zamenjuje današnji sheet za izbor formata.
  - Strane se listaju vodoravno (scroll-snap) kad ih je više. Ispod piše „A4 · K kolone · strana X od Y“.
- **Akcije** (iste širine):
  - **Pošalji:** status učitavanja, pa „Poslato na mejl radnje“, a kod greške „Ponovi“.
  - **Excel:** preuzimanje kao danas.
- **Tačnost:** dimenzije, kolone, margine i prelomi su tačni. Izgled teksta je približan (font naziva na telefonu, Excel-ovo prelamanje i smanjivanje).

### 03 · Skeniranje

**Kamera (`lib/scanner.js`):**
- **Otvaranje:** `getUserMedia` sa `facingMode: environment` i idealnom rezolucijom 1920×1080. Zatim se primenjuje `focusMode: continuous` gde je podržano.
- **Izbor sočiva:** posle dozvole se bira glavna zadnja kamera. Tap na oznaku „kamera“ u gornjoj traci prebacuje na sledeću zadnju kameru. Izabrani `deviceId` se pamti na uređaju.
- **Blic:** dugme se vidi samo kad traka podržava `torch`.
- **Čitač:** ugrađeni `BarcodeDetector` gde postoji, inače zxing. Formati su isti kao danas (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39). Kod se prihvata kad ga dva uzastopna kadra pročitaju isto.
- **zxing:**
  - wasm fajl je deo build-a, a ne CDN-a;
  - učitava se tek kad se kamera otvori na uređaju bez `BarcodeDetector`-a, ili kad je izabran u privremenom meniju;
  - service worker ga čuva za rad bez interneta.
- **Pauza:** posle čitanja video se pauzira (zamrznut kadar) i petlja staje. Posle akcije u sheet-u kamera nastavlja.
- **Gašenje:** kamera se gasi pri napuštanju ekrana i kad aplikacija ode u pozadinu (`visibilitychange`).
- **Bez dozvole:** status „Nema dozvole za kameru.“ sa „Upiši ručno“.

**Artikal je u bazi (sheet preko kamere):**
- Sadržaj: „U bazi“, barkod, „N. u nizu“, Naziv i Cena. Cena je u fokusu, sa selektovanim tekstom i labelom „Cena · bila X“.
- „Sačuvaj i skeniraj sledeći“: čuva u bazu, dodaje u listu, prikazuje status „Dodato: <naziv> <cena>“ i nastavlja kameru.
- „Preskoči“: dodaje u listu bez upisa u bazu i nastavlja kameru.
- „Sačuvaj i završi (N)“: čuva i vraća na `/`.

**Artikal nije u bazi:** otvara se sheet 04 preko kamere, sa fokusom na Naziv.

### 04 · Izmena

Otvara se na tri načina:
- posle skeniranja novog artikla;
- dugim pritiskom na red liste;
- iz ručnog unosa.

**Sadržaj:**
- **Oznaka:** „Novi artikal“ za artikal koji nije pronađen, „Nije u bazi“ za `notInDb` iz liste, a „U bazi“ za ostale.
- **Živi pregled cenovnika:** `PriceTag` u izabranom formatu, sa natpisom „Ovako izgleda cenovnik na rafu / u frižideru / za voće“.
- **Polja:** Naziv i Cena.

**Dugmad zavise od toga odakle je otvoreno.** Tabela važi za sheet izmene u svim slučajevima, i za sadržaj 03 i za sadržaj 04:

| Izvor | Dugmad |
|---|---|
| skeniranje, artikal u bazi (03) | Sačuvaj i skeniraj sledeći · Preskoči · Sačuvaj i završi (N) |
| skeniranje, novi artikal (04) | Sačuvaj i skeniraj sledeći · Sačuvaj i zatvori |
| lista (04) | Sačuvaj i zatvori |
| ručni unos (03 ili 04) | Sačuvaj i upiši sledeći · Sačuvaj i zatvori |

„Sačuvaj i zatvori“ i „Sačuvaj i završi“ posle skeniranja ili ručnog unosa vraćaju na `/`. Iz liste samo zatvaraju sheet.

**Čuvanje:**
- Uvek upisuje u bazu preko `lib/products.js`. Zadržava se pomeranje 12-cifrenog reda na pun barkod.
- Artikal iz „nije u bazi“ prelazi u „Spremno“ (`notInDb` se briše).
- Isti barkod u listi se zamenjuje, kao danas.

**Za sve sheet-ove izmene (03 i 04):**
- **Validacija:** naziv je obavezan, a cena mora biti broj veći od 0 (zarez ili tačka). Dok unos nije ispravan, primarno dugme je neaktivno.
- **Greška pri čuvanju:** status „Nema veze. Nije sačuvano.“ sa „Ponovi“. Sheet ostaje otvoren sa unetim podacima.
- **Tastatura:** fokus se postavlja programski. Na iPhonu tastatura traži jedan tap (ograničenje iOS-a). Na Androidu se proverava da li se otvara sama.

### 05 · Ručni unos

- **Tastatura:** tastatura iz handoff-a (3×4). Na računaru rade i tipke 0–9, Backspace i Enter.
- **Unos:** do 20 cifara. Indikator od 13 crtica je samo vodič.
- **„Nastavi“** (i ✓) je aktivno već od jedne cifre i otvara sheet izmene preko ekrana za ručni unos. Ako je artikal u bazi, sheet ima sadržaj 03 („U bazi“, „Cena · bila X“, fokus na ceni, bez pregleda cenovnika), a ako nije, sadržaj 04. Dugmad su po tabeli u 04.
- **Posle „Sačuvaj i upiši sledeći“** vraća se prazna tastatura.

## Logo i PWA

- **Ikonice:** skripta u `scripts/` pretvara slovo „b“ iz `logo-nisan.svg` u putanje (Bricolage 800 iz fontsource paketa) i pravi `src/assets/logo.svg` i PNG ikonice:
  - `favicon-32`;
  - `apple-touch-icon` (180);
  - `icon-192`, `icon-512`;
  - `icon-maskable-512` (accent pozadina do ivica, znak u bezbednoj zoni od 80%).
- **Manifest:**
  - `theme_color` i `background_color` su `#FBF6EE`;
  - dodaje se maskable ikonica (`purpose: "maskable"`);
  - `index.html` dobija iste boje i `viewport-fit=cover`.
- **Service worker:** pored aplikacije čuva fontove i zxing wasm.

## Testiranje i provera

- **Vitest (`npm test`)** proverava čiste funkcije u `lib/` i lifletu:
  - raspored po stranama za sva tri formata, uključujući jednakost sa današnjim prelomima za 0, 1, 3, 7 i 40 artikala;
  - prikaz i parsiranje cene;
  - `barcodeCandidates`;
  - `rowsFromTextItems`.
- **Posle svake faze:**
  - `npm run build` i `npm test`;
  - pregled na računaru;
  - pregled na Android telefonu preko Vercel preview linka.
- **Faza 3:** odštampa se po jedna strana svakog formata i uporedi sa pregledom (lenjir za dimenzije, oko za raspored i veličinu cene). Ako ne odgovara, važi odluka 4.
- **Faza 4:** porede se čitači na Android telefonu u radnji, i na iPhonu ako je dostupan.

## Rizici i otvorene tačke

- **Automatsko otvaranje tastature na Androidu:** nije sigurno. Ako ne radi, ostaje jedan tap, kao na iPhonu.
- **Izbor glavne kamere:** biranje po listi uređaja nije pouzdano na svim telefonima. Zato postoji ručno prebacivanje.
- **Zamenski font za naziv:** razlikuje se od Bahnschrift-a, pa je pregled naziva približan.
- **Veličina:** zxing dodaje oko 1 MB (samo uz kameru). Bundle je već 1,4 MB zbog ExcelJS-a, a to se ovde ne rešava.
