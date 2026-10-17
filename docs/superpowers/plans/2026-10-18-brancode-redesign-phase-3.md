# Brancode redizajn — faza 3 (pregled štampe): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cilj:** cenovnik u pregledu izgleda kao odštampan. Faza dodaje:
- komponentu `PriceTag` u pravim milimetrima;
- A4 strane na `/pregled` sa listanjem;
- živi pregled cenovnika u sheet-u za izmenu (04).

Sve dimenzije dolaze iz istih podešavanja kao Excel.

**Arhitektura:** `lib/priceTags.js` dobija geometriju i raspored po stranama, koje koriste i Excel (prelomi) i pregled. `PriceTag` i `PrintPage` crtaju u CSS milimetrima i tačkama, a ceo prikaz se umanjuje `transform: scale` na širinu ekrana.

**Tehnologije:** dosadašnje + `@fontsource/oswald` (cena, kao u Excel-u) i `@fontsource/barlow-semi-condensed` (zamenski font za Bahnschrift).

**Spec:** [`docs/superpowers/specs/2026-10-17-brancode-redesign-design.md`](../specs/2026-10-17-brancode-redesign-design.md), odeljci „Odluke“ 3 i 4, „06 · Pregled štampe“ i deo „04 · Izmena“ (živi pregled cenovnika).

**Prethodna faza:** [`2026-10-18-brancode-redesign-phase-2.md`](2026-10-18-brancode-redesign-phase-2.md).

## Globalna ograničenja

- Sva ograničenja faza 1 i 2 i dalje važe.
- **Excel izlaz se ne menja.** Postojeći testovi u `src/lib/priceTags.test.js` (prelomi, fontovi, slike) moraju ostati zeleni bez izmene.
- **Pregled prati print, ne mock** (odluka 3). Cena je u Oswald-u veličine iz `PRICE_TAG_STYLES`, a naziv u Bahnschrift SemiBold bold. Na telefonu se umesto njega koristi Barlow Semi Condensed 700.
- **Širina kolone** po Excel formuli: `px = trunc(((256·w + trunc(128/7)) / 256) · 7)` na 96 dpi, pa `mm = px · 25,4 / 96`. Za raf i frižider (26,75) to je 187 px = 49,48 mm, a za voće (40) 280 px = 74,08 mm. Spec navodi približno `w·7+5`, ali ova formula daje Excel-ovu podrazumevanu kolonu od tačno 64 px (`w` = 9,140625), pa je tačnija.
- **Visine redova:** iz tačaka u mm, `pt · 25,4 / 72`.
- **A4 strana:** 210 × 297 mm. Margine su iz `PAGE_MARGINS_IN` (leva 0,7″ = 17,78 mm, gornja 0,75″ = 19,05 mm), a cenovnici idu od gornje leve margine.
- **Slika barkoda za voće** stoji na istom mestu kao u Excel-u. Excel je postavlja preko `w·7+5` i `round(pt·96/72)`, pa pregled koristi iste brojke, ne tačnu širinu kolone.
- **Odluka 4:** ako se na papiru pokaže da pregled ne odgovara, A4 pregled i pregled u izmeni se uklanjaju. Kod mora biti tako odvojen da se to može uraditi brisanjem dva mesta u JSX-u.

## Fokus pregleda

1. **Prelomi u pregledu** se poklapaju sa Excel-om za sva tri formata. Test: Excel koristi `layoutTagPages` (Task 1), a postojeći testovi preloma ostaju zeleni.
2. **Duga cena** („12.499,99“ u frižideru, gde je font fiksiran na 42) ne izlazi iz ćelije, nego se smanjuje kao Excel-ov „shrink to fit“. Test: `shrinkFontPt` (Task 1).
3. **Dug naziv** se prelama u ćeliji, a ne izlazi iz cenovnika. Ćelija naziva ima fiksnu visinu i `overflow: hidden`, kao u Excel-u. Test: render u Task 2.
4. **Neispravna cena dok se kuca** („“, „0“, „abc“) u živom pregledu ne ruši prikaz, nego pokazuje „0,00“. Test: EditSheet u Task 4.
5. **Mnogo artikala** (npr. 120): listanje kroz strane radi, a natpis pokazuje tačnu stranu. Test: brojanje strana u Task 1, natpis u Task 3.

