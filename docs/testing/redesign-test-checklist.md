# Redizajn „Pijaca“: spisak za testiranje

Ovo nije provereno na pravom telefonu i papiru, pa ostaje za zajednički test. Štikliraj kako prolaziš. Šta ne radi, zapiši pored stavke.

## 1. Na računaru (dev server, `npm run dev`)

- [ ] Prijava: pogrešna lozinka pokazuje grešku, a ispravna ulazi.
- [ ] Na vrhu početnog ekrana je logo umesto natpisa „brancode“.
- [ ] Meni (☰ gore desno) se otvara odozdo: Cenovnici (označeno), Podešavanja, Odjavi se i email. „Nazad“ zatvara meni, a iz Podešavanja „nazad“ ne vraća meni.
- [ ] Odjava iz menija.
- [ ] Početna:
  - [ ] grupe „Za proveru · nije u bazi“ i „Spremno · N“;
  - [ ] brojevi i množina („1 cenovnik“, „2 traže proveru“);
  - [ ] prazno stanje.
- [ ] Dugi pritisak na red otvara izmenu. Kratak tap ne radi ništa, a skrolovanje liste ne otvara izmenu.
- [ ] X uklanja red, a „Vrati“ ga vraća na isto mesto.
- [ ] „Obriši sve“ pita za potvrdu, a „Zadrži listu“ ne briše ništa.
- [ ] Izmena iz liste:
  - [ ] promena cene;
  - [ ] „Sačuvaj i zatvori“ pokazuje status „Dodato“;
  - [ ] artikal iz „nije u bazi“ posle čuvanja prelazi u „Spremno“ i ulazi u bazu.
- [ ] Ručni unos:
  - [ ] tastatura na ekranu i obične tipke;
  - [ ] „Nastavi“;
  - [ ] poznat artikal: „Cena · bila X“, bez pregleda;
  - [ ] nov artikal: pregled cenovnika;
  - [ ] „Sačuvaj i upiši sledeći“ i „Sačuvaj i zatvori“ (vraća na početnu).
- [ ] Uvoz lifleta sa pravim PDF-om:
  - [ ] status „Čitam liflet… strana X / Y“;
  - [ ] brojke u sheet-u;
  - [ ] „Zameni listu i uvezi“ upisuje akcijske cene u bazu.
- [ ] `/pregled`:
  - [ ] Raf / Frižider / Voće, a izbor se pamti;
  - [ ] listanje strana i „strana X od Y“;
  - [ ] Excel se preuzima i otvara u Excel-u.
- [ ] Sistemsko „nazad“ na svakom ekranu i sheet-u zatvara samo ono što je otvoreno, i nikad ne vraća u kameru.
- [ ] Osvežavanje stranice na `/rucni-unos`, `/pregled` i `/skeniranje` ostaje na tom ekranu.

## 2. Na telefonu (Vercel preview ili produkcija)

### Android
- [ ] Skeniranje pravih barkodova, uključujući artikal koji je u bazi pod 12 cifara (npr. majonez `8600005000122`).
- [ ] Skeniranje u nizu:
  - [ ] „Sačuvaj i skeniraj sledeći“, a kamera nastavlja;
  - [ ] „Preskoči“ dodaje u listu bez promene baze;
  - [ ] „Sačuvaj i završi (N)“ vraća na početnu.
- [ ] Isti barkod koji je i dalje ispred kamere ne otvara se ponovo posle čuvanja ili odustajanja.
- [ ] „Nazad“ dok je sheet preko kamere otvoren znači odustajanje, pa kamera nastavlja.
- [ ] Blic, ako ga telefon ima.
- [ ] Tap na „kamera“ prebacuje sočivo („kamera 2/3“). Proveri koje sočivo najbolje hvata izbliza.
- [ ] Da li se tastatura za cenu otvara sama posle skeniranja.
- [ ] Kamera se gasi kad napustiš ekran ili aplikacija ode u pozadinu (indikator kamere nestaje).
- [ ] Odbijena dozvola za kameru daje status „Nema dozvole za kameru.“ sa „Upiši ručno“.
- [ ] **Poređenje čitača:** meni → Podešavanja → „Čitač barkoda (test)“ → Ugrađeni, pa zxing. Koji brže i pouzdanije hvata? Posle odluke se ovaj izbor uklanja.

### iPhone (ako je dostupan)
- [ ] Skeniranje radi (zxing).
- [ ] Tastatura za cenu traži jedan tap. To je očekivano ograničenje iOS-a.

### Zajedničko
- [ ] Pošalji na `/pregled`: mejl stiže sa ispravnim Excel fajlom.
- [ ] Direktno otvaranje `<preview>/rucni-unos` učitava aplikaciju (nije 404).
- [ ] Dodavanje na početni ekran: ikonica je novi logo, bez belog kruga (Android).
- [ ] Bez interneta: aplikacija se otvara, a fontovi i skeniranje rade. Čuvanje i slanje traže vezu.
- [ ] Sheet-ovi se zatvaraju prevlačenjem nadole.

