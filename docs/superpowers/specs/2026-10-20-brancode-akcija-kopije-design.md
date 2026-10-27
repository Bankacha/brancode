# Brancode: popravke iz radnje, broj kopija i akcija iz lifleta (dizajn)

Datum: 2026-10-20. Polazi od: `main` na verziji 0.9.2. Prethodni spec: [`2026-10-18-brancode-popis-trebovanje-design.md`](2026-10-18-brancode-popis-trebovanje-design.md).

## Zašto

Prvo testiranje u radnji je otkrilo tri greške i dve potrebe.

**Akcije iz lifleta.** Akcijski cenovnik se fizički stavi preko starog, a kad akcija istekne, baci se i ostaje stari. Uvoz lifleta upisuje akcijske cene u bazu artikala, što radnja želi da zadrži dok akcija traje. Problem je što posle akcije u bazi ostaju akcijske cene, jer niko nije pamtio redovne. Uz to se na cenovniku nije videlo do kada akcija važi, i niko nije podsećao da akcija ističe.

**Ista cena na više mesta.** Artikal ponekad stoji na dva mesta u radnji, pa treba isti cenovnik dvaput. Isti barkod ne može dvaput na listu (drugo skeniranje samo osveži prvi red), pa danas nema načina.

## Odluke (iz razgovora)

1. **Liflet i dalje upisuje akcijske cene u bazu** postojećih artikala, kao do sada (odluka radnje, 21.10.).
   - Pri tom **pamti period akcije i redovnu cenu** svakog artikla koju je pregazio.
   - **Posle isteka akcije aplikacija sama vraća redovne cene** u bazu.
   - Artikli kojih nema u bazi se i dalje ne upisuju, nego idu na listu kao „nije u bazi“.
2. **Period akcije** se čita iz liflet PDF-a. Pravi primer je u `docs/examples/` (samo lokalno, ne ide u repo). Na prvoj strani je jedan red teksta „Jutro Liflet Avg od 25.09.2026 do 31.10.2026“, i to je jedini datum u PDF-u.
3. **Na cenovniku** za artikal iz lifleta piše sitno **„Akcija važi do 31.10.2026.“**, između naziva i cifre (izabrana opcija B na skici). Ostalo na cenovniku je isto, uključujući barkod i njegove sitne cifre.
4. **Mejl podsetnik** ide na isti mejl na koji idu cene, i to samo dva puta po lifletu:
   - dan pre isteka: „ističe sutra“;
   - na dan isteka: „ističe danas“.
   Liflet stiže jednom mesečno.
5. **Broj kopija:**
   - u prozoru za izmenu cene je diskretna ikonica kopiranja;
   - tap otvara mali prozor „Broj kopija“ sa −, broj, + i „U redu“;
   - pri štampi se cenovnik ponavlja toliko puta.
6. **Popravke idu prve, kao 0.9.3**, pre novih funkcija. Prvo kopije (0.10.0), pa liflet (0.11.0). Svaki deo ima svoju granu, pregled koda i jedan squash commit na `main`.
7. **Na trebovanju se jasno vidi liflet cena** (dodato 22.10.):
   - stavka čija je cena akcijska cena iz lifleta dobija oznaku „Liflet“;
   - bez nove kolone, jer neke radnje koje budu koristile aplikaciju možda neće imati lifleta;
   - oznaka stoji u ćeliji cene, sitno i boldovano u gornjem uglu.

## Ne-ciljevi

- Cene koje su raniji uvozi (pre 0.11.0) upisali u bazu ne vraćaju se automatski, jer njihove redovne cene niko nije zapamtio. Ispravljaju se skeniranjem, kao do sada.
- Liflet PDF se ne čuva i ne šalje nikuda. I dalje se čita samo u browser-u.
- Nema više mejl primalaca ni podešavanja vremena slanja.
- Nema kopija na popisu ni na trebovanju, samo za cenovnike.

## Anti-ciljevi (neuspeh i kad tehnički radi)