---

### Task 1: geometrija, raspored po stranama i smanjivanje fonta

**Fajlovi:**
- Izmena: `src/lib/priceTags.js`, `src/lib/priceTags.test.js`

**Interfejsi:**
- Proizvodi:
  - `columnWidthMm(width: number): number`, po formuli iz ograničenja.
  - `ptToMm(pt: number): number`.
  - `tagGeometry(format): { columns, widthMm, nameHeightMm, priceHeightMm, barcodeHeightMm, heightMm }`. `barcodeHeightMm` je 0 kad nema barkoda.
  - `layoutTagPages(queue, format): Item[][][]`, tj. strane, pa redovi, pa stavke. Red ima do `columns` stavki, a strana do `tagRowsPerPage(format)` redova.
  - `barcodeImageBox(format): { leftMm, topMm, widthMm, heightMm }` za format sa barkodom, inače `null`. Računa se iz istih brojki koje `buildWorkbook` koristi za `nativeColOff`/`nativeRowOff`/`ext`.
  - `shrinkFontPt(fontPt: number, textWidthPx: number, cellWidthPx: number): number` → `fontPt` ako tekst staje u `cellWidthPx − 4`, inače `fontPt · (cellWidthPx − 4) / textWidthPx`.
  - `buildWorkbook` umesto sopstvenog računanja preloma prolazi kroz `layoutTagPages`. Prelom ide pre prvog reda svake strane osim prve.

- [ ] **Korak 1: testovi** (dopuna `src/lib/priceTags.test.js`, `toBeCloseTo(x, 2)`):
- `columnWidthMm(26.75)` ≈ 49.48, `columnWidthMm(40)` ≈ 74.08, `columnWidthMm(9.140625)` ≈ 16.93; `ptToMm(28.5)` ≈ 10.05.
- `tagGeometry("shelf")`: columns 3, widthMm ≈ 49.48, nameHeightMm ≈ 10.05, priceHeightMm ≈ 27.25, barcodeHeightMm 0.
- `tagGeometry("fruit")`: columns 2, nameHeightMm ≈ 18, priceHeightMm ≈ 29, barcodeHeightMm ≈ 13.
- `layoutTagPages(items(40), "shelf").map((p) => p.flat().length)` → `[18, 18, 4]`, a broj redova po strani `[6, 6, 2]`. Za `"fridge"` → `[15, 15, 10]`, za `"fruit"` → `[8, 8, 8, 8, 8]`. `layoutTagPages([], "shelf")` → `[]`. Za 7 stavki u voću su redovi dužina `[2, 2, 2, 1]`.
- `barcodeImageBox("fruit")`: leftMm ≈ 6.41, topMm ≈ 1.30, widthMm ≈ 62.59, heightMm ≈ 10.37. `barcodeImageBox("shelf")` → `null`.
- `shrinkFontPt(42, 150, 187)` → 42; `shrinkFontPt(42, 366, 187)` ≈ 21.
- Postojeći testovi preloma, fontova i slika ostaju nepromenjeni.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, nove funkcije ne postoje.

- [ ] **Korak 3: implementiraj** po interfejsima i prebaci `buildWorkbook` na `layoutTagPages`.

- [ ] **Korak 4: pokreni** `npm test`. Očekivano: sve prolazi, uključujući stare testove preloma.

- [ ] **Korak 5: commit**

```bash
git add src/lib/priceTags.js src/lib/priceTags.test.js
git commit -m "Share tag geometry and page layout between the Excel export and the preview"
```

---

### Task 2: `PriceTag` i `PrintPage`

**Fajlovi:**
- Novo: `src/components/PriceTag.jsx`, `src/components/PrintPage.jsx`, `src/components/PriceTag.test.jsx`
- Izmena: `package.json` (fontovi)

