# Trebovanje: plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:** sekcija Trebovanje. Spisak, sa arhivom za starije od 20 dana. Jedno trebovanje ima datum i stavke, gde je barkod opcion i stavka sme da bude „samo naziv“. Uz to:
- skeniranje i ručni unos u nizu, sa istim pitanjem o duplikatu kao na popisu;
- „Prenesi stavke“, koje kopira izabrane stavke u drugo ili novo trebovanje;
- PDF sa kvadratićem za štikliranje.

**Arhitektura:**
- Sve što Popis već ima koristi se ponovo: `createListStore`, `CameraScanner`, `BarcodeKeypad`, `ListCard`, `ListItemRow`, `ExportSheet`, `ConfirmDeleteListSheet`, `listPdf`, `sendFileByEmail`.
- Tok stavke i njegov sheet se uopštavaju. `useListItemFlow(store, listId, rules)` i `ListItemSheet` primaju pravila i tekstove po vrsti liste. Popis ih koristi sa svojim pravilima, bez promene ponašanja: postojeći testovi popisa prolaze.
- Isto važi za `useListEntry` (ranije `useInventoryEntry`).

**Spec:** [`2026-10-18-brancode-popis-trebovanje-design.md`](../specs/2026-10-18-brancode-popis-trebovanje-design.md), odeljak „Trebovanje“ (sve što nije navedeno je „isto kao Popis“).

**Grana:** `trebovanje`. Na `main` ide jedan squash commit.

## Globalna ograničenja

- **Naziv trebovanja:** `tekst dd.mm.yyyy` ili samo `dd.mm.yyyy` (bez tačke-separatora, kako spec kaže). Podrazumevani datum je danas.
- **Stavka:**
  - naziv je obavezan;
  - barkod, cena (> 0) i količina (> 0, do 3 decimale) nisu;
  - artikal iz `products` ima zaključan naziv i cenu, isto kao na popisu;
  - ništa se ne piše u `products`.
- **Duplikat:** isto pitanje kao na popisu. „Dodaj količinu“ na stavci bez količine postavlja uneti broj (RPC `add_requisition_quantity` radi `coalesce`).
- **Arhiva:** trebovanja čiji je `date` stariji od 20 dana od danas idu u „Arhiva“ ispod. Ništa se ne briše automatski.
- **Prenos:**
  - kopira, a izvor ostaje isti;
  - stavka sa barkodom koji već postoji na cilju dobija dodatu količinu ako je ima, inače se preskače;
  - stavka bez barkoda se uvek kopira;
  - posle prenosa se otvara cilj (`replace`).
- **PDF:**
  - zaglavlje: „Trebovanje · tekst“, datum, „Izrađeno …“ i broj stavki;
  - kolone: Naziv, Barkod, Cena, Količina i prazan kvadratić (pdfmake `canvas rect`);
  - prazna polja ostaju prazna;
  - ime fajla `trebovanje-<yyyy-mm-dd>.pdf`;
  - mejl „Trebovanje – <naziv>“.

## Review Focus

1. **Stavka bez barkoda** (samo naziv), kroz dodavanje, izmenu, prenos i PDF.
2. **Prenos** u trebovanje koje već ima neke od tih artikala: bez duplikata, a količine se sabiraju. Prekid veze na pola prenosa jasno kaže koliko je preneseno.
3. **Granica arhive:** trebovanje od pre tačno 20 dana je još na vrhu, a od pre 21 dana je u arhivi.
4. **Popis se ne menja:** posle uopštavanja svi testovi popisa prolaze bez izmena u očekivanjima.
5. **Ručni unos bez barkoda:** sa tastature se može dodati samo naziv.

---

### Task 1: Uopštavanje toka i sheet-a

**Fajlovi:**
- `src/lib/useListItemFlow.js` (nastaje od `useInventoryItemFlow.js`);
- `src/sheets/ListItemSheet.jsx` (od `InventoryItemSheet.jsx`);
- `src/screens/useListEntry.js` (od `useInventoryEntry.js`);
- popis ekrani i testovi menjaju samo uvoze.

**Produces:**
- `useListItemFlow(store, listId, rules)`, sa pravilima:
  - `rules.priceRequired`, `rules.quantity` (`"required-zero-ok"` | `"optional"`), `rules.barcodeOptional`;
  - `start(code)` uz `startWithoutBarcode()`.
- `inventoryRules`, `requisitionRules`.
- `ListItemSheet({ flow, …, texts })`, gde `texts` nosi `quantityLabel` i `duplicateTitle`.
- `useListEntry(id, { section, store, rules, onNext })`.

