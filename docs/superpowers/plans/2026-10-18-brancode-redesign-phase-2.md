# Brancode redizajn — faza 2 (početna i lista): plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cilj:** novi izgled prijave (01), početne sa grupisanom listom (02), menija, uvoza lifleta (07), potvrde brisanja (08) i statusa (09). Uz to:
- zajednički sheet-ovi sa istorijom i prevlačenjem;
- osnovni sheet za izmenu (04, bez pregleda cenovnika);
- ekran `/pregled` sa izborom formata i dugmadima Pošalji i Excel (06, bez A4 pregleda).

Ta dva poslednja dela su potrebna jer stara kartica za izmenu i stara dugmad za preuzimanje i slanje nestaju sa početne.

**Arhitektura:**
- Nove komponente su u Tailwind-u sa tokenima iz `src/index.css`.
- Otvoren sheet se čuva u `location.state.sheet` React Router-a. Tako sistemsko „nazad“ zatvara sheet, a prelazak između dva sheet-a radi `replace`.
- Statusi idu kroz jedan `ToastProvider` u `App`-u.
- Ekrani za kameru i ručni unos ostaju stari do faze 4, u privremenom `LegacyLayout`-u.

**Tehnologije:** dosadašnje, plus za testove komponenti `jsdom@^26` (v27+ traži Node 22.22+, a lokalno je 22.21), `@testing-library/react@^16` i `@testing-library/dom@^10`.

**Spec:** [`docs/superpowers/specs/2026-10-17-brancode-redesign-design.md`](../specs/2026-10-17-brancode-redesign-design.md), odeljci „Odluke“ (5, 6), „Arhitektura“ i „Ekrani i tokovi“ (01, 02, Meni, 07, 08, 09, Zajedničko, deo 04 i 06). Vizuelni detalji (mere, boje, zaobljenja, tekstovi) su u [`docs/design/redesign-handoff/README.md`](../../design/redesign-handoff/README.md) i mocku `Brancode C - Pijaca.dc.html`. Plan ih ne ponavlja.

**Prethodna faza:** [`2026-10-17-brancode-redesign-phase-1.md`](2026-10-17-brancode-redesign-phase-1.md). Nastavlja se na grani `redesign`.

## Globalna ograničenja

- Sva globalna ograničenja faze 1 i dalje važe: React 18, React Router 7, Vitest 3.2, bez `Co-Authored-By`, `print-queue` u istom obliku, Excel bez izmena, bez izmena baze i `api/send-email.js`.
- **Stilovi:** nov UI koristi samo Tailwind klase iz tokena (`.claude/rules/ui-conventions.md`). Bez hex vrednosti i inline stilova, osim vrednosti izračunatih u toku rada (npr. pomeraj pri prevlačenju sheet-a).
- **Raspored:** sadržaj u koloni `mx-auto w-full max-w-[480px]`. Fiksni elementi (donja traka, sheet, toast) su unutar iste širine. Gornji i donji padding uključuje `env(safe-area-inset-*)`.
- **Tekstovi** su na srpskom (latinica), tačno kako su navedeni u ovom planu i handoff-u. Brojevi uz imenice idu kroz `plural` (Task 1).
- **Pritisnuto dugme:** `active:scale-[.97]`, sa `transition-transform duration-100`.
- **Sheet:** ulazi odozdo za 250 ms (ease-out), a pozadina (`bg-scrim/80`) se pojavljuje postepeno. Zatvara se tapom na pozadinu, prevlačenjem nadole i sistemskim „nazad“. Dok traje operacija, sheet ne može da se zatvori.
- **Ikone:** `lucide-react`, sa imenima iz handoff-a. Sve postoje u verziji 0.383.

## Fokus pregleda

1. **Prst koji skroluje listu** ne sme da otvori izmenu niti da ukloni red. Testovi: `useLongPress` u Task 5.
2. **„Vrati“ posle X** kad je isti artikal u međuvremenu ponovo dodat ne sme da napravi duplikat. Test: `withItemRestored` u Task 2.
3. **„Nazad“ dok je sheet otvoren** zatvara samo sheet. Osvežavanje stranice sa sheet-om u istoriji, a bez njegovih podataka, ne prikazuje pokvaren sheet. Testovi: `useSheet` u Task 3.
4. **Srpska množina** za 1, 2, 5, 11, 21 i 22 u „N cenovnika“, „M traže proveru“, „Pročitano N artikla“ i „Obrisati svih N cenovnika?“. Testovi: `plural` u Task 1 i Home u Task 5.
5. **Neuspelo čuvanje** ostavlja sheet otvoren sa unetim podacima i nudi „Ponovi“. Test: `useProductEditor` u Task 6.

---

### Task 1: okruženje za testove komponenti, `plural` i unos cene

**Fajlovi:**
- Izmena: `package.json`, `vitest.config.js`, `src/lib/format.js`, `src/lib/format.test.js`
- Novo: `src/test/setup.js`, `src/lib/plural.js`, `src/lib/plural.test.js`

