# Brancode redizajn — faza 1 (temelj): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cilj:** postaviti temelj za redizajn tako da aplikacija radi isto kao danas. Konkretno:
- testovi (Vitest);
- `lib/` sloj izvučen iz `App.jsx`;
- React Router sa adresama ekrana;
- Tailwind v4 sa tokenima iz handoff-a i novim fontovima;
- novi logo na PWA ikonicama.

**Arhitektura:**
- Logika iz `App.jsx` (Supabase, Excel, lista, mejl) prelazi u čiste module u `src/lib/`, pokrivene testovima.
- Postojeći ekrani se samo premeštaju u `src/screens/` i dobijaju rute. Zadržavaju inline stilove preko privremenog `lib/legacyTheme.js`, dok ih faze 2–4 ne zamene.
- Tailwind i tokeni se uvode, ali ih još nijedan ekran ne koristi.

**Tehnologije:** React 18, Vite 5, `react-router@^7.18.4`, `vitest@^3.2.7`, `tailwindcss@^4.3.3` + `@tailwindcss/vite@^4.3.3`, fontsource paketi, `opentype.js@^2` + `@resvg/resvg-js@^2.6` (samo za skriptu ikonica).

**Spec:** [`docs/superpowers/specs/2026-10-17-brancode-redesign-design.md`](../specs/2026-10-17-brancode-redesign-design.md), odeljci „Faze“ (1), „Arhitektura“, „Logo i PWA“ i „Testiranje i provera“.

## Globalna ograničenja

- **Grana:** `redesign`, sa commit-ovima po task-u. Bez `Co-Authored-By` linije u commit porukama (pravilo korisnika). Stil poruke: naslov u imperativu + kratke stavke, kao u istoriji repozitorijuma.
- **React** ostaje 18. React Router mora biti `^7` (v8 traži React 19). Vitest mora biti `^3.2` (v4 i v5 vuku sopstveni Vite 6+).
- **Tailwind v4:** cilj je iOS 16.4+ / iPhone 8+.
- **Ne menjaju se:** sadržaj i raspored Excel fajla, šema i RLS u Supabase-u, `api/send-email.js`.
- **Ponašanje** ostaje kao danas. Jedine novine za korisnika su adrese ekrana i sistemsko „nazad“.
- **localStorage:** ključ `print-queue`, oblik stavke `{ id, barcode, name, price, notInDb? }`, bez promene.
- **Rute u ovoj fazi:** `/`, `/skeniranje`, `/rucni-unos`. Nepoznata adresa vodi na `/`.
- **Tekstovi** za korisnika su na srpskom, a komentari u kodu na engleskom.
- **Tokeni** (hex vrednosti u Task 5) prepisuju se tačno iz `docs/design/redesign-handoff/README.md`.

## Fokus pregleda

1. **Postojeće liste na telefonima** (`print-queue` u starom obliku) moraju preživeti ažuriranje. Test: `parseStoredQueue` u Task 4.
2. **Direktno otvaranje ili osvežavanje** `/rucni-unos` na Vercel-u mora učitati aplikaciju, a `/api/send-email` i dalje mora stići do funkcije. Test pravila u `vercel.json` je u Task 4, provera na preview linku u Task 7.
3. **Izlazak sa `/skeniranje`** sistemskim „nazad“ mora ugasiti kameru. Cleanup pri unmount-u je u Task 4, provera na telefonu u Task 7.
4. **Excel posle premeštanja** mora imati iste prelome strana, vrednosti, fontove i slike barkoda. Testovi su u Task 3.
5. **Čuvanje artikla nađenog preko 12 cifara** i posle izvlačenja u `lib/` pomera red umesto da pravi duplikat. Testovi su u Task 2.

---

### Task 1: Vitest, HTTP režim za dev server i prvi test

**Fajlovi:**
- Izmena: `package.json` (skripte, devDependency `vitest`), `vite.config.js`, `CLAUDE.md` (odeljak Commands)
- Novo: `vitest.config.js`, `src/promoLeaflet.test.js`

**Interfejsi:**
- Proizvodi:
  - `npm test` (`vitest run`) i `npm run test:watch` (`vitest`);
  - `npm run dev:http` (`vite --mode http`): isti dev server bez HTTPS-a, za ugrađeni browser koji odbija samopotpisani sertifikat. Port je isti (5173).

- [ ] **Korak 1: instaliraj Vitest i napravi konfiguraciju**

