# Akcija iz lifleta (0.11.0): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:**
- Uvoz lifleta pamti period akcije i redovne cene, a jutarnja provera ih sama vraća posle isteka i šalje podsetnike.
- Na cenovniku piše „Akcija važi do …“.
- Na trebovanju se vidi koja cena je liflet cena.

**Arhitektura:**
- **Tabele** postoje: `promo_leaflets` i `promo_leaflet_items` (`supabase/migrations/20261022_promo_leaflets.sql`, već pokrenut).
- **Pristup podacima** je na jednom mestu: `lib/leafletStore.js`, `createLeafletStore(client)`, bez ikakve logike. Prima bilo koji Supabase klijent: telefon šalje prijavljenog korisnika, a server service-role klijent.
- **Logika** je u čistim modulima nad tim interfejsom, a testovi koriste lažni store u memoriji (`src/test/fakeLeafletStore.js`):
  - `lib/leafletImport.js`: uvoz sa telefona;
  - `lib/promoCheck.js`: jutarnja provera na serveru;
  - `lib/leafletMarks.js`: oznaka na trebovanju.
- **Red akcije na cenovniku** je slika (canvas), postavljena preko vrha ćelije cene, kao uspravni barkod. Excel struktura, visine redova i broj po strani se ne menjaju. Pregled crta istu sliku na istom mestu, iz iste geometrije (`promoLineBox`).
- **Jutarnja provera:** `api/promo-check.js`, Vercel Cron `0 5 * * *` (6–7h zimi, 7–8h leti po beogradskom vremenu). Logika se uvozi iz `src/lib/`.

**Tehnologije:** pdfjs-dist, Supabase JS, ExcelJS, canvas, Resend, Vercel Cron, Vitest.

**Spec:** [`2026-10-20-brancode-akcija-kopije-design.md`](../specs/2026-10-20-brancode-akcija-kopije-design.md), odeljci „Akcija iz lifleta (0.11.0)“ i „Trebovanje: oznaka „Liflet““.

**Grana:** `liflet` (već ima SQL i dopunu spec-a), rebase na `main` posle 0.10.0. Na `main` ide jedan squash commit, verzija 0.11.0.

## Globalna ograničenja

- **Datumi:**
  - u podacima su ISO `yyyy-mm-dd`, a korisnik ih vidi kao `dd.mm.yyyy` (`formatDate`);
  - na telefonu je „danas“ `todayIso()`;
  - na serveru je „danas“ beogradski datum: `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" })`.
