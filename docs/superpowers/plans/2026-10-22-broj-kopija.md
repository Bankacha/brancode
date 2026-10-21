# Broj kopija (0.10.0): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:** isti cenovnik može da se odštampa više puta. U prozoru za cenu je diskretna ikonica kopiranja koja otvara mali prozor „Broj kopija“, a Excel, pregled i mejl ponavljaju cenovnik toliko puta.

**Arhitektura:**
- Stavka liste za štampu dobija opciono `copies` (izostavljeno = 1). Pravila broja su na jednom mestu, u `lib/printQueue.js`.
- `layoutTagPages` raširi kopije pre raspoređivanja. Zato Excel, mejl i pregled (koji svi idu kroz nju) dobijaju kopije bez posebnog koda.
- Editor (`useProductEditor`) drži broj kopija dok je prozor otvoren. Pri otvaranju ga uzima sa liste, pa ponovno skeniranje zadrži broj.
- Prozor „Broj kopija“ ima svoj unos u istoriji, preko novog `useDialog` u `lib/useSheet.js`. Tako sistemsko „nazad“ zatvori samo njega, a prozor za cenu ostaje otvoren.

**Tehnologije:** React 18, React Router 7 (stanje istorije), Vitest + Testing Library, lucide `Copy` / `Minus` / `Plus`.

**Spec:** [`2026-10-20-brancode-akcija-kopije-design.md`](../specs/2026-10-20-brancode-akcija-kopije-design.md), odeljak „Broj kopija (0.10.0)“.

**Grana:** `kopije`, od `main`. Na `main` ide jedan squash commit, verzija 0.10.0.

## Globalna ograničenja

- **Broj kopija:** od 1 do 20, podrazumevano 1. U podacima je to `copies`, a izostavljeno znači 1. Stavka sa jednom kopijom ne nosi polje `copies`, pa postojeći testovi i liste ostaju isti.
- **Kopije se ponavljaju jedna za drugom.** Prelomi strana se računaju posle ponavljanja: Raf 18, Frižider 15 i Voće 8 po strani, kao do sada.
- **Brojanje:**
  - brojač na početnom ekranu („N cena“) i „N kom“ u pregledu broje cenovnike, znači sa kopijama;
  - naslovi grupa („Spremno · N“) i „N traži proveru“ broje redove.
- **Ponovno skeniranje istog artikla** osveži cenu, a broj kopija ostaje.
- **Oznaka „×3“** se vidi samo kad je broj veći od 1: uz ikonicu u prozoru i u redu liste pored cene.
- **Sav korisnički tekst je na srpskom** (latinica). Brojevi sa imenicom idu kroz `plural()`.
- **Popis i trebovanje nemaju kopije** (ne-cilj iz spec-a).

## Review Focus

1. **Lista sačuvana u telefonu pre 0.10.0**, ili sa lošim `copies` (`0`, `"3"`, `2.5`, `99`), štampa normalno: nikad 0 ni 99 cenovnika, ništa ne puca. Test je u Task 1.
2. **Sistemsko „nazad“ dok je otvoren „Broj kopija“** zatvara samo taj prozor. Prozor za cenu ostaje, sa ukucanom cenom. Test je u Task 2 (`useDialog`).
3. **Kopije preko preloma strane:** na rafu 17 cenovnika pa jedan ×3 daje strane od 18 i 2. Test je u Task 1.
4. **Ponovno skeniranje artikla koji je na listi ×3:** prozor pokazuje ×3, a čuvanje (i „Preskoči“) ostavlja 3. Test je u Task 2.
5. **Uklanjanje reda ×3 pa „Vrati“** vraća red sa kopijama, a brojač se vraća na isti broj. Test je u Task 3.

---

### Task 1: Kopije na listi i u rasporedu štampe

**Fajlovi:** `src/lib/printQueue.js` + test, `src/lib/priceTags.js` + test.

**Produces** (u `printQueue.js`):
- `MAX_COPIES = 20`.
- `copiesOf(item): number`. Ceo broj `copies` se ograniči na 1–20. Sve ostalo daje 1: polja nema, string, decimalni broj, `null`.
- `withCopies(item, n): item`. Vraća novu stavku sa `copies: n` (ograničeno na 1–20), a bez polja `copies` kad je n = 1.
- `tagCount(queue): number`, zbir `copiesOf`.
- `expandCopies(queue): item[]`. Svaka stavka se ponovi `copiesOf` puta, jedna za drugom. Prva zadržava svoj `id`, a ostale dobijaju `` `${id}#2` ``, `` `${id}#3` `` itd., jer `PrintPage` koristi `id` kao React key.
- `layoutTagPages(queue, format)` (u `priceTags.js`) poziva `expandCopies` pre rasporeda. Potpis se ne menja.

