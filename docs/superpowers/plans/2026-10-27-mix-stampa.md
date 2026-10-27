# Mix štampa (0.12.0): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:** u pregledu štampe četvrti izbor „Mix“, gde svaka cena dobija Raf ili Friz. Izvoz pravi poseban Excel za svaki format, a izbor se pamti po artiklu u bazi (`products.tag_format`).

**Arhitektura:**
- **Pravila u `lib/printQueue.js`:** stavka liste dobija `mixFormat`, pa izbor ostaje na telefonu, kao `copies` i `promo`. Raspodela po formatu i početni izbor (lokalni, pa zapamćeni, pa raf) su čiste funkcije.
- **Baza u `lib/tagFormats.js`:** čitanje i upis kolone `tag_format`, preko `barcodeCandidates`, u delovima po 100. Upis šalje samo kolonu formata.
- **Ekran:** `PrintPreview` za Mix umesto A4 stranica prikazuje `MixList`. Izvoz pravi jedan workbook po nepraznoj grupi postojećim `buildWorkbookBuffer`, šalje ih jednim mejlom (`api/send-email.js` prima listu priloga) ili ih preuzima jedan za drugim.

**Tehnologije:** React 18, Supabase JS, ExcelJS, Vitest + Testing Library, lucide (`ArrowRightLeft`).

**Spec:** [`2026-10-27-brancode-mix-stampa-design.md`](../specs/2026-10-27-brancode-mix-stampa-design.md). SQL je u `supabase/migrations/20261027_products_tag_format.sql`.

**Grana:** `mix`. Na `main` ide jedan squash commit, verzija 0.12.0.

## Globalna ograničenja

- **Formati u Mix-u** su samo `"shelf"` (Raf) i `"fridge"` (Friz). Podrazumevan je `"shelf"`.
- **Natpisi na izboru formata:** „Raf“, „Friz“, „Voće“, „Mix“, sa ikonicama `LayoutGrid`, `Refrigerator`, `Apple`, `ArrowRightLeft`.
- **Izbor na telefonu** je `item.mixFormat`. On je jači od zapamćenog u bazi, a zapamćeni od raf.
- **Upis u bazu** ide samo za kolonu `tag_format`, samo za stavke pronađene u `products`, i tek posle uspešnog izvoza iz Mix-a. Štampa u jednom formatu ne upisuje ništa.
- **Neuspeh upisa** ne obara izvoz. Poruka je „Format nije zapamćen za sledeći put.“
- **Imena fajlova** su postojeća: `sheetFilename("shelf" | "fridge")`. Prazna grupa ne pravi fajl.
- **Mejl:** naslov za Mix sa dva fajla je „Cenovnici – raf i friz“. Tekst za priloge koji su svi `.xlsx` kaže da se otvaraju u Excel-u.
- **Sav korisnički tekst je na srpskom.** Brojevi sa imenicom idu kroz `plural()`.

## Review Focus

1. **Artikal ponovo skeniran posle izbora Friz u Mix-u** zadržava Friz, a prozor za cenu pokazuje cenovnik za frižider. Testovi su u Task 1.
2. **Zapamćen format za artikal čiji je red u bazi kraći** (lista ima 13 cifara iz lifleta, a baza 12): Mix ga nađe, a upis ide na red od 12 cifara. Test je u Task 2.
3. **Telefon blokira drugo preuzimanje:** poruka posle preuzimanja ima dugme „Preuzmi friz“, koje preuzima drugi fajl. Test je u Task 3.
4. **Sve stavke u jednom formatu:** pravi se jedan fajl, mejl sa jednim prilogom ima stari naslov, i nema praznog fajla. Test je u Task 3.
5. **Upis formata ne uspe** (nema veze posle slanja): mejl je poslat, poruka o uspehu stoji, a ispod je poruka da format nije zapamćen. Test je u Task 3.

---

### Task 1: Izbor na stavci i pravila Mix-a

**Fajlovi:**
- `src/lib/printQueue.js` + test;
- `src/lib/printFormat.js` + test;
- `src/lib/useProductEditor.js` + test;
- `src/sheets/EditSheet.jsx` + test.

**Produces:**
- `MIX_FORMATS = ["shelf", "fridge"]` u `printQueue.js`.
- `withMixFormat(item, format): item`, gde je format jedan od `MIX_FORMATS`.
- `mixChoice(item, remembered?: "shelf" | "fridge" | null) → { format, isNew }`:
  - `item.mixFormat`, ako postoji, sa `isNew: false`;
  - inače `remembered`, sa `isNew: false`;
  - inače `"shelf"`, sa `isNew: true`.
- `splitForMix(queue, rememberedOf: (item) => format | null) → { shelf: item[], fridge: item[] }`: redosled liste ostaje, a stavke zadržavaju `copies` i `promo`.
- `printFormat.js`:
  - `parseStoredFormat` prihvata i `"mix"`;
  - `PRINT_FORMATS = ["shelf", "fridge", "fruit", "mix"]`;
  - `tagFormatOf(format, mixFormat) → format === "mix" ? mixFormat ?? "shelf" : format`.