**Interfejsi:**
- Troši: Task 1, `formatPrice`, `makeBarcodeDataUrl`, `PRICE_TAG_STYLES`.
- Proizvodi:
  - `PriceTag({ item: { name, price, barcode }, format, barcodeImage = makeBarcodeDataUrl })` crta jedan cenovnik kao `<table>` sa `border-collapse: collapse`:
    - **Red naziva:** visina `nameHeightMm`, font `'Bahnschrift SemiBold', 'Bahnschrift', 'Barlow Semi Condensed'` 700, `nameFontSize` pt, poravnanje iz `nameAlignment` (vodoravno i uspravno), prelamanje i `overflow: hidden`.
    - **Red cene:** visina `priceHeightMm`, Oswald 400, veličina `priceFontSize(text)` pt smanjena kroz `shrinkFontPt` posle merenja (`useLayoutEffect`, `scrollWidth`), poravnanje iz `priceAlignment`.
    - **Red barkoda** (samo voće): `<img>` apsolutno postavljen po `barcodeImageBox`.
    - Okvir svake ćelije je 1px solid black, kao Excel „thin“.
    - Dimenzije su inline (izračunate u toku rada, dozvoljeno po ograničenjima), u `mm` i `pt`.
  - `PrintPage({ rows, format, barcodeImage })` crta A4 list (210 × 297 mm, beo, `shadow-paper`) sa marginama iz `PAGE_MARGINS_IN` i jednom tabelom `border-collapse` u kojoj su ćelije svih cenovnika. Tako susedni cenovnici dele liniju, kao u Excel-u.
  - Fontovi: `@fontsource/oswald/400.css` i `@fontsource/barlow-semi-condensed/700.css` se uvoze u `PriceTag.jsx`.

- [ ] **Korak 1: test** (`src/components/PriceTag.test.jsx`, jsdom):
- `PriceTag` za `shelf` sa `{ name: "MAJONEZ 175", price: 1249.99 }` sadrži „MAJONEZ 175“ i „1.249,99“. Red naziva ima inline `height: 10.05mm` (zaokruženo na 2 decimale), a ćelija cene `font-size: 42pt` (jsdom ne meri, pa nema smanjivanja).
- Ćelija naziva ima `overflow: hidden`, pa dug naziv ne izlazi iz cenovnika.
- `PriceTag` za `fruit` sa `barcodeImage={() => "data:image/png;base64,AAA"}` sadrži `img` sa tim `src`.
- `PrintPage` sa 2 reda po 3 stavke za `shelf` sadrži 6 cena.

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj**, uz `npm install @fontsource/oswald @fontsource/barlow-semi-condensed`.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: commit**

```bash
git add package.json package-lock.json src/components/PriceTag.jsx src/components/PrintPage.jsx src/components/PriceTag.test.jsx
git commit -m "Draw price tags and A4 pages in real millimetres from the print settings"
```

---

### Task 3: A4 pregled na `/pregled`

**Fajlovi:**
- Izmena: `src/screens/PrintPreview.jsx`, `src/screens/PrintPreview.test.jsx`
- Novo: `src/components/ScaledToWidth.jsx`

**Interfejsi:**
- Troši: `layoutTagPages`, `PrintPage`, `plural`.
- Proizvodi:
  - `ScaledToWidth({ widthMm, heightMm, children })`. Meri širinu roditelja (`ResizeObserver`), a dete crta u prirodnoj veličini sa `transform: scale(širina / prirodna širina)` i `transform-origin: top left`. Kontejner ima umanjenu visinu. U jsdom-u (bez merenja) skala je 1.
  - Na `/pregled` sredina postaje okvir `bg-surface-muted rounded-card p-4`:
    - u njemu su strane jedna pored druge, sa vodoravnim listanjem (`overflow-x-auto snap-x snap-mandatory`, svaka strana `snap-center w-full shrink-0`);
    - ispod okvira je natpis `A4 · ${cols} ${plural(cols, "kolona", "kolone", "kolona")} · strana ${x} od ${y}`;
    - `x` se računa iz `scrollLeft / clientWidth` (zaokruženo, +1) na `scroll` događaj.

