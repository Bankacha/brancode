# Brancode: Mix štampa (dizajn)

Datum: 2026-10-27. Polazi od: `main` na verziji 0.11.0. Verzija posle: 0.12.0.

## Zašto

Posle uvoza lifleta lista za štampu je mešovita: deo artikala ide na raf, a deo u frižider. Danas se cela lista štampa u jednom formatu, pa frižiderski artikli dobiju cenovnik za raf, ili obrnuto.

Radnja inače skenira raf i frižider u odvojenim etapama, pa je mešovita lista uglavnom posledica lifleta. Liflet stiže jednom mesečno i u frižideru su iz meseca u mesec uglavnom isti artikli (mleko, jogurti, sirevi). Zato aplikacija pamti format svakog artikla: sledeći liflet se raspoređuje sam, a bira se samo za nove artikle.

## Odluke (iz razgovora)

1. **Nova opcija u pregledu štampe.** Izbor formata je Raf | Friz | Voće | Mix, sa ikonicama.
   - „Frižider“ se na tom izboru zove „Friz“, a „Kombinovano“ je „Mix“, da sve četiri stanu sa ikonicama.
2. **Mix ima samo dva formata:** raf i friz. Voće ne učestvuje.
3. **Izgled je varijanta B1 sa skice:**
   - lista je istim redom kao na početnom ekranu;
   - u svakom redu je prekidač „Raf | Friz“, samo tekst: tamno je raf, plavo friz;
   - gore stoje brojevi „Raf N“ i „Friz N“;
   - artikli bez zapamćenog formata imaju oznaku „NOVO“.
4. **Izvoz pravi poseban Excel za svaki format:** jedan za raf i jedan za friz. Formati se ne mešaju na istom listu, a svaki fajl ima postojeći, isproban raspored.
5. **Format se pamti u bazi, po artiklu, samo kad se štampa iz Mix-a.**
   - Štampa cele liste kao Raf ili Friz ne menja zapamćeno, za sada. Ako radnji bude odgovaralo drugačije, menja se kasnije.
6. **Pri otvaranju Mix-a** artikli sa zapamćenim formatom su već postavljeni. Ostali počinju od raf, jer je takvih najviše, i imaju oznaku „NOVO“.

## Ne-ciljevi

- Različiti formati na istom A4 listu.
- Voće u Mix-u.
- Pamćenje formata iz štampe u jednom formatu (Raf, Friz ili Voće).
- Format na popisu i trebovanju.
- Promena izgleda samih cenovnika.

## Anti-ciljevi (neuspeh i kad tehnički radi)

- Artikal završi u pogrešnom fajlu, ili ga nema ni u jednom.
- Izvoz iz Mix-a promeni cenu ili naziv u bazi, ili zapamćeni format artikla koji nije bio na listi.
- U Mix izvozu se izgube kopije (×3) ili red „Akcija važi do“.
- Uvoz lifleta, izmena cene ili premeštanje reda sa 12 na 13 cifara obriše zapamćeni format.
- Lista od 100 i više artikala postane spora ili teška za tapkanje.
- Izbor na pola liste nestane kad se izađe iz pregleda, na primer da se proveri nešto na početnom ekranu.

## Kako radi

### Ekran

- **Izbor formata:** Raf (`LayoutGrid`), Friz (`Refrigerator`), Voće (`Apple`), Mix (`ArrowRightLeft`).
  - Izabran format se pamti na telefonu, kao do sada (`print-format`), sada sa vrednošću `"mix"`.
  - Natpis „N kom“ gore ostaje.
- **Kad je izabran Mix,** umesto A4 stranica stoji lista iz odluke 3.
  - Brojevi „Raf N“ i „Friz N“ broje odštampane cenovnike, znači sa kopijama, kao „kom“.
  - Red pokazuje naziv, barkod i cenu. Oznaka „×3“ ne mora da stoji u redu.
  - *(moja odluka)* U Mix-u nema A4 pregleda. Ko hoće da vidi stranice, izabere Raf ili Friz.
- **Tap na „Raf“ ili „Friz“** odmah menja izbor i brojeve.
- **Izbor se čuva uz stavku liste na telefonu,** kao kopije: novo polje `mixFormat: "shelf" | "fridge"`. Tako ostaje kad se izađe iz pregleda i vrati, i kad se aplikacija zatvori.
  - Ponovno skeniranje ili izmena istog artikla zadržava `mixFormat`, kao `copies` i `promo`.
  - Uvoz lifleta pravi novu listu bez `mixFormat`.
- **Oznaka „NOVO“** stoji na stavci koja nema ni svoj izbor (`mixFormat`) ni format zapamćen u bazi. Nestaje čim se izabere Raf ili Friz.

### Prozor za cenu dok je izabran Mix

- `print-format` čitaju i početni ekran, skeniranje i ručni unos, za pregled cenovnika u prozoru za cenu. Format `"mix"` tamo nema svoj izgled.
- *(moja odluka)* Dok je izabran Mix, prozor za cenu pokazuje cenovnik u formatu koji stavka već ima (`mixFormat`). Ako ga nema, pokazuje raf. Format se ne bira u tom prozoru i skeniranje ne čita bazu zbog formata.

