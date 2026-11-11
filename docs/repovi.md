# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 11.11.2026, posle 0.14.0 (frižider cena kao slika, naziv sa trebovanja u bazu). Ostale su sitnice iz pregleda 0.12.2 i 0.13.0 i ono što čeka tebe ili proveru u radnji.

## Sitnice iz pregleda 0.12.2 (za sledeće sređivanje)

1. Ako bi kutija za datum ikad bila široka 0 mm, canvas vraća prazan PNG umesto „nema slike“. Danas to nije moguće, jer je kutija uvek bar onolika kolike su decimale. Popravka je jedna provera.
2. Kvadratić u PDF-u trebovanja izlazi 1 pt preko unutrašnje margine ćelije. Na papiru se ne vidi, a tako je bilo i ranije.

## Sitnice iz pregleda 0.13.0 (za sledeće sređivanje)

1. „Da, ispravi datume“ menja samo datume, a naziv lifleta ostaje stari. Kad je liflet prepoznat po artiklima, a ne po nazivu (npr. ranije uvezen pod imenom fajla), zapis i mejlovi podsetnici zadržavaju stari naziv. Popravka: upisati i novi naziv, uz proveru da isti naziv sa tim datumima već ne postoji.
2. Posle „Da“, kad su akcijske cene već upisane, a početak je pomeren na kasniji dan, poruka kaže „Akcijske cene od dd.mm.“, iako su cene već u bazi i tamo ostaju.
3. Dve oznake lifleta sa istim tekstom u istom redu trebovanja (dupli zapis u bazi) daju React upozorenje o istom ključu. Prikaz je ispravan. Ključ treba da bude `leafletId`.
4. `promoCheck.js` i dalje izvozi `addDays`, a niko ga odatle ne uvozi (sada je u `listFormat.js`).
5. Uvoz lifleta tri puta čita otvorene liflete iz baze. Pri ovoj veličini tabele to se ne oseća.

## Sitnice iz pregleda 0.14.0 (za sledeće sređivanje)

1. Naziv sa trebovanja ide u red baze koji je pretraga našla. Za jedan od oko 170 parova gde u bazi postoje i 12-cifreni i 13-cifreni kod istog artikla, otkucan 12-cifreni kod nađe stari red, pa skeniranje pakovanja (13 cifara) i dalje pokaže stari naziv. Ista nedoslednost postoji i za cene; parovi se ne spajaju automatski (vidi pravila za barkodove).
2. Svaka različita frižider cena je u Excel-u slika od oko 20 KB (ista cena se upisuje jednom). Mejl prima do oko 4 MB, pa jedan mejl staje oko 150 različitih frižider cena (u Mix-u zajedno sa raf barkodovima). Preko toga aplikacija kaže da je fajl prevelik i nudi preuzimanje. Ako to postane čest slučaj: manja rezolucija slike ili slika samo oko cifara.

## Treba tvoja odluka, podešavanje ili provera u radnji

- **Lifletske cene se nisu vratile posle isteka akcije** (prijavljeno 10.11.): još nije istraženo. Treba prijava u aplikaciju u pregledaču u Claude-u, da se pročita `promo_leaflets` (`prices_restored_at`, `restore_result` po artiklu), i odgovor: da li su stizali mejlovi „Akcija ističe sutra/danas“ i „Redovne cene vraćene“, koji liflet i koji artikal. Mogući uzroci: liflet uvezen pre 0.11.0 ili ponovo uvezen posle njega dok su u bazi već bile akcijske cene (tada „redovna“ cena jeste akcijska), ili jutarnja provera ne radi (sledeća tačka).
- **Prvo jutro jutarnje provere:** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY` su dodati u Vercel. Ostaje da se vidi da je provera radila: Vercel → projekat → **Logs** (putanja `/api/promo-check`, oko 6 h) bez greške, ili Settings → Cron Jobs → **Run**. Ako piše da nema ključa za bazu, ključ nije dobro unet.
- **Dupli zapisi lifleta u bazi:** pogledaj u Supabase (Table Editor → `promo_leaflets`) da li već postoji zapis sa pogrešnim datumima i obriši ga. Od 0.13.0 uvoz sam pita da li je liflet isti sa ispravljenim datumima, pa novi duplikati ne nastaju. Dugme za brisanje za sada ne treba (odluka od 29.10.).
- **Probna štampa** za raf („99,99“, „1.249,99“, „12.499,99“) i frižider („99,99“, „12.499,99“), svaki sa akcijom. „12.499,99“ daje najsitniji datum:
  - datum ispod decimala ne dodiruje cifre i čita se;
  - uspravni barkod se vidi u držaču i telefon ga skenira;
  - **frižider od 0.14.0:** cena je slika, kao barkod (u 0.13.1 ju je Excel kod brata podigao 6 mm i linija joj je odsekla vrh). Na papiru stoji oko 2,5 mm ispod linije, cela, kao u pregledu, i u držaču se vidi cela.
- **Naziv sa trebovanja u bazu** (od 0.14.0): na trebovanju promeni naziv artikla iz baze, štikliraj „Sačuvaj ovaj naziv i u bazi artikala“, pa skeniraj cenu tog artikla: treba da pokaže novi naziv, a cena da ostane ista.
- **Trebovanje dok se dva lifleta preklapaju** (od 0.13.0): prvi put kad se novi liflet uveze dok stari traje, pogledaj trebovanje u aplikaciji i u PDF-u (oznake, „USKORO“, kolona „Akcija“).
- **Čitač barkoda:** ugrađeni ili zxing. Posle odluke se iz Podešavanja uklanja probni izbor „Čitač barkoda (test)“.
- **Popis i trebovanje:** ako dva telefona u istoj sekundi dodaju isti artikal, jedan pod 12, a drugi pod 13 cifara, mogu nastati dva reda. Retko je, a rešenje traži izmenu baze.
- **Posebno okruženje za probu** pre 1.0.0, da produkcija ne bude mesto za testiranje.

## Ostaje ovako (namerno)

- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.

## Ideje za kasnije (nije dogovoreno)

- **Izbor kolona u PDF-u popisa i trebovanja** (ideja od 31.10.): u Podešavanjima, pored „Redosled u PDF-u“, za popis i trebovanje posebno štiklira koje kolone ulaze u PDF. Podrazumevano kao sada; Naziv i Količina uvek uključeni. Samo biranje postojećih kolona (Barkod, Cena, Akcija) donosi malo; vredelo bi uz nove kolone iz podataka koje već imamo: Vrednost (cena × količina) sa zbirom na dnu, Akcija i na popisu, oznaka „nije u bazi“, vreme dodavanja. Otvoreno: važi za telefon (kao redosled) ili za celu radnju (u bazi).
