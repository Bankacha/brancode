# Kolona „Akcija“ na trebovanju (0.13.0): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:**
- Trebovanje (PDF i ekran) pokazuje sve liflete na kojima je artikal: onaj koji traje i onaj koji počinje u narednih 14 dana. Uz svaki stoji liflet cena i datumi, a liflet koji još nije počeo ima oznaku „USKORO“.
- Uvoz pita da li je liflet isti sa ispravljenim datumima.

**Arhitektura:**
- `lib/leafletMarks.js` umesto da/ne oznake daje svakoj stavci listu `leaflets` (cena, datumi, `upcoming`). Ekran i PDF crtaju iz nje.
- `lib/leafletImport.js` dobija `findSameLeaflet` i opciju `replaceId`. Prozor za uvoz pita pre upisa.

**Tehnologije:** Supabase JS, pdfmake, React, Vitest.

**Spec:** [`2026-10-29-brancode-trebovanje-akcija-design.md`](../specs/2026-10-29-brancode-trebovanje-akcija-design.md).

**Grana:** `akcija-trebovanje`. Na `main` ide jedan squash commit, verzija 0.13.0 (spajanje odobreno).

## Globalna ograničenja

- **Prozor lifleta:** važi na datum trebovanja, ili počinje najkasnije 14 dana posle njega. „USKORO“ dobija liflet čiji je `dateFrom` posle datuma trebovanja.
- **Zapis:**
  - liflet koji traje: `Liflet <cena>` u prvom redu i `do dd.mm.` u drugom;
  - liflet koji počinje: `Liflet <cena>` i `USKORO` u prvom redu, a `od dd.mm. do dd.mm.` u drugom;
  - prvo idu oni koji traju, pa oni koji počinju, po početku.
- **Kolona „Akcija“** postoji u PDF-u samo kad bar jedna stavka ima liflet. Bez nje PDF je isti kao u 0.12.2, ali bez natpisa „LIFLET“ iznad cene.
- **Pitanje pri uvozu** postavlja se samo za otvoren liflet koji se preklapa sa novim i ima isti naziv ili ≥ 80% istih artikala. Kad postoji zapis sa istim nazivom i istim datumima, pitanja nema.
- **Tekst pitanja:**
  - „Već postoji liflet „<naziv>“ (<od>. – <do>.).“
  - „Da li je ovo isti liflet sa ispravljenim datumima?“
  - dugmad „Da, ispravi datume“ i „Ne, ovo je novi liflet“.
- **Liste** i dalje samo čitaju tabele lifleta. Nema izmene baze.

## Review Focus

1. **Artikal na oba lifleta**, sa 12 i 13 cifara u stavkama lifleta: jedan zapis po lifletu, nikad dva za isti liflet. Test je u Task 3.
2. **Staro trebovanje iz arhive** ne pokazuje liflete koji počinju više od 14 dana posle njegovog datuma. Test je u Task 3.
3. **„Da, ispravi datume“ kad je novi kraj isti kao stari:** oznake podsetnika ostaju (ne šalju se ponovo). Test je u Task 1.
4. **Novi liflet uvezen 7 dana unapred** sa drugim nazivom i malo istih artikala: nema pitanja. Test je u Task 1.
5. **Trebovanje bez ijednog artikla na lifletu:** PDF bez kolone „Akcija“, sa istim širinama kao do sada. Test je u Task 4.

---

### Task 1: Uvoz: isti liflet

**Fajlovi:** `src/lib/leafletStore.js` + test, `src/lib/leafletImport.js` + test, `src/test/fakeLeafletStore.js`.

**Produces:**
- `store.leafletsBetween(fromIso, toIso) → Leaflet[]`, gde je `date_from <= toIso` i `date_to >= fromIso`. Fake store radi isto.
- `store.markLeaflet` prihvata i `dateFrom` / `dateTo` (kolone `date_from` / `date_to`).
- `findSameLeaflet(store, { name, dateFrom, dateTo, matches }) → Leaflet | null`:
  - kandidati su otvoreni lifleti koji se preklapaju sa novim periodom, a nisu isti naziv sa istim datumima;
  - kandidat ide ako ima isti naziv (bez razmaka na krajevima, bez razlike u velikim slovima) ili udeo ≥ 0,8;
  - udeo je broj artikala novog lifleta iz baze (`existing.barcode`) koji postoje u stavkama kandidata po `sameArticleCodes`, podeljen ukupnim brojem tih artikala;
  - pobeđuje kandidat sa najvećim udelom, a isti naziv se računa kao udeo 1.