### Zapamćeni formati

- **U bazi:** nova kolona `products.tag_format`:
  - tip `text`, `check (tag_format in ('shelf', 'fridge'))`;
  - `null` znači da format nije zapamćen.
  - Kolonu pravi SQL koji korisnik pokreće u Supabase-u, kao do sada.
- **Čitanje:** pri otvaranju Mix-a, za stavke bez svog izbora.
  - Barkodovi se traže kao kod cena (`barcodeCandidates`: tačan kod, pa kod bez ispravne kontrolne cifre).
  - Upiti idu u delovima po 100 barkodova.
  - Stavka dobija zapamćeni format kao početni izbor, pa nije „NOVO“.
- **Prednost:** izbor na telefonu (`mixFormat`) je jači od zapamćenog u bazi.
- **Bez veze:** lista radi sa izborom sa telefona, a ostalo je raf. Stoji mala poruka „Zapamćeni formati nisu učitani.“, a izvoz radi.
- **Upis:** posle uspešnog izvoza iz Mix-a (poslat mejl ili preuzeti fajlovi).
  - Za svaku stavku koja je u bazi upisuje se samo kolona `tag_format`, na red koji je pronađen pri čitanju.
  - Cena i naziv se ne diraju.
  - Stavke kojih nema u bazi (`notInDb`) pamte izbor samo na telefonu.
- **Upis ne sme da obori izvoz.** Ako ne uspe, izvoz je ipak gotov i stoji poruka „Format nije zapamćen za sledeći put.“
- **Ostali tokovi ne diraju kolonu:**
  - čuvanje cene (`saveProduct`) i uvoz lifleta (`setProductPrices`) šalju samo `barcode`, `name` i `price`;
  - premeštanje reda sa 12 na 13 cifara je `update` istog reda.
  - Test to pokazuje za oba toka.

### Izvoz iz Mix-a

- **Raspodela:** stavke se dele po izboru u dve grupe, a svaka se pravi postojećim izvozom za svoj format (`buildWorkbook(queue, "shelf" | "fridge")`). Kopije i red akcije rade kao do sada.
  - Prazna grupa ne pravi fajl.
  - Ako je sve u jednom formatu, izvoz je jedan fajl.
- **Imena fajlova** su postojeća: `cenovnik-raf-dd.mm.yyyy.xlsx` i `cenovnik-frizider-dd.mm.yyyy.xlsx`.
- **„Pošalji“:** *(moja odluka)* jedan mejl sa oba fajla u prilogu.
  - `api/send-email.js` prima i listu priloga (`files: [{ filename, base64 }]`), a stari oblik sa jednim fajlom ostaje.
  - Granica veličine važi za zbir priloga, kao i do sada za jedan fajl. Prekoračenje daje postojeći odgovor 413, a aplikacija nudi preuzimanje.
  - Naslov mejla je „Cenovnici – raf i friz“ kad su dva fajla. Kad je jedan, naslov je kao i do sada.
  - Tekst mejla, kao i do sada, kaže da se prilozi otvaraju u Excel-u.
- **„Excel“:** preuzima fajlove jedan za drugim. Browser može jednom da pita dozvolu za više preuzimanja, pa to ide i u spisak za testiranje.
  - *(moja odluka)* Aplikacija ne može da sazna da li je browser blokirao drugo preuzimanje. Zato posle preuzimanja ostaje poruka sa dugmetom „Preuzmi friz“ (ili „Preuzmi raf“, za drugi fajl), da se drugi fajl može uzeti još jednim tapom.
- **Posle uspeha** sledi upis formata (gore) i postojeće poruke („Poslato na mejl radnje“, i za preuzimanje).

## Provera

- **Vitest:**
  - raspodela stavki po izboru, sa kopijama i promo;
  - prazna grupa ne pravi fajl;
  - jedan format daje jedan fajl;
  - početni izbor: lokalni pa zapamćeni pa raf, i oznaka „NOVO“;
  - čitanje zapamćenih formata preko `barcodeCandidates`;
  - upis samo kolone `tag_format`, samo za stavke iz baze;
  - neuspeh upisa ne obara izvoz;
  - endpoint sa listom priloga i granicom za zbir;
  - `saveProduct` i uvoz lifleta ne šalju `tag_format`;
  - izbor ostaje posle ponovnog skeniranja;
  - novi izbor formata „Mix“ se pamti;
  - brojevi „Raf N“ i „Friz N“ sa kopijama.
- **Browser:** pregled sa Mix listom, prekidači i brojevi, oba fajla (preuzimanje).
- **Kasnije, u radnji:**
  - mejl sa dva priloga;
  - drugi liflet: frižiderski artikli su već raspoređeni.

## Ostavljeno graditelju

- Tačni razmaci i boje prekidača prema postojećim tokenima (plava za friz kao na skici, iz palete ili nova tokenizovana boja).
- Kako se upit za formate deli sa postojećim čitanjem artikala.
- Tekst poruka u dogovorenom smislu.
