# Brancode redizajn — faza 4 (skeniranje, izmena, ručni unos): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cilj:** poslednja faza redizajna. Dodaje:
- novi ekran za kameru (03) sa skeniranjem u nizu;
- izmenu prilagođenu izvoru (03 ili 04, dugmad po tabeli iz spec-a);
- novi ručni unos sa tastaturom (05);
- bolja podešavanja kamere i zxing čitač za iPhone (privremeni izbor čitača za poređenje na Androidu);
- uklanjanje starog koda (`legacyTheme.js`, `LegacyLayout`, IBM Plex).

**Arhitektura:**
- `lib/scanner.js` drži čiste odluke (potvrda čitanja, izbor kamere, izbor čitača) i kontroler kamere.
- Sheet za izmenu se posle skeniranja ili ručnog unosa otvara preko tog ekrana, a ne na `/`. Kamera ostaje pauzirana iza sheet-a.
- Izmena iz liste ostaje na `/`.
- `EditSheet` dobija `source` (`"scan" | "manual" | "list"`), a dugmad i sadržaj idu po tabeli iz spec-a.

**Tehnologije:** dosadašnje + `barcode-detector@^3` (zxing-wasm ponyfill, isti `detect()` interfejs kao ugrađeni `BarcodeDetector`).

**Spec:** [`docs/superpowers/specs/2026-10-17-brancode-redesign-design.md`](../specs/2026-10-17-brancode-redesign-design.md), odeljci „Odluke“ 1–2, „03 · Skeniranje“, „04 · Izmena“, „05 · Ručni unos“ i „Logo i PWA“ (keš za zxing). Vizuelni detalji su u handoff README-u (03, 05).

**Prethodna faza:** [`2026-10-18-brancode-redesign-phase-3.md`](2026-10-18-brancode-redesign-phase-3.md).

## Globalna ograničenja

- Sva ograničenja faza 1–3 i dalje važe.
- **Formati čitanja** ostaju isti: `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`, `code_39`.
- **zxing wasm** je deo build-a. Učitava se tek kad je potreban: uređaj bez `BarcodeDetector`-a ili izbor „zxing“ u meniju. Service worker ga čuva u kešu pri prvoj upotrebi (`runtimeCaching`, keš `scanner`).
- **Kamera:**
  - zahtev: `{ facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }`, ili `deviceId: { exact }` kad je kamera izabrana;
  - posle otvaranja `focusMode: "continuous"` gde `getCapabilities()` to nudi;
  - gasi se na unmount i na `visibilitychange` → `hidden`, a pali se ponovo na `visible`.
- **Ključevi u `localStorage`:** `camera-device` (izabrana kamera) i `scanner-reader` (`"auto" | "native" | "zxing"`, podrazumevano `"auto"`).
- **Privremeni izbor čitača** u meniju ostaje dok korisnik ne uporedi čitače na telefonu. Uklanja se posle toga, van ovog plana.
- **Na kraju faze nema** `legacyTheme.js`, `LegacyLayout.jsx` ni učitavanja IBM Plex fonta.

## Fokus pregleda

1. **Dva brza čitanja istog barkoda** ne otvaraju sheet dvaput, a jedno pogrešno pročitano kadriranje ne otvara sheet. Test: `createReadConfirmer` u Task 1.
2. **Odbijena dozvola za kameru** daje status „Nema dozvole za kameru.“ sa „Upiši ručno“, bez praznog crnog ekrana. Test: `cameraErrorKind` u Task 1, a status u Task 4.
3. **„Nazad“ dok je otvoren sheet preko kamere** samo zatvara sheet, artikal se ne dodaje i kamera nastavlja. „Sačuvaj i završi“ vodi na početnu bez ekrana kamere u istoriji. Test: `finishScreen` u Task 3.
4. **Ručni unos:** više od 20 cifara, slova i nule na početku. Kod ostaje samo od cifara, najviše 20, a nule na početku se čuvaju. Test: `typeDigit` / `eraseDigit` u Task 2.
5. **„Preskoči“** dodaje artikal u listu bez upisa u bazu. Test: `editor.skip` u Task 3.

---

### Task 1: `lib/scanner.js` — odluke, kontroler kamere i zxing

**Fajlovi:**
- Novo: `src/lib/scanner.js`, `src/lib/scanner.test.js`
- Izmena: `package.json`, `vite.config.js` (`runtimeCaching` za `.wasm`)