**Interfejsi:**
- Proizvodi:
  - `plural(n: number, one: string, few: string, many: string): string`, po srpskom pravilu:
    - `n % 10 === 1 && n % 100 !== 11` → `one`;
    - `n % 10` u 2–4 i `n % 100` nije u 12–14 → `few`;
    - inače → `many`.
  - `parsePrice(text: string): number | null`:
    - trim, pa jedan zarez se pretvara u tačku, pa `Number`;
    - `null` za prazno, nebroj, ≤ 0 i za tekst sa i tačkom i zarezom (`"1.249,99"`).
  - `toPriceInput(price: number): string` → `String(price)` sa tačkom zamenjenom zarezom (`1249.99` → `"1249,99"`).
  - Testovi komponenti: fajl počinje sa `// @vitest-environment jsdom`, a JSX radi u `.test.jsx` fajlovima.

- [ ] **Korak 1: okruženje**

Pokreni `npm install -D jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10`.

U `vitest.config.js`:
- `include` dobija i `"src/**/*.test.jsx"`;
- dodaj `esbuild: { jsx: "automatic" }`;
- dodaj `setupFiles: ["./src/test/setup.js"]`.

`src/test/setup.js` posle svakog testa radi `cleanup()` iz `@testing-library/react`, ali samo kad postoji `document` (dinamički import, da node testovi ne učitavaju DOM).

- [ ] **Korak 2: testovi**

`src/lib/plural.test.js`, sa `c = (n) => plural(n, "cenovnik", "cenovnika", "cenovnika")` i `a = (n) => plural(n, "artikal", "artikla", "artikala")`:
- `a(1)` je `"artikal"`, `a(2)` i `a(4)` su `"artikla"`, `a(5)`, `a(11)`, `a(12)`, `a(14)` i `a(0)` su `"artikala"`;
- `a(21)` je `"artikal"`, `a(22)` je `"artikla"`, `a(42)` je `"artikla"`, `a(111)` je `"artikala"`;
- `plural(1, "traži", "traže", "traže")` je `"traži"`, a `plural(2, …)` je `"traže"`.

`src/lib/format.test.js`, dopuna:
- `parsePrice("79")` → 79, `parsePrice(" 84,5 ")` → 84.5, `parsePrice("1249.99")` → 1249.99;
- `parsePrice("")`, `parsePrice("0")`, `parsePrice("-5")`, `parsePrice("abc")` i `parsePrice("1.249,99")` → `null`;
- `toPriceInput(1249.99)` → `"1249,99"`, `toPriceInput(84)` → `"84"`.

- [ ] **Korak 3: pokreni i proveri da ne prolaze**

Pokreni `npm test`. Očekivano: FAIL na `plural.js` i na `parsePrice` / `toPriceInput is not a function`.

- [ ] **Korak 4: implementiraj** `src/lib/plural.js` i dopunu `src/lib/format.js` po interfejsima.

- [ ] **Korak 5: pokreni**

Pokreni `npm test`. Očekivano: sve prolazi.

- [ ] **Korak 6: commit**

```bash
git add package.json package-lock.json vitest.config.js src/test/setup.js src/lib/plural.js src/lib/plural.test.js src/lib/format.js src/lib/format.test.js
git commit -m "Add component test setup, Serbian plurals and price input parsing"
```

---

### Task 2: pomoćne funkcije za listu i pamćenje formata

**Fajlovi:**
- Izmena: `src/lib/printQueue.js`, `src/lib/printQueue.test.js`
- Novo: `src/lib/printFormat.js`, `src/lib/printFormat.test.js`

**Interfejsi:**
- Proizvodi (`printQueue.js`):
  - `upsertQueueItem(queue, item): Item[]`. Ako postoji stavka sa istim `barcode`, menja se na istom mestu i zadržava stari `id`, inače se dodaje na kraj. Nova stavka nema `notInDb` ako ga `item` nema.
  - `withoutItem(queue, id): { next: Item[], removed: { item, index } | null }`.
  - `withItemRestored(queue, removed): Item[]` vraća stavku na `Math.min(index, queue.length)`. Ako u listi već postoji stavka sa istim `barcode`, vraća `queue` nepromenjen.
- Proizvodi (`printFormat.js`):
  - `parseStoredFormat(raw: string | null): "shelf" | "fridge" | "fruit"`. Sve što nije ključ iz `PRICE_TAG_STYLES` daje `"shelf"`.
  - `usePrintFormat(): [format, setFormat]`, ključ `localStorage["print-format"]`, sa try/catch kao `usePrintQueue`.

- [ ] **Korak 1: testovi**