- [ ] **Korak 1: testovi** (dopuna `PrintPreview.test.jsx`):
- sa 40 stavki i Raf: „A4 · 3 kolone · strana 1 od 3“;
- posle klika na „Voće“: „A4 · 2 kolone · strana 1 od 5“;
- sa 120 stavki i Raf: „strana 1 od 7“.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, natpis ne postoji.

- [ ] **Korak 3: implementiraj.**

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: vizuelna provera** (390×844, prijavljen, lista puna kroz `localStorage`):
- strane se vide cele, a cenovnici na njima su proporcionalni;
- listanje menja „strana X od Y“;
- sva tri formata;
- dugačka cena („12.499,99“) u frižideru je smanjena unutar ćelije.

- [ ] **Korak 6: commit**

```bash
git add src/screens/PrintPreview.jsx src/screens/PrintPreview.test.jsx src/components/ScaledToWidth.jsx
git commit -m "Show the A4 print preview on the print screen"
```

---

### Task 4: živi pregled cenovnika u izmeni (04)

**Fajlovi:**
- Izmena: `src/sheets/EditSheet.jsx`, `src/screens/Home.jsx` (prosleđuje format)
- Novo: `src/sheets/EditSheet.test.jsx`

**Interfejsi:**
- Troši: `PriceTag`, `ScaledToWidth`, `tagGeometry`, `usePrintFormat`, `parsePrice`.
- Proizvodi:
  - `EditSheet({ editor, open, onClose, onSave, format })` između oznake i polja dobija okvir `bg-surface-muted rounded-tag-frame`.
  - U okviru je `PriceTag` za `format`, sa `name` (ili „—“ kad je prazan) i `parsePrice(price) ?? 0`, skaliran na širinu 210px, centriran i sa `shadow-tag`.
  - Ispod okvira je natpis `Ovako izgleda cenovnik ${ { shelf: "na rafu", fridge: "u frižideru", fruit: "za voće" }[format] }`.
  - Home prosleđuje `format` iz `usePrintFormat()`.

- [ ] **Korak 1: test** (`src/sheets/EditSheet.test.jsx`, jsdom, `editor` stub sa `barcode: "1", name: "Hleb", price: "79", badge: "U bazi", canSave: true`):
- sa `format="shelf"` vidi se „Ovako izgleda cenovnik na rafu“ i „79,00“;
- sa `price: "abc"` vidi se „0,00“ i ništa ne puca;
- sa `format="fruit"` natpis je „… za voće“.

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj.**

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: vizuelna provera.** Dugi pritisak na red otvara izmenu sa pregledom. Kucanje cene menja pregled, a promena formata na `/pregled` menja pregled u izmeni.

- [ ] **Korak 6: commit**

```bash
git add src/sheets/EditSheet.jsx src/sheets/EditSheet.test.jsx src/screens/Home.jsx
git commit -m "Show a live price tag preview while editing a product"
```

---

### Task 5: dokumentacija

**Fajlovi:** `CLAUDE.md`, `.claude/rules/price-tag-export.md`

- [ ] **Korak 1:**
- **`price-tag-export.md`:**
  - geometrija i raspored (`tagGeometry`, `layoutTagPages`, `barcodeImageBox`) su jedini izvor za Excel i pregled;
  - promena dimenzija ide samo kroz `PRICE_TAG_STYLES`;
  - Excel formula za širinu kolone;
  - slika barkoda u pregledu namerno ponavlja Excel-ovu približnu `w·7+5` računicu;
  - ako papir ne odgovara pregledu, važi odluka 4 iz spec-a.
- **`CLAUDE.md`:** `PriceTag`, `PrintPage` i `ScaledToWidth` u spisku. Ispravi i glob testova (`.test.jsx`), što je odloženi sitni nalaz iz faze 2.

- [ ] **Korak 2:** pokreni `npm test && npm run build`, pa commit-uj:

```bash
git add CLAUDE.md .claude/rules/price-tag-export.md
git commit -m "Document the shared tag geometry behind the export and the preview"
```

Poređenje sa odštampanim papirom radi korisnik u završnom testu (spec, „Testiranje i provera“).
