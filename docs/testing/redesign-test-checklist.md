# Redizajn „Pijaca“: spisak za testiranje

Ovo nije provereno na pravom telefonu i papiru, pa ostaje za zajednički test. Štikliraj kako prolaziš. Šta ne radi, zapiši pored stavke.

## 1. Na računaru (dev server, `npm run dev`)

- [ ] Prijava: pogrešna lozinka pokazuje grešku, a ispravna ulazi.
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

## 3. Štampa

- [ ] Odštampaj po jednu stranu za Raf, Frižider i Voće i uporedi sa `/pregled`:
  - [ ] širina cenovnika lenjirom: Raf i Frižider oko 49,5 mm, Voće oko 74 mm;
  - [ ] broj cenovnika po strani i prelomi strana (Raf 18, Frižider 15, Voće 8);
  - [ ] duga cena („12.499,99“) je smanjena i staje, a dug naziv se prelama;
  - [ ] barkod na cenovniku za voće se očitava na kasi.
- [ ] Ako pregled ne odgovara papiru: po odluci 4 iz spec-a pregled se uklanja, a ne podešava odvojeno od Excel-a.

## 4. Posle testa

- Ukloniti privremeni izbor čitača iz Podešavanja (`useScannerReader`, „Čitač barkoda (test)“) i zadržati čitač koji je bolji.
- Proći odložene sitne nalaze iz pregleda (spisak je u završnim porukama faza 2–4), na primer:
  - više barkodova u kadru;
  - „N. u nizu“ broji i odustajanja;
  - dugmad kamere ne reaguju dok je sheet otvoren;
  - pravilo za PWA pogrešno opisuje keširanje zxing-a.