- [ ] Testovi popisa (`useInventoryItemFlow.test.js`, `Inventory*.test.jsx`) prolaze, uz izmenjene samo uvoze ili poziv hook-a.
- [ ] Novi testovi za `requisitionRules`:
  - prazna cena i količina prolaze;
  - „0“ za količinu se odbija;
  - prazan naziv se odbija;
  - `startWithoutBarcode` daje formu bez barkoda, sa otključanim nazivom.
- [ ] Commit.

### Task 2: Podaci i nazivi

**Fajlovi:** `src/lib/requisitions.js` + test, `src/lib/listFormat.js` + test (`requisitionTitle`, `isArchived(dateIso, now)`).

- [ ] **Testovi:**
  - `requisitionTitle` sa tekstom i bez njega;
  - `isArchived` za 20 i 21 dan;
  - mapiranje redova: `barcode`, `price` i `quantity` mogu biti `null`;
  - `addQuantity` zove `add_requisition_quantity`;
  - `transferItems(store, items, targetId)` (u `requisitions.js`): dodaje nove, sabira postojeće, preskače postojeće bez količine, kopira stavke bez barkoda i vraća `{ copied, added, skipped }`. Ako veza pukne na pola, baca grešku sa `done`.
- [ ] Commit.

### Task 3: Spisak (`/trebovanje`) i lista (`/trebovanje/:id`)

**Fajlovi:**
- novo: `src/screens/RequisitionLists.jsx`, `src/screens/Requisition.jsx` + testovi, `src/sheets/RequisitionFormSheet.jsx`;
- izmena: `App.jsx`, `AppMenu.jsx` (`SECTIONS`, ikonica `ShoppingCart`).

**Spisak:** gore poslednjih 20 dana, a ispod naslov „Arhiva“ sa starijima. Dugi pritisak briše, a „Novo trebovanje“ pita datum i tekst.

**Lista:** isto kao popis. Red pokazuje „barkod · cena“ samo za ono što postoji, a količinu samo ako je ima.

- [ ] **Testovi:**
  - arhiva razdvaja po datumu;
  - novo trebovanje sa datumom danas otvara listu;
  - stavka bez barkoda i cene prikazuje samo naziv.
- [ ] Commit.

### Task 4: Skeniranje, ručni unos i „bez barkoda“

**Fajlovi:** `src/screens/RequisitionScan.jsx`, `src/screens/RequisitionManualEntry.jsx` + test. `BarcodeKeypad` dobija opcioni `extraAction` (dugme „Bez barkoda“).

- [ ] **Testovi:**
  - „Bez barkoda“ otvara formu bez barkoda, a „Sačuvaj i upiši sledeći“ dodaje stavku sa `barcode: null`;
  - kod koji je već na trebovanju otvara pitanje o duplikatu.
- [ ] Commit.

### Task 5: Prenos stavki

**Fajlovi:** `src/sheets/TransferSheet.jsx` + izmena `Requisition.jsx` (režim izbora: kvadratići, „Izaberi sve“, „Prenesi (N)“) + test.

**Tok:**
1. „Prenesi stavke“ u zaglavlju uključuje izbor.
2. „Prenesi (N)“ otvara sheet: na vrhu „Novo trebovanje sa izabranim stavkama“, ispod ostala trebovanja od najnovijeg (trenutno nije ponuđeno).
3. Novo trebovanje prvo pita datum i tekst.
4. Posle prenosa ide toast „Preneseno: N“ i `navigate(/trebovanje/<cilj>, { replace: true })`.

- [ ] **Testovi:**
  - izbor i „Izaberi sve“;
  - prenos u postojeće zove `transferItems` sa izabranim stavkama i otvara cilj;
  - „Novo trebovanje sa izabranim stavkama“ pravi trebovanje pa prenosi;
  - trenutno trebovanje nije u spisku ciljeva.
- [ ] Commit.

### Task 6: PDF i slanje

**Fajlovi:** `src/lib/listPdf.js` + test (`requisitionPdfDefinition`, `requisitionPdfFilename`), izmena `Requisition.jsx`.

- [ ] **Testovi:**
  - kolone su Naziv, Barkod, Cena, Količina i prazna kolona sa `canvas rect`;
  - prazna cena i količina daju prazne ćelije;
  - zaglavlje sadrži „Trebovanje · tekst“ i „Datum: 18.10.2026“;
  - `headerRows: 1`;
  - ime fajla je `trebovanje-2026-10-18.pdf`.
- [ ] `npm test && npm run build`, provera u browseru. Probno trebovanje se posle obriše.
- [ ] Commit.

### Task 7: Dokumentacija i pitanja

- [ ] `CLAUDE.md` (rute), `.claude/rules/lists.md` (Trebovanje, prenos, arhiva), spisak za testiranje, `docs/pitanja.md`.
