# Brancode: e-Faktura, ulazne fakture iz SEF-a (dizajn)

Datum: 2026-11-17. Polazi od: `main` na verziji 0.14.0. Verzija posle: 0.15.0. Grana: `e-faktura`.

Izvor za API je zvanična specifikacija, javno dostupna: [public_v1/swagger.json](https://efaktura.mfin.gov.rs/swagger/public_v1/swagger.json). Činjenice iz istraživanja od 17.11.:
- ključ daje pun pristup;
- SEF prima najviše 3 poziva u sekundi, a na više odgovara sa 429;
- SEF ne dozvoljava pozive iz pregledača (nema CORS-a), pa sve ide preko servera;
- postoji demo okruženje (demoefaktura.mfin.gov.rs).

## Zašto

Radnja danas ulazne fakture prihvata na SEF-u jednu po jednu, štampa svaku posebno i papire nosi knjigovođi. To traje, a fakture su ionako već elektronske.

Novi odeljak „e-Faktura“ treba da:
- pokaže na telefonu, na jednom mestu, fakture dobavljača koje čekaju odgovor;
- omogući da se više faktura prihvati odjednom;
- skupi prihvaćene fakture na jednu listu i pošalje ih sve jednim mejlom (danas radnji, a kad aplikacija dobije domen, knjigovođi).

**Uspeh:** brat ujutru otvori e-Fakturu, štiklira današnje fakture i prihvati ih jednom potvrdom. Zatim jednim dugmetom pošalje prihvaćene. SEF ne otvara i ništa ne štampa.

## Odluke (iz razgovora)

1. **Odeljak se zove „e-Faktura“**, bez krovnog „Integracije“, jer je to za sada jedina integracija. Ima svoju stavku u meniju.
2. **Prvi obim** su ulazne fakture: pregled, prihvatanje, odbijanje i slanje prihvaćenih. Stavke faktura, nabavne cene i stanje u poređenju sa popisom **ne ulaze sada**. Na kraju ovog posla korisnika ponovo pitamo da li to hoće.
3. **Jedna uloga:** svaki prijavljeni korisnik sme da prihvata i odbija. Uloge (vlasnik/admin i ostali) dolaze posle ovog posla.
4. **API ključ se čuva bezbedno.** Nijedan korisnik ga ne može pročitati, ni sa telefona ni iz pregledača. Koristi ga samo server.
5. **Knjigovođa ne koristi API ključ**, pa ga aplikacija sme imati i koristiti.
6. **Razvoj ide na probnom SEF-u (mock)**, napravljenom po zvaničnoj specifikaciji. Brat pravi ključ ubacuje kad posao bude gotov.
7. **Više faktura odjednom:** štiklirane fakture prihvataju se jednom potvrdom. Prihvaćene idu na zajedničku listu, odakle se šalju sve zajedno.
8. **Mejl umesto nošenja papira.** Kad je ključ proveren, pojavljuje se polje „Fakture šalji na“ sa mejlom radnje. **Za sada je polje zasivljeno** i sve ide na postojeći mejl radnje (`EMAIL_TO`). Kad aplikacija dobije sopstveni domen, polje se otključava za mejl knjigovođe. Resend sa probne adrese isporučuje samo vlasniku naloga.
9. **Tekst mejla** je kulturan i opšti: u prilogu su prihvaćene fakture prodavnice [naziv] (PIB …).
10. **Spremno za više radnji:** ključ, naziv i PIB čuvaju se tako da kasnije svaka radnja ima svoje. Sam rad sa više radnji nije deo ovog posla.
11. **Lista ima tri taba koji rade kao filteri:** Na čekanju, Prihvaćene i Sve (dopuna od 19.11.).
12. **Trajna istorija.** Svaka faktura koju je neko prihvatio, odbio ili poslao kroz aplikaciju zapisuje se u tabelu, da se i posle mnogo vremena može proveriti ko je šta uradio i kada. Zapis se ne menja i ne briše (dopuna od 19.11.).
13. **Datum valute (rok plaćanja) se čuva** u istoriji uz svaku fakturu. Kasnije bi mogao da posluži za dnevno upozorenje na prihvaćene, a neplaćene fakture kojima valuta ističe za 48 sati. To upozorenje nije deo ovog posla (dopuna od 19.11.).

## Moje odluke (korisnik ih proverava pri čitanju)

- **A. Svaka faktura je poseban PDF u prilogu**, nazvan po dobavljaču i broju, a ne jedan spojen PDF. Krajnji primalac je knjigovođa, koji svaku fakturu knjiži posebno. Do domena radnja taj jedan mejl prosledi knjigovođi.
- **B. Naziv radnje i PIB unose se uz ključ.** SEF nema poziv koji kaže čiji je ključ. To je privremeno. Kasnije se tačan naziv radnje traži pri registraciji radnje, pa e-Faktura uzima taj naziv, a uz ključ se unosi samo PIB (dopuna od 19.11.).
- **C. Lista se svaki put čita sa SEF-a**, a ne iz kopije u našoj bazi. Ne pravimo sinhronizaciju svih faktura. U bazu ide samo istorija (odluka 12): svaka faktura koju je aplikacija prihvatila, odbila ili poslala, sa svojim podacima iz tog trenutka, uključujući datum valute.
- **D. „Nije poslato“ obuhvata i fakture prihvaćene direktno na SEF-u ili automatski posle roka**, da knjigovođi ništa ne promakne. Izuzetak su fakture koje su već bile prihvaćene u trenutku povezivanja: one su već odštampane i odnete. Taj spisak se uzima jednom, pri povezivanju (odluka I).
- **E. Prozor je 60 dana:** aplikacija pokazuje fakture koje su stigle u poslednjih 60 dana.
- **F. Probni režim je podrazumevan** dok se na Vercel-u izričito ne uključi pravi SEF (`SEF_ENV=production`). Tako nijedan deploy ne može slučajno da prihvati pravu fakturu.
- **G. Odbijanje je pojedinačno** i uvek uz razlog. Masovno odbijanje nema smisla.
- **H. Podešavanja se čuvaju posebno za svaki režim** (probni, demo, pravi). Proba na preview deploy-u, koji koristi istu bazu, zato ne može da prepiše ili obriše pravi ključ, naziv, PIB ni dan povezivanja. Isto važi za zapamćene radnje (odluka F).
- **I. Pri povezivanju se jednom uzme spisak faktura koje su u tom trenutku prihvaćene** u prozoru od 60 dana, i zapamti uz podešavanja tog režima. Te se fakture pojavljuju kao „Pre povezivanja“. Svaka druga prihvaćena faktura bez zapisa o slanju je „Nije poslato“, bez obzira kad je i gde prihvaćena. SEF u listi ne daje datum prihvatanja, pa ovo pravilo ne traži dodatne pozive. Spisak i dan povezivanja ostaju isti kad se ključ zameni.
- **J. Prihvatanje i odbijanje na pravom SEF-u ima poseban prekidač** `SEF_ACCEPT=on` na Vercel-u. Pravi SEF se uključuje u dva koraka: prvo `SEF_ENV=production` (lista, PDF, slanje), pa tek posle provere na pravim podacima `SEF_ACCEPT=on`. Dok prekidač nije uključen, dugmad Prihvati i Odbij su zaključana, uz napomenu „Prihvatanje još nije uključeno“, a server odbija te akcije. Prekidač važi i za `demo`; probni režim ga ne treba.
- **K. „Ponovo poslata“ nema brojanje dana.** Datum podsetnika se ne vidi u listi SEF-a, pa piše istaknuto „Podsetnik stigao · odgovori odmah“.

## Ne-ciljevi

- Stavke faktura, nabavne cene, marža, stanje i poređenje sa popisom (pitanje na kraju, odluka 2).
- Izlazne fakture, PDV evidencija, fiskalni računi, e-otpremnice, CIR i javne nabavke.
- Obaveštenja koja SEF sam šalje (pretplata, webhook), push obaveštenja i jutarnji mejl o novim fakturama.
- Uloge i ograničenje ko sme da prihvata.
- Upozorenje da ističe valuta za plaćanje, i oznaka „plaćeno“. SEF ne zna da li je ulazna faktura plaćena, pa bi radnja to morala da označava u aplikaciji. Ovaj posao samo čuva datum valute (odluka 13).
- Prikaz istorije u aplikaciji, osim u detalju fakture. Istorija se čuva u tabeli za proveru kad zatreba.
- Slanje na adresu koju korisnik upiše (čeka domen) i sopstveni domen za mejl.
- Više radnji: registracija radnje i odvajanje podataka po radnji.
- Štampa iz aplikacije i spajanje PDF-ova u jedan.

## Anti-ciljevi

- SEF ključ procuri: vidi se u pregledaču, u odgovoru servera, u logu ili u bazi bez šifre.
- Prihvati se faktura koju korisnik nije potvrdio: pogrešno štiklirana, dupli dodir, ili probni režim koji zove pravi SEF.
- Aplikacija pokaže da je nešto prihvaćeno ili poslato, a SEF ili mejl nisu uspeli.
- Prihvaćena faktura nikad ne stigne do primaoca, a niko to ne vidi.
- Deset faktura opet traži deset odvojenih radnji.

## Kako radi

### Podešavanja e-Fakture

Ekran `/e-faktura/podesavanja`. Do njega se dolazi iz Podešavanja (nova grupa „e-Faktura“ sa stanjem i dugmetom „Podesi“) i sa praznog ekrana e-Fakture („Poveži e-Fakturu“).

Polja:
- **Naziv radnje** (obavezno). Ovde je samo dok ne postoji registracija radnje, odluka B.
- **PIB** (tačno 9 cifara). Ostaje ovde i posle registracije.
- **API ključ sa SEF-a**: polje za lozinku, prima nalepljen tekst. Ispod je kratko uputstvo: SEF → Podešavanja → API menadžment → Generiši ključ, pa status „Aktivan“.

Dugme **„Proveri i sačuvaj“**: server isproba ključ na SEF-u i sačuva ga šifrovanog samo ako ga SEF prihvati. Ako ga SEF odbije, poruka je „SEF ne prihvata ovaj ključ. Proveri da li je status ključa Aktivan.“ Ako SEF ne odgovori, poruka je „SEF trenutno ne odgovara. Pokušaj ponovo.“ U oba slučaja ništa se ne čuva.

Posle čuvanja:
- Ključ se više nigde ne prikazuje. Piše samo „Ključ sačuvan · završava se na …1234“, uz dugmad **Zameni ključ** i **Ukloni ključ** (sa potvrdom).
- Naziv i PIB mogu da se menjaju i bez novog ključa.
- Pojavljuje se polje **„Fakture šalji na“**, zasivljeno, sa mejlom radnje. Ispod piše: „Slanje na drugu adresu, npr. knjigovođi, biće moguće uskoro.“
- U probnom režimu na vrhu je traka: „Probni režim: izmišljene fakture, SEF se ne poziva.“

### Lista faktura (`/e-faktura`)

Zaglavlje „e-Faktura“ i tri taba koji rade kao filteri: **Na čekanju**, **Prihvaćene** i **Sve**. Prva dva pokazuju broj faktura (odluka 11).

**„Na čekanju“** prikazuje fakture sa statusom Nova, Viđena i Ponovo poslata.
- Fakture su grupisane po danu prijema: Danas, Juče, pa datumi.
- Svaki red ima: štiklir, dobavljača (podebljano), broj fakture, iznos sa PDV-om (`12.345,67 din`), rok plaćanja i rok za odgovor („još 12 dana“).
- Rok za odgovor je 15 dana od prijema. Pravilo je iz stručnih izvora i proverava se na pravim fakturama. Kad ostane 3 dana ili manje, rok je istaknut. Ako rok prođe, piše „Rok prošao“. „Ponovo poslata“ ima oznaku iz odluke K.
- Zaglavlje svakog dana ima „Izaberi sve“.
- Kad je nešto štiklirano, dole se pojavi traka „Prihvati (N) · ukupno X din“.
- Dodir na red otvara detalj fakture.

**„Prihvaćene“** prikazuje prihvaćene fakture iz poslednjih 60 dana.
- Na vrhu je grupa **„Nije poslato“**: svaka prihvaćena faktura koja nije poslata i nije na spisku iz trenutka povezivanja (odluka I). Svejedno je da li je prihvaćena kroz aplikaciju, na SEF-u ili automatski. Kad se tab otvori, sve su štiklirane.
- Ispod je grupa **„Poslato“**, sa oznakom „Poslato 17.11. na radnja@…“, i grupa **„Pre povezivanja“**. I te fakture mogu da se štikliraju i pošalju ponovo.
- Fakture koje je dobavljač posle stornirao ili otkazao ne nude se za slanje.
- Na dnu je dugme „Pošalji (N)“.

**„Sve“** prikazuje sve fakture iz poslednjih 60 dana, u svim statusima: na čekanju, prihvaćene, odbijene, stornirane i otkazane.
- Grupe su po danu prijema, i svaki red ima oznaku statusa.
- Nema štiklira. Prihvata se, odbija i otvara PDF iz detalja fakture.

**Osvežavanje** je pri otvaranju i na zahtev. Graditelj bira da li povlačenjem nadole ili dugmetom u zaglavlju. Ako SEF ne odgovori, ostaje poslednja učitana lista, uz poruku.

### Detalj fakture (sheet)

- Dobavljač i njegov PIB, broj fakture, datum prijema i rok plaćanja.
- Iznos bez PDV-a, PDV i ukupno, i status.
- **„Otvori PDF“** otvara PDF koji SEF daje za fakturu, preuzet preko našeg servera.
- Faktura na čekanju ima dugmad **Prihvati** i **Odbij**.
- Prihvaćena faktura pokazuje kad je i kome poslata.
- Ako je faktura prihvaćena ili odbijena kroz aplikaciju, piše i ko je to uradio i kada („Prihvatio: …, 17.11. u 08:42“). Ako nije, piše „Prihvaćena na SEF-u“.

### Prihvatanje

1. Korisnik štiklira fakture i dodirne „Prihvati (N)“.
2. Otvara se prozor za potvrdu (`useDialog`): „Prihvatiti N faktura? Ukupno X din. Prihvatanje odmah ide u SEF.“ Dugmad su **Prihvati** i **Odustani**.
3. Server prihvata fakture jednu po jednu, najviše 3 poziva SEF-u u sekundi; 10 faktura traje oko 4 s. Za to vreme na ekranu piše „Prihvatam…“, a dugmad su zaključana.
   - Faktura se računa kao prihvaćena tek kad SEF to potvrdi: `success: true` u odgovoru. Ako odgovor nije jasan (greška, istek vremena, neočekivan oblik), server pročita status te fakture (`GET purchase-invoice`) i tek po njemu javlja ishod.
   - Ako ni tada nije jasno, faktura se javlja kao „Nije potvrđeno, osveži listu“, nikad kao prihvaćena.
4. Rezultat se javlja za svaku fakturu posebno:
   - Uspešne nestaju iz „Na čekanju“ i pojavljuju se u „Prihvaćene → Nije poslato“.
   - Neuspele ostaju štiklirane, uz razlog. Ako je faktura na SEF-u već prihvaćena ili odbijena, to nije greška: lista se samo osveži.
   - Poruka je „Prihvaćeno 10 faktura“, ili „Prihvaćeno 8 od 10, 2 nisu: …“.
5. Svako prihvatanje se upisuje u istoriju (odluka 12): koja faktura, ko i kada, uz podatke fakture iz tog trenutka.

### Odbijanje

Odbija se iz detalja fakture. Otvara se prozor sa obaveznim razlogom (najviše 500 znakova), koji ide SEF-u kao komentar, i dugmetom **Odbij**. Pamti se isto kao prihvatanje.

### Slanje

1. Dodir na „Pošalji (N)“ otvara potvrdu: „Poslati N faktura na radnja@…?“
2. Telefon šalje samo spisak faktura. Server za svaku preuzima PDF sa SEF-a (najviše 3 u sekundi) i šalje **jedan mejl** sa svim PDF-ovima. Tako veličina priloga ne zavisi od interneta u radnji ni od ograničenja zahteva na Vercel-u.
3. Mejl:
   - naslov: `Prihvaćene fakture – {naziv radnje} – {dd.mm.yyyy.}`;
   - tekst: „Poštovani,“, prazan red, pa „u prilogu su prihvaćene ulazne fakture prodavnice {naziv} (PIB {pib}), ukupno N.“, zatim spisak u obliku „dobavljač – broj – iznos“ i „Srdačan pozdrav“;
   - prilozi: `{dobavljač} – {broj fakture}.pdf`, bez znakova koji ne smeju u ime fajla; dva ista imena se razlikuju dodatkom;
   - ako prilozi pređu ograničenje Resend-a (40 MB po mejlu), fakture se dele u više mejlova sa „(1/2)“ u naslovu; nijedna faktura ne sme da ispadne potajno.
4. Fakture se zapisuju kao poslate (kada, kome, ko) tek kad Resend prihvati mejl. Ako ne uspe, ništa se ne zapisuje, a poruka kaže da nije poslato.
5. Poruka posle slanja: „Poslato N faktura na radnja@…“.

### Probni režim (mock)

- `SEF_ENV` na Vercel-u ima tri vrednosti:
  - `mock`: podrazumevano, važi i kad promenljiva nije postavljena;
  - `demo`: demoefaktura.mfin.gov.rs;
  - `production`: efaktura.mfin.gov.rs.
- Probni SEF daje izmišljene fakture po zvaničnoj šemi (`PurchaseInvoiceOverviewDto`, statusi iz `PurchaseInvoiceStatus`). Fakture se računaju od današnjeg datuma, pa svaki dan izgledaju sveže:
  - 6 do 10 dobavljača;
  - fakture stigle danas, juče i pre 3, 10, 14 i 18 dana, da se vidi i rok koji ističe;
  - jedna „Ponovo poslata“, nekoliko već prihvaćenih i jedna odbijena.
- Prihvatanje, odbijanje i slanje rade kao u pravom režimu. Status menjaju preko zapamćenih radnji, pa promene prežive između poziva servera.
- PDF je jednostavan izmišljen PDF sa podacima fakture.
- Slanje u probnom režimu zaista šalje mejl na adresu radnje, sa „[PROBA]“ u naslovu, da bi se proverio ceo tok.
- Dugme „Vrati probne fakture“ briše probne zapise.
- Probni režim nikad ne zove SEF, ni kad je ključ sačuvan.
- Ključ može da se sačuva i u probnom režimu. Probni SEF prihvata svaki ključ osim teksta `neispravan`, da bi se proverila i poruka o grešci.
- Zapamćene radnje nose oznaku režima. Lista i „Poslato“ u jednom režimu ne vide zapise iz drugog.

### Server

- Jedna funkcija `api/efaktura.js`, sa poljem `action` u telu zahteva, da se funkcije ne množe.
  - Akcije su `status`, `save-settings`, `remove-key`, `list`, `pdf`, `accept`, `reject`, `send` i `reset-mock`.
  - Logika je u modulima u `src/lib/`, testirana kao `promoCheck.js`. Sama funkcija je tanka.
- **Prijava** radi kao kod `send-email`: korisnikov Supabase token u `Authorization: Bearer …`, proveren sa `auth.getUser`. Bez važećeg tokena server ne vraća nikakav podatak o fakturama.
- **Ključ:**
  - šifruje se sa AES-256-GCM šifrom iz `EFAKTURA_SECRET` (32 bajta, base64), postavljenom na Vercel-u;
  - pri svakom čuvanju dobija nov nasumičan IV;
  - u bazi su samo šifrat, IV, tag i poslednja 4 znaka;
  - dešifruje se samo u memoriji, u trenutku poziva SEF-a;
  - nikad se ne vraća klijentu i nikad se ne loguje, ni u porukama o greškama;
  - bez `EFAKTURA_SECRET` u režimu `production` ili `demo` sve akcije vraćaju `not-configured`.
- **Pozivi SEF-a:**
  - adresa zavisi samo od `SEF_ENV`, nikad od onoga što klijent pošalje;
  - ključ ide u zaglavlju `ApiKey`;
  - unutar jednog zahteva između poziva je najmanje 340 ms;
  - na odgovor 429 server sačeka 1 s i ponovi jednom;
  - odgovor 401 ili 403 znači da je ključ odbijen, i aplikacija predlaže proveru u podešavanjima;
  - odgovori SEF-a se čitaju oprezno: polje koje nedostaje ili ima neočekivan oblik nikad ne postaje „uspeh“. Specifikacija ne kaže sve (na koji datum se odnose `dateFrom`/`dateTo`, da li `amount` uključuje PDV, šta vraća neispravan ključ), pa se to proverava na pravim podacima u prvom koraku (odluka J).
- **`SEF_ACCEPT`** (odluka J): bez vrednosti `on` u režimima `demo` i `production`, akcije `accept` i `reject` vraćaju `accept-disabled`, a `status` to javlja klijentu, koji zaključava dugmad.
- **Ograničenja:**
  - prihvatanje i slanje primaju najviše 50 faktura po pozivu; veći izbor klijent šalje u delovima;
  - `maxDuration` za funkciju je 60 s;
  - ID faktura su pozitivni celi brojevi;
  - razlog odbijanja ima najviše 500 znakova.
- Greške se vraćaju kao `{ ok: false, error: "<kebab-case>" }`, kao u postojećim funkcijama.

### Podaci

Nova migracija `supabase/migrations/<datum>_efaktura.sql` pravi dve tabele.

**`efaktura_settings`** ima jedan red po radnji i režimu; danas su to najviše tri reda: probni, demo i pravi (odluka H). Polja:
- režim;
- šifrovan ključ (šifrat, IV, tag) i njegova poslednja 4 znaka;
- naziv radnje i PIB;
- `send_to`: danas uvek prazno, što znači mejl radnje;
- dan povezivanja i spisak SEF id-jeva faktura prihvaćenih u tom trenutku (odluka I);
- ko je i kad poslednji menjao.

**`efaktura_events`** je istorija (odluka 12). Ima jedan red za svaku radnju nad fakturom. Polja:
- SEF id fakture;
- radnja: `accepted`, `rejected` ili `sent`;
- komentar (razlog odbijanja) i primalac (za slanje);
- korisnik (id i mejl) i vreme;
- režim;
- podaci fakture iz tog trenutka: dobavljač i njegov PIB, broj fakture, datum prijema, datum valute (`dueDate`), iznos bez PDV-a, PDV i ukupno, valuta i status na SEF-u.

Redovi se samo dodaju. Okidač u bazi odbija `update` i `delete`, osim brisanja probnih redova („Vrati probne fakture“). Tako ni greška u aplikaciji ne može da izmeni istoriju.

**Pristup:**
- Na obe tabele je uključen RLS, bez ijedne politike za klijente.
- `anon` i `authenticated` nemaju nikakva prava nad njima. Čita ih i piše samo server, preko service-role ključa.
- Ništa od ovoga ne dira `products`, liste ni liflete.

### Lokalni razvoj

`npm run dev` danas ne služi `api/`. Odeljak e-Faktura **mora da radi u `npm run dev` u probnom režimu bez ijedne tajne**, da bi mogao da se proveri u pregledaču. Način bira graditelj. Jedna mogućnost je dev middleware u Vite-u koji poziva handler, sa skladištem u memoriji i bez stvarnog slanja mejla kad nema service-role ili Resend ključa.

## Bezbednost (provera pre spajanja)

- U `dist/` nema `EFAKTURA_SECRET`, SEF ključa ni service-role ključa.
- Nijedan odgovor nijedne akcije ne sadrži ključ.
- Prijavljen korisnik preko Supabase klijenta ne može da pročita `efaktura_settings` ni `efaktura_events`: upit sa publishable ključem vraća prazno ili grešku.
- Bez tokena, ili sa lošim tokenom, svaka akcija vraća 401.
- Probni režim ne zove nijednu SEF adresu (test sa lažnim `fetch`-om).

## Provera

**Vitest:**
- Šifrovanje: ključ se vraća isti; izmenjen šifrat ili tag daje grešku; IV je drugačiji pri svakom čuvanju.
- SEF klijent sa lažnim `fetch`-om: zaglavlje `ApiKey`, adresa po `SEF_ENV`, razmak između poziva, ponavljanje posle 429, 401 kao odbijen ključ.
- Probni SEF: fakture u odnosu na današnji datum, promena statusa posle prihvatanja i odbijanja, ključ „neispravan“.
- Pravilo „Nije poslato“, kroz slučajeve:
  - prihvaćeno kroz aplikaciju;
  - na čekanju pri povezivanju, pa prihvaćeno na SEF-u ili automatski;
  - već prihvaćeno pri povezivanju („Pre povezivanja“);
  - poslato;
  - poslato pa ponovo izabrano;
  - stornirano.
- Podešavanja po režimu: čuvanje i brisanje u probnom režimu ne dira red pravog režima. Zamena ključa ne menja dan povezivanja ni spisak.
- `SEF_ACCEPT`: bez njega `accept` i `reject` vraćaju `accept-disabled` u `demo` i `production`, a u probnom režimu rade.
- Prihvatanje: `success: false`, nejasan odgovor sa statusom Approved posle čitanja, nejasan odgovor koji ni posle čitanja nije jasan.
- Rok za odgovor: 15 dana, isticanje na 3 dana, „Rok prošao“, oznaka za „Ponovo poslatu“.
- Mejl: naslov, tekst sa nazivom i PIB-om, imena priloga (i ista imena), podela preko ograničenja, „[PROBA]“.
- Zapis o slanju nastaje samo posle uspeha Resend-a.
- Istorija: zapis o prihvatanju ima datum valute i ostale podatke fakture. Okidač odbija izmenu i brisanje pravog reda, a brisanje probnog reda pušta (SQL u migraciji; proverava se na Supabase-u pri izlasku).
- Tabovi: „Na čekanju“, „Prihvaćene“ i „Sve“ filtriraju istu listu. „Sve“ pokazuje i odbijene i stornirane, bez štiklira.
- Handler: metod, token, akcije, provera ID-ova i razloga, `not-configured`, ključ nikad u odgovoru.
- Komponente: štikliranje i „Izaberi sve“, traka sa zbirom, potvrda, delimičan uspeh.

**Pregledač (probni režim):** ceo tok na širini telefona: povezivanje, prihvatanje 10 faktura, odbijanje jedne, slanje, pa ponovno slanje.

**Posle izlaska, sa pravim ključem:** prvo samo lista, PDF-ovi i slanje, sa zaključanim prihvatanjem (odluka J). Proverava se da lista odgovara onome što pokazuje SEF: koje fakture, iznosi, datumi. Tek onda se uključuje `SEF_ACCEPT=on`. Prvo pravo prihvatanje treba da bude faktura koju bi brat i inače prihvatio.

## Šta korisnik radi (ide u `docs/repovi.md`)

1. Na Vercel-u postaviti `EFAKTURA_SECRET` za Production i Preview. Komanda za generisanje biće u izveštaju.
2. Kad probni tok prođe, postaviti `SEF_ENV=production`, a brat u aplikaciji unese pravi ključ, naziv i PIB.
3. Uporediti listu u aplikaciji sa SEF-om: fakture, iznosi, datumi, rok od 15 dana.
4. Ako se lista slaže, postaviti `SEF_ACCEPT=on`.
5. Na kraju posla: pitanje o stavkama, nabavnim cenama i stanju (odluka 2).

## Ostavljeno graditelju

- Tačan izgled redova, tabova, trake za izbor i detalja, u postojećim tokenima i sa postojećim delovima (`AppHeader`, `BottomSheet`, `useDialog`, `useToast`).
- Ikona u meniju.
- Kako se PDF otvara na telefonu (nov tab ili preuzimanje), u skladu sa `lib/download.js`.
- Kako probni SEF pravi PDF.
- Oblik ključa reda u `efaktura_settings`, da se kasnije veže za tabelu radnji.
- Kako `npm run dev` služi funkciju.
- Tačna podela mejla kad prilozi pređu ograničenje.