`npm install -D vitest@^3.2.7`. `vitest.config.js` je poseban fajl, da testovi ne učitavaju PWA i SSL pluginove:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "scripts/**/*.test.mjs"],
  },
});
```

U `package.json` dodaj skripte `test`, `test:watch` i `dev:http`.

- [ ] **Korak 2: HTTP režim u `vite.config.js`**

Pretvori config u `defineConfig(({ mode }) => …)`. Kad je `mode === "http"`, izostavi `basicSsl()` i postavi `server.https: false`. Inače sve ostaje kao sada.

- [ ] **Korak 3: napiši test za `rowsFromTextItems` (karakterizacija postojećeg ponašanja)**

`src/promoLeaflet.test.js`:

```js
import { describe, it, expect } from "vitest";
import { rowsFromTextItems } from "./promoLeaflet.js";

const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe("rowsFromTextItems", () => {
  it("reads EAN, name and the price right before the Marža %", () => {
    const rows = rowsFromTextItems([
      item("1001", 10, 500), item("8600005000122", 60, 500), item("MAJONEZ 175 2.8%T", 160, 501),
      item("84,99", 300, 500), item("25%", 340, 500), item("100,00", 380, 500),
    ]);
    expect(rows).toEqual([{ ean: "8600005000122", name: "MAJONEZ 175 2.8%T", price: 84.99 }]);
  });

  it("joins items of one line in x order", () => {
    const rows = rowsFromTextItems([
      item("25%", 340, 500), item("84,99", 300, 500), item("MAJONEZ 175", 160, 500),
      item("8600005000122", 60, 500), item("1001", 10, 500),
    ]);
    expect(rows.map((r) => r.ean)).toEqual(["8600005000122"]);
  });

  it("ignores lines that are not article rows", () => {
    expect(rowsFromTextItems([item("Šifra", 10, 700), item("EAN", 60, 700), item("Naziv", 160, 700)])).toEqual([]);
  });
});
```

- [ ] **Korak 4: pokreni testove**

Pokreni `npm test`. Očekivano: 3 testa prolaze. Ovo opisuje postojeći kod, pa test prolazi odmah. Ako ne prođe, test je pogrešan, ne kod.

- [ ] **Korak 5: proveri oba dev režima**

Pokreni `npm run build`, pa `npm run dev:http`. Očekivano: build prolazi, a dev:http ispisuje `http://localhost:5173/`, a ne `https`.

- [ ] **Korak 6: dopuni Commands u `CLAUDE.md`**

Dodaj `npm test`, `npm run test:watch` i `npm run dev:http` (sa jednim redom zašto postoji). Izbaci rečenicu „There is no test runner…“ i napiši da je `npm test` zajedno sa `npm run build` automatska provera.

- [ ] **Korak 7: commit**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js src/promoLeaflet.test.js CLAUDE.md
git commit -m "Add Vitest and an HTTP dev mode" -m "- npm test runs Vitest over src/ and scripts/; first tests pin the leaflet row parser.
- npm run dev:http serves the app without the self-signed cert, for browsers that refuse it."
```

---

### Task 2: `lib/products.js`, pretraga i čuvanje artikla

**Fajlovi:**
- Novo: `src/lib/products.js`, `src/lib/products.test.js`
- Izmena:
  - `src/promoLeaflet.js`: briše se `barcodeCandidates`, uvozi se iz `./lib/products.js`;
  - `src/App.jsx`: `lookupProduct` i Supabase deo iz `saveAndQueue` zamenjuju se pozivima;
  - `.claude/rules/products-and-barcodes.md`: lokacija `barcodeCandidates`.

**Interfejsi:**
- Proizvodi:
  - `barcodeCandidates(code: string): string[]`, sa istim ponašanjem kao danas;
  - `lookupProduct(barcode: string, client = supabase): Promise<{ barcode, name, price } | null>`, koji probava kandidate redom;
  - `saveProduct(product: { barcode, name, price }, matchedBarcode: string | null, client = supabase): Promise<void>`. Ako je `matchedBarcode` zadat i različit od `product.barcode`, radi `update(product).eq("barcode", matchedBarcode).select("barcode")`. Ako to vrati 0 redova, ili ako uslov nije ispunjen, radi `upsert(product)`. Svaka `error` se baca.

- [ ] **Korak 1: napiši testove**

`src/lib/products.test.js` koristi lažni klijent koji beleži pozive:

```js
const fakeClient = ({ rows = {}, updateResult = { data: [], error: null }, upsertResult = { error: null } } = {}) => {
  const calls = [];
  const client = {
    from: () => ({
      select: () => ({ eq: (_c, val) => ({ maybeSingle: async () => (calls.push(["select", val]), { data: rows[val] ?? null, error: null }) }) }),
      update: (values) => ({ eq: (_c, val) => ({ select: async () => (calls.push(["update", values, val]), updateResult) }) }),
      upsert: async (values) => (calls.push(["upsert", values]), upsertResult),
    }),
  };
  return { client, calls };
};

