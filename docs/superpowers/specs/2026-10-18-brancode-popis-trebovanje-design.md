# Brancode: meni, Popis, Trebovanje i nadogradnja cenovnika — dizajn

Datum: 2026-10-18 · Polazi od: `main` posle redizajna „Pijaca“ (PR #8) · Prethodni spec: [`2026-10-17-brancode-redesign-design.md`](2026-10-17-brancode-redesign-design.md)

## Zašto

Aplikacija danas služi samo za cenovnike. U radnji se radi i:
- **popis:** prebrojavanje robe na stanju za neki period;
- **trebovanje:** spisak šta treba nabaviti za dan.

Oba se rade na papiru ili ponovnim kucanjem. Cilj je da se i jedno i drugo radi istim skeniranjem kao cenovnici, da se liste čuvaju i da se lepo štampaju i šalju. Uz to, cenovnici za raf i frižider dobijaju broj barkoda i manje decimale, da bi mu oslobodili mesto.

## Odluke (iz razgovora)

1. **Meni:** dugme u zaglavlju početne otvara meni odozdo, kao postojeći sheet-ovi, jer se jednom rukom lakše dohvata od hamburgera gore levo. Stavke:
   - Cenovnici (početna), Popis, Trebovanje;
   - odvojeno ispod: Podešavanja (za sada privremeni izbor čitača) i Odjava.
2. **Popis i Trebovanje su posebni ekrani,** svaki sa spiskom svojih lista i dugmetom za novu listu.
3. **Liste se čuvaju u Supabase-u** i zajedničke su za sve uređaje i korisnike radnje. Ovo je moja pretpostavka, korisnik joj se nije protivio.
4. **Artikal koji nije u bazi artikala ostaje samo na listi** (popisa ili trebovanja) i ne upisuje se u `products`. U `products` upisuje samo tok za cenovnike.
5. **Popis i Trebovanje nikad ne menjaju cene niti nazive u `products`.**
6. **Izvoz:** uredan PDF (tabela, više strana) za preuzimanje i slanje mejlom, preko postojećeg `api/send-email.js`.
7. **Cenovnici:** raf i frižider dobijaju **broj barkoda** (samo cifre, bez linija), uspravno uz desnu ivicu ćelije cene, a decimale („,50“) upola manjim fontom, poravnate na vrh. Voće ostaje kakvo jeste.
8. **Novo u bazi:** tabele pravi SQL koji pripremi graditelj, a korisnik ga pokreće u Supabase konzoli.

## Ne-ciljevi

- Popis ne ažurira stanje zaliha nigde osim na samoj listi.
- Nema više radnji, staging okruženja ni rada sa listama bez interneta. Čitanje i čuvanje lista traže vezu, kao čuvanje cene danas.
- Nema uvoza ili izvoza u Excel za Popis i Trebovanje. Samo PDF.

## Anti-ciljevi (neuspeh i kad tehnički radi)

- Skeniranje u Popisu ili Trebovanju slučajno promeni cenu ili naziv u bazi artikala.
- Lista se izgubi ili obriše bez jasnog upozorenja.
- Odštampan PDF od više strana je nepregledan: bez zaglavlja tabele na svakoj strani, bez broja strane, sa iseckanim nazivima ili sa pokvarenim slovima č, ć, š, ž, đ.
- Na cenovniku broj barkoda uguši cenu, ili je toliko sitan da se ne može pročitati.

## Meni

- Dugme „…“ na početnoj postaje dugme menija (ikonica `Menu`) i otvara sheet sa stavkama iz odluke 1. Aktivna sekcija je označena.
- Sekcije su rute: `/` (Cenovnici), `/popis`, `/trebovanje`. Meni je dostupan i na `/popis` i na `/trebovanje`, sa istog mesta u zaglavlju.
- „Podešavanja“ za sada sadrži samo privremeni izbor čitača („Čitač barkoda (test)“), premešten iz sadašnjeg menija. Oblik je stvar graditelja: sheet ili ekran.
- Odjava ostaje u meniju.

## Popis

### Spisak popisa (`/popis`)

- Liste od najnovije ka najstarijoj. Svaki red pokazuje naziv i broj stavki.
- Dugme „Novi popis“.
- Brisanje cele liste uz potvrdu koja jasno kaže šta se briše i koliko stavki ima. Mesto u UI-u je stvar graditelja, uz postojeće obrasce (npr. dugi pritisak ili meni liste).

### Novi popis

- Bira se period od–do. Podrazumevano je ovo moja odluka: od 1. u tekućem mesecu do danas.
- Opcioni tekst.
- **Naziv:** `dd.mm.yyyy – dd.mm.yyyy`, a kad tekst postoji, `tekst · dd.mm.yyyy – dd.mm.yyyy`.
- Naziv i period se menjaju olovčicom u zaglavlju liste. Otvara se isti sheet kao pri kreiranju.

### Lista (`/popis/:id`)

- Stavke jedna ispod druge: naziv, barkod, cena i količina.
- Donja traka kao na početnoj: ručni unos, Skeniraj, i izvoz (PDF: preuzmi ili pošalji).
- Dugi pritisak na stavku otvara izmenu, a X je briše. To su isti obrasci kao na početnoj, uključujući „Vrati“.

### Stavka popisa

- Polja: naziv, cena, barkod i količina na stanju.
- **Barkod:**
  - skeniran: zaključan;
  - ručni unos: kuca se na tastaturi za barkod (isti ekran kao `/rucni-unos`), pa je posle toga zaključan u formi;
  - svaka stavka popisa ima barkod.
- **Koji barkod se čuva** (moja odluka): skenirani ili ukucani kod, a kad je poznat, pun 13-cifreni. Lista ne upisuje ništa u `products`, pa se 12-cifreni red u bazi ne pomera. Isti artikal sa 12 ili 13 cifara (kao u `barcodeCandidates`) računa se kao „već na listi“ i ne pravi drugu stavku. PDF štampa sačuvani kod.
- **Artikal pronađen u bazi** (preko `barcodeCandidates`): naziv i cena se popunjavaju iz baze i zaključani su (moja odluka). Popis ne menja bazu, pa izmena tu ne bi imala smisla.
- **Artikal nije u bazi:** naziv i cena se upisuju ručno.
- **Validacija:** sva polja su obavezna. Cena > 0, po istim pravilima kao danas. Količina je broj ≥ 0 (nula je dozvoljena na popisu), sa decimalama zbog robe na meru, zarez ili tačka (moja odluka).
- **Već na listi:** skeniranje ili unos barkoda koji je već na ovom popisu otvara pitanje „Artikal je već na popisu. Dodati količinu ili izmeniti stavku?“ sa tri izbora:
  - „Dodaj količinu“: samo polje za broj, koji se sabira sa postojećom količinom;
  - „Izmeni stavku“: forma sa svim poljima;
  - „Otkaži“.
- **Više telefona na istom popisu** (odluka korisnika: mora da radi):
  - „Dodaj količinu“ sabira u bazi (`quantity = quantity + n`), a ne prepisuje;
  - dodavanje barkoda koji je drugi telefon upravo dodao vodi u pitanje „Artikal je već na popisu“, a ne u grešku;
  - lista se osvežava pri otvaranju i posle svakog čuvanja, bez praćenja uživo.
  - Isto važi za trebovanje.
- **Skeniranje u nizu radi kao na cenovnicima:** posle čuvanja kamera nastavlja. Posle stavke ide „Sačuvaj i skeniraj sledeći“, a posle duplikata „Dodaj i skeniraj sledeći“. Isti obrazac pauze i nastavka kamere.

### PDF popisa

- Zaglavlje: naziv popisa, period, datum izrade i broj stavki.
- Tabela: redni broj, naziv, barkod, cena i količina. Na svakoj strani se ponavlja zaglavlje tabele, a u podnožju piše „Strana X od Y“.
- A4 uspravno. Dugi nazivi se prelamaju, ne seku.
- Srpska latinica mora biti ispravna, pa se ugrađuje font koji ima č, ć, š, ž, đ.
- Ime fajla: `popis-<period>.pdf`.

## Trebovanje

Isto kao Popis, osim:

- **Novo trebovanje:** jedan datum (podrazumevano danas) i opcioni tekst. Naziv je `tekst dd.mm.yyyy` ili samo `dd.mm.yyyy`.
- **Stavka:** naziv je obavezan, a barkod, cena i **količina** (koliko treba nabaviti) nisu. Ručni unos može biti bez barkoda: samo naziv, npr. „hleb za sendviče“.
- **Duplikat:** kad je barkod već na trebovanju, isto pitanje kao na popisu („Dodaj količinu / Izmeni stavku / Otkaži“). Ako stavka nema količinu, „Dodaj količinu“ je postavlja na uneti broj.
- **Spisak trebovanja:** poslednjih 20 dana na vrhu, a starija u sekciji „Arhiva“ ispod (moja odluka). Ništa se ne briše automatski. Brisanje je ručno, uz potvrdu, kao kod popisa.
- **„Prenesi stavke“** (dugme u zaglavlju liste) **kopira** izabrane stavke (odluka korisnika). Staro trebovanje ostaje kakvo je, a posle prenosa se otvara ciljno trebovanje:
  1. Uključuje režim izbora sa kvadratićem na svakoj stavki i „Izaberi sve“.
  2. Posle izbora otvara sheet sa listom trebovanja (od najnovijeg; trenutno je isključeno) i opcijom „Novo trebovanje sa izabranim stavkama“ na vrhu.
  3. „Novo trebovanje“ prvo traži datum i tekst (podrazumevano danas), pa prebacuje.
  4. Stavka sa barkodom koji već postoji na ciljnom trebovanju se ne duplira, nego joj se dodaje količina, ako je ima.
- **PDF trebovanja:** tabela sa kolonama naziv, barkod, cena, količina i prazan kvadratić skroz desno za štikliranje posle štampe. Isto zaglavlje i podnožje kao kod popisa. Ime fajla: `trebovanje-<datum>.pdf`.

## Nadogradnja cenovnika (raf i frižider)

- **Cena:** celi deo ostaje kao danas. Decimalni deo sa zarezom („,50“) je upola manji i poravnat na vrh celog dela, kao eksponent. U Excel-u to je rich text u ćeliji. Tačan način je stvar graditelja, ali na papiru mora izgledati tako.
- **Broj barkoda:** samo cifre barkoda artikla, bez linija (odluka korisnika: linije ne bi stale čitljive). Okrenut je uspravno uz desnu ivicu ćelije cene (moje tumačenje „uz ivicu, uspravno, da zauzme što manje mesta“). Sitan, ali da se lako pročita.
  - U frižideru mora biti u vidljivom delu ćelije, koji držač ne pokriva.
  - Cena i broj se ne preklapaju. Ako cena ne staje, smanjuje se (postojeći „shrink to fit“).
  - U Excel-u ćelija ne može imati dva različito okrenuta teksta, pa broj može biti slika (cifre iscrtane na canvasu i okrenute) postavljena kao barkod za voće, ili uska dodatna kolona sa okrenutim tekstom. Izbor je stvar graditelja, ali raspored i broj cenovnika po strani ne smeju da se promene.
- **Pregled štampe prati Excel** (odluka 3 iz prethodnog spec-a): `PriceTag` crta iste decimale i isti broj, iz iste geometrije.
- **Testovi u `priceTags.test.js`** se ažuriraju: rich text vrednosti i broj barkoda na rafu i frižideru. Pravilo da se dimenzije menjaju samo kroz `PRICE_TAG_STYLES` i dalje važi.

## Baza (novo)

Četiri tabele, sa RLS-om „prijavljen korisnik može sve“, kao `products` za upis:

| Tabela | Polja |
|---|---|
| `inventories` (popisi) | `id`, `title` (tekst korisnika, može prazno), `date_from`, `date_to`, `created_at`, `created_by` (default `auth.uid()`) |
| `inventory_items` | `id`, `inventory_id` (cascade), `barcode` (obavezan), `name`, `price`, `quantity`, `in_products` (bool), `created_at`, `updated_at`; jedinstven par (`inventory_id`, `barcode`) |
| `requisitions` (trebovanja) | `id`, `title`, `date`, `created_at`, `created_by` |
| `requisition_items` | `id`, `requisition_id` (cascade), `barcode` (može null), `name` (obavezan), `price` (može null), `quantity` (može null), `created_at`, `updated_at`; jedinstven par (`requisition_id`, `barcode`) kad barkod postoji |

- Konkretni tipovi, indeksi i SQL su stvar graditelja. SQL ide u `supabase/migrations/` i u uputstvo za korisnika.
- `products` se ne menja.

## Slanje mejlom

`api/send-email.js` dobija opcioni `subject`. Podrazumevano ostaje „Cenovnik – …“, a za PDF se šalje „Popis – …“ ili „Trebovanje – …“. Prilog je PDF (`application/pdf`). Ograničenje veličine ostaje isto. Ako PDF za veliki popis pređe limit, korisnik dobija jasnu poruku da ga preuzme umesto da ga šalje.

## Faze

Svaka faza ima svoj plan, izvršavanje i pregled, kao kod redizajna. Na `main` ide posle svake faze (aplikacija je u test fazi).

1. **Meni + Popis:** meni, rute sekcija, tabele za popis, spisak, lista, stavke, duplikati, skeniranje u nizu, PDF i mejl.
2. **Trebovanje:** tabele, spisak sa arhivom, lista, stavke, prenos stavki i PDF. Koristi što je moguće više delova Popisa.
3. **Nadogradnja cenovnika:** decimale i uspravan broj barkoda na rafu i frižideru, u Excel-u i pregledu.

## Provera

- Vitest za čistu logiku: nazivi lista, validacija, sabiranje količina, izbor i prenos stavki bez duplikata, raspored PDF-a gde je moguće, rich text cene i položaj barkoda.
- Ručna provera u browseru kao do sada.
- Na telefonu i papiru se testira kasnije, zajedno sa redizajnom. Sve se dopisuje u `docs/testing/redesign-test-checklist.md` (ili u novi spisak pored njega), naročito:
  - da li je uspravan broj barkoda na rafu i frižideru čitljiv i da li ostaje u vidljivom delu držača;
  - da li PDF od više strana izgleda uredno na papiru.

## Ostavljeno graditelju

- Raspored ekrana Popisa i Trebovanja u okviru tokena i komponenti redizajna (Button, Field, BottomSheet, QueueRow obrasci, statusi). Nema novog mocka, pa graditelj prati stil postojećih ekrana.
- Kako se ekrani za kameru i ručni unos uopštavaju da služe i cenovnicima i listama.
- Biblioteka za PDF.
- Tačni SQL tipovi i indeksi.
- Mesto brisanja cele liste u UI-u.

## Moje odluke (da ih proveriš)

- Meni se otvara odozdo, a ne kao hamburger gore levo.
- Podrazumevani period novog popisa je od 1. u mesecu do danas.
- Na popisu su naziv i cena artikla iz baze zaključani, a ručno se upisuju samo za artikle kojih nema u bazi.
- Količina na popisu dozvoljava 0 i decimale.
- Trebovanja starija od 20 dana idu u „Arhivu“ na istom ekranu. Ništa se ne briše automatski.
- Čuva se pun skenirani barkod. Isti artikal sa 12 ili 13 cifara je isti duplikat.
- Broj barkoda na cenovniku je uspravan, uz desnu ivicu ćelije cene.

## Otvorena pitanja

Nema. Odgovori iz provere su uneti iznad: količina u trebovanju, samo broj barkoda na cenovniku, prenos kopira, više telefona na popisu.
