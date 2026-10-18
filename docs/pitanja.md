# Pitanja i odluke

Odluke koje sam doneo sam dok smo radili meni, cene, popis i trebovanje, i tvoji odgovori na njih.

## Odgovori (18.10.) i šta je urađeno na grani `fixes`

- **Vercel:** ✅ rešeno.
  - Uzrok: build je prolazio, ali je Vercel tražio izlaz u folderu `build` (podrazumevani za React Router), a Vite pravi `dist`.
  - `vercel.json` sada kaže `framework: vite` i `outputDirectory: dist`. Preview na `fixes` je prošao.
- **Cene:**
  - Barkod na cenovniku čitaju telefoni (aplikacija), ne kasa, pa je čitljivost na kasi nebitna.
  - ✅ Linija između cene i barkoda u Excel-u je bila Excel-ova siva mreža na ekranu (ne štampa se). Sada je isključena u izvozu.
  - Kodovi, cifre i ostalo ostaju ovako do testa u radnji.
- **Popis i trebovanje:** ✅ Podešavanja → „Redosled stavki u PDF-u“, posebno za Popis i Trebovanje. Izbor je „Po nazivu“ (podrazumevano, po srpskoj abecedi: c č ć, d dž đ, l lj) ili „Redom dodavanja“ (prvo dodato prvo). Pamti se na telefonu.
- **Trebovanje:** ✅ naziv artikla iz baze može da se menja. Cena ostaje zaključana.
- **UI:** ✅ logo umesto natpisa „brancode“ na vrhu početnog ekrana.
- **Podešavanja:** ✅ dva odeljka sa naslovima, „Izvoz u PDF“ i „Skeniranje“, a na dnu verzija aplikacije.
- **Verzija:** ✅ trenutno **0.9.0**.
  - Uz svaki deploy (merge na `main`) se podiže: popravke 0.9.1, nove funkcije 0.10.0.
  - 1.0.0 je dan kad radnja počne da se oslanja na aplikaciju.
  - Pravilo je zapisano u `CLAUDE.md`.
- **Prijava:** ✅ pozdrav prati doba dana na telefonu: „Dobro jutro.“ od 5 do 11, „Dobar dan.“ od 11 do 18 i „Dobro veče.“ od 18 pa kroz noć do 5.
- Sve ostalo ispod ostaje kako je urađeno.

## 0.9.1

- **Ikonica PWA** je posle ažuriranja i dalje stara. Produkcija služi novu ikonicu, pa je razlog na telefonu:
  - Android/Chrome menja ikonicu instalirane aplikacije tek kad sam proveri manifest, najviše jednom dnevno, pri otvaranju aplikacije, i tada ponekad pita da li se slaže;
  - iPhone ikonicu nikad ne menja sam.
  - Odmah: ukloniti aplikaciju sa početnog ekrana i ponovo je dodati iz browser-a. Podaci (prijava, lista) ostaju.
- **Naziv sekcije:** ✅ „Cene“ umesto „Cenovnici“.
  - Brojač kaže „76 cena“ („1 cena“, „3 cene“), a brisanje „Obrisati sve 3 cene?“.
  - „Cenovnik“ je ostao tamo gde se misli na sam papirni cenovnik: pregled „Ovako izgleda cenovnik na rafu“, ime Excel fajla i naslov mejla.

## Meni (hamburger)

1. **Meni se otvara odozdo** (sheet), da bude pod palcem, a dugme ☰ je gore desno, gde je bilo „…“. Može i obrnuto (dugme dole ili meni koji izlazi sa strane), ako ti je tako prirodnije.
2. **Dugme za liflet ostaje u zaglavlju Cenovnika**, pored menija, jer pripada samo cenovnicima. Da li ga radije premestiti u meni?
3. **Email prijavljenog korisnika** stoji sitno ispod „Odjavi se“. Da li treba više gore ili uopšte?
4. **Podešavanja** za sada imaju samo privremeni izbor čitača. Kad izaberemo čitač, ostaju prazna. Predlog: tada sakriti stavku dok ne dobije nešto novo.
5. **„Nazad“ posle prelaska u drugu sekciju** vraća na prethodnu sekciju (npr. iz Popisa na Cenovnike), a ne zatvara aplikaciju.

## Cene (barkod na rafu i frižideru)

1. **Barkod je u svojoj uskoj koloni** (oko 9 mm) desno od cene, a naziv ide preko cele širine. Cena se sada centrira i smanjuje u preostalih 40 mm. Ukupna širina, visina i broj po strani su isti. Da li je širina barkoda dobra ili treba uža/šira?
2. **Čitljivost na kasi je glavni rizik.** Kod sebe sam proverio da se svi barkodovi očitavaju u štampanoj veličini i na 300 i na 200 dpi. To je savršeno poravnata slika, a pravi skener na kasi je druga priča.
   - **Kakav skener je na kasi?** Laserski „pištolj“ (crvena linija) mora da prođe celom dužinom barkoda, a visina linija je samo oko 6,5 mm, pa ga treba držati prilično pravo. Kamera (2D) je mnogo manje osetljiva.
   - Odštampaj stranu Raf i stranu Frižider i probaj na kasi, i iskosa.
   - Ako frižider ne prolazi, opcije su: barkod vodoravno ispod cene, viši red cene ili bez barkoda na frižideru.