const majonez = { barcode: "8600005000122", name: "MAJONEZ 175", price: 85 };
```

Testovi i očekivanja:
- `barcodeCandidates("8600005000122")` → `["8600005000122", "860000500012"]`; `barcodeCandidates("12345678")` → `["12345678"]`; `barcodeCandidates("860000500012")` → `["860000500012"]`.
- `lookupProduct("8600005000122", client)`, kad postoji samo `rows["860000500012"]`: vraća taj red, a `calls` je `[["select","8600005000122"],["select","860000500012"]]`.
- `lookupProduct`, kad nema nijednog: vraća `null`.
- `saveProduct(majonez, null, client)`: `calls` je `[["upsert", majonez]]`.
- `saveProduct(majonez, "8600005000122", client)`: `calls` je `[["upsert", majonez]]`.
- `saveProduct(majonez, "860000500012", client)` sa `updateResult = { data: [{ barcode: "8600005000122" }], error: null }`: `calls` je `[["update", majonez, "860000500012"]]`, bez upsert-a.
- Isto, ali sa `updateResult = { data: [], error: null }`: `calls` je `[["update", majonez, "860000500012"], ["upsert", majonez]]`.
- `updateResult = { data: null, error: new Error("boom") }`: `saveProduct` se odbija sa „boom“.

- [ ] **Korak 2: pokreni i proveri da ne prolaze**

Pokreni `npm test -- src/lib/products.test.js`. Očekivano: FAIL, ne može da reši `./products.js`.

- [ ] **Korak 3: implementiraj `src/lib/products.js`**

Premesti `barcodeCandidates` iz `promoLeaflet.js` i logiku iz `lookupProduct`/`saveAndQueue` u `App.jsx`, sa dodatkom parametra `client`. Zatim:
- `promoLeaflet.js` uvozi `barcodeCandidates` iz `./lib/products.js`;
- `App.jsx` zove `lookupProduct(barcode)` i `saveProduct(product, matchedBarcode)`. Poruke o grešci ostaju iste.

- [ ] **Korak 4: pokreni testove i build**

Pokreni `npm test && npm run build`. Očekivano: svi testovi prolaze, build prolazi.

- [ ] **Korak 5: ažuriraj pravilo i commit-uj**

U `.claude/rules/products-and-barcodes.md` zameni „in `src/promoLeaflet.js`“ sa „in `src/lib/products.js`“ i navedi da `saveProduct` sadrži logiku pomeranja reda.

```bash
git add src/lib/products.js src/lib/products.test.js src/promoLeaflet.js src/App.jsx .claude/rules/products-and-barcodes.md
git commit -m "Move product lookup and save into lib/products.js" -m "- barcodeCandidates, lookupProduct and saveProduct now live in one module with tests, including the move-to-full-barcode path."
```

---

### Task 3: `lib/priceTags.js` i `lib/format.js`, Excel izlaz

**Fajlovi:**
- Novo: `src/lib/priceTags.js`, `src/lib/format.js`, `src/lib/priceTags.test.js`, `src/lib/format.test.js`
- Izmena:
  - `src/App.jsx`: brišu se `PRICE_TAG_STYLES`, konstante strane, `buildWorkbookBuffer`, `makeBarcodeDataUrl`, konverzije i ime fajla;
  - `.claude/rules/price-tag-export.md`: `paths` i lokacija.

**Interfejsi:**
- Proizvodi (`lib/format.js`):
  - `formatPrice(price: number): string`, isto kao danas u Excel-u: `toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- Proizvodi (`lib/priceTags.js`):
  - `PRICE_TAG_STYLES`, bez promene vrednosti, ključevi `shelf | fridge | fruit`;
  - `A4_HEIGHT_PT`, `PAGE_MARGINS_IN`;
  - `tagRowsPerPage(format): number`, isto računanje kao današnji `tagRowsPerPage` unutar `buildWorkbookBuffer`;
  - `buildWorkbook(queue, format, { barcodeImage = makeBarcodeDataUrl } = {}): ExcelJS.Workbook`;
  - `buildWorkbookBuffer(queue, format, options): Promise<ArrayBuffer>` = `buildWorkbook(...).xlsx.writeBuffer()`;
  - `sheetFilename(format, date = new Date()): string` → `` `cenovnik-${fileSlug}-${date.toISOString().slice(0, 10)}.xlsx` ``;
  - `makeBarcodeDataUrl(value): string` (samo u browseru, koristi canvas).