Sa `const q = [{ id: "a", barcode: "1", name: "A", price: 1 }, { id: "b", barcode: "2", name: "B", price: 2, notInDb: true }, { id: "c", barcode: "3", name: "C", price: 3 }]`:
- `upsertQueueItem(q, { id: "x", barcode: "2", name: "B2", price: 5 })` → `[a, { id: "b", barcode: "2", name: "B2", price: 5 }, c]` (bez `notInDb`).
- `upsertQueueItem(q, { id: "x", barcode: "9", name: "N", price: 9 })` → `[a, b, c, { id: "x", … }]`.
- `withoutItem(q, "b")` → `next` je `[a, c]`, a `removed` je `{ item: b, index: 1 }`. `withoutItem(q, "zz").removed` je `null`.
- `withItemRestored([a, c], { item: b, index: 1 })` → `[a, b, c]`. `withItemRestored([a], { item: c, index: 2 })` → `[a, c]`.
- `withItemRestored([a, { id: "n", barcode: "2", name: "B", price: 2 }, c], { item: b, index: 1 })` vraća istu listu, bez duplikata.
- `parseStoredFormat("fridge")` → `"fridge"`. `parseStoredFormat(null)`, `parseStoredFormat("raf")` i `parseStoredFormat('"fruit"')` → `"shelf"`.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, funkcije ne postoje.

- [ ] **Korak 3: implementiraj** po interfejsima.

- [ ] **Korak 4: pokreni** `npm test`. Očekivano: sve prolazi.

- [ ] **Korak 5: commit**

```bash
git add src/lib/printQueue.js src/lib/printQueue.test.js src/lib/printFormat.js src/lib/printFormat.test.js
git commit -m "Add print list helpers for in-place updates and undo, and remember the print format"
```

---

### Task 3: zajednički UI — dugme, polje, logo, sheet sa istorijom i statusi

**Fajlovi:**
- Novo:
  - `src/components/Button.jsx`, `src/components/Field.jsx`, `src/components/Logo.jsx`;
  - `src/components/BottomSheet.jsx`, `src/components/Toast.jsx`;
  - `src/lib/useSheet.js`, `src/lib/gestures.js`;
  - testovi `src/lib/useSheet.test.jsx`, `src/lib/gestures.test.js`, `src/components/Toast.test.jsx`.

**Interfejsi:**
- Proizvodi:
  - `Button({ variant, size = "lg", icon, iconRight, className, ...buttonProps })`:
    - `variant`: `"accent"` (narandžasto, bela slova), `"dark"` (ink, bg slova), `"outline"` (belo, ivica `border` 1.5px), `"muted"` (surface-muted) ili `"text"` (bez pozadine, ink-2);
    - `size`: `"lg"` = visina 62px, 17/700; `"md"` = 52px, 15/600;
    - uvek `rounded-full`, ikonica 20px levo (`icon`) ili desno (`iconRight`), a `disabled` daje `opacity-50`.
  - `Field = forwardRef(({ label, suffix, className, ...inputProps }, ref))`: labela iznad vrednosti u istom belom okviru (`rounded-field`, ivica 1.5px `border`, padding 12/16). U fokusu (`focus-within`) ivica postaje 2px `accent`, a labela `accent` 600. `suffix` („din“) je desno.
  - `Logo({ size = 64 })`: `src/assets/logo.svg` u kontejneru `rounded-toast overflow-hidden`, `alt="Brancode"`.
  - `useSheet(): { name: string | null, open(name: string): void, close(): void }`:
    - `name` je `location.state?.sheet ?? null`;
    - `open` radi `navigate(location.pathname, { state: { sheet: name }, replace: name !== null && current !== null })`, tj. push ako ništa nije otvoreno, a replace pri prelasku sa sheet-a na sheet;
    - `close` radi `navigate(-1)` samo ako je sheet otvoren.
  - `shouldDismissDrag(dy: number, ms: number): boolean` → `dy > 96 || (dy > 24 && dy / ms > 0.6)`.
  - `BottomSheet({ open, onClose, dismissible = true, children })`:
    - fiksiran, pozadina `bg-scrim/80` (tap zatvara ako je `dismissible`), panel `bg-bg rounded-t-sheet`, padding 12/20/(34 + safe-area), drška 40×5;
    - prevlačenje panela nadole pomera panel (`translateY`), a na otpuštanje `shouldDismissDrag` odlučuje da li se zatvara ili vraća;
    - Escape zatvara na računaru;
    - ulaz i izlaz po globalnim ograničenjima. Kad je `open` false, posle animacije se ništa ne renderuje.
  - `ToastProvider({ children })` i `useToast(): { show(toast): void, hide(): void }`:
    - `toast = { kind: "success" | "error" | "loading" | "info", text, detail?, icon?, action?: { label, run }, duration? }`;
    - prikazuje se jedan po jedan, a novi zamenjuje stari;
    - `success` nestaje posle 2500 ms, a `duration` to menja (npr. „Vrati“ 4000);
    - `error`, `loading` i `info` ostaju dok se ne zamene ili sakriju;
    - klik na akciju poziva `run()` pa sakriva, a tap na `error` ili `info` sakriva.
  - Izgled statusa je po handoff-u („09 · Statusi“). Pozicija je `fixed`, iznad donje trake: `bottom: calc(150px + env(safe-area-inset-bottom))`. `loading` vrti `Loader` (`animate-spin`), a `detail` je u DM Mono desno.

- [ ] **Korak 1: testovi**

`src/lib/gestures.test.js`:
- `shouldDismissDrag(120, 400)` → true;
- `shouldDismissDrag(40, 50)` → true (brz potez);
- `shouldDismissDrag(40, 400)` → false;
- `shouldDismissDrag(10, 5)` → false.

