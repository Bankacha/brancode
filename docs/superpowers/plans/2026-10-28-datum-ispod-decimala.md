# Datum akcije ispod decimala (0.12.2): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:**
- Na rafu i frižideru „Akcija važi do / 31.10.2026.“ stoji u dva reda ispod decimala cene. Voće zadržava red na vrhu ćelije cene.
- Uspravni barkod na rafu i frižideru se završava u liniji dna cifre cene.

**Arhitektura:**
- Mesto se računa jednom funkcijom, `promoNoteBox` u `lib/priceTags.js`. Koriste je i Excel izvoz (slika preko ćelije cene, kao i do sada) i pregled (`PriceCell`).
- Širine se mere fontom Oswald na canvasu (`measureOswaldMm`).
- Visina dolazi iz modela Excel-a na Windows-u, sa Oswald metrikom `winAscent` 1,325, `winDescent` 0,377 i cifrom 0,81 em, a decimale se crtaju na pola veličine. Isti model već pomera cenu na frižideru u pregledu.

**Tehnologije:** ExcelJS, canvas, Vitest.

**Spec:** [`2026-10-20-brancode-akcija-kopije-design.md`](../specs/2026-10-20-brancode-akcija-kopije-design.md), odeljak „Cenovnik“, „Izmena 28.10. (0.12.2)“.

**Grana:** `sitnice`, na kojoj su već tri sitnice. Na `main` ide jedan squash commit, verzija 0.12.2.

## Globalna ograničenja

- **Tekst** je u dva reda: `Akcija važi do` i datum `dd.mm.yyyy.`, centrirano.
- **Kad je mesto usko,** isti tekst ide u tri reda (`Akcija`, `važi do`, datum), sa slovima što većim koja staju. Kutija se nikad ne širi.
- **Kutija** je unutar kolone cene. Ne prelazi levo na cele cifre (počinje desno od njih, uz 0,3 mm rezerve), a desno ostaje najmanje 0,6 mm do kolone barkoda.
- **Visina:** od 0,5 mm ispod decimala do osnovne linije cifre.
- **Raspored, visine redova i broj po strani** se ne menjaju.

## Review Focus

1. **Duga cena koja se smanjuje** („12.499,99“ na rafu, „1.249,99“ na frižideru): kutija je uska, ali i dalje desno od celih cifara i levo od barkoda. Test je u Task 1.
2. **Frižider:** kutija se završava iznad dela koji držač pokriva (5 mm od dna ćelije cene). Test je u Task 1.
3. **Bez canvas-a** (jsdom, ili greška): merenje koristi procenu, a izvoz i pregled rade bez slike reda. Test je u Task 1 i Task 2.
4. **Voće** i dalje ima red na vrhu, u jednom redu. Test je u Task 1.
5. **Kopije i Mix** dobijaju isti red, jer prolaze kroz `buildWorkbook`. Pokriva postojeći test „changes nothing in the layout“ sa `promo`.

---

### Task 1: Mesto ispod decimala i Excel

**Fajlovi:** `src/lib/priceTags.js` + test.

**Produces:**
- `measureOswaldMm(text: string, fontPt: number): number`:
  - meri širinu na canvasu fontom `400 <px>px Oswald`;
  - kad canvas ne postoji, procenjuje 0,5 em po znaku.
- `priceLayout(price, format, measure = measureOswaldMm) → { fontPt, baselineMm, capTopMm, textLeftMm, wholeMm, decimalsMm }` je model jedne cene na rafu ili frižideru. Iz njega računaju i `promoNoteBox` i `sideBarcodeBox`.
- `sideBarcodeBox(format, price, measure = measureOswaldMm)`: kao do sada, ali dno je `baselineMm` cene (nikad niže od dosadašnjeg dna). Voće daje `null`. Excel i pregled je pozivaju sa cenom stavke.
- `promoNoteLines(dateTo): string[]` daje `["Akcija važi do", "31.10.2026."]`.
- `promoNoteBox(price, format, measure = measureOswaldMm) → { leftMm, topMm, widthMm, heightMm }`. Za `fruit` je `promoLineBox(format)`. Za raf i frižider:
  - **veličina:** `S = shrinkFontPt(base, ukupna širina u px, širina kolone u px)`, gde je `base = style.priceFontSize(text)`, a ukupna širina je `measure(whole, base) + measure(decimals, base·0,5)`;
  - **vodoravno:**
    - tekst je centriran u koloni cene;
    - decimale počinju na `(W − ukupno)/2 + širina celih`;
    - kutija je centrirana na sredini decimala, a pola širine je `min(pola decimala − 0,3, W − 0,6 − sredina)`;
  - **uspravno:**
    - osnovna linija je `H/2 + 0,474·S` (raf, sredina), odnosno `1,325·S` (frižider, vrh);
    - vrh cifre je `osnovna − 0,81·S`;
    - dno decimala je `vrh cifre + 0,405·S`;
    - kutija ide od `dno decimala + 0,5` do osnovne linije.