- Faza 3 će funkciju rasporeda koristiti i za pregled.

- [ ] **Korak 1: napiši testove**

`src/lib/format.test.js`: `formatPrice(219)` → `"219,00"`, `formatPrice(1249.99)` → `"1.249,99"`, `formatPrice(12499.9)` → `"12.499,90"`.

`src/lib/priceTags.test.js`:

```js
const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, barcode: `86000050001${String(i).padStart(2, "0")}`, name: `Artikal ${i}`, price: 99 }));
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const sheetFor = (format, queue) => buildWorkbook(queue, format, { barcodeImage: () => PNG_1PX }).getWorksheet("Cenovnici");
const breakRows = (format, n) => sheetFor(format, items(n)).rowBreaks.map((b) => b.id);
```

Očekivanja:
- `tagRowsPerPage`: `shelf` → 6, `fridge` → 5, `fruit` → 4.
- `breakRows` za 0, 1, 3 i 7 artikala je `[]` za sva tri formata. Za 40 artikala: `shelf` → `[12, 24]`, `fridge` → `[10, 20]`, `fruit` → `[12, 24, 36, 48]`.
- Prvi prelom za `shelf` sa 40 artikala je tačno `{ id: 12, max: 16383, man: 1 }`. To je prelom preko cele širine, isti kao danas.
- `sheetFor("shelf", [{ id: "a", barcode: "1", name: "MAJONEZ 175", price: 1249.99 }])`:
  - `A1.value` je `"MAJONEZ 175"`, a `A1.font` je `{ name: "Bahnschrift SemiBold", bold: true, size: 12 }`;
  - `A2.value` je `"1.249,99"`, a `A2.font` je `{ name: "Oswald", bold: false, size: 42 }`;
  - visine redova 1 i 2 su `28.5` i `77.25`.
- `sheetFor("fruit", items(3)).getImages().length` je 3.
- `sheetFilename("fridge", new Date("2026-10-17T10:00:00Z"))` je `"cenovnik-frizider-2026-10-17.xlsx"`.

- [ ] **Korak 2: pokreni i proveri da ne prolaze**

Pokreni `npm test -- src/lib`. Očekivano: FAIL, nema `./priceTags.js` ni `./format.js`.

- [ ] **Korak 3: implementiraj premeštanjem**

Kod iz `App.jsx` prelazi bez promene logike, osim:
- `queue` i `format` postaju parametri;
- slika barkoda dolazi iz opcije `barcodeImage`;
- tekst cene ide kroz `formatPrice`.

`App.jsx` koristi `buildWorkbookBuffer(queue, format)` i `sheetFilename(format)` za preuzimanje i za mejl.

- [ ] **Korak 4: pokreni testove i build**