`src/lib/useSheet.test.jsx` (jsdom) renderuje `MemoryRouter` (`initialEntries={["/"]}`) sa test komponentom koja prikazuje `name ?? "none"` i dugmad koja zovu `open("menu")`, `open("confirm")`, `close()` i `navigate(-1)`:
- posle `open("menu")` prikazuje „menu“, a posle `navigate(-1)` (sistemsko nazad) „none“;
- posle `open("menu")`, pa `open("confirm")`, pa `navigate(-1)` prikazuje „none“. Prelaz je bio replace, pa nazad ne vraća meni;
- posle `open("menu")`, pa `close()` prikazuje „none“, a još jedan `navigate(-1)` ne radi ništa jer smo već na početnom unosu.

`src/components/Toast.test.jsx` (jsdom, `vi.useFakeTimers()`), test komponenta poziva `show` preko dugmadi:
- `success` „Dodato: A“ je vidljiv, a posle `vi.advanceTimersByTime(2500)` više nije;
- `error` „Nema veze. Nije sačuvano.“ je i dalje vidljiv posle 10000 ms;
- novi `show` zamenjuje stari tekst;
- klik na akciju „Vrati“ poziva `run` jednom i sakriva toast.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, moduli ne postoje.

- [ ] **Korak 3: implementiraj** po interfejsima. Za prevlačenje koristi pointer događaje na panelu (`setPointerCapture`), a za vreme `performance.now()`.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: commit**

```bash
git add src/components src/lib/useSheet.js src/lib/useSheet.test.jsx src/lib/gestures.js src/lib/gestures.test.js
git commit -m "Add the shared UI kit: buttons, fields, logo, history-aware bottom sheet and status toasts"
```

---

### Task 4: prijava (01), `AuthGate` i okvir aplikacije

**Fajlovi:**
- Izmena: `src/auth/Login.jsx` (ceo), `src/auth/AuthGate.jsx` (ceo), `src/main.jsx`, `src/App.jsx`
- Novo: `src/screens/LegacyLayout.jsx`, `src/auth/Login.test.jsx`

**Interfejsi:**
- Troši: `Button`, `Field`, `Logo`, `ToastProvider` (Task 3).
- Proizvodi:
  - `AuthGate({ children: (session) => ReactNode })`:
    - dok se sesija učitava: centrirano „Učitavanje…“ (`text-ink-3`, `font-sans`);
    - bez sesije: `Login`;
    - sa sesijom: `children(session)`.
    - Zaglavlje sa emailom i „Odjava“ se uklanja.
  - `main.jsx`: `<BrowserRouter><AuthGate>{(session) => <App session={session} />}</AuthGate></BrowserRouter>`.
  - `App({ session })`:
    - koren je `<ToastProvider>` sa `div.mx-auto.min-h-dvh.w-full.max-w-[480px]`;
    - rute: `/` → `Home` (Task 5), `/skeniranje` i `/rucni-unos` → postojeći ekrani umotani u `LegacyLayout`;
    - današnji stari omotač (stil i zaglavlje) iz `App.jsx` prelazi u `LegacyLayout({ queueLength, children })`, koji je privremen.
  - `Login`: po handoff-u („01 · Prijava“):
    - naslov `Dobro jutro.` / `Prijavi se u radnju.`;
    - polja `Email` (`type="email"`, placeholder `ime@radnja.rs`) i `Lozinka`;
    - dugme `Prijavi se` (`variant="dark"`, `iconRight={ArrowRight}`), dok traje `Prijavljivanje…`;
    - greška `Pogrešan email ili lozinka.` (danger-bg, `CircleAlert`, `rounded-error`) samo posle neuspelog pokušaja;
    - dugme je onemogućeno dok email ili lozinka nisu popunjeni.

- [ ] **Korak 1: test**

`src/auth/Login.test.jsx` (jsdom) mock-uje `../supabaseClient` sa `vi.mock` tako da `auth.signInWithPassword` vraća `{ error: { message: "x" } }`:
- na početku nema teksta „Pogrešan email ili lozinka.“, a dugme „Prijavi se“ je `disabled`;
- posle unosa emaila i lozinke dugme nije `disabled`;
- posle klika `signInWithPassword` je pozvan sa `{ email: "a@b.rs", password: "tajna" }` (email sa razmacima se trim-uje), i greška se pojavljuje.

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL, stari Login nema „Dobro jutro.“ / tekst greške se ne poklapa.

- [ ] **Korak 3: implementiraj** po interfejsima. U ovom koraku `/` privremeno prikazuje stari `Home` u `LegacyLayout`-u, a Task 5 ga menja.

- [ ] **Korak 4: provera**

Pokreni `npm test && npm run build`. Zatim `npm run dev:http -- --port 5175` (konfiguracija `dev-http` u `.claude/launch.json`, viewport 390×844). Uporedi prijavu sa mockom 01. Ne odjavljuj se u ugrađenom browseru, jer bi se izgubila korisnikova sesija za dalje provere. Umesto toga pokreni drugi dev server na portu 5176, gde nema sesije, pa se prijava prikaže sama. Očekivano: raspored, fontovi i boje kao u mocku.

