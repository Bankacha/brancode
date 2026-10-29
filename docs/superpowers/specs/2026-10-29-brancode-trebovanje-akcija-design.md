# Brancode: kolona „Akcija“ na trebovanju (dizajn)

Datum: 2026-10-29. Polazi od: `main` na verziji 0.12.2. Verzija posle: 0.13.0. Prethodni spec za liflet: [`2026-10-20-brancode-akcija-kopije-design.md`](2026-10-20-brancode-akcija-kopije-design.md).

## Zašto

Radnja uvozi novi liflet i do 7 dana pre nego što prethodni istekne. Robu za akciju nabavlja unapred, pa na trebovanju mora da vidi liflet cene i za liflet koji još nije počeo, a ne samo za onaj koji trenutno važi.

Dok se dva lifleta preklapaju, isti artikal može biti na oba, i na trebovanju treba da se vide oba.

Danas trebovanje vidi samo liflet koji važi na datum trebovanja, i to samo ako je cena na stavci baš liflet cena. Tako se novi liflet ne vidi dok ne počne.

## Odluke (iz razgovora)

1. **Nova kolona „Akcija“** u PDF-u trebovanja. U njoj za svaki liflet na kome je artikal piše „Liflet“, liflet cena i do kada važi.
2. **Liflet koji još nije počeo** ima i datum početka i uokvirenu oznaku **„USKORO“** (izabrana varijanta B sa skice):
   ```
   Liflet 99,99 [USKORO]
   od 01.11. do 30.11.
   ```
   Liflet koji traje ima samo „do“:
   ```
   Liflet 109,99
   do 31.10.
   ```
3. **Artikal na oba lifleta** ima oba zapisa u koloni, jedan ispod drugog: prvo onaj koji traje, pa onaj koji dolazi.
4. **Stari liflet ističe na svoj datum**, kao do sada. Upis i vraćanje cena se ne menjaju.
5. **Isti liflet sa ispravljenim datumima ne pravi drugi zapis.** Pri uvozu aplikacija pita da li je to isti liflet (vidi „Uvoz“). Zato posebno brisanje lifleta u aplikaciji za sada ne treba. Odluka od 29.10.

## Ne-ciljevi

- Promena cene u bazi pre početka akcije. Akcijske cene i dalje ulaze u bazu ujutru prvog dana.
- Kolona „Akcija“ na popisu.
- Prikaz liflet cena na ekranu cena ili u štampi cenovnika.
- Artikli kojih nema u bazi. Liflet ih ne pamti, pa ih trebovanje ne može prepoznati.
- Dugme za brisanje lifleta u aplikaciji. Zapis koji već postoji, a pogrešan je, korisnik briše u Supabase-u.

## Anti-ciljevi

- Artikal sa novog lifleta se na trebovanju ne vidi kao akcija, pa se ne nabavi dovoljno.
- Liflet koji još nije počeo izgleda isto kao onaj koji traje, pa se pobrkaju cene.
- Radnja bez lifleta dobija praznu kolonu „Akcija“ na svakom trebovanju.
- Staro trebovanje iz arhive pokazuje liflete iz mnogo kasnijih meseci.

## Kako radi

### Koji lifleti se računaju

- Računa se svaki uvezen liflet koji na **datum trebovanja**:
  - važi, ili
  - tek počinje, *(moja odluka)* najviše 14 dana posle datuma trebovanja (radnja uvozi do 7 dana unapred, a 14 ostavlja rezervu).
- Tako staro trebovanje iz arhive pokazuje šta je tada važilo i šta je tada dolazilo, a ne liflete iz kasnijih meseci.
- Isti artikal se prepoznaje po `sameArticleCodes`, kao do sada.
- *(moja odluka)* **Cena na stavci više ne mora da bude liflet cena.** Kolona sama pokazuje liflet cenu, pa se uslov iz 0.11.0 ukida.
- „USKORO“ važi kad liflet počinje posle datuma trebovanja.

### Uvoz: isti liflet sa ispravljenim datumima

- **Kada se pita:** pri potvrdi uvoza aplikacija traži otvoren liflet (cene mu još nisu vraćene) čiji se period preklapa sa novim, a koji ima:
  - isti naziv, ili
  - 80% ili više istih artikala, računato na artikle novog lifleta koji su u bazi, po istom artiklu (`sameArticleCodes`).