Pokreni `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: ručna provera Excel-a**

Pokreni `npm run dev:http` i uloguj se (korisnik). Dodaj dva artikla preko ručnog unosa, pa preuzmi „Cene za voće“. Očekivano: fajl se otvara, 2 cenovnika u 2 kolone, sa barkodom ispod cene.

- [ ] **Korak 6: ažuriraj pravilo i commit-uj**

U `.claude/rules/price-tag-export.md`: `paths` → `src/lib/priceTags.js`, `src/lib/format.js`, a tekst „`buildWorkbookBuffer` in `src/App.jsx`“ → „in `src/lib/priceTags.js`“.

```bash
git add src/lib/priceTags.js src/lib/priceTags.test.js src/lib/format.js src/lib/format.test.js src/App.jsx .claude/rules/price-tag-export.md
git commit -m "Move the Excel price tag export into lib/priceTags.js" -m "- Same styles, layout and page breaks; tests pin breaks per format, cell fonts and fruit barcode images."
```

---

### Task 4: React Router, podela na ekrane i `lib/` za listu i mejl

**Fajlovi:**
- Novo:
  - `src/lib/printQueue.js`, `src/lib/printQueue.test.js`
  - `src/lib/email.js`
  - `src/lib/useProductEditor.js`
  - `src/lib/legacyTheme.js`
  - `src/screens/Home.jsx`, `src/screens/Scan.jsx`, `src/screens/ManualEntry.jsx`
  - `src/sheets/BottomSheet.jsx`
  - `vercel.json`, `src/routing.test.js`
- Premeštanje: `src/AuthGate.jsx` → `src/auth/AuthGate.jsx`, `src/Login.jsx` → `src/auth/Login.jsx` (uvoz tema iz `../lib/legacyTheme.js`)
- Izmena: `src/main.jsx`, `src/App.jsx` (postaje samo rute), `package.json` (`react-router@^7.18.4`), `CLAUDE.md` (Architecture), `.claude/rules/ui-conventions.md`, `.claude/rules/promo-leaflet.md` (`paths`)

**Interfejsi:**
- Proizvodi (`lib/printQueue.js`):
  - `parseStoredQueue(raw: string | null): Item[]`. Nevalidan JSON ili nešto što nije niz daje `[]`.
  - `usePrintQueue(): [Item[], (next: Item[]) => void]`, koji čita i piše `localStorage["print-queue"]`, sa try/catch kao danas.
- Proizvodi (`lib/email.js`):
  - `sendSheetByEmail(filename: string, buffer: ArrayBuffer): Promise<void>`. Pretvara buffer u base64, uzima `access_token` iz sesije i šalje POST na `/api/send-email`. Baca grešku ako nema sesije ili `!res.ok`.
- Proizvodi (`lib/useProductEditor.js`):
  - `useProductEditor(queue, setQueue)` vraća `{ barcode, name, price, isNew, loading, error, savedFlash, open(code), setName, setPrice, save(), cancel() }`.
  - `barcode === null` znači da izmena nije otvorena.
  - Sadrži današnje `openProduct` i `saveAndQueue`, preko `lookupProduct` i `saveProduct`.
- Proizvodi (`lib/legacyTheme.js`): `FONT_SANS`, `FONT_MONO`, `PAPER`, `INK`, `RED`, `GREEN`, `MUTE`, `BORDER`, `CARD` i današnji objekti stilova dugmadi. Privremeno, briše se na kraju faze 4.
- Ekrani:
  - `Home({ queue, setQueue, editor })`: današnji idle prikaz, kartica izmene kad je `editor.barcode` postavljen, lista, preuzimanje i mejl, liflet i potvrde;
  - `Scan({ onDetected(code) })`: kamera, kao danas. Kamera se gasi pri unmount-u. „Otkaži“ vodi na `/`;
  - `ManualEntry({ onSubmit(code) })`: „Otkaži“ vodi na `/`.
- `App`:
  - drži `usePrintQueue` i `useProductEditor`;
  - `onDetected` i `onSubmit` rade `navigate("/", { replace: true })`, pa `editor.open(code)`, da „nazad“ ne vraća u kameru;
  - rute: `/` → `Home`, `/skeniranje` → `Scan`, `/rucni-unos` → `ManualEntry`, `*` → `<Navigate to="/" replace />`.
- `main.jsx`: `<BrowserRouter><AuthGate><App /></AuthGate></BrowserRouter>`.

- [ ] **Korak 1: napiši testove**

`src/lib/printQueue.test.js`:
- Stari oblik `[{ id: "a-1", barcode: "8600005000122", name: "MAJONEZ 175", price: 84 }, { id: "b-2", barcode: "123", name: "X", price: 10, notInDb: true }]`, kao JSON string, vraća se `toEqual` isti niz.
- `parseStoredQueue(null)`, `parseStoredQueue("{oops")` i `parseStoredQueue('{"a":1}')` vraćaju `[]`.

`src/routing.test.js`:

```js
import vercel from "../vercel.json";
const rewrite = vercel.rewrites[0];
const served = (path) => new RegExp(`^${rewrite.source}$`).test(path);

it("serves the app for every page route", () => {
  for (const path of ["/", "/skeniranje", "/rucni-unos", "/pregled"]) expect(served(path)).toBe(true);
  expect(rewrite.destination).toBe("/index.html");
});
it("never rewrites the email endpoint", () => expect(served("/api/send-email")).toBe(false));
```

- [ ] **Korak 2: pokreni i proveri da ne prolaze**

Pokreni `npm test`. Očekivano: FAIL, nema `printQueue.js` ni `vercel.json`.

- [ ] **Korak 3: dodaj `vercel.json` i `lib/printQueue.js`**

`vercel.json`:

```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

Pokreni `npm test`. Očekivano: novi testovi prolaze.

- [ ] **Korak 4: podeli `App.jsx` po interfejsima iznad**

Instaliraj `react-router@^7.18.4`. Kod se premešta bez promene izgleda i tekstova. Jedine promene ponašanja su:
- skeniranje i ručni unos su na svojim adresama;
- posle čitanja ili unosa, izmena se otvara na `/`.

`AuthGate` i dalje prikazuje email i „Odjava“ iznad aplikacije. To se menja u fazi 2.

- [ ] **Korak 5: build i testovi**