**Interfejsi:**
- Proizvodi (čiste funkcije):
  - `createReadConfirmer(): (code: string | null) => string | null`. Vraća kod kad ga dva uzastopna kadra pročitaju isto, a posle toga `null` dok se kod ne promeni ili ne pojavi kadar bez koda.
  - `backCameras(devices: MediaDeviceInfo[]): { deviceId, label }[]`. Bira `videoinput` uređaje čiji label sadrži `back`, `rear`, `environment` ili `zadnj` (bez obzira na velika i mala slova). Ako takvih nema, uzima sve `videoinput`.
  - `nextCameraId(cameras, currentId): string | null` → sledeća u krug, ili `null` kad postoji samo jedna ili nijedna.
  - `cameraConstraints(deviceId?: string)`: sa `deviceId` daje `{ deviceId: { exact }, width: { ideal: 1920 }, height: { ideal: 1080 } }`, a bez njega `{ facingMode: "environment", width: …, height: … }`.
  - `readerKind(setting: "auto" | "native" | "zxing", hasNative: boolean): "native" | "zxing"`. `"native"` bez podrške pada na `"zxing"`.
  - `cameraErrorKind(error): "permission" | "unavailable"`. `NotAllowedError` i `SecurityError` su `"permission"`, sve ostalo `"unavailable"`.
- Proizvodi (browser, bez jedinične provere):
  - `createDetector(kind): Promise<{ detect(video) }>`. `native` je `new BarcodeDetector({ formats })`. `zxing` radi `import("barcode-detector/ponyfill")` i `prepareZXingModule({ overrides: { locateFile } })` sa lokalnim wasm-om (`zxing-wasm/reader/zxing_reader.wasm?url`).
  - `startCamera(video, { deviceId }): Promise<{ stream, track, torch: boolean, setTorch(on), stop() }>`, sa zahtevom iz `cameraConstraints` i `focusMode` kad je podržan.

- [ ] **Korak 1: testovi** (`src/lib/scanner.test.js`):
- `createReadConfirmer()`:
  - niz `"A"`, `"A"` → `null`, `"A"`;
  - treće `"A"` → `null`;
  - `null`, pa `"A"`, `"A"` → `"A"` ponovo;
  - `"A"`, `"B"`, `"B"` → `null`, `null`, `"B"`.
- `backCameras([{ kind: "videoinput", deviceId: "1", label: "camera2 1, facing front" }, { kind: "videoinput", deviceId: "0", label: "camera2 0, facing back" }, { kind: "audioinput", deviceId: "m", label: "mic" }, { kind: "videoinput", deviceId: "2", label: "camera2 2, facing back" }])` → ids `["0", "2"]`. Kad nijedan label nije zadnji (npr. prazni labeli), vraća sve `videoinput`.
- `nextCameraId([{deviceId:"0"},{deviceId:"2"}], "0")` → `"2"`, a sa `"2"` → `"0"`. Sa jednom kamerom → `null`.
- `cameraConstraints()` ima `facingMode: "environment"` i `width.ideal` 1920, a `cameraConstraints("x")` ima `deviceId: { exact: "x" }` i nema `facingMode`.
- `readerKind("auto", true)` → `"native"`, `("auto", false)` → `"zxing"`, `("native", false)` → `"zxing"`, `("zxing", true)` → `"zxing"`.
- `cameraErrorKind({ name: "NotAllowedError" })` → `"permission"`, a `{ name: "NotFoundError" }` → `"unavailable"`.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj.**
- `npm install barcode-detector@^3`.
- Proveri da `zxing-wasm/reader/zxing_reader.wasm?url` radi kroz Vite. Ako paket ne izvozi taj put, nađi stvarni put u `node_modules/zxing-wasm/package.json` „exports“ i zapiši ruling.
- `vite.config.js` `workbox.runtimeCaching` dobija `{ urlPattern: ({ url }) => url.pathname.endsWith(".wasm"), handler: "CacheFirst", options: { cacheName: "scanner" } }`.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi, a u `dist/assets` postoji `zxing_reader-*.wasm`.

- [ ] **Korak 5: commit**

```bash
git add package.json package-lock.json vite.config.js src/lib/scanner.js src/lib/scanner.test.js
git commit -m "Add the scanner module: camera settings, read confirmation and a zxing fallback"
```