- [ ] **Korak 5: commit**

```bash
git add src/auth src/main.jsx src/App.jsx src/screens/LegacyLayout.jsx
git commit -m "Redesign the login screen and move the app into a 480px shell with status toasts"
```

---

### Task 5: početna (02), meni i potvrda brisanja (08)

**Fajlovi:**
- Izmena: `src/screens/Home.jsx` (ceo, novi), `src/App.jsx`
- Novo:
  - `src/components/QueueRow.jsx`, `src/lib/useLongPress.js`;
  - `src/sheets/MenuSheet.jsx`, `src/sheets/ConfirmClearSheet.jsx`;
  - testovi `src/lib/useLongPress.test.jsx`, `src/screens/Home.test.jsx`.
- Brisanje: `src/sheets/BottomSheet.jsx` (stari, više ga niko ne koristi)

**Interfejsi:**
- Troši: Task 1 (`plural`), Task 2 (`withoutItem`, `withItemRestored`), Task 3 (sve).
- Proizvodi:
  - `useLongPress(onLongPress, { ms = 500 } = {})` vraća handler-e `{ onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel, onContextMenu }`:
    - posle `ms` bez otpuštanja i bez pomeranja većeg od 10px zove `onLongPress()` i `navigator.vibrate?.(10)`;
    - `onContextMenu` zove `preventDefault()`.
  - `QueueRow({ item, tone: "check" | "ready", onLongPress, onRemove })`:
    - izgled po handoff-u („Red“ i grupe u 02). `check` je na danger-bg sa barkodom u danger-ink, a `ready` je beo sa ivicom `border-soft`;
    - desno su cena (`formatPrice`, Bricolage 22/800) i X (`aria-label="Ukloni"`, ikonica ink-4);
    - red ima `select-none` i `[-webkit-touch-callout:none]`.
  - `Home({ queue, setQueue, editor, session })`. Rukovaoce izmene (`editor`) koristi Task 6, a ovde `onLongPress` otvara `sheet.open("edit")` posle `editor.openItem(item)`. Sadržaj:
    - **Zaglavlje:** `brancode` (`font-display` 22/800) i dva okrugla dugmeta od 44px na surface-muted: `FileUp` (liflet, Task 7; u ovom task-u bez akcije) i `Ellipsis` → `sheet.open("menu")`.
    - **Tamna kartica:** `{n}` + `plural(n, "cenovnik", "cenovnika", "cenovnika")`, a ispod jedno od ovoga:
      - kad je `m > 0`: `{m} {plural(m, "traži", "traže", "traže")} proveru pre štampe`;
      - kad je `n > 0` i `m = 0`: `Sve je spremno za štampu`;
      - kad je `n = 0`: `Skeniraj prvi artikal`.
      - Desno je „Pregled“ (`Eye`) → `navigate("/pregled")`, onemogućeno kad je `n = 0`.
    - **Grupe:** `Za proveru · nije u bazi` (samo ako ih ima), pa `Spremno · {k}` sa linkom `Obriši sve` → `sheet.open("confirm-clear")`.
    - **X:** `withoutItem`, pa `toast.show({ kind: "success", text: "Uklonjeno: " + name, duration: 4000, action: { label: "Vrati", run: () => setQueue(withItemRestored(queueRef.current, removed)) } })`. `queueRef` drži najnoviju listu.
    - **Donja traka** (fiksna, 140px, gradijent ka `bg` na 40%): `Keyboard` 52px belo → `/rucni-unos`, `ScanBarcode` 84px accent sa `shadow-scan` → `/skeniranje`, `Printer` 52px ink → `/pregled` (onemogućeno kad je `n = 0`). Lista ima donji padding od 160px.
  - `MenuSheet({ open, onClose, email, canClear, onClear, onSignOut })`:
    - email korisnika (DM Mono 12, ink-3);
    - `Obriši listu` (`Trash2`, `variant="outline"`, onemogućeno kad je `!canClear`) → `sheet.open("confirm-clear")`;
    - `Odjavi se` (`LogOut`, `variant="text"`) → `supabase.auth.signOut()`.
  - `ConfirmClearSheet({ open, onClose, count, onConfirm })`, po handoff-u 08:
    - naslov `Obrisati ${plural(count, `${count} cenovnik`, `sva ${count} cenovnika`, `svih ${count} cenovnika`)}?`;
    - tekst `Lista se briše samo sa ovog telefona. Cene u bazi ostaju.`;
    - `Obriši sve` (accent) i `Zadrži listu` (muted).
  - `App` prosleđuje `session` u `Home`.

- [ ] **Korak 1: testovi**

`src/lib/useLongPress.test.jsx` (jsdom, fake timers), na `<div {...handlers}>`:
- `pointerDown`, pa posle 500 ms callback je pozvan jednom;
- `pointerDown`, `pointerUp` posle 300 ms, pa još 500 ms: nije pozvan;
- `pointerDown`, pa `pointerCancel` (počeo skrol), pa 500 ms: nije pozvan;
- `pointerDown` sa `clientY: 100`, pa `pointerMove` sa `clientY: 130`, pa 500 ms: nije pozvan.