- **Pitanje u prozoru za uvoz,** pre upisa:
  ```
  Već postoji liflet „Jutro Liflet Avg“ (25.09.2026. – 31.10.2026.).
  Da li je ovo isti liflet sa ispravljenim datumima?
  [Da, ispravi datume]   [Ne, ovo je novi liflet]
  ```
- **„Da“:**
  - postojeći zapis dobija nove datume, a stavke se upisuju na njega, kao kod ponovnog uvoza (redovne cene ostaju iz prvog uvoza);
  - *(moja odluka)* ako se promeni datum kraja, oznake poslatih podsetnika se brišu, pa podsetnici stižu za novi kraj;
  - *(moja odluka)* ako su akcijske cene već upisane, ostaju upisane;
  - ostalo radi kao do sada, i cene se upisuju odmah ili prvog jutra po novom početku.
- **„Ne“:** nastaje novi zapis, kao do sada. To je normalan slučaj kad se novi liflet uveze dok stari još traje.
- **Ako se nađe više takvih lifleta,** pita se za onaj sa najviše istih artikala.
- *(moja odluka)* Ako već postoji zapis sa istim nazivom i istim novim datumima, koristi se on, kao do sada, bez pitanja.
- Ako ništa nije nađeno, uvoz radi kao do sada, bez pitanja.

### PDF trebovanja

- Kolone su redom: Naziv, Barkod, Cena, **Akcija**, Količina i kvadratić.
- Kolona „Cena“ ostaje kao do sada: cena iz baze kad je stavka dodata.
- **Kolona „Akcija“ se pojavljuje samo kad je bar jedan artikal na trebovanju na nekom lifletu.** Inače PDF izgleda tačno kao danas, bez kolone.
- **Zapis u koloni:**
  - prvi red, boldovano: „Liflet“ i cena (npr. „Liflet 99,99“), a za liflet koji nije počeo i uokvireno „USKORO“;
  - drugi red: „do 31.10.“, odnosno „od 01.11. do 30.11.“, za liflet koji nije počeo.
- *(moja odluka)* **Senčenje reda iz 0.12.2 ostaje** za svaki red koji ima zapis u koloni „Akcija“, jer se tako red vidi pri brzom gledanju niz papir.
- *(moja odluka)* Natpis „LIFLET“ iznad cene se uklanja, jer ga zamenjuje kolona.
- Podebljan naziv ostaje uz senčenje.

### Trebovanje u aplikaciji

- *(moja odluka)* Red stavke dobija isti zapis kao malu oznaku u redu sa detaljem, umesto današnje pločice „Liflet“. Primeri: „Liflet 99,99 do 31.10.“ i „Liflet 89,99 · USKORO od 01.11.“.
- Artikal na oba lifleta dobija dve oznake.

### Podaci

- **Čitanje:** iz `promo_leaflets` i `promo_leaflet_items`, samo za čitanje, kao do sada. Upit vraća liflete čiji period seče [datum trebovanja, datum + 14 dana].
- **Nema izmene baze** ni SQL-a.
- **Bez veze:** ako tabele lifleta ne mogu da se pročitaju, trebovanje i PDF rade kao danas, bez kolone i oznaka.

## Provera

- **Vitest:**
  - koji lifleti se računaju: traje; počinje za 5 dana; počinje za 20 dana (ne računa se); istekao (ne računa se);
  - artikal na oba lifleta, prvo onaj koji traje;
  - „USKORO“ samo za liflet koji nije počeo;
  - kolona postoji samo kad ima zapisa;
  - skraćen barkod (12 i 13 cifara);
  - bez veze nema kolone;
  - PDF ćelija (dva reda, okvir „USKORO“) i širine kolona;
  - uvoz: isti naziv ili 80% istih artikala uz preklapanje daje pitanje; „Da“ menja datume postojećeg i briše oznake podsetnika kad se kraj promeni; „Ne“ pravi novi zapis; bez preklapanja nema pitanja.
- **Probni PDF:** trebovanje sa artiklom na lifletu koji traje, na lifletu koji dolazi, na oba, i bez akcije.
- **U radnji:** trebovanje dok se dva lifleta preklapaju.

## Ostavljeno graditelju

- Tačne širine kolona i izgled okvira „USKORO“ u pdfmake-u, da staje na A4 uspravno.
- Izgled oznaka u aplikaciji, u postojećim tokenima.