3. **Kodovi sa 12 cifara** (iz baze, bez kontrolne cifre) štampaju se kao pun EAN-13 sa izračunatom 13. cifrom, kao na ambalaži. Ako neki takav kod nije pravi EAN, kasa ga neće prepoznati. Javi ako vidiš takav artikal.
4. **Decimale:** u Excel-u su „superscript“ na 0,75 veličine cene, pa ih Excel crta otprilike upola manje. Tačnu veličinu na papiru nisam mogao da vidim. Ako su premale ili prevelike, to je jedan broj (`DECIMALS_SUPERSCRIPT_SCALE`).
5. **Sitne cifre uz barkod** su uvek tu, ali zauzimaju najviše petinu debljine, da linije ostanu što više. Okrenute su da se čitaju odozdo nagore. Ako na kasi bolje prolazi bez cifara, uklanjanje je jedan broj.
7. **Vrlo dugi kodovi** (npr. ručno ukucano 20 cifara) dobijaju CODE128 sa jako tankim linijama, koje verovatno neće moći da se pročitaju. Ostavio sam tako. Ako to smeta, na takvim cenovnicima ide samo broj, bez barkoda.
6. **Probnu stranu nisam pravio** (spec je predlagao da se prvo štampa probna strana sa više veličina). Prava strana za Raf i Frižider sada služi kao proba.

## Popis

1. **Brisanje celog popisa** je dugim pritiskom na popis u spisku, uz potvrdu sa brojem stavki. Da li je to dovoljno vidljivo, ili da dodam i dugme u samoj listi?
2. **Izgled stavke:** levo naziv, ispod barkod i cena, a desno krupno količina. Bez jedinice mere (kom/kg), jer je baza nema.
3. **Redosled stavki:** najnovija je na vrhu, da se odmah vidi šta je upravo dodato. PDF ima isti redosled. Da li bi u PDF-u bolje bilo po nazivu?
4. **Sheet za stavku:** „nazad“ iz „Dodaj količinu“ zatvara ceo sheet umesto da se vrati na pitanje „Dodaj / Izmeni“.
5. **„Dodaj količinu“ traži broj veći od 0.** Količina stavke može biti 0, ali dodavanje nule nema smisla.
6. **PDF:**
   - naslov je „Popis · tekst“, a period i datum izrade su u redovima ispod;
   - kolone su #, Naziv, Barkod, Cena, Količina;
   - ime fajla je `popis-2026-10-01_2026-10-18.pdf`.
7. **Meni na ekranu jednog popisa** se ne vidi (tu su „nazad“ i olovčica). Meni je na spisku popisa.
8. **Probni podaci:** napravio sam popis „Proba (Claude)“ u tvojoj bazi, sa dve stavke, proverio sve i **obrisao ga**. Tabele popisa su ponovo prazne. U `products` nisam ništa pisao.
9. **PWA:** PDF biblioteka (oko 1,9 MB) se čuva za rad bez interneta, pa je prva instalacija aplikacije nešto veća.

## Trebovanje

1. **Artikal iz baze** ima zaključan naziv i cenu, kao na popisu, i pri dodavanju i pri izmeni. Trebovanje u bazi ne pamti da li je artikal iz baze, pa se pri izmeni barkod ponovo proverava. Spec je rekao „isto kao Popis“. Da li na trebovanju treba da mogu da se menjaju?
2. **„Bez barkoda“** je dugme na ekranu za ručni unos, ispod „Nastavi“. Stavka tada ima samo naziv, a cenu i količinu po želji.
3. **Prenos stavki bez barkoda:** spec spominje samo barkod. Ako cilj već ima stavku bez barkoda **sa istim nazivom** (bez obzira na velika i mala slova), ne pravi se druga, nego se dodaje količina. Probao sam: bez toga je drugi prenos dupliran „Hleb za sendviče“.
4. **Postojeća stavka bez količine na cilju** se pri prenosu preskače, ako ni prenesena nema količinu. Poruka kaže „N već postoji“.
5. **Ako veza pukne na pola prenosa:**
   - poruka kaže koliko je preneseno (npr. „Preneseno 1 od 2“) i otvara se ciljno trebovanje, da se vidi šta je stiglo;
   - ostale stavke se prenose ponovo, ručno;
   - „Ponovi“ se nudi samo kad ništa nije preneseno, da se količine ne bi dodale dvaput;
   - ako je ciljno trebovanje u međuvremenu obrisano, to se jasno kaže.
6. **Biranje stavki je korak u istoriji:** „nazad“ izlazi iz biranja. „Nazad“ iz liste ciljeva izlazi iz celog prenosa, a ne nazad na biranje.
7. **Spisak trebovanja** je poređan po datumu trebovanja (najnovije gore), a ne po vremenu kad je napravljeno.
8. **Arhiva:** sve sa datumom starijim od 20 dana. Trebovanje od pre tačno 20 dana je još gore.
9. **PDF trebovanja** nema kolonu „#“ (redni broj), jer je spec za trebovanje naveo kolone bez nje. Popis je ima.
10. **Probni podaci:** napravio sam i obrisao tri trebovanja „Proba (Claude)…“. Tabele trebovanja su prazne.