`src/screens/Home.test.jsx` (jsdom, `MemoryRouter`, `ToastProvider`, `editor` stub `{ openItem: vi.fn() }`, `session = { user: { email: "b@b.com" } }`):
- lista sa 7 stavki od kojih 2 imaju `notInDb`: vidi se „7“ i „cenovnika“, „2 traže proveru pre štampe“, „Za proveru · nije u bazi“ i „Spremno · 5“;
- lista sa 1 stavkom bez `notInDb`: „cenovnik“ i „Sve je spremno za štampu“, a „Za proveru“ se ne vidi;
- lista sa 21 stavkom od kojih 1 ima `notInDb`: „21“, „cenovnik“ i „1 traži proveru pre štampe“;
- prazna lista: „Skeniraj prvi artikal“, a „Pregled“ je `disabled`;
- klik na prvi „Ukloni“ zove `setQueue` sa listom bez te stavke i prikazuje „Uklonjeno: <naziv>“. Klik na „Vrati“ zove `setQueue` sa stavkom vraćenom na isto mesto.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, moduli ne postoje ili stari Home nema te tekstove.

- [ ] **Korak 3: implementiraj** po interfejsima. Ruta `/pregled` još ne postoji, pa do Task 8 vodi na `/`.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: vizuelna provera**

Na 390×844 uporedi početnu sa mockom 02 (puna lista i prazna), meni i potvrdu brisanja sa 08. Proveri:
- dugi pritisak vibrira (na računaru se samo otvara izmena kad Task 6 bude gotov);
- X pa „Vrati“;
- „nazad“ zatvara meni.

- [ ] **Korak 6: commit**

```bash
git add src/screens/Home.jsx src/screens/Home.test.jsx src/components/QueueRow.jsx src/lib/useLongPress.js src/lib/useLongPress.test.jsx src/sheets src/App.jsx
git commit -m "Redesign the home screen with a grouped print list, menu and clear confirmation"
```

---

### Task 6: izmena artikla (04, osnovna), čuvanje i statusi

**Fajlovi:**
- Izmena: `src/lib/useProductEditor.js`, `src/App.jsx`, `src/screens/Home.jsx`
- Novo: `src/sheets/EditSheet.jsx`, `src/lib/useProductEditor.test.jsx`

**Interfejsi:**
- Troši: `parsePrice`, `toPriceInput`, `formatPrice` (Task 1), `upsertQueueItem` (Task 2), `BottomSheet`, `Field`, `Button`, `useSheet`, `useToast` (Task 3).
- Proizvodi:
  - `useProductEditor(queue, setQueue)` vraća `{ barcode, name, price, badge, loading, saving, error, canSave, open(code), openItem(item), setName, setPrice, save(): Promise<Item | null>, close() }`.
    - `badge` je `"U bazi" | "Novi artikal" | "Nije u bazi" | null`.
    - `savedFlash` se uklanja.
    - `open(code)`: kao danas, cena se popunjava kroz `toPriceInput`. Pronađen artikal ima „U bazi“, a nepronađen „Novi artikal“.
    - `openItem(item)`: naziv i cena se popunjavaju iz stavke liste, ne iz baze, a pretraga ide samo zbog `matchedBarcode`. Oznaka je „Nije u bazi“ ako je `item.notInDb`, inače „U bazi“.
    - `canSave` = `name.trim() !== "" && parsePrice(price) !== null && !loading && !saving`.
    - `save()`: `saveProduct`, pa `setQueue(upsertQueueItem(queue, { id, barcode, name, price }))` (artikal iz „Nije u bazi“ tako gubi `notInDb`). Vraća sačuvanu stavku. Kod greške vraća `null`, izmena ostaje otvorena sa podacima, a `error` je `"save"`.
    - `close()` zatvara izmenu (`barcode = null`).
  - `EditSheet({ editor, open, onClose })`:
    - oznaka (success-bg ili danger-bg) i barkod (DM Mono 12);
    - `Field` „Naziv“ i `Field` „Cena“ (`inputMode="decimal"`, `suffix="din"`, vrednost Bricolage 36/800);
    - `Sačuvaj i zatvori` (accent), `disabled={!editor.canSave}`;
    - dok traje pretraga, umesto oznake piše `Tražim u bazi…`;
    - greška pretrage je inline: `Ne mogu da se povežem sa bazom. Proveri internet konekciju.`;
    - fokus je na ceni kad je artikal pronađen, a na nazivu kad nije.
  - Home posle uspešnog čuvanja zatvara sheet i prikazuje `toast.show({ kind: "success", icon: Check, text: "Dodato: " + name, detail: formatPrice(price) })`. Kod greške prikazuje `toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: save } })`.
  - `App` umesto današnjeg `openCode` radi `navigate("/", { replace: true, state: { sheet: "edit" } })`, pa `editor.open(code)`.
  - Home: ako je `sheet.name === "edit"`, a `editor.barcode === null` (osvežena stranica), radi `navigate(".", { replace: true, state: null })`.