## 2a. Popis (na telefonu)

- [ ] Meni → Popis → „Novi popis“. Podrazumevani period je od 1. u mesecu do danas, a naziv se vidi pre čuvanja.
- [ ] Skeniranje u nizu:
  - artikal iz baze ima zaključan naziv i cenu, pa se upiše količina;
  - „Sačuvaj i skeniraj sledeći“ nastavlja kameru;
  - artikal kog nema u bazi traži naziv i cenu.
- [ ] Isti artikal ponovo pita „Dodaj količinu / Izmeni stavku / Otkaži“. Količina se sabira, i sa decimalama („1,5“).
- [ ] **Dva telefona na istom popisu:** oba skeniraju isti artikal. Drugi dobija pitanje o duplikatu, a zbir je tačan.
- [ ] Dugi pritisak na stavku je otvara za izmenu. X briše stavku, a „Vrati“ je vraća.
- [ ] Olovčica menja tekst i period.
- [ ] Dugi pritisak na popis u spisku nudi brisanje, sa brojem stavki.
- [ ] **PDF:**
  - preuzet PDF ima naziv, period, datum, broj stavki i tabelu;
  - zaglavlje tabele je na svakoj strani;
  - podnožje je „Strana X od Y“;
  - slova č ć š ž đ su ispravna.
- [ ] „Pošalji mejlom“: stiže mejl „Popis – …“ sa PDF-om (samo na Vercel-u).
- [ ] Bez interneta: jasna poruka i „Ponovi“, ništa se ne gubi.

## 2b. Trebovanje (na telefonu)

- [ ] Meni → Trebovanje. Poslednjih 20 dana je na vrhu, a starija su pod „Arhiva“.
- [ ] Novo trebovanje sa datumom danas i tekstom. Naziv je „tekst 18.10.2026“.
- [ ] Ručni unos:
  - „Bez barkoda“ dodaje stavku sa samo nazivom;
  - cena i količina mogu da ostanu prazne;
  - artikal iz baze ima zaključan naziv i cenu.
- [ ] Isti artikal ponovo: „Dodaj količinu“ i na stavci bez količine.
- [ ] **Prenesi stavke:**
  - biranje stavki i „Izaberi sve“;
  - prenos u postojeće i u novo trebovanje;
  - otvara se ciljno trebovanje;
  - drugi prenos istih stavki ne pravi duplikate;
  - „nazad“ izlazi iz biranja.
- [ ] **PDF:** kolone Naziv, Barkod, Cena, Količina i kvadratić za štikliranje desno. Prazne vrednosti su prazne.
- [ ] Naziv skeniranog artikla iz baze može da se promeni, a cena je zaključana.
- [ ] Podešavanja → „Redosled stavki u PDF-u“: „Po nazivu“ i „Redom dodavanja“ menjaju redosled u PDF-u, posebno za Popis i Trebovanje.

## 3. Štampa

- [ ] Odštampaj po jednu stranu za Raf, Frižider i Voće i uporedi sa `/pregled`:
  - [ ] širina cenovnika lenjirom: Raf i Frižider oko 49,5 mm, Voće oko 74 mm;
  - [ ] broj cenovnika po strani i prelomi strana (Raf 18, Frižider 15, Voće 8);
  - [ ] duga cena („12.499,99“) je smanjena i staje, a dug naziv se prelama;
  - [ ] barkod na cenovniku za voće se očitava na kasi.
- [ ] **Novi cenovnici za raf i frižider** (uspravan barkod i manje decimale):
  - [ ] barkod na rafu se očitava **telefonom** (skeniranje u aplikaciji), i za artikal sa 13 cifara i za artikal iz baze sa 12 cifara (štampa se pun EAN-13);
  - [ ] barkod na frižideru se očitava telefonom i ostaje u vidljivom delu kad je cenovnik u držaču;
  - [ ] u Excel-u nema sive linije između cene i barkoda;
  - [ ] decimale u Excel-u su otprilike upola manje i gore, kao u pregledu;
  - [ ] dug naziv se prelama preko cele širine cenovnika;
  - [ ] cena od 5 cifara („12.499,99“) se smanjuje i ne ulazi u barkod.
- [ ] Ako pregled ne odgovara papiru: po odluci 4 iz spec-a pregled se uklanja, a ne podešava odvojeno od Excel-a.

## 4. Posle testa

- Ukloniti privremeni izbor čitača iz Podešavanja (`useScannerReader`, „Čitač barkoda (test)“) i zadržati čitač koji je bolji.
- Proći odložene sitne nalaze iz pregleda (spisak je u završnim porukama faza 2–4), na primer:
  - više barkodova u kadru;
  - „N. u nizu“ broji i odustajanja;
  - dugmad kamere ne reaguju dok je sheet otvoren;
  - pravilo za PWA pogrešno opisuje keširanje zxing-a.