---

### Task 2: ručni unos (05)

**Fajlovi:**
- Novo: `src/lib/manualCode.js`, `src/lib/manualCode.test.js`
- Izmena: `src/screens/ManualEntry.jsx` (ceo)

**Interfejsi:**
- Proizvodi:
  - `typeDigit(code: string, key: string): string` dodaje cifru 0–9 dok je dužina ispod 20, a sve ostalo ignoriše.
  - `eraseDigit(code: string): string`.
  - `ManualEntry({ editor, queueLength })` po handoff-u 05:
    - **Zaglavlje:** nazad (`ArrowLeft`) → `leaveScreen` i naslov `Upiši barkod`.
    - **Uneti broj:** DM Mono 34, tracking 0.06em, kursor 3×38 `bg-accent` (`animate-pulse`).
    - **Indikator:** 13 crtica 10×4 (`rounded-xs`), popunjene `bg-ink`, prazne `bg-border`. Ispod `${n} od 13 cifara · EAN, UPC ili interna šifra`.
    - **Tastatura 3×4:** 60px, `bg-surface border-[1.5px] border-border-soft rounded-field`, Bricolage 26/700. Tasteri su 1–9, `Delete` ikonica (⌫, `aria-label="Obriši"`), 0 i `Check` (`aria-label="Potvrdi"`).
    - **Dugme:** `Nastavi` (`variant="dark"`), onemogućeno dok je kod prazan.
    - **Fizička tastatura:** `keydown` na `window` za 0–9, Backspace i Enter.
    - **„Nastavi“ i ✓:** `editor.open(code)`, pa `sheet.open("edit")` na `/rucni-unos`. Sheet je `EditSheet` sa `source="manual"` (Task 3).

- [ ] **Korak 1: testovi** (`manualCode.test.js`):
- `typeDigit("", "8")` → `"8"`;
- `typeDigit("12", "a")` → `"12"`;
- `typeDigit("0", "0")` → `"00"` (nule na početku ostaju);
- `typeDigit("1".repeat(20), "2")` → 20 jedinica;
- `eraseDigit("123")` → `"12"`, a `eraseDigit("")` → `""`.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj** `manualCode.js`, pa novi `ManualEntry`. Sheet se uključuje kad Task 3 doda `source` u `EditSheet`. Do tada `ManualEntry` renderuje `EditSheet` bez `source`, sa dosadašnjim „Sačuvaj i zatvori“.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: commit**

```bash
git add src/lib/manualCode.js src/lib/manualCode.test.js src/screens/ManualEntry.jsx src/App.jsx
git commit -m "Redesign manual barcode entry with an on-screen keypad"
```

---

### Task 3: izmena po izvoru, „Preskoči“ i završetak

**Fajlovi:**
- Izmena: `src/sheets/EditSheet.jsx`, `src/sheets/EditSheet.test.jsx`, `src/lib/useProductEditor.js`, `src/lib/useProductEditor.test.jsx`, `src/lib/navigation.js`, `src/lib/navigation.test.js`, `src/screens/Home.jsx`, `src/App.jsx`

**Interfejsi:**
- Proizvodi:
  - `editor.skip(): Item | null` dodaje trenutni naziv i cenu u listu (`upsertQueueItem`) bez `saveProduct`, a `null` vraća ako `canSave` nije ispunjen. Editor dobija i `oldPrice: string | null`, tj. cenu iz baze pri `open` (za labelu „bila X“).
  - `finishScreen(navigate, screenWasFirstPage: boolean)`: zatvara sheet i napušta ekran u jednom koraku. Kad je ekran bio prva učitana strana radi `navigate("/", { replace: true })`, a inače `navigate(-2)`.
  - `EditSheet({ editor, open, onClose, format, source, sessionCount, onSave, onSaveNext, onSkip, onFinish })`:
    - **Sadržaj 03** (`source` je `"scan"` ili `"manual"`, a `badge` je „U bazi“): bez pregleda cenovnika, labela cene `Cena · bila ${oldPrice}`. Za `"scan"` desno od barkoda piše `${sessionCount}. u nizu`.
    - **Sadržaj 04** (ostali slučajevi): pregled cenovnika i labela `Cena`.
    - Dugmad po tabeli iz spec-a (04 · Izmena):

      | source / sadržaj | dugmad |
      |---|---|
      | scan / 03 | `Sačuvaj i skeniraj sledeći` (accent, `ScanBarcode`) → `onSaveNext`; ispod levo `Preskoči` → `onSkip`, desno `Sačuvaj i završi (${sessionCount})` → `onFinish` |
      | scan / 04 | `Sačuvaj i skeniraj sledeći` → `onSaveNext`; `Sačuvaj i zatvori` → `onFinish` |
      | manual | `Sačuvaj i upiši sledeći` → `onSaveNext`; `Sačuvaj i zatvori` → `onFinish` |
      | list | `Sačuvaj i zatvori` → `onSave` |

    - Za `source="scan"` sheet ne zatvara tap na pozadinu (`BottomSheet` dobija `closeOnScrim`), ali prevlačenje i „nazad“ ga zatvaraju (= odustani).
  - ManualEntry (od Task 2) sam otvara sheet sa `editor`-om. `Home` zadržava sheet za izvor `"list"`. `openCode` u `App`-u ostaje samo za stari Scan, a uklanja ga Task 4.