- [ ] **Korak 1: testovi**

`src/lib/useProductEditor.test.jsx` (jsdom, `renderHook`, `vi.mock("./products.js")`):
- `openItem({ id: "b", barcode: "2", name: "Lista", price: 12.5, notInDb: true })`, a pretraga vraća `null`: `name` je „Lista“, `price` je „12,5“, `badge` je „Nije u bazi“;
- posle toga `save()` zove `saveProduct({ barcode: "2", name: "Lista", price: 12.5 }, null)`, a `setQueue` dobija listu u kojoj je stavka „b“ na istom mestu i bez `notInDb`;
- `open("8600005000122")`, a pretraga vraća `{ barcode: "860000500012", name: "MAJONEZ 175", price: 84 }`: `save()` zove `saveProduct(…, "860000500012")`;
- `saveProduct` odbija: `save()` vraća `null`, `error` je „save“, a `barcode`, `name` i `price` su nepromenjeni;
- `setPrice("0")` daje `canSave` false, a `setPrice("79")` daje true.

- [ ] **Korak 2: pokreni i proveri da ne prolaze.** Očekivano: FAIL, nema `openItem`, `canSave` i `badge`.

- [ ] **Korak 3: implementiraj** po interfejsima. Stara kartica izmene nestaje iz `Home`-a.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: ručna provera** (prijavljen, 390×844):
- Ručni unos `8600005000122`: otvara se sheet na `/` sa „MAJONEZ 175“, a „nazad“ zatvara sheet i ostaje na `/`.
- Dugi pritisak na red: sheet sa podacima iz liste. Promeni cenu i vrati je, pa „Sačuvaj i zatvori“: pojavljuje se „Dodato: MAJONEZ 175 · 84,00“, a red ostaje na istom mestu.
- Ako se ovde nešto upiše u bazu, vrati staru cenu, kao pri testu popravke barkoda.

- [ ] **Korak 6: commit**

```bash
git add src/lib/useProductEditor.js src/lib/useProductEditor.test.jsx src/sheets/EditSheet.jsx src/screens/Home.jsx src/App.jsx
git commit -m "Edit products in a bottom sheet from scans and from the list" -m "- Saving a 'nije u bazi' item adds it to the database and moves it to Spremno; failed saves keep the sheet open with a retry."
```

---

### Task 7: uvoz lifleta (07)

**Fajlovi:**
- Izmena: `src/promoLeaflet.js`, `src/screens/Home.jsx`
- Novo: `src/sheets/LeafletImportSheet.jsx`, `src/sheets/LeafletImportSheet.test.jsx`

**Interfejsi:**
- Proizvodi:
  - `parseLeafletPdf(arrayBuffer, onProgress?: (page: number, total: number) => void)`, koji zove `onProgress` pre čitanja svake strane.
  - `LeafletImportSheet({ open, onClose, fileName, matches, queueLength, saving, onConfirm })`, po handoff-u 07:
    - naslov `Pročitano ${n} ${plural(n, "artikal", "artikla", "artikala")}`, a ispod `fileName` (DM Mono 12);
    - kartice `{k}` / `u bazi, cena se ažurira` (success) i `{m}` / `nisu u bazi, samo u listu` (danger);
    - kad je `queueLength > 0`, info blok (`Info`): `Trenutna lista (${queueLength}) biće zamenjena. Nepotrebne artikle ukloni pre štampe.`;
    - dugme `Zameni listu i uvezi` kad je lista puna, a `Uvezi u listu` kad je prazna (`variant="dark"`);
    - `Otkaži` (`variant="text"`);
    - `dismissible={!saving}`.
- Home tok, bez stare potvrde „Lista nije prazna“:
  1. `FileUp` odmah radi `inputRef.current.click()`, sinhrono.
  2. Posle izbora fajla: `toast.show({ kind: "loading", text: "Čitam liflet…", detail: "strana X / Y" })` preko `onProgress`.
  3. Zatim `toast.hide()` i `sheet.open("leaflet")` sa podacima u state-u Home-a.
  4. Potvrda: `saving`, pa `saveLeafletPrices`, pa `setQueue(imported)` (ista logika kao danas), `sheet.close()` i `toast.show({ kind: "success", text: "Uvezeno u listu: " + n })`.
  5. Greške idu kao `toast.show({ kind: "error", icon: CircleAlert, text })`, sa istim tekstovima kao danas.
  6. Ako je otvoren sheet „leaflet“ bez podataka (osvežena stranica), primenjuje se isti `replace` kao za izmenu.

- [ ] **Korak 1: test**

`src/sheets/LeafletImportSheet.test.jsx` (jsdom, `MemoryRouter`), sa 42 stavke od kojih 35 ima `existing`:
- vidi se „Pročitano 42 artikla“, „35“, „7“ i ime fajla;
- sa `queueLength={7}` vidi se „Trenutna lista (7) biće zamenjena.“ i dugme „Zameni listu i uvezi“;
- sa `queueLength={0}` nema info bloka, a dugme je „Uvezi u listu“;
- sa 21 stavkom naslov je „Pročitano 21 artikal“.

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL, nema modula.