- `useProductEditor` čuva `mixFormat` kao `promo`: `open` ga uzima sa stavke istog barkoda, `openItem` sa stavke, a `save`/`skip` ga upisuju.
- `EditSheet` crta pregled u formatu `tagFormatOf(format, editor.mixFormat)`.

- [ ] **Testovi** (prvo crveni):
  - `printQueue.test.js`:
    - `mixChoice({}, null)` daje `{ format: "shelf", isNew: true }`;
    - `mixChoice({}, "fridge")` daje `{ format: "fridge", isNew: false }`;
    - `mixChoice({ mixFormat: "shelf" }, "fridge")` daje `{ format: "shelf", isNew: false }`;
    - `withMixFormat(a, "fridge").mixFormat` je `"fridge"`;
    - `splitForMix([a, {…b, mixFormat:"fridge", copies:3}, c], () => null)` daje `shelf` = `[a, c]` i `fridge` = `[b sa copies 3]`.
  - `printFormat.test.js`:
    - `parseStoredFormat("mix")` daje `"mix"`;
    - `tagFormatOf("mix", "fridge")` daje `"fridge"`;
    - `tagFormatOf("mix", undefined)` daje `"shelf"`;
    - `tagFormatOf("fruit", "fridge")` daje `"fruit"`.
  - `useProductEditor.test.jsx`, Review Focus 1: lista ima `{…a, mixFormat: "fridge"}`, pa `open("1")` i `save()` zadrže `mixFormat: "fridge"`.
  - `EditSheet.test.jsx`, Review Focus 1: `format="mix"` i `editor.mixFormat: "fridge"` pokazuju „Ovako izgleda cenovnik u frižideru“; bez `mixFormat` je „na rafu“.
- [ ] Implementacija. `npm test`. Commit.

### Task 2: Zapamćeni formati u bazi

**Fajlovi:** novo `src/lib/tagFormats.js` + test, i `src/lib/products.test.js` (provera da čuvanje ne šalje `tag_format`).

**Consumes:** `barcodeCandidates` iz `lib/products.js`.

**Produces:**
- `readTagFormats(barcodes: string[], client = supabase) → Map<string, { dbBarcode: string, format: "shelf" | "fridge" | null }>`:
  - ključ je barkod sa liste;
  - za svaki se uzima prvi kandidat iz `barcodeCandidates` koji postoji u `products`;
  - `select("barcode, tag_format").in("barcode", deo od 100)`;
  - barkod koga nema u bazi nema ključ.
- `saveTagFormats(rows: { dbBarcode, format }[], client = supabase)`: grupiše po formatu i radi `update({ tag_format }).in("barcode", deo od 100)`. Baca grešku Supabase-a.

- [ ] **Testovi** (prvo crveni, sa lažnim klijentom kao u `inventories.test.js`):
  - Review Focus 2: `readTagFormats(["8600005000122"])`, a baza ima samo `860000500012` sa `fridge`, daje `{ dbBarcode: "860000500012", format: "fridge" }`;
  - tačan kod ima prednost kad postoje oba reda;
  - 250 barkodova daje upite od najviše 100 kandidata;
  - `saveTagFormats([{dbBarcode:"1",format:"fridge"},{dbBarcode:"2",format:"shelf"},{dbBarcode:"3",format:"fridge"}])` daje dva `update` poziva:
    - `{ tag_format: "fridge" }` sa `in("barcode", ["1","3"])`;
    - `{ tag_format: "shelf" }` sa `["2"]`;
    - nijedan ne sadrži `price` ni `name`;
  - greška klijenta se baca;
  - `products.test.js`: `saveProduct` šalje samo `barcode`, `name` i `price` (nema `tag_format`).
- [ ] Implementacija. `npx vitest run src/lib/tagFormats.test.js src/lib/products.test.js`. Commit.

### Task 3: Mix u pregledu štampe i izvoz

**Fajlovi:**
- novo `src/components/MixList.jsx`;
- `src/screens/PrintPreview.jsx` + test;
- `src/App.jsx` (`PrintPreview` dobija `setQueue`);
- `src/lib/email.js` + test, `api/send-email.js`, `src/emailEndpoint.test.js`;
- `src/lib/download.js`.

**Consumes:** Task 1 (`mixChoice`, `splitForMix`, `withMixFormat`, `PRINT_FORMATS`) i Task 2 (`readTagFormats`, `saveTagFormats`).

**Produces:**
- **`MixList({ queue, remembered, loadFailed, onChoose(item, format) })`:**
  - brojevi „Raf N“ i „Friz N“ (`tagCount` po grupi);
  - poruka „Zapamćeni formati nisu učitani.“ kad je `loadFailed`;
  - red: naziv, `barkod · cena`, oznaka „NOVO“ kad je `isNew`, i prekidač `role="radiogroup"` sa dugmadima „Raf“ i „Friz“ (`aria-checked`);
  - izgled B1 sa skice (tamno raf, plavo friz).