- [ ] **Testovi** (prvo crveni). `printQueue.test.js`:
  - `copiesOf({})` daje 1, a `copiesOf({ copies: 3 })` daje 3;
  - `copiesOf` za `0`, `-2`, `"3"`, `2.5` i `null` daje 1, a za `99` daje 20;
  - `withCopies(a, 3)` je `{ ...a, copies: 3 }`;
  - `withCopies({ ...a, copies: 3 }, 1)` nema ključ `copies` (`"copies" in result` je false);
  - `withCopies(a, 25).copies` je 20;
  - `tagCount([a, { ...b, copies: 3 }])` daje 4, a `tagCount([])` daje 0;
  - `expandCopies([{ ...a, copies: 2 }, b]).map((i) => i.id)` daje `["a", "a#2", "b"]`;
  - `withItemRestored` vraća stavku sa `copies: 3` netaknutu (Review Focus 5, deo za podatke).

  `priceTags.test.js`:
  - `layoutTagPages([{ ...items(1)[0], copies: 3 }], "shelf")[0][0].length` je 3;
  - Review Focus 3: 17 stavki plus jedna sa `copies: 3` na rafu daje strane od `[18, 2]` cenovnika (`page.flat().length`);
  - frižider: jedna stavka sa `copies: 16` daje `[15, 1]`;
  - `buildWorkbook([{ ...items(1)[0], copies: 2 }], "shelf")` upisuje naziv u ćelije za dva cenovnika, u istom redu i u kolonama 1 i 3 (raf ima po dve kolone po cenovniku);
  - Review Focus 1: `layoutTagPages([{ ...items(1)[0], copies: 0 }, { ...items(2)[1], copies: 99 }], "fruit").flat(2).length` je 21.
- [ ] Implementacija. Komentar o obliku stavke u `printQueue.js` dobija `copies?`.
- [ ] `npx vitest run src/lib/printQueue.test.js src/lib/priceTags.test.js` prolazi. Commit.

### Task 2: Broj kopija u prozoru za cenu

**Fajlovi:**
- `src/lib/useSheet.js` + test;
- `src/lib/useProductEditor.js` + test;
- novo: `src/components/CopiesDialog.jsx`;
- `src/sheets/EditSheet.jsx` + test.

**Consumes:** `copiesOf`, `withCopies`, `MAX_COPIES` iz Task 1.

**Produces:**
- `useDialog(name: string): { isOpen: boolean, open(): void, close(): void }` u `useSheet.js`.
  - `open` doda unos u istoriju (`push`, ne `replace`) sa istim putem i stanjem `{ ...location.state, dialog: name }`. Tako `useSheet().name` ostaje isti.
  - `close` radi `navigate(-1)` samo ako je dijalog otvoren, uz isti „latch“ kao `useSheet.close`.
  - `isOpen` je `location.state?.dialog === name`.
- `useProductEditor` vraća i `copies: number` i `setCopies(n)`.
  - `open(code)` postavlja `copies` na `copiesOf` stavke sa istim barkodom na listi, a ako je nema, na 1.
  - `openItem(item)` postavlja `copiesOf(item)`.
  - `save` i `skip` prave stavku kroz `withCopies(…, copies)`.
- `CopiesDialog({ open, value, onConfirm, onClose })`:
  - mali prozor na sredini ekrana, iznad sheet-a (`z-[60]`), sa zatamnjenom pozadinom (`bg-scrim/80`);
  - naslov „Broj kopija“; dugmad −, broj (`font-display`, krupno), +; ispod „Štampa se N put/puta“ preko `plural(n, "put", "puta", "puta")`; dugme „U redu“ (`Button variant="accent"`);
  - − je onemogućen na 1, a + na `MAX_COPIES`;
  - broj se menja u nacrtu, a tek „U redu“ zove `onConfirm(n)`;
  - tap na pozadinu i Escape zovu `onClose` bez promene;
  - pri svakom otvaranju nacrt kreće od `value`.