- `importLeaflet(store, { …, replaceId? }, today, now)`:
  - sa `replaceId` ne zove `saveLeaflet`, nego `markLeaflet(replaceId, { dateFrom, dateTo, …(ako se kraj promenio: remindedTomorrowAt: null, remindedTodayAt: null) })`;
  - dalje radi isto kao do sada, sa tim lifletom (redovne cene iz istog lifleta ostaju).

- [ ] **Testovi** (prvo crveni). `leafletImport.test.js`:
  - isti naziv i preklapanje daju taj liflet;
  - drugi naziv i 4 od 5 istih artikala daju taj liflet;
  - Review Focus 4: drugi naziv, 1 od 5 artikala i preklapanje daju `null`;
  - bez preklapanja (stari je istekao pre početka novog) daje `null`;
  - isti naziv sa istim datumima daje `null`;
  - `importLeaflet` sa `replaceId`:
    - liflet ima nove datume;
    - stavke su na njemu (nema drugog zapisa);
    - promenjen kraj briše `remindedTomorrowAt` i `remindedTodayAt`;
  - Review Focus 3: isti kraj ostavlja oznake podsetnika.

  `leafletStore.test.js`:
  - `leafletsBetween` ima korake `lte("date_from", to)` i `gte("date_to", from)`;
  - `markLeaflet(id, { dateFrom })` šalje `date_from`.
- [ ] Implementacija. `npx vitest run src/lib/leafletImport.test.js src/lib/leafletStore.test.js`. Commit.

### Task 2: Pitanje u prozoru za uvoz

**Fajlovi:** `src/sheets/LeafletImportSheet.jsx` + test, `src/screens/Home.jsx` + test.

**Consumes:** `findSameLeaflet`, `importLeaflet({ replaceId })` iz Task 1.

**Ponašanje:**
- `LeafletImportSheet` dobija `sameLeaflet` (liflet ili `null`) i `onAnswer(isSame: boolean)`. Kad postoji `sameLeaflet`:
  - umesto dugmeta za uvoz stoji tekst pitanja iz Globalnih ograničenja;
  - ispod su dva dugmeta: „Da, ispravi datume“ (`variant="dark"`) i „Ne, ovo je novi liflet“ (`variant="outline"`), pa „Otkaži“.
- `Home.confirmLeaflet({ dateFrom, dateTo })`:
  - prvo zove `findSameLeaflet`. Ako nešto nađe, pamti datume i liflet i prikazuje pitanje. Inače uvozi kao do sada;
  - `onAnswer(true)` uvozi sa `replaceId`, a `onAnswer(false)` bez njega;
  - ako `findSameLeaflet` baci grešku, javlja postojeću poruku o neuspelom čuvanju.