- Posle isteka akcije u bazi ostane akcijska cena.
- Vraćanje pregazi cenu koju je neko u međuvremenu ručno promenio.
- Vraćanje vrati cenu artiklu koji je već na novom lifletu, ili kao „redovnu“ upamti akcijsku cenu iz prethodnog lifleta.
- Akcijski cenovnik se odštampa bez datuma, ili sa pogrešnim datumom.
- Isti podsetnik stigne dvaput, ili stigne za liflet koji je zamenjen novijim uvozom.
- Sitni red akcije pomeri raspored: drugačiji broj cenovnika po strani, drugi prelomi strana, ili cifra cene preko teksta ili barkoda.
- Na frižideru se red akcije sakrije iza držača.

---

## Popravke (0.9.3)

### 1. Barkod se ne vidi kad se cene pošalju mejlom

Provereno: fajl koji ide mejlom je bajt po bajt isti kao preuzeti, sa slikama barkoda. Razlog je program kojim se prilog otvori: pregledi priloga u mejlu ne prikazuju slike preko ćelija, a Excel ih prikazuje.

- U tekst mejla za cene (`api/send-email.js`, kad nema `subject`) dodati rečenicu u smislu: „Otvorite prilog u Excel-u (pregled u mejlu ne prikazuje barkodove).“
- U spisak za testiranje dodati: cene iz mejla otvarati u Excel-u.

### 2. Ikonica za izvoz

Na popisu i trebovanju (`components/ListBottomBar.jsx`) dugme za izvoz ima ikonicu štampača (`Printer`), kao na cenama. Natpis za čitač ekrana ostaje „Izvoz“.

### 3. Barkodovi bilo koje dužine

**Uzrok** (provereno u bazi, 24.695 artikala): kasa pri izvozu odseca poslednju, kontrolnu cifru, i to ne samo kod EAN-13.

| Dužina koda u bazi | Broj artikala |
|---|---|
| 7 cifara | 810 |
| 8 cifara | 249 |
| 11 cifara | 45 |
| 12 cifara | 13.348 |
| 13 cifara | 9.981 |
| 14 cifara | 13 |

Na primer, KINDER BUENO je u bazi `8005276`, a na pakovanju piše EAN-8 `80052760`. Danas se kontrolna cifra skida samo kod 13 cifara.

**Pravilo za sve dužine:**
- Prvo se traži tačan kod.
- Zatim, ako je kod numerički, ima 8, 12, 13 ili 14 cifara i poslednja cifra je ispravna GTIN kontrolna cifra (ista formula 3-1 za sve dužine), traži se isti kod bez poslednje cifre.
- Skenirani kodovi uvek imaju ispravnu kontrolnu cifru. Ukucani kod sa greškom u kucanju se ne „popravlja“.

**Gde važi:**
- `barcodeCandidates` u `lib/products.js`: cene, pretraga i čuvanje, i uparivanje lifleta.
- „Isti artikal“ na popisu i trebovanju (`sameArticleCodes` u `lib/ean.js`), u oba smera:
  - 8 → 7, 12 → 11, 13 → 12, 14 → 13;
  - i obrnuto, ukucan skraćeni kod sa dodatom kontrolnom cifrom, kao što je danas 12 → 13.
- `lookupArticle` za liste.
- Čuvanje sa cena (`saveProduct`) već premešta skraćeni red na pun kod. To treba da radi za svaku dužinu, kao danas za 12 → 13.
- **Barkod na cenovniku:** kod od 7 cifara iz baze se štampa kao EAN-8 sa dodatom kontrolnom cifrom, isto kao što se 12 cifara štampa kao EAN-13. Telefon pri skeniranju pročita 8 cifara i nađe artikal po pravilu iznad.

---

## Broj kopija (0.10.0)

**Gde:**
- u `EditSheet`, za sva tri izvora (posle skeniranja, ručnog unosa i dugog pritiska na red);
- mala ikonica kopiranja (lucide `Copy`), siva, uz polje za cenu ili u gornjem redu sa barkodom. Diskretna je, jer se retko koristi.
- Tap otvara mali prozor „Broj kopija“ sa −, broj, + i „U redu“.
- Kad je podešeno više od jedne, uz ikonicu piše npr. „×3“.