- `EditSheet`: u gornjem redu, desno (posle „N. u nizu“ kod skeniranja), dugme `aria-label="Broj kopija"`.
  - Siva ikonica `Copy` (16 px), a pored nje „×N“ u boji akcenta kad je `editor.copies > 1`.
  - Tap radi `dialog.open()` za `useDialog("copies")`.
  - `CopiesDialog` sa `onConfirm={(n) => { editor.setCopies(n); dialog.close(); }}`.
  - Dugme je onemogućeno dok se čuva.

- [ ] **Testovi** (prvo crveni):
  - `useSheet.test.jsx`, Review Focus 2: sheet „edit“ je otvoren, pa `dialog.open()` daje dijalog otvoren uz sheet i dalje „edit“; sistemsko nazad (`navigate(-1)`) daje dijalog zatvoren uz sheet i dalje „edit“; još jedno nazad zatvara sheet.
  - `useSheet.test.jsx`: `dialog.close()` dvaput zaredom vraća samo jedan korak.
  - `useProductEditor.test.jsx`, Review Focus 4: lista ima `{ ...a, copies: 3 }`, pa `open("1")` daje `copies` 3, a `save()` ostavlja red sa `copies: 3` na istom mestu. Isto za `skip()`.
  - `useProductEditor.test.jsx`: `open` za kod koji nije na listi daje `copies` 1; `openItem(b)` posle `setCopies(4)` i `save()` daje red sa `copies: 4`; `setCopies(1)` pa `save()` daje red bez ključa `copies`.
  - `EditSheet.test.jsx`:
    - `setup` se obavija u `MemoryRouter`, jer sheet sada koristi istoriju; postojeći testovi se ne menjaju drugačije;
    - dugme „Broj kopija“ postoji i bez „×“ kad je `copies` 1;
    - sa `copies: 3` vidi se „×3“;
    - tap otvara „Broj kopija“, dvaput + pa „U redu“ zove `setCopies(3)` kad je `copies` 1;
    - − je onemogućen na 1, a + na 20;
    - tap na pozadinu zatvara prozor bez poziva `setCopies`.
- [ ] Implementacija.
- [ ] `npm test` prolazi. Commit.

### Task 3: Brojanje i oznaka na početnom ekranu i u pregledu, dokumentacija, verzija

**Fajlovi:**
- `src/screens/Home.jsx`, `src/components/QueueRow.jsx`, `src/screens/PrintPreview.jsx` + testovi (`Home.test.jsx`, `PrintPreview.test.jsx`);
- `.claude/rules/products-and-barcodes.md` (oblik stavke liste i kopije);
- `docs/testing/redesign-test-checklist.md`, `docs/pitanja.md` (odeljak 0.10.0 sa mojim odlukama);
- `package.json` (`npm version 0.10.0 --no-git-tag-version`).

**Consumes:** `tagCount` iz Task 1.

**Ponašanje:**
- U `Home` je `n = tagCount(queue)`. Isti `n` koriste i brojač, `ConfirmClearSheet count` i `LeafletImportSheet queueLength`: svuda se vidi isti broj koji pokazuje brojač.
- `m` i „Spremno · N“ i dalje broje redove.
- `QueueRow`: kad je `copiesOf(item) > 1`, ispred cene stoji mala pločica „×N“ (`rounded-full bg-surface-muted px-2 text-xs font-semibold text-ink-2`).
- `PrintPreview`: „{tagCount(queue)} kom“.

- [ ] **Testovi** (prvo crveni):
  - `Home.test.jsx`: lista sa 2 reda, jednim `copies: 3`, pokazuje brojač „4“ i „cene“, „Spremno · 2“ i „×3“ u redu;
  - `Home.test.jsx`, Review Focus 5: ukloni red ×3 (X), pa „Vrati“ iz toast-a, i brojač je opet 4, a „×3“ je opet tu;
  - `Home.test.jsx`: „Obriši sve“ za tu listu pita „Obrisati sve 4 cene?“;
  - `PrintPreview.test.jsx`: lista sa jednim `copies: 3` i jednim bez pokazuje „4 kom“.
- [ ] Implementacija, pravila i dokumenta.
  - U spisak za testiranje ide: ikonica i prozor, ×N, Excel i mejl sa kopijama, ponovno skeniranje.
  - U `pitanja.md` idu moje odluke: nacrt se primenjuje tek na „U redu“; nazad zatvara samo prozor; brisanje i uvoz lifleta pokazuju broj cenovnika; uvoz lifleta briše kopije jer zamenjuje listu.
- [ ] `npm test && npm run build` prolaze. U browseru: prozor za kopije, ×N na listi, pregled sa ponovljenim cenovnikom. Commit.