- **`PrintPreview({ queue, setQueue })`:**
  - četiri formata sa natpisima i ikonicama iz Globalnih ograničenja;
  - kad je izabran `"mix"`:
    - pri otvaranju se pokreće `readTagFormats(queue.map(barcode))`;
    - umesto `PagePreview` stoji `MixList`;
    - tap menja stavku kroz `setQueue(queue.map(… withMixFormat …))`.
- **`sendSheetsByEmail(files: { filename, buffer }[], { subject })`** u `email.js`: šalje `{ files: [{ filename, base64 }], subject }`. Greške su iste kao kod `sendFileByEmail`.
- **`api/send-email.js`** prima `files: [{ filename, base64 }]` ili stari `{ filename, base64 }`.
  - Zbir dužina ide do `MAX_BASE64_LENGTH`, inače 413.
  - Tekst za priloge koji su svi `.xlsx` je: „U prilogu je generisan cenovnik. Otvorite prilog u Excel-u: pregled priloga u mejlu ne prikazuje barkodove.“ za jedan prilog, a za više: „U prilogu su generisani cenovnici. Otvorite priloge u Excel-u: pregled priloga u mejlu ne prikazuje barkodove.“.
  - Inače je tekst kao do sada.
  - Naslov: dat `subject`, inače `Cenovnik – <filename>`.
- **Izvoz u Mix-u:**
  - `splitForMix` daje grupe, a za svaku nepraznu ide `buildWorkbookBuffer(grupa, format)`;
  - „Pošalji“:
    - dva fajla: `sendSheetsByEmail(…, { subject: "Cenovnici – raf i friz" })`;
    - jedan fajl: postojeći `sendSheetByEmail`;
  - „Excel“ preuzima fajlove jedan za drugim, pa prikazuje poruku „Preuzeto: 2 fajla“ sa dugmetom „Preuzmi friz“ (ili „Preuzmi raf“, ako je friz jedini), koje ponovo preuzima drugi fajl;
  - posle uspeha: `saveTagFormats` za stavke koje imaju `dbBarcode` u `remembered`, sa njihovim trenutnim izborom (`mixChoice`). Neuspeh daje poruku „Format nije zapamćen za sledeći put.“ (`kind: "error"`), posle poruke o uspehu.

- [ ] **Testovi** (prvo crveni). `PrintPreview.test.jsx` (mock `../lib/tagFormats.js`, `email.js`, `download.js`):
  - postoje četiri dugmeta formata, Raf, Friz, Voće i Mix, i Mix se pamti (`print-format` = `"mix"`);
  - Mix pokazuje listu sa „NOVO“ za stavku bez zapamćenog formata, a zapamćeni „Friz“ je izabran i bez „NOVO“;
  - tap „Friz“ menja brojeve: „Raf 1“ i „Friz 2“ (jedna stavka ima `copies: 2` u Friz);
  - Review Focus 4: sve na Raf, pa „Pošalji“ zove `sendSheetByEmail` jednom, a `buildWorkbookBuffer` je pozvan samo sa `"shelf"`;
  - dva formata, pa „Pošalji“ zove `sendSheetsByEmail` sa dva fajla (`cenovnik-raf-…`, `cenovnik-frizider-…`) i naslovom „Cenovnici – raf i friz“, a posle toga `saveTagFormats` sa `[{dbBarcode, format}]` samo za stavke iz baze;
  - Review Focus 5: `saveTagFormats` baci grešku, pa se i dalje vidi „Poslato na mejl radnje“, i pojavljuje se „Format nije zapamćen za sledeći put.“;
  - Review Focus 3: „Excel“ zove `downloadWorkbook` za oba formata, a dugme „Preuzmi friz“ u poruci zove ga ponovo samo za `"fridge"`;
  - bez veze za formate: „Zapamćeni formati nisu učitani.“, a izvoz radi.

  `emailEndpoint.test.js`:
  - `files` sa dva `.xlsx` šalje dva priloga i tekst „Otvorite priloge u Excel-u“;
  - zbir preko granice daje 413;
  - stari oblik radi kao pre.

  `email.test.js`: `sendSheetsByEmail` šalje `files` sa base64 i `subject`.
- [ ] Implementacija. `npm test`. Commit.

### Task 4: Dokumentacija, verzija i provera

**Fajlovi:**
- `CLAUDE.md` (Mix, `tagFormats.js`);
- `.claude/rules/products-and-barcodes.md` (`tag_format`, `mixFormat`);
- `.claude/rules/price-tag-export.md` (Mix izvoz);
- `.claude/rules/email-api.md` (`files`);
- `docs/testing/redesign-test-checklist.md`, `docs/pitanja.md`;
- `package.json` (`npm version 0.12.0 --no-git-tag-version`).

- [ ] Dokumenta i verzija.
- [ ] `npm test && npm run build`.
- [ ] Provera u browseru, na privremenoj stranici bez prijave, koja se posle briše:
  - Mix lista, prekidači i brojevi;
  - izgled na širini telefona;
  - u bazu se ništa ne upisuje: upis formata posle izvoza se ne proverava uživo, jer bi tražio prijavu i upis u bazu.
- [ ] Commit.