**Moje odluke** (prihvaćene u razgovoru):
- broj ide od 1 do 20, a podrazumevano je 1;
- ponovno skeniranje istog artikla osveži cenu, a broj kopija ostaje;
- „×3“ se vidi i u redu liste na početnom ekranu, pored cene;
- brojač na početnom ekranu („76 cena“) i „kom“ u pregledu štampe broje odštampane cenovnike, znači sa kopijama. Naslovi grupa („Spremno · N“) broje redove.

**Štampa:**
- Excel, pregled štampe i mejl ponavljaju cenovnik jedan za drugim, onoliko puta koliko je kopija;
- prelomi strana se računaju posle ponavljanja, tako da A4 raspored ostaje isti (Raf 18, Frižider 15, Voće 8 po strani).

**Podaci:** stavka liste za štampu dobija `copies` (izostavljeno = 1). Lista ostaje samo na telefonu.

---

## Akcija iz lifleta (0.11.0)

### Uvoz

- **Akcijska cena ide u bazu.** Postojećim artiklima se upisuje akcijska cena, kao do sada.
  - Uz to se pamti **redovna cena** svakog takvog artikla, i to cena iz baze pre uvoza.
  - Ako je artikal već na nekom aktivnom lifletu čije cene još nisu vraćene, pamti se redovna cena zapamćena tamo, a ne trenutna akcijska.
- Artikli kojih nema u bazi se ne upisuju, kao do sada. Idu na listu kao „nije u bazi“ i nemaju šta da se vraća.
- Prozor za potvrdu uvoza (`LeafletImportSheet`):
  - Statistika: „u bazi, akcijska cena do 31.10.“ / „nisu u bazi, samo u listu“, uz napomenu da se redovne cene posle isteka vraćaju same.
  - Pokazuje **period akcije** pročitan iz PDF-a, u dva polja za datum (`DateField`) koja mogu da se isprave.
  - Ako period nije pronađen, polja su prazna i obavezna. „Uvezi“ ne radi bez oba datuma i bez `do ≥ od`.
- **Čitanje perioda:**
  - u tekstu PDF-a (prva strana) traži se „od d.m.yyyy do d.m.yyyy“;
  - naziv lifleta je tekst ispred „od“ na tom redu („Jutro Liflet Avg“), a ako ga nema, ime fajla;
  - test koristi tekst iz pravog primera.
- *(moja odluka)* **Kada se cene upisuju:**
  - ako je liflet uvezen na dan početka akcije ili posle, upisuju se odmah, kao do sada;
  - ako je uvezen ranije, upisuje ih jutarnja provera na dan početka, i prozor za potvrdu to kaže;
  - lista za štampu je odmah spremna.
- **Novi uvoz lifleta sa istim nazivom i periodom** zamenjuje prethodni zapis. Redovne cene ostaju one iz prvog uvoza, a podsetnik ne stiže dvaput.

### Lista za štampu

- Svaka stavka iz lifleta nosi `promo: { dateFrom, dateTo }` (ISO datumi) pored akcijske cene. Postojeći `notInDb` ostaje.
- Red liste na početnom ekranu pokazuje malu oznaku **„akcija do 31.10.“**.
- Izmena i skeniranje rade kao i do sada, jer je u bazi akcijska cena.
  - *(moja odluka)* Ponovno skeniranje ili izmena istog artikla **zadržava `promo` i broj kopija** na listi, da cenovnik ne izgubi „Akcija važi do“.
- Izvoz i mejl rade kao do sada. Novi uvoz lifleta i dalje zamenjuje listu, uz potvrdu.
- *(moja odluka)* Lista uvezena pre 0.11.0 nema datume. Posle nadogradnje liflet se uvozi ponovo, a u spisku za testiranje to piše.

### Cenovnik

- Za stavke sa `promo`, na rafu, frižideru i voću, sitan red **„Akcija važi do dd.mm.yyyy.“**:
  - centriran, između naziva i cifre cene;
  - na rafu i frižideru u koloni cene, levo od kolone barkoda;
  - visina na papiru oko 2 mm.