Pokreni `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 6: ručna provera u browseru**

Pokreni `npm run dev:http`. Ako ugrađeni browser treba konfiguraciju, dodaj je lokalno u `.claude/launch.json` (fajl se ne commit-uje). Korisnik se uloguje. Proveri:
- Ručni unos → `8600005000122` → otvara se izmena na `/` sa MAJONEZ 175 → „Otkaži“. Ništa se ne čuva u bazu.
- Na `/rucni-unos` browser „nazad“ vraća na `/`.
- Osvežavanje na `/rucni-unos` ostaje na ručnom unosu.
- `/nesto` vodi na `/`.
- Lista za štampu ostaje posle osvežavanja.
- Preuzimanje „Cene za rafove“ radi.

- [ ] **Korak 7: dokumentacija i commit**

U `CLAUDE.md` prepiši Architecture: rute, `screens/`, `sheets/`, `auth/`, `lib/` (svaki fajl u jednom redu), `legacyTheme.js` kao privremen. U `ui-conventions.md` napiši da stari ekrani koriste `lib/legacyTheme.js` dok ih faze 2–4 ne zamene. U `promo-leaflet.md` stavi `paths` na `src/promoLeaflet.js` i `src/screens/Home.jsx`.

```bash
git add -A src vercel.json package.json package-lock.json CLAUDE.md .claude/rules
git commit -m "Add React Router and split App.jsx into screens and lib modules" -m "- Scanning and manual entry get their own routes, so the system back button works; vercel.json serves the app for every route except /api/.
- Print queue, email sending and the product editor move to lib/; old inline styles move to lib/legacyTheme.js until the redesign replaces them."
```

---

### Task 5: Tailwind v4, tokeni i fontovi

**Fajlovi:**
- Novo: `src/index.css`
- Izmena: `vite.config.js` (plugin `tailwindcss()`), `src/main.jsx` (uvoz CSS-a i fontova), `package.json`, `.claude/rules/ui-conventions.md`

**Interfejsi:**
- Proizvodi: Tailwind klase iz tokena, za faze 2–4:
  - boje: `bg-bg`, `bg-surface`, `bg-surface-muted`, `border-border`, `border-border-soft`, `text-ink`, `text-ink-2`, `text-ink-3`, `text-ink-4`, `text-ink-on-dark-muted`, `bg-accent`, `bg-danger-bg`, `text-danger-ink`, `bg-success`, `text-success-light`, `bg-success-bg`, `text-success-ink`, `bg-scrim`, `bg-camera`, `bg-camera-stripe`;
  - fontovi: `font-display` (Bricolage), `font-sans` (DM Sans), `font-mono` (DM Mono);
  - zaobljenja: `rounded-sheet` 32px, `rounded-card` 24px, `rounded-tag-frame` 22px, `rounded-toast` 20px, `rounded-field` 18px, `rounded-error` 16px (pill je `rounded-full`);
  - senke: `shadow-toast`, `shadow-paper`, `shadow-tag`, `shadow-scan`.

- [ ] **Korak 1: instaliraj pakete**

```bash
npm install -D tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3
npm install @fontsource-variable/bricolage-grotesque @fontsource-variable/dm-sans @fontsource/dm-mono
```

- [ ] **Korak 2: napiši `src/index.css`**

`@import "tailwindcss";` pa `@theme` sa svim tokenima iz tabele „Boje“ u handoff README-u, uz ova imena:
- boje: `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-border-soft`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-ink-4`, `--color-ink-on-dark-muted`, `--color-accent`, `--color-danger-bg`, `--color-danger-ink`, `--color-success`, `--color-success-light`, `--color-success-bg`, `--color-success-ink`, `--color-scrim`, `--color-camera: #3A4A3F`, `--color-camera-stripe: #33433A`;
- fontovi: `--font-display: "Bricolage Grotesque Variable", system-ui, sans-serif`, `--font-sans: "DM Sans Variable", system-ui, sans-serif`, `--font-mono: "DM Mono", ui-monospace, monospace`;
- zaobljenja i senke: vrednosti iz odeljaka „Zaobljenja“ i „Senke“, pod imenima iz Interfejsa (`--radius-sheet`…, `--shadow-scan: 0 10px 24px rgba(217,80,43,.35)`).

Na kraju dodaj:

```css
@layer base {
  body { background-color: var(--color-bg); color: var(--color-ink); font-family: var(--font-sans); }
}
```

- [ ] **Korak 3: poveži**

U `vite.config.js` dodaj `tailwindcss()` iz `@tailwindcss/vite` pre `react()`. U `src/main.jsx`, pre `index.css`, uvezi:
- `@fontsource-variable/bricolage-grotesque/opsz.css`;
- `@fontsource-variable/dm-sans/opsz.css`;
- `@fontsource/dm-mono/500.css`.