- [ ] **Korak 1: testovi**
- `useProductEditor.test.jsx`:
  - posle `open` sa nađenim artiklom (`price: 79`) `oldPrice` je „79,00“;
  - `skip()` dodaje `{ barcode, name, price }` u listu i ne zove `saveProduct`.
- `navigation.test.js`:
  - `finishScreen(nav, false)` → `[[-2]]`;
  - `finishScreen(nav, true)` → `[["/", { replace: true }]]`.
- `EditSheet.test.jsx`:
  - `source="scan"`, „U bazi“, `sessionCount={3}`, `oldPrice: "79,00"`: vide se „3. u nizu“, „Cena · bila 79,00“, „Sačuvaj i skeniraj sledeći“, „Preskoči“ i „Sačuvaj i završi (3)“, a nema „Ovako izgleda cenovnik“;
  - `source="scan"` sa „Novi artikal“: vidi se „Ovako izgleda cenovnik“ i „Sačuvaj i zatvori“, a nema „Preskoči“;
  - `source="manual"`: „Sačuvaj i upiši sledeći“;
  - `source="list"`: samo „Sačuvaj i zatvori“;
  - klik na „Preskoči“ zove `onSkip`.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj.** U `ManualEntry` poveži:
- `onSaveNext`: čuvanje, pa status „Dodato“, `sheet.close()` i prazan kod;
- `onFinish`: čuvanje, pa status i `finishScreen`.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: commit**

```bash
git add src/sheets src/lib/useProductEditor.js src/lib/useProductEditor.test.jsx src/lib/navigation.js src/lib/navigation.test.js src/screens src/App.jsx src/components/BottomSheet.jsx
git commit -m "Tailor the edit sheet to where it was opened from, with skip and finish actions"
```

---

### Task 4: ekran za kameru (03)

**Fajlovi:**
- Izmena: `src/screens/Scan.jsx` (ceo), `src/sheets/MenuSheet.jsx`, `src/screens/Home.jsx`
- Novo: `src/lib/useScannerReader.js` (izbor čitača u `localStorage`), `src/screens/Scan.test.jsx`