- [ ] **Testovi** (prvo crveni):
  - `LeafletImportSheet.test.jsx`: sa `sameLeaflet` ({ name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" }) se vidi tekst „Već postoji liflet „Jutro Liflet Avg“ (25.09.2026. – 31.10.2026.).“, a „Da, ispravi datume“ zove `onAnswer(true)`, „Ne, ovo je novi liflet“ zove `onAnswer(false)`;
  - `Home.test.jsx` (mock `../lib/leafletImport.js`):
    - `findSameLeaflet` vraća liflet, pa „Uvezi“ prikaže pitanje, a „Da“ zove `importLeaflet` sa `replaceId: "L1"`;
    - `findSameLeaflet` vraća `null`, pa „Uvezi“ odmah zove `importLeaflet` bez `replaceId`.
- [ ] Implementacija. `npm test`. Commit.

### Task 3: Lifleti po stavci i oznake u aplikaciji

**Fajlovi:**
- `src/lib/leafletMarks.js` + test;
- `src/lib/listFormat.js` + test (`addDays`);
- `src/lib/promoCheck.js` (koristi `addDays` iz `listFormat`, a izvoz ostaje);
- `src/screens/listScreens.js`, `src/screens/ListDetail.jsx`, `src/components/ListItemRow.jsx`, `src/screens/Requisition.test.jsx`.

**Produces:**
- `addDays(iso, n)` u `listFormat.js`. `promoCheck.js` ga uvozi i ponovo izvozi pod istim imenom.
- `withLeafletMarks(store, dateIso, items) → items`, gde svaka stavka dobija:
  - `leaflets: [{ leafletId, promoPrice, dateFrom, dateTo, upcoming }]`, po redosledu iz Globalnih ograničenja, jedan zapis po lifletu;
  - `onLeaflet = leaflets.length > 0`.
  - Čita `store.leafletsBetween(dateIso, addDays(dateIso, 14))`. Greška daje prazne liste.
- `leafletBadgeText(entry) → string`: „Liflet 99,99 do 31.10.“, odnosno „Liflet 89,99 · USKORO od 01.11.“.
- `trebovanjeScreen.badges = (item) => (item.leaflets ?? []).map(leafletBadgeText)`. `ListItemRow` dobija `badges: string[]` umesto `badge`, i crta ih kao red malih pločica ispod detalja:
  - liflet koji traje: `bg-accent text-white`;
  - liflet koji počinje: `border border-accent text-accent`.

- [ ] **Testovi** (prvo crveni). `leafletMarks.test.js` (lažni store sa lifletima L1 25.09.–31.10. i L2 01.11.–30.11., za trebovanje od 27.10.):
  - artikal samo na L1 daje jedan zapis, `upcoming: false`;
  - artikal samo na L2 daje `upcoming: true`;
  - Review Focus 1: artikal na oba (L1 pod 12 cifara, L2 pod 13) daje dva zapisa, prvo L1;
  - Review Focus 2: liflet L3 od 20.11. za trebovanje od 27.10. se ne računa;
  - istekao liflet se ne računa;
  - stavka bez barkoda ima `leaflets: []`;
  - greška store-a daje prazne liste;
  - `leafletBadgeText` za oba oblika.

  `listFormat.test.js`: `addDays("2026-10-27", 14)` daje `"2026-11-10"`.

  `Requisition.test.jsx`: mock vraća `leaflets` za stavku, a red pokazuje „Liflet 99,99 do 31.10.“ i „Liflet 89,99 · USKORO od 01.11.“.
- [ ] Implementacija. Stari uslov sa cenom se uklanja. `npm test`. Commit.

### Task 4: Kolona „Akcija“ u PDF-u

**Fajlovi:** `src/lib/listPdf.js` + test.

**Consumes:** `item.leaflets` iz Task 3.

**Ponašanje:**
- **Sa kolonom** (bar jedna stavka ima `leaflets`): širine su `["*", 80, 50, 96, 44, 24]`, a zaglavlje `Naziv, Barkod, Cena, Akcija, Količina, ""`.
- **Bez kolone:** širine `["*", 88, 60, 52, 24]`, kao do sada.
- **Ćelija „Akcija“** je `stack` po zapisu:
  - prvi red `{ text: [{ text: "Liflet 99,99", bold: true }, …(upcoming: [{ text: " " }, { text: " USKORO ", bold: true, fontSize: 7, color: "#ffffff", background: "#111111" }])], fontSize: 9 }`;
  - drugi red `{ text: "do 31.10." | "od 01.11. do 30.11.", fontSize: 8.5 }`;
  - zapisi su odvojeni malim razmakom (`margin`).
- **Senčenje reda i podebljan naziv** ostaju za `onLeaflet`. Natpis „LIFLET“ iznad cene se uklanja, a cena je obična ćelija.

- [ ] **Testovi** (prvo crveni):
  - stavka sa jednim lifletom koji traje i jedna sa oba daju kolonu na indeksu 3, širine iz plana i ćelije sa tačnim tekstovima;
  - `USKORO` ima `background` samo kod lifleta koji počinje;
  - Review Focus 5: bez lifleta nema kolone i širine su `["*", 88, 60, 52, 24]`;
  - cena u osenčenom redu je `{ text: "100,00", alignment: "right", fillColor }`, bez „LIFLET“;
  - postojeći testovi (kvadratić po redu, veći kvadratić) se prilagođavaju indeksu kolone.
- [ ] Implementacija. Probni PDF (node, kao za 0.12.2) sa artiklom na lifletu koji traje, na lifletu koji počinje, na oba i bez akcije, pregledan. Commit.

### Task 5: Dokumenta i verzija

**Fajlovi:** `.claude/rules/lists.md`, `.claude/rules/promo-leaflet.md`, `docs/pitanja.md`, `docs/testing/redesign-test-checklist.md`, `docs/repovi.md`, `package.json` (`npm version 0.13.0 --no-git-tag-version`).

- [ ] Dokumenta i verzija. `npm test && npm run build`. Commit.
