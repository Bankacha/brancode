# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 31.10.2026, posle 0.13.1 (frižider cena odmah ispod naziva). Ostale su sitnice iz pregleda 0.12.2 i 0.13.0 i ono što čeka tebe ili proveru u radnji.

## Sitnice iz pregleda 0.12.2 (za sledeće sređivanje)

1. Ako bi kutija za datum ikad bila široka 0 mm, canvas vraća prazan PNG umesto „nema slike“. Danas to nije moguće, jer je kutija uvek bar onolika kolike su decimale. Popravka je jedna provera.
2. Kvadratić u PDF-u trebovanja izlazi 1 pt preko unutrašnje margine ćelije. Na papiru se ne vidi, a tako je bilo i ranije.

## Sitnice iz pregleda 0.13.0 (za sledeće sređivanje)

1. „Da, ispravi datume“ menja samo datume, a naziv lifleta ostaje stari. Kad je liflet prepoznat po artiklima, a ne po nazivu (npr. ranije uvezen pod imenom fajla), zapis i mejlovi podsetnici zadržavaju stari naziv. Popravka: upisati i novi naziv, uz proveru da isti naziv sa tim datumima već ne postoji.
2. Posle „Da“, kad su akcijske cene već upisane, a početak je pomeren na kasniji dan, poruka kaže „Akcijske cene od dd.mm.“, iako su cene već u bazi i tamo ostaju.
3. Dve oznake lifleta sa istim tekstom u istom redu trebovanja (dupli zapis u bazi) daju React upozorenje o istom ključu. Prikaz je ispravan. Ključ treba da bude `leafletId`.
4. `promoCheck.js` i dalje izvozi `addDays`, a niko ga odatle ne uvozi (sada je u `listFormat.js`).
5. Uvoz lifleta tri puta čita otvorene liflete iz baze. Pri ovoj veličini tabele to se ne oseća.

## Treba tvoja odluka, podešavanje ili provera u radnji

- **Prvo jutro jutarnje provere:** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY` su dodati u Vercel. Ostaje da se vidi da je provera radila: Vercel → projekat → **Logs** (putanja `/api/promo-check`, oko 6 h) bez greške, ili Settings → Cron Jobs → **Run**. Ako piše da nema ključa za bazu, ključ nije dobro unet.
- **Dupli zapisi lifleta u bazi:** pogledaj u Supabase (Table Editor → `promo_leaflets`) da li već postoji zapis sa pogrešnim datumima i obriši ga. Od 0.13.0 uvoz sam pita da li je liflet isti sa ispravljenim datumima, pa novi duplikati ne nastaju. Dugme za brisanje za sada ne treba (odluka od 29.10.).
- **Probna štampa** za raf („99,99“, „1.249,99“, „12.499,99“) i frižider („99,99“, „12.499,99“), svaki sa akcijom. „12.499,99“ daje najsitniji datum:
  - datum ispod decimala ne dodiruje cifre i čita se;
  - uspravni barkod se vidi u držaču i telefon ga skenira;
  - **frižider od 0.13.1:** cena stoji odmah ispod linije (oko 2,5 mm), kao u pregledu, i u držaču se vidi cela. Pogledaj posebno vrh podignutih decimala „,99“: do linije im ostaje oko 1,5 mm i ne sme biti odsečen. Ako je odsečen, razmak se povećava (`FRIDGE_PRICE_GAP_MM`). Barkod je iste dužine kao pre.
- **Oznaka „Liflet“ i kolona „Akcija“ na trebovanju:** oktobarski liflet je uvezen pre 0.11.0, pa ga treba ponovo uvesti da bi se oznake pojavile (ističe 31.10., pa ima smisla samo ako se trebuje do tada).
- **Trebovanje dok se dva lifleta preklapaju** (od 0.13.0): prvi put kad se novi liflet uveze dok stari traje, pogledaj trebovanje u aplikaciji i u PDF-u (oznake, „USKORO“, kolona „Akcija“).
- **Čitač barkoda:** ugrađeni ili zxing. Posle odluke se iz Podešavanja uklanja probni izbor „Čitač barkoda (test)“.
- **Popis i trebovanje:** ako dva telefona u istoj sekundi dodaju isti artikal, jedan pod 12, a drugi pod 13 cifara, mogu nastati dva reda. Retko je, a rešenje traži izmenu baze.
- **Posebno okruženje za probu** pre 1.0.0, da produkcija ne bude mesto za testiranje.

## Ostaje ovako (namerno)

- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.