- [ ] **Korak 3: implementiraj** po interfejsima.

- [ ] **Korak 4: pokreni** `npm test && npm run build`. Očekivano: sve prolazi.

- [ ] **Korak 5: ručna provera**

Ako korisnik ima PDF lifleta, uvezi ga. Ako nema, ostavi to za korisnikov završni test i zapiši to kao ruling. Uporedi sheet sa mockom 07.

- [ ] **Korak 6: commit**

```bash
git add src/promoLeaflet.js src/screens/Home.jsx src/sheets/LeafletImportSheet.jsx src/sheets/LeafletImportSheet.test.jsx
git commit -m "Redesign the promo leaflet import with page progress and a single confirm sheet"
```

---

### Task 8: `/pregled` bez A4 pregleda (06), dokumentacija i provera faze

**Fajlovi:**
- Novo: `src/screens/PrintPreview.jsx`, `src/screens/PrintPreview.test.jsx`
- Izmena: `src/App.jsx` (ruta), `src/screens/Home.jsx` („Pregled“ i štampa vode na `/pregled`), `CLAUDE.md`, `.claude/rules/ui-conventions.md`, `.claude/rules/price-tag-export.md`

**Interfejsi:**
- Troši: `usePrintFormat` (Task 2), `buildWorkbookBuffer`, `sheetFilename`, `PRICE_TAG_STYLES` (faza 1), `sendSheetByEmail` (faza 1), `useToast`, `Button`, `leaveScreen` (faza 1).
- Proizvodi: `PrintPreview({ queue })` na `/pregled`:
  - **Prazna lista:** `<Navigate to="/" replace />`.
  - **Zaglavlje:** nazad (`ArrowLeft`, 44px) → `leaveScreen`, naslov `Pregled štampe` (Bricolage 24/800) i desno `${n} kom`.
  - **Segment:** `Raf` (`LayoutGrid`), `Frižider` (`Refrigerator`) i `Voće` (`Apple`), za `shelf`, `fridge` i `fruit`. Aktivan je na ink pozadini sa bg slovima. Izbor se pamti kroz `usePrintFormat`.
  - **Mesto za A4 pregled** ostaje prazno do faze 3.
  - **Akcije** u redu, iste širine:
    - `Pošalji` (accent, `Send`): `toast.show({ kind: "loading", text: "Šaljem na mejl…" })`, pa uspeh `{ kind: "success", icon: MailCheck, text: "Poslato na mejl radnje" }`, a greška `{ kind: "error", icon: WifiOff, text: "Nema veze. Nije poslato.", action: { label: "Ponovi", run: send } }`;
    - `Excel` (outline, `Download`): preuzimanje kao danas.

- [ ] **Korak 1: test**

`src/screens/PrintPreview.test.jsx` (jsdom, `MemoryRouter` na `/pregled`, localStorage očišćen):
- sa 7 stavki vidi se „7 kom“, a „Raf“ je aktivan (`aria-pressed="true"`);
- klik na „Voće“ ga čini aktivnim i upisuje `localStorage["print-format"]` = „fruit“;
- sa praznom listom ruta vodi na `/` (test ruta `/` prikazuje „HOME“).

- [ ] **Korak 2: pokreni i proveri da ne prolazi.** Očekivano: FAIL.

- [ ] **Korak 3: implementiraj** i poveži „Pregled“ i štampu sa početne na `/pregled`.

- [ ] **Korak 4: dokumentacija**
- `CLAUDE.md` Architecture: rute (`/pregled`), `components/`, `sheets/`, sheet istorija preko `location.state.sheet` (`useSheet`) i `ToastProvider`.
- `ui-conventions.md`:
  - koristi `Button`, `Field`, `BottomSheet` i `useToast`, a ne pravi nove varijante;
  - sheet se otvara samo kroz `useSheet`;
  - tekstovi sa brojevima idu kroz `plural`.
- `price-tag-export.md`: izbor formata je na `/pregled` (`usePrintFormat`), a ne u sheet-u.

- [ ] **Korak 5: kompletna provera**

Pokreni `npm test && npm run build`. Očekivano: sve prolazi. Na 390×844 prođi:
- prijavu;
- početnu (puna i prazna lista);
- meni;
- brisanje;
- izmenu iz liste i iz ručnog unosa;
- uvoz lifleta;
- `/pregled` sa sva tri formata i preuzimanjem.

Proveri i sistemsko „nazad“ na svakom sheet-u i ekranu. Uporedi sve sa mockom.

- [ ] **Korak 6: commit**

```bash
git add src/screens/PrintPreview.jsx src/screens/PrintPreview.test.jsx src/App.jsx src/screens/Home.jsx CLAUDE.md .claude/rules
git commit -m "Add the print screen with format choice, send and Excel download"
```

Push i provera na telefonu idu posle korisnikovog završnog testiranja, zajedno sa Task 7 iz faze 1.