- `makePromoLineDataUrl(lines: string[], box)` crta date redove centrirano, sa najvećim fontom koji staje. Kad su dva reda i font je manji od 3,6 pt, pokušava tri reda (prvi red se deli na poslednjem razmaku) i uzima raspored sa većim fontom.
- `buildWorkbook`:
  - za raf i frižider postavlja sliku na `promoNoteBox(item.price, format)` sa `promoNoteLines`;
  - za voće na `promoLineBox` sa `[promoLineText(dateTo)]`;
  - opcija se i dalje zove `promoLineImage`, ali sada prima `(lines, box)`.

- [ ] **Testovi** (prvo crveni, sa merenjem `fake = (t, pt) => t.length * 0.5 * pt * 25.4 / 72`):
  - `promoNoteLines("2026-10-31")` daje `["Akcija važi do", "31.10.2026."]`;
  - `promoNoteBox(99.99, "shelf", fake)`:
    - levo je najmanje `(W − ukupno)/2 + širina "99"` (računato istim `fake` i `S`);
    - `leftMm + widthMm` je najviše `W − 0,6`;
    - visina je najmanje 3 mm;
  - Review Focus 1: `promoNoteBox(12499.99, "shelf", fake)` je uži od kratke cene, i isti uslovi levo i desno važe;
  - Review Focus 2: `promoNoteBox(1249.99, "fridge", fake)`: `topMm + heightMm` je najviše `priceHeightMm − 5`;
  - Review Focus 4: `promoNoteBox(99.99, "fruit", fake)` je jednako `promoLineBox("fruit")`;
  - Review Focus 3: `measureOswaldMm("99", 50)` bez canvas-a (jsdom/node) daje procenu `2 · 0,5 · 50 · 25,4/72`;
  - `buildWorkbook` za raf sa `promo`:
    - `promoLineImage` dobija `["Akcija važi do", "31.10.2026."]`;
    - slika je u koloni cene (`nativeCol` 0, `nativeRow` 1);
    - `nativeColOff` je `round(mmToPx(box.leftMm) · 9525)` za `promoNoteBox(…)` (izvezi `mmToPx` ili uporedi preko istog proračuna);
  - za voće `promoLineImage` dobija `["Akcija važi do 31.10.2026."]`;
  - postojeći testovi za „promo line“ se prilagođavaju novom potpisu;
  - `sideBarcodeBox("shelf", 99, fake)` i `("fridge", 99, fake)` se završavaju na `priceLayout(...).baselineMm`. Frižider je iznad zaklonjenih 5 mm, a postojeći testovi za barkod dobijaju cenu;
  - `buildWorkbook` postavlja uspravni barkod sa visinom iz `sideBarcodeBox(format, item.price)`.
- [ ] Implementacija. `npx vitest run src/lib/priceTags.test.js`. Commit.

### Task 2: Pregled, dokumenta i verzija

**Fajlovi:**
- `src/components/PriceTag.jsx` + test;
- `.claude/rules/price-tag-export.md`;
- `docs/testing/redesign-test-checklist.md`, `docs/pitanja.md`, `docs/repovi.md` (probna štampa);
- `package.json` (`npm version 0.12.2 --no-git-tag-version`).

**Ponašanje:** `SideBarcodeCell` dobija cenu i koristi `sideBarcodeBox(format, price)`. `PriceCell` crta sliku na `promoNoteBox(price, format)`, sa `promoNoteLines` (voće: `promoLineBox` i jedan red). Keš slike je po ključu `linije|kutija`.

- [ ] **Testovi** (prvo crveni):
  - `PriceTag` na rafu sa `promo` ima `img` alt „Akcija važi do 31.10.2026.“, a `style.left` mu je `promoNoteBox(...).leftMm` u mm;
  - na voću `style.top` je `0.7mm`.
- [ ] Implementacija i dokumenta. `npm test && npm run build`. U browseru (privremena stranica bez prijave): pregled za raf i frižider sa kratkom i dugom cenom, pa se stranica briše. Commit.