**Interfejsi:**
- Troši: Task 1 (sve), Task 3 (`EditSheet`, `finishScreen`, `editor.skip`).
- Proizvodi:
  - `useScannerReader(): [setting, setSetting]`, sa ključem `scanner-reader`, uz try/catch kao ostali store-ovi.
  - `Scan({ editor })` po handoff-u 03:
    - **Osnova:** video preko celog ekrana (`object-cover`). Dok nema slike: `bg-camera` sa prugama `bg-[repeating-linear-gradient(135deg,var(--color-camera)_0_14px,var(--color-camera-stripe)_14px_28px)]`.
    - **Gornja traka:** zatvori (`X`) → `leaveScreen`; oznaka `kamera` (sa više zadnjih kamera `kamera ${i}/${n}`), čiji tap prebacuje na `nextCameraId` i pamti `camera-device`; blic (`Flashlight`) samo kad je `torch` dostupan. Sve na `bg-black/40`.
    - **Dok traži:** okvir 280×170, `rounded-[28px]`, ivica 3px `border-bg`, linija `bg-accent` na 85% širine i tekst `Usmeri na barkod`.
    - **Kad je pročitao** (sheet otvoren): video pauziran, petlja stoji, okvir 240×120 `rounded-card` sa ivicom i linijom `success`, a ispod `CircleCheck` (`text-success-light`) i `Pročitano · kamera na pauzi`. Okvir je u gornjih oko 250px.
    - **Petlja:** `requestAnimationFrame`, `detect(video)`, pa `createReadConfirmer`. Potvrđen kod → `editor.open(code)`, `sessionCount + 1`, `sheet.open("edit")`.
    - **Sheet:** `EditSheet` sa `source="scan"`, `sessionCount`. Kad se sheet zatvori (bilo kako), video i petlja nastavljaju.
      - `onSaveNext`: čuvanje, pa status „Dodato“ i `sheet.close()`;
      - `onSkip`: `editor.skip()`, status „Dodato“ i `sheet.close()`;
      - `onFinish`: čuvanje, pa status i `finishScreen`.
      - Greška pri čuvanju daje isti status „Nema veze…“ sa „Ponovi“ kao na početnoj.
    - **Greška kamere:** status `Nema dozvole za kameru.` (`CameraOff`) sa akcijom `Upiši ručno` → `navigate("/rucni-unos", { replace: true })` za `"permission"`, ili `Kamera nije dostupna.` sa istom akcijom za `"unavailable"`.
    - **Brojač sesije** je stanje ekrana i resetuje se pri unmount-u.
  - `App` gubi `openCode` i Scan dobija `editor`.
  - **Meni:** privremena sekcija `Čitač barkoda (test)` sa tri dugmeta `Automatski` / `Ugrađeni` / `zxing` (`aria-pressed`) → `useScannerReader`.

- [ ] **Korak 1: test** (`src/screens/Scan.test.jsx`, jsdom, `MemoryRouter`, `ToastProvider`):
- mock `../lib/scanner.js`: čiste funkcije prave, a `startCamera` odbija sa `{ name: "NotAllowedError" }`;
- posle renderovanja vidi se status „Nema dozvole za kameru.“ sa „Upiši ručno“;
- klik na „Upiši ručno“ vodi na `/rucni-unos` (test ruta prikazuje „MANUAL“).

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj.**

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: ručna provera u ugrađenom browseru** (Chromium na Mac-u ima `BarcodeDetector`):
- ekran se otvara, a odbijena dozvola pokazuje status;
- ako kamera radi, bar izgled okvira i gornje trake;
- zatvaranje gasi kameru (`track.readyState === "ended"`).

Skeniranje pravih barkodova, blic, prebacivanje kamera i poređenje čitača rade se na telefonu u završnom testu.

- [ ] **Korak 6: commit**

```bash
git add src/screens/Scan.jsx src/screens/Scan.test.jsx src/lib/useScannerReader.js src/sheets/MenuSheet.jsx src/screens/Home.jsx src/App.jsx
git commit -m "Redesign the scanner: continuous scanning with a paused camera behind the edit sheet"
```

---

### Task 5: uklanjanje starog koda i dokumentacija

**Fajlovi:**
- Brisanje: `src/lib/legacyTheme.js`, `src/screens/LegacyLayout.jsx`
- Izmena: `src/App.jsx`, `CLAUDE.md`, `.claude/rules/ui-conventions.md`, `.claude/rules/pwa.md`, `.claude/rules/products-and-barcodes.md` (ako pominje tok skeniranja)

- [ ] **Korak 1:** pokreni `grep -rn "legacyTheme\|LegacyLayout\|IBM Plex" src`. Očekivano: nema pogodaka u `src/` posle brisanja.

- [ ] **Korak 2: dokumentacija**
- **`CLAUDE.md`:**
  - rute i ekrani;
  - `lib/scanner.js` (native ili zxing, `scanner-reader`, `camera-device`);
  - nema više legacy dela;
  - napomena da je izbor čitača u meniju privremen.
- **`ui-conventions.md`:** ukloni deo o `legacyTheme`; fontovi za štampu se uvoze u `PriceTag.jsx` (odloženi sitni nalaz iz faze 3).
- **`pwa.md`:** keš `scanner` za zxing wasm.

- [ ] **Korak 3: provera**

Pokreni `npm test && npm run build`. Očekivano: sve prolazi i build ne sadrži `IBM Plex`.

- [ ] **Korak 4: commit**

```bash
git add -A src CLAUDE.md .claude/rules
git commit -m "Remove the pre-redesign styles and document the scanner"
```