Fontovi treba da rade bez interneta (spec, „Logo i PWA“), a fontsource donosi mnogo jezičkih podskupova. Zato ih service worker ne precache-uje, nego ih čuva pri prvom korišćenju. U `VitePWA({ workbox })` dodaj `runtimeCaching: [{ urlPattern: ({ request }) => request.destination === "font", handler: "CacheFirst", options: { cacheName: "fonts" } }]`.

- [ ] **Korak 4: build i provera izlaza**

Pokreni:

```bash
npm run build && grep -o "fbf6ee" dist/assets/*.css | head -1 && grep -c "Bricolage Grotesque Variable" dist/assets/*.css && grep -o '"fonts"' dist/sw.js
```

Očekivano: build prolazi, `fbf6ee` je pronađen, broj za Bricolage je veći od 0, a `dist/sw.js` sadrži keš `"fonts"`. `npm test` i dalje prolazi.

- [ ] **Korak 5: ručna provera**

Pokreni `npm run dev:http` i otvori početnu. Očekivano: aplikacija radi i izgleda skoro isto. Pozadina je jedva primetno toplija, a dugmad i inputi su i dalje stilizovani preko inline stilova. Ako preflight vidno pokvari neki stari element, popravi ga inline u tom elementu, bez novih globalnih pravila.

- [ ] **Korak 6: pravilo i commit**

U `ui-conventions.md` napiši:
- nov UI koristi samo Tailwind klase iz tokena u `src/index.css`, bez hex vrednosti i inline stilova. Izuzetak su vrednosti izračunate u toku rada;
- fontovi se uvoze u `main.jsx` iz fontsource paketa.

```bash
git add src/index.css src/main.jsx vite.config.js package.json package-lock.json .claude/rules/ui-conventions.md
git commit -m "Add Tailwind v4 with the Pijaca design tokens and fonts" -m "- Colors, fonts, radii and shadows from the handoff live in src/index.css (@theme); Bricolage Grotesque, DM Sans and DM Mono ship with the build via fontsource.
- The service worker caches fonts on first use so the app keeps its type offline."
```

---

### Task 6: logo, PWA ikonice i manifest

**Fajlovi:**
- Novo: `scripts/build-icons.mjs`, `scripts/build-icons.test.mjs`, `src/assets/logo.svg`, `public/icon-maskable-512.png`
- Regenerisano: `public/favicon-32.png`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`
- Izmena: `vite.config.js` (manifest), `index.html`, `package.json` (skripta `icons`, devDependencies), `.claude/rules/pwa.md`

**Interfejsi:**
- Proizvodi:
  - `outlineLogoSvg(svg: string, font): string`. Svaki `<text …>b</text>` zamenjuje sa `<path d=… fill=… clip-path=…>`. Putanja je `font.getPath("b", x, y, fontSize).toPathData(2)`, sa `x`, `y` i `font-size` iz atributa tog `<text>` elementa. Uklanja `<metadata>…</metadata>` i atribut `xmlns:c2pa`.
  - `squareCorners(svg: string): string`. Samo prvom `<rect>` (pozadini) postavlja `rx="0"`.
  - `src/assets/logo.svg`: zaobljena verzija sa putanjama, koju faza 2 koristi za `Logo`.
- Izvor: `docs/design/redesign-handoff/assets/logo-nisan.svg`. Font: `node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff`. opentype.js ne čita woff2, zato woff.

- [ ] **Korak 1: instaliraj alate**

`npm install -D opentype.js@^2 @resvg/resvg-js@^2.6 @fontsource/bricolage-grotesque`. Dodaj skriptu `"icons": "node scripts/build-icons.mjs"`.

- [ ] **Korak 2: napiši testove**

`scripts/build-icons.test.mjs` učitava handoff SVG i font, pa proverava:
- `outlineLogoSvg(...)` ne sadrži `<text` ni `<metadata`;
- sadrži tačno dve putanje sa `clip-path="url(#t)"` i `clip-path="url(#b)"`, obe sa `fill="#FFFFFF"`;
- zadržava `stroke="#1D3B2A"` uglove i liniju skenera;
- `squareCorners('<rect width="48" height="48" rx="11" fill="#D9502B"></rect><rect x="1" rx="0.6"></rect>')` vraća `'<rect width="48" height="48" rx="0" fill="#D9502B"></rect><rect x="1" rx="0.6"></rect>'`.

- [ ] **Korak 3: pokreni i proveri da ne prolaze**

Pokreni `npm test -- scripts`. Očekivano: FAIL, nema modula.

- [ ] **Korak 4: implementiraj skriptu**

Funkcije su izvezene, a `main()` se pokreće samo kad se fajl pozove direktno (`import.meta.url === pathToFileURL(process.argv[1]).href`). `main()` piše:
- `src/assets/logo.svg`: zaobljena verzija;
- iz zaobljene verzije, preko `new Resvg(svg, { fitTo: { mode: "width", value } }).render().asPng()`: `public/favicon-32.png` (32), `public/icon-192.png` (192), `public/icon-512.png` (512);
- iz `squareCorners` verzije (iOS sam zaobljava, a maskable mora biti do ivica): `public/apple-touch-icon.png` (180), `public/icon-maskable-512.png` (512).

Znak je već skaliran na 0,62 i staje u bezbednu zonu od 80%.

- [ ] **Korak 5: pokreni testove i skriptu**

Pokreni:

```bash
npm test && npm run icons && sips -g pixelWidth public/favicon-32.png public/apple-touch-icon.png public/icon-192.png public/icon-512.png public/icon-maskable-512.png
```

Očekivano: testovi prolaze, a širine su 32, 180, 192, 512 i 512. Otvori `public/icon-512.png` i `public/icon-maskable-512.png` i proveri okom: belo „b“ prepolovljeno sa pomerenom donjom polovinom, tamni uglovi i linija, narandžasta pozadina (zaobljena, odnosno do ivica).

- [ ] **Korak 6: manifest i `index.html`**

U `vite.config.js` (manifest):
- `theme_color` i `background_color` → `"#FBF6EE"`;
- u `icons` dodaj `{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }`.

U `index.html`:
- `theme-color` → `#FBF6EE`;
- viewport dobija `viewport-fit=cover`.