- **Tekst na cenovniku:** tačno `Akcija važi do 31.10.2026.` (sa tačkom na kraju).
- **Artikli kojih nema u `products`** se nikad ne upisuju u bazu. Liflet PDF se ne čuva i ne šalje.
- **Vraćanje cene** važi samo ako je u bazi i dalje akcijska cena iz tog lifleta. Cene se porede na 2 decimale. Ručno promenjena cena ostaje.
- **Svaki korak jutarnje provere se pamti u bazi**, pa ponovni poziv ništa ne radi dvaput. Stavka sa upisanim `restore_result` se preskače.
- **Liste** (popis, trebovanje) samo čitaju tabele lifleta i nikad ne pišu ni u njih ni u `products`.
- **Tajne su samo na serveru:** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY`. Bez `CRON_SECRET` funkcija odbija svaki poziv.
- **Sav korisnički tekst je na srpskom.** Brojevi sa imenicom idu kroz `plural()`.

## Review Focus

1. **Isti artikal na dva lifleta zaredom** (stari ističe 31.10., novi počinje 1.11.).
   - 1.11. ujutru je u bazi nova akcijska cena.
   - Kad istekne i novi, vraća se redovna cena od pre starog lifleta, a ne stara akcijska.
   - Test je u Task 4, a deo za uvoz u Task 2.
2. **Artikal skeniran i sačuvan tokom akcije:** red od 12 cifara je premešten na 13. Vraćanje ga i dalje nađe preko `sameArticleCodes` i vrati cenu. Test je u Task 4.
3. **Cena ručno promenjena tokom akcije** ostaje. Mejl posle vraćanja je navodi. Test je u Task 4.
4. **Jutarnja provera dvaput istog dana, ili pukne na pola:** drugi poziv završi posao, a ništa ne uradi dvaput (ni mejl). Test je u Task 4.
5. **Liflet uvezen pre početka akcije:**
   - baza se ne dira do jutra prvog dana;
   - lista za štampu je odmah spremna;
   - podsetnici i vraćanje rade normalno.
   - Testovi su u Task 2 i Task 4.

---

### Task 1: Period iz PDF-a i prozor za uvoz

**Fajlovi:** `src/promoLeaflet.js` + test, `src/sheets/LeafletImportSheet.jsx` + test.

**Produces:**
- `leafletPeriodFromText(text: string): { name: string | null, dateFrom: string, dateTo: string } | null` traži „od d.m.yyyy do d.m.yyyy“:
  - regex `/^(.*?)\s*\bod\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s+do\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?/i`;
  - `name` je tekst ispred „od“, sređen, ili `null` ako ga nema;
  - nepostojeći datum daje `null`.
- `linesFromTextItems(items): string[]` izdvaja grupisanje u redove iz `rowsFromTextItems`, koji ga sada koristi.
- `parseLeafletPdf(…)` vraća `{ rows, period }`. `period` je prvi pogodak `leafletPeriodFromText` u redovima prve strane, ili `null`.
- `LeafletImportSheet({ open, onClose, fileName, leafletName, matches, period, queueLength, saving, onConfirm, today })`:
  - drži `dateFrom` i `dateTo` u svom stanju, počev od `period` (prazni ako ga nema);
  - `onConfirm({ dateFrom, dateTo })`.

**Prozor:**
- naslov kao do sada, a ispod `leafletName` i ime fajla (mono);
- dva `DateField`: „Akcija od“ i „Akcija do“;
- statistika „u bazi, akcijska cena do 31.10.“ (bez datuma dok „do“ nije upisan) i „nisu u bazi, samo u listu“.

**Poruke,** redom, prikazuje se prva koja važi. Za prve tri je „Uvezi“ onemogućen:
- nema perioda u PDF-u i polja su prazna: „Datumi akcije nisu pronađeni u PDF-u. Upiši ih.“;
- `dateTo < dateFrom`: „Kraj akcije ne može biti pre početka.“;
- `dateTo < today`: „Ova akcija je već istekla.“;
- `dateFrom > today`: „Akcijske cene se upisuju u bazu 25.09.2026. ujutru.“;
- inače: „Akcijske cene se upisuju u bazu odmah.“

Uvek stoji još i „Posle isteka akcije redovne cene se vraćaju same.“

- [ ] **Testovi** (prvo crveni):
  - `leafletPeriodFromText("Jutro Liflet Avg od 25.09.2026 do 31.10.2026")` daje `{ name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" }`;
  - `("od 1.9.2026. do 30.9.2026.")` daje `{ name: null, dateFrom: "2026-09-01", dateTo: "2026-09-30" }`;
  - `("Šifra EAN Naziv")` i `("od 31.02.2026 do 10.03.2026")` daju `null`;
  - `linesFromTextItems` spaja stavke jednog reda po x (postojeći testovi `rowsFromTextItems` ostaju);
  - `LeafletImportSheet`:
    - polja popunjena iz `period` (vide se „25.09.2026“ i „31.10.2026“), a statistika kaže „u bazi, akcijska cena do 31.10.“;
    - bez perioda: poruka o datumima i „Uvezi“ onemogućen;
    - „do“ pre „od“: poruka, onemogućen;
    - istekla: poruka, onemogućen;
    - budući početak: poruka „… 25.09.2026. ujutru.“;
    - izmena polja „Akcija do“ (`fireEvent.change` na input), pa „Uvezi“, zove `onConfirm({ dateFrom, dateTo: <novo> })`;
    - postojeći testovi prozora ostaju, uz `period` i `today` u props.
- [ ] Implementacija. `npx vitest run src/promoLeaflet.test.js src/sheets/LeafletImportSheet.test.jsx`. Commit.

### Task 2: Pamćenje lifleta pri uvozu i lista za štampu

**Fajlovi:**
- novo: `src/lib/leafletStore.js` + test (oblik upita na lažnom klijentu), `src/lib/leafletImport.js` + test, `src/test/fakeLeafletStore.js`;
- `src/promoLeaflet.js` (`saveLeafletPrices` se uklanja);
- `src/screens/Home.jsx`, `src/lib/useProductEditor.js` + test, `src/components/QueueRow.jsx`, `src/screens/Home.test.jsx`.

**Produces:**
- `createLeafletStore(client)` sa metodama (sve `async`, bacaju grešku Supabase-a). Kolone se mapiraju u camelCase:
  - `saveLeaflet({ name, dateFrom, dateTo }) → { id, pricesAppliedAt }`: upsert, `onConflict: "name,date_from,date_to"`;
  - `openLeaflets() → Leaflet[]`, gde je `prices_restored_at is null`. Leaflet je `{ id, name, dateFrom, dateTo, pricesAppliedAt, pricesRestoredAt, remindedTomorrowAt, remindedTodayAt }`;
  - `leafletsOn(dateIso) → Leaflet[]`, gde je `date_from <= dateIso <= date_to`, uključujući vraćene;
  - `leafletItems(leafletIds, barcodes?) → Item[]`. Item je `{ leafletId, barcode, name, promoPrice, regularPrice, restoreResult }`. Barkodovi idu u delovima od 100;
  - `saveItems(leafletId, items)`: upsert, `onConflict: "leaflet_id,barcode"`;
  - `setItemResults(leafletId, [{ barcode, restoreResult }])`;
  - `setItemRegularPrice(leafletId, barcode, regularPrice)`;
  - `markLeaflet(id, fields)`, gde su `fields` u camelCase;
  - `products(barcodes) → [{ barcode, name, price }]`, u delovima od 100;
  - `setProductPrices(rows: { barcode, name, price }[])`: upsert u `products`, samo za redove pročitane malopre.
- `importLeaflet(store, { name, dateFrom, dateTo, matches }, today) → { applied: boolean }`, redom:
  1. `saveLeaflet`.
  2. Artikli iz baze (`matches` sa `existing`), jedan po `existing.barcode`.
  3. Redovna cena, po prioritetu:
     - stavka istog lifleta (ponovni uvoz);
     - stavka drugog otvorenog lifleta sa upisanim cenama;
     - `existing.price`.
  4. `saveItems`.
  5. Ako je `dateFrom <= today`: `setProductPrices` sa akcijskim cenama, pa `markLeaflet(id, { pricesAppliedAt: now })`, i `{ applied: true }`. Inače `{ applied: false }` i baza artikala se ne dira.
- **Stavka liste za štampu** dobija `promo: { dateFrom, dateTo }`, i to svaka stavka iz lifleta, i u bazi i van nje.
- **`useProductEditor`** čuva `promo` kao `copies`:
  - `open(code)` uzima ga sa stavke istog barkoda na listi, a `openItem(item)` sa stavke;
  - `save`/`skip` ga upisuju;
  - vraća `promo` (ili `null`).
- **`QueueRow`:** kad postoji `item.promo`, posle barkoda stoji ` · akcija do 31.10.`.
- **`Home.confirmLeaflet({ dateFrom, dateTo })`:**
  - naziv je `period.name`, a ako ga nema, ime fajla bez `.pdf`;
  - zove `importLeaflet(createLeafletStore(supabase), …, todayIso())`;
  - toast „Uvezeno u listu: N“, a ako cene nisu upisane odmah, uz detail „Akcijske cene od 25.09.“;
  - greška: postojeća poruka.

- [ ] **Testovi** (prvo crveni). `leafletImport.test.js` sa lažnim store-om:
  - prvi uvoz pamti redovnu cenu iz baze i upisuje akcijsku, `applied: true`, `pricesAppliedAt` je upisan;
  - artikal van baze nije ni u stavkama ni u `products`;
  - Review Focus 5: `dateFrom` posle `today` ne dira `products` i vraća `applied: false`, a stavke su sačuvane;
  - ponovni uvoz istog lifleta (u bazi je sada akcijska cena) zadrži redovnu cenu iz prvog uvoza;
  - Review Focus 1 (uvoz): artikal je na drugom otvorenom lifletu sa upisanim cenama, pa je redovna cena ona sa tog lifleta, a ne trenutna akcijska.

  `leafletStore.test.js`:
  - `openLeaflets` filtrira `prices_restored_at is null` i mapira kolone;
  - `products` deli 250 barkodova u 3 upita.

  `useProductEditor.test.jsx`: ponovno skeniranje stavke sa `promo` i čuvanje zadrže `promo`.

  `Home.test.jsx`: red sa `promo.dateTo = "2026-10-31"` pokazuje „akcija do 31.10.“.
- [ ] Implementacija. `npm test`. Commit.

### Task 3: Red „Akcija važi do“ na cenovniku

**Fajlovi:** `src/lib/priceTags.js` + test, `src/components/PriceTag.jsx` + test, `src/components/PrintPage.jsx`, `src/sheets/EditSheet.jsx` (pregled dobija `promo` iz editora).

**Produces:**
- `promoLineText(dateTo) → "Akcija važi do 31.10.2026."`
- `promoLineBox(format) → { leftMm, topMm, widthMm, heightMm }` u ćeliji cene, u milimetrima: `leftMm: 0.6`, `topMm: 0.7`, `heightMm: 2.2`, `widthMm: priceWidthMm - 1.2`.
- `makePromoLineDataUrl(text, box)` (samo browser):
  - canvas 12 px/mm, providna pozadina, crn tekst centriran;
  - font `600 <h>px Arial, Helvetica, sans-serif`, gde je `h` 0,8 visine kutije;
  - tekst se smanji ako je širi od kutije.
- `buildWorkbook(queue, format, { …, promoLineImage = makePromoLineDataUrl })`: za stavku sa `promo?.dateTo` dodaje sliku u ćeliju cene.
  - `tl`: `nativeCol: col - 1`, `nativeRow` je red cene (0-indexed), offseti preko EMU kao kod barkoda;
  - `ext` iz kutije.
  - Ako canvas ne može da nacrta, cenovnik ide bez reda, isto kao barkod.
- `PriceCell({ price, format, promoUntil, promoLineImage })`: kad postoji `promoUntil`, ćelija je `position: relative`, a `<img alt={promoLineText(…)}>` stoji apsolutno na `promoLineBox`. Cena se ne pomera.
- `PrintPage` i `PriceTag` prosleđuju `item.promo?.dateTo`.

- [ ] **Testovi** (prvo crveni):
  - `promoLineText("2026-10-31")` daje `"Akcija važi do 31.10.2026."`;
  - za sva tri formata `promoLineBox`: `topMm + heightMm <= 3.2` (iznad cifara), a `leftMm + widthMm <= priceWidthMm`;
  - `buildWorkbook` sa jednom stavkom sa `promo` na rafu ima 2 slike (barkod i red akcije), a bez nje 1;
  - red akcije je u koloni cene i u redu cene (`nativeCol` 0, `nativeRow` 1);
  - `promoLineImage` je pozvan sa `"Akcija važi do 31.10.2026."`;
  - voće: 2 slike sa `promo` (barkod u trećem redu i red akcije u redu cene);
  - `layoutTagPages` daje isti broj po strani sa `promo` i bez njega;
  - visine redova u Excel-u su iste sa `promo` i bez njega;
  - `PriceTag` sa `item.promo` prikazuje `img` sa alt „Akcija važi do 31.10.2026.“ (lažna slika kroz prop), a bez `promo` je nema.
- [ ] Implementacija. `npm test`. Commit.

### Task 4: Jutarnja provera (vraćanje cena i podsetnici)

**Fajlovi:**
- novo: `src/lib/promoCheck.js` + test, `api/promo-check.js`, `src/promoCheckEndpoint.test.js`;
- `vercel.json` (`crons`).

**Consumes:** `createLeafletStore`, lažni store i `sameArticleCodes` (`lib/ean.js`).

**Produces:**
- `belgradeToday(now = new Date()): string` i `addDays(iso, n): string`.
- `runPromoCheck({ store, sendMail, today, now = new Date() }) → { applied, restored, reminders }`. Redom, nad `store.openLeaflets()`:
  1. **Upis:** `dateFrom <= today <= dateTo` i `!pricesAppliedAt`. Akcijske cene idu na redove koji postoje (`products`), pa `markLeaflet({ pricesAppliedAt })`.
  2. **Vraćanje:** `dateTo < today`. Ako cene nisu bile upisane, samo `markLeaflet({ pricesRestoredAt })`. Inače, za stavke bez `restoreResult`:
     - **drugi aktivan liflet:** artikal je na drugom otvorenom lifletu kome `dateFrom <= today <= dateTo`. Rezultat je `newer_leaflet`, a `setItemRegularPrice(drugi, barkod, regularPrice)`;
     - **vraćeno:** red iz `products` nađen po `sameArticleCodes(barcode)` (prvo tačan), a cena mu je jednaka `promoPrice`. Cena postaje `regularPrice` na barkodu tog reda, a rezultat je `restored`;
     - **promenjeno:** sve ostalo (ručno promenjena cena, nema reda), i rezultat je `changed`;
     - redosled: `setProductPrices`, pa `setItemResults`, pa `markLeaflet({ pricesRestoredAt })`;
     - ako ima `changed`, ide mejl o vraćanju.
  3. **Podsetnici:** `dateTo === addDays(today, 1)` i `!remindedTomorrowAt` daje mejl „sutra“; `dateTo === today` i `!remindedTodayAt` daje mejl „danas“. `markLeaflet` ide tek posle uspešnog slanja.
- **Mejlovi** `{ subject, text }`. Spisak artikala je po nazivu (`localeCompare("sr")`), red po artiklu `- NAZIV (barkod)`:
  - **Sutra.** Naslov: `Akcija ističe sutra: <naziv> (31.10.2026.)`. Telo: „Akcija „<naziv>“ (25.09.2026. – 31.10.2026.) ističe sutra. Posle zatvaranja sutra skini akcijske cenovnike. Redovne cene u bazi se vraćaju same.“, pa spisak artikala.
  - **Danas.** Naslov: `Akcija ističe danas: <naziv> (31.10.2026.)`. Telo: „… ističe danas. Posle zatvaranja skini akcijske cenovnike. Redovne cene u bazi se vraćaju same sutra ujutru.“, pa spisak.
  - **Vraćanje.** Naslov: `Redovne cene vraćene: <naziv>`. Telo: „Vraćeno: N. Ovi artikli nisu vraćeni jer im je cena u međuvremenu menjana, pa ih proveri:“, pa `- NAZIV (barkod): sada 99,00, redovna 120,00`.
- **`api/promo-check.js`:**
  - nema `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ili `EMAIL_TO`: 500 `not-configured`;
  - `authorization` nije `Bearer ${CRON_SECRET}`: 401 `unauthorized`;
  - inače `runPromoCheck` sa service-role klijentom (`persistSession: false`), mejl preko Resend-a kao u `send-email.js`, i odgovor 200 `{ ok: true, ...rezultat }`;
  - greška: 500 `server-error`.
- **`vercel.json`:** `"crons": [{ "path": "/api/promo-check", "schedule": "0 5 * * *" }]`.

- [ ] **Testovi** (prvo crveni). `promoCheck.test.js` sa lažnim store-om:
  - `belgradeToday(new Date("2026-10-30T23:30:00Z"))` daje `"2026-10-31"`;
  - liflet koji počinje danas, a cene nisu upisane: upiše akcijske cene i `pricesAppliedAt`;
  - dan posle isteka: vrati redovnu cenu, `restored`, `pricesRestoredAt`, bez mejla;
  - Review Focus 3: ručno promenjena cena ostaje, `changed`, i mejl „Redovne cene vraćene“ sa tim artiklom i „sada … redovna …“;
  - Review Focus 2: red premešten sa 12 na 13 cifara je vraćen na 13-cifrenom redu;
  - Review Focus 1: stari ističe 31.10., a novi (od 1.11., cene upisane jer upis ide pre vraćanja u istom pozivu) ima isti artikal. Posle 1.11. stari je `newer_leaflet`, a novi nosi staru redovnu cenu. Posle isteka novog vraća se ta cena;
  - Review Focus 4: drugi poziv istog dana ne šalje ništa i ne menja ništa;
  - poziv koji pukne posle `setProductPrices` (lažni store baci grešku u `setItemResults`), pa ponovni poziv: cene su vraćene, a nijedna nije `changed`. Zato poređenje u ponovnom pozivu prihvata i stavke kojima je cena već redovna. Nedovršena stavka čija je cena u bazi jednaka `regularPrice` dobija `restored`;
  - podsetnik „sutra“ dan pre kraja, „danas“ na dan kraja, svaki jednom; neuspelo slanje ne obeležava, pa ide ponovo;
  - Review Focus 5: liflet uvezen unapred (`pricesAppliedAt` je `null`, početak sutra): danas ništa, a sutra upis.

  `promoCheckEndpoint.test.js` (mock `resend`, `@supabase/supabase-js` i `../src/lib/promoCheck.js`):
  - bez `CRON_SECRET` 500;
  - pogrešan token 401;
  - ispravan 200 i `runPromoCheck` dobija `today` po Beogradu.
- [ ] Implementacija. `npm test`. Commit.

### Task 5: Oznaka „Liflet“ na trebovanju

**Fajlovi:**
- novo: `src/lib/leafletMarks.js` + test;
- `src/screens/listScreens.js`, `src/screens/ListDetail.jsx`, `src/components/ListItemRow.jsx`, `src/lib/listPdf.js` + test, `src/screens/Requisition.test.jsx`.

**Produces:**
- `withLeafletMarks(store, dateIso, items) → items`. Svaka stavka dobija `onLeaflet: boolean`:
  - `true` kad za neki `sameArticleCodes(item.barcode)` postoji stavka lifleta iz `leafletsOn(dateIso)` sa `promoPrice` jednakom `item.price` (2 decimale);
  - bez barkoda ili cene je `false`;
  - ako store baci grešku, sve stavke su `false` (`console.error`), a trebovanje radi.
- `trebovanjeScreen.decorate = (list, items) => withLeafletMarks(createLeafletStore(supabase), list.date, items)` i `trebovanjeScreen.badge = (item) => (item.onLeaflet ? "Liflet" : null)`. Popis nema `decorate` ni `badge`.
- `ListDetail`: posle učitavanja, i pre PDF-a, stavke idu kroz `screen.decorate` ako postoji. `ListItemRow` dobija `badge`, malu pločicu u istom redu sa detaljem: `rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-white`.
- `requisitionPdfDefinition`: za `onLeaflet` ćelija cene je `{ stack: [{ text: "LIFLET", fontSize: 6, bold: true, alignment: "right" }, { text: <cena>, alignment: "right" }] }`.

- [ ] **Testovi** (prvo crveni). `leafletMarks.test.js`:
  - datum trebovanja u periodu i ista cena daju `true`;
  - van perioda daje `false`;
  - druga cena daje `false`;
  - stavka sa 13 cifara i liflet stavka sa 12 daju `true`;
  - bez barkoda ili cene daje `false`;
  - store baci grešku: sve `false`.

  `listPdf.test.js`: stavka `onLeaflet` ima `stack` sa „LIFLET“ i cenom, a ostale imaju običnu ćeliju.

  `Requisition.test.jsx`: stavka koju `decorate` (mock store-a) označi pokazuje „Liflet“, a druga ne.
- [ ] Implementacija. `npm test`. Commit.

### Task 6: Dokumentacija, pravila, verzija i provera

**Fajlovi:**
- `CLAUDE.md` (`api/promo-check.js` je i serverski kod, cron, nove `lib` datoteke);
- `.claude/rules/promo-leaflet.md`, `.claude/rules/email-api.md` (nova funkcija, env), `.claude/rules/price-tag-export.md` (red akcije), `.claude/rules/lists.md` (oznaka „Liflet“);
- `docs/testing/redesign-test-checklist.md`, `docs/pitanja.md` (moje odluke iz ovog plana);
- `package.json` (`npm version 0.11.0 --no-git-tag-version`).

- [ ] Dokumenta i verzija.
- [ ] `npm test && npm run build`.
- [ ] U browseru (privremena stranica bez prijave, kao za 0.10.0, posle se briše):
  - prozor za uvoz sa periodom;
  - pregled štampe sa redom akcije za sva tri formata;
  - trebovanje se ne proverava uživo, jer bi tražilo upis u bazu.
- [ ] Commit.