- **Raspored se ne menja:** ista ukupna visina cenovnika, isti broj po strani, isti prelomi. Cifra cene i red akcije se ne preklapaju. Ako je potrebno, cena se smanjuje kao i do sada (shrink to fit).
  - *(moja odluka)* Dozvoljen je i tanak poseban red za akciju u Excel-u, ako je ukupna visina ista (npr. red cene niži za toliko). Excel ne može da spoji prelom teksta i „shrink to fit“ u istoj ćeliji.
- **Frižider:** red akcije mora biti u delu ćelije koji držač ne pokriva.
- **Pregled štampe** (`PriceTag.jsx`) crta isti red iz iste geometrije (pravilo „jedan izvor za papir i ekran“).
- Kako se red pravi u Excel-u (tanak red, slika iscrtana na canvasu kao barkod, ili drugo) bira graditelj, uz ograničenja iznad.
  - *(moja odluka)* Ne čeka se probna štampa pre puštanja. Štampa u radnji je deo testa 0.11.0, a eventualno doterivanje ide kao 0.11.x.

**Izmena 28.10. (0.12.2), odluka radnje:** na rafu i frižideru datum više nije red preko vrha ćelije cene. Stoji u praznom prostoru ispod decimala („,99“), centrirano, u dva reda:

```
Akcija važi do
  31.10.2026.
```

- Na frižideru je red iznad cene u pregledu delovao kao da gura cenu pod držač. Novo mesto ne dira ni naziv ni cifru.
- Mesto se računa iz širine cene u fontu Oswald, kao i smanjivanje duge cene. Datum ne sme da pređe ni na cele cifre (levo) ni na kolonu barkoda (desno). Kad je cena duga i decimale su uske, tekst se smanjuje ili prelama u tri reda („Akcija / važi do / datum“).
- Visina se računa iz istog modela kao pregled (Excel na Windows-u, `winAscent`). Ako cifra na papiru stoji više nego što model kaže, datum je niže u odnosu na nju, pa se ne preklapa sa decimalama.
- Voće (cena bez izdignutih decimala) zadržava red na vrhu ćelije cene, jer tamo ima mesta.
- Pre oslanjanja na ovo potrebna je probna štampa: raf i frižider, kratka i duga cena.

### Pamćenje lifleta, vraćanje cena i podsetnik

**Pamćenje:**
- Svaki potvrđen uvoz upisuje u Supabase liflet: naziv, period, kada je uvezen.
- Za svaki artikal iz baze pamti barkod, naziv, akcijsku cenu i zapamćenu redovnu cenu.
- Upisuje i stanje: cene upisane / vraćene, i koji podsetnici su poslati.
- Tabele su `promo_leaflets` i `promo_leaflet_items`, iz [`supabase/migrations/20261022_promo_leaflets.sql`](../../../supabase/migrations/20261022_promo_leaflets.sql). Korisnik ih pokreće u Supabase konzoli, kao za popis i trebovanje. RLS: prijavljeni korisnici. Server pristupa preko svog ključa.
  - Isti liflet (naziv i period) je jedan red (`unique`).
  - Stavka čuva barkod reda u `products` kome je upisana akcijska cena, i ishod vraćanja (`restored` / `changed` / `newer_leaflet`).

**Jutarnja provera:** Vercel Cron jednom dnevno, rano ujutru po beogradskom vremenu (oko 7h), poziva novu serverless funkciju u `api/`. „Danas“ i „sutra“ se računaju po beogradskom vremenu. Svaki korak se pamti u bazi, pa ponovni poziv ništa ne radi dvaput. Redom:
1. **Upis akcijskih cena** za liflete čija akcija počinje danas, a cene još nisu upisane (uvezeni unapred).
2. **Vraćanje redovnih cena** za liflete čija je akcija istekla (kraj je bio juče ili ranije), a cene još nisu vraćene.
   - Za svaki artikal: redovna cena se vraća **samo ako je u bazi i dalje akcijska cena iz tog lifleta**. Ako je neko u međuvremenu ručno promenio cenu, ta promena ostaje.
   - Artikal koji je u međuvremenu na drugom, aktivnom lifletu se preskače, a njegova redovna cena prelazi na taj liflet.