- [ ] **Korak 7: build i provera manifesta**

Pokreni `npm run build && grep -o '"purpose":"maskable"' dist/manifest.webmanifest && grep -o '"theme_color":"#FBF6EE"' dist/manifest.webmanifest`. Očekivano: oba pronađena.

- [ ] **Korak 8: pravilo i commit**

U `pwa.md`:
- ikonice se prave sa `npm run icons` iz handoff logoa;
- boje manifesta su `#FBF6EE`.

```bash
git add scripts src/assets public vite.config.js index.html package.json package-lock.json .claude/rules/pwa.md
git commit -m "Use the Nišan logo for the app icons" -m "- scripts/build-icons.mjs outlines the logo letter with the real Bricolage font and renders favicon, apple-touch, 192/512 and a new maskable icon.
- Manifest and theme colors move to the new cream background; viewport covers the safe areas."
```

---

### Task 7: završna provera faze 1

- [ ] **Korak 1: kompletna lokalna provera**

Pokreni `npm test && npm run build`. Očekivano: sve prolazi, bez upozorenja osim postojećeg o veličini chunk-a.

- [ ] **Korak 2: push grane i preview**

Pokreni `git push -u origin redesign`. Vercel pravi preview za svaki push grane, i bez PR-a. Link uzmi iz `gh api repos/Bankacha/brancode/deployments --jq '.[0].statuses_url'` → poslednji status → `environment_url`, ili sa Vercel dashboard-a. Ako preview traži prijavu na Vercel (Deployment Protection), korisnik se prijavljuje svojim Vercel nalogom na telefonu.

- [ ] **Korak 3: provera na telefonu (korisnik, Android)**

Na preview linku:
1. Otvori direktno `<preview>/rucni-unos`. Učitava se aplikacija, ne 404.
2. Skeniraj artikal. Izmena se otvara na `/`. Sistemsko „nazad“ sa `/skeniranje` vraća na `/`, a indikator kamere se gasi.
3. Pošalji listu mejlom. Mejl stiže, pa `/api/send-email` nije prepisan.
4. Dodaj aplikaciju na početni ekran. Ikonica je novi logo, bez belog kruga oko njega.

- [ ] **Korak 4: zapiši rezultat**

Ako nešto ne prođe, popravka ide u novi commit na `redesign` pre faze 2. Faza 2 se planira tek posle uspešne provere.

---

## Faze 2–4

Planiraju se pred svaku fazu, na osnovu spec-a i saznanja iz faze 1:
- **Faza 2:** početna i lista (01, 02, meni, 07, 08, 09), `BottomSheet` sa istorijom i prevlačenjem, `Toast`, `Logo`.
- **Faza 3:** `PriceTag`, raspored za pregled u `lib/priceTags.js` i ekran `/pregled` (06).
- **Faza 4:** `lib/scanner.js` (kamera, zxing, poređenje čitača), ekrani 03, 04 i 05, uklanjanje `legacyTheme.js` i IBM Plex fonta.