3. **Podsetnici:**
   - liflet čiji je kraj sutra: „Akcija ističe sutra“;
   - liflet čiji je kraj danas: „Akcija ističe danas“, uz rečenicu da se redovne cene u bazi vraćaju same sutra ujutru;
   - šalje preko Resend-a na `EMAIL_TO`.
4. *(moja odluka)* **Posle vraćanja cena** stiže mejl samo ako neki artikal nije vraćen (cena ručno menjana). U njemu je spisak tih artikala. Ako je sve vraćeno, nema dodatnog mejla.

**Sadržaj mejla podsetnika:**
- naslov npr. „Akcija ističe sutra: Jutro Liflet Avg (31.10.2026.)“;
- u telu period i spisak artikala (naziv, barkod), da se zna koje cenovnike treba skinuti.

**Bezbednost:**
- funkciju sme da pokrene samo Vercel Cron (`CRON_SECRET`);
- pristup bazi sa servera ide preko ključa koji postoji samo na serveru (service role);
- korisnik dodaje promenljive u Vercel, a graditelj daje tačne korake;
- ništa tajno ne ide u klijent.

### Trebovanje: oznaka „Liflet“

- *(moja odluka)* **Kada se oznaka vidi:** obe tačke moraju da važe.
  - Artikal je na lifletu čiji period obuhvata **datum trebovanja**. Isti artikal se prepoznaje po `sameArticleCodes`, kao duplikati. Zato i staro trebovanje iz arhive pokazuje šta je tada bilo na akciji.
  - Cena stavke je jednaka akcijskoj ceni iz tog lifleta. Stavka dodata pre nego što je akcijska cena upisana nosi redovnu cenu i ne dobija oznaku, jer oznaka kaže „ova cena je liflet cena“.
  - Stavka bez barkoda ili bez cene nema oznaku.
- **Na ekranu trebovanja:** uz cenu u redu stavke mala istaknuta oznaka „Liflet“ (bold, u boji akcenta, kao mala pločica).
- **U PDF-u:** kolone ostaju iste. U ćeliji cene, iznad iznosa, stoji sitno boldovano „LIFLET“ poravnato desno, pa izgleda kao natpis u gornjem uglu ćelije. Radnja bez lifleta ne vidi nikakvu promenu.
- *(moja odluka)* **Popis nema oznaku.** Zahtev je bio samo za trebovanje.
- Trebovanje oznaku samo čita iz tabela lifleta. Liste i dalje ne pišu ni u `products` ni u tabele lifleta.
- Ako tabele lifleta ne mogu da se pročitaju, trebovanje i PDF rade normalno, samo bez oznake.

---

## Provera

- **Vitest:**
  - pravilo barkodova za sve dužine (uključujući primere iz baze);
  - čitanje perioda iz teksta pravog lifleta;
  - šta uvoz upiše u bazu i šta zapamti (redovne cene, i kad je artikal već na drugom lifletu);
  - jutarnja provera: upis na dan početka, vraćanje posle isteka (i preskakanje ručno promenjenih i onih na novom lifletu), podsetnici sutra / danas, ništa dvaput;
  - kopije u rasporedu strana i u Excel-u;
  - red akcije u Excel-u i pregledu, bez promene broja po strani;
  - zaštita funkcije podsetnika;
  - oznaka „Liflet“ na trebovanju: datum trebovanja u periodu i van njega, cena jednaka i različita od akcijske, skraćen barkod, ćelija cene u PDF-u.
- **Browser:** pregled štampe sa akcijom i kopijama, prozor za kopije, prozor za uvoz sa periodom, trebovanje sa oznakom „Liflet“.
- **Kasnije, u radnji:**
  - štampa akcijskih cenovnika, posebno frižider i držač;
  - prvi pravi podsetnik mejlom i prvo automatsko vraćanje redovnih cena;
  - čitanje 8-cifrenih barkodova (Kinder Bueno, Orbit).

## Ostavljeno graditelju

- Tehnika crtanja reda akcije u Excel-u, uz ograničenja iznad.
- Tačan izgled i mesto ikonice kopija i prozora za broj, u stilu postojećih sheet-ova.
- Tačno vreme cron-a u UTC-u.
- Tekst mejlova u dogovorenom smislu.
