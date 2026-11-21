# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 21.11.2026, posle 0.16.1 (e-Faktura: jedan PDF za štampu; provera strana na 100 faktura: nijedna strana fakture ne otpada, kod 20 ostaje poslednja strana specifikacije, koju još proveravam). Ostale su sitnice iz pregleda 0.12.2–0.16.0 i ono što čeka tebe ili proveru u radnji. Prvo idu koraci za e-Fakturu, redom.

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

## Sitnice iz pregleda 0.16.0 (za sledeće sređivanje)

- Kad se šalje više od 50 faktura, stižu dva mejla sa istim nazivom priloga („Prihvaćene fakture – datum.pdf“), jer se delovi numerišu samo unutar jednog zahteva. Starije su u prvom mejlu.
- Ako se veza telefona prekine dok server još šalje (zaključan telefon usred slanja 50 faktura), aplikacija javi „Nema veze“, a mejl ipak ode. Ponovno slanje odmah posle toga može da pošalje iste fakture još jednom. Posle osvežavanja liste stanje je tačno.

## Treba tvoja odluka, podešavanje ili provera u radnji

**e-Faktura, redom.** Urađeno (21.11.): tabele u bazi, `EFAKTURA_SECRET`, `EFAKTURA_USERS`, isključena registracija, proba u probnom režimu, pravi SEF (`SEF_ENV`) i poređenje liste sa SEF-om. Ostaje:

6. **Prihvatanje:** lista se slaže, pa: `SEF_ACCEPT=on` **samo za Production** (Redeploy). Prvo pravo prihvatanje neka bude faktura koju bi brat i inače prihvatio, pa proveri na SEF-u da je prihvaćena.
- **Prvi zajednički PDF (0.16.0):** pri sledećem slanju pogledaj PDF iz mejla: svaka faktura cela, bez strana „Strukturirani format…“. Ako nešto fali ili višak ostane, javi mi koja faktura.
- **Privremena provera `pdf-check`** (0.16.0, u 0.16.1 javlja i početak strane koju pravilo ne prepoznaje): na 100 faktura od 77 dobavljača nijedna strana fakture nije otpala, a kod 20 ostaje poslednja strana sa identifikatorom i podnožjem, bez polja specifikacije. Kad se vidi šta je na njoj, doterati `specPages` i ukloniti proveru.
- **Podsetnik, dogovoreno:** dvostepena prijava (2FA) bar za naloge koji vide e-Fakturu (oni iz `EFAKTURA_USERS`), jer ti nalozi mogu da prihvataju fakture na SEF-u.


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

- e-Faktura, samo u probnom režimu: ako upis u istoriju ne uspe posle prihvatanja, probna faktura se opet pokaže kao „na čekanju“, jer probni SEF čita odluke iz istorije. Sa pravim SEF-om status uvek dolazi sa SEF-a, pa ovoga tamo nema.
- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.

## Ideje za kasnije (nije dogovoreno)

- **e-Faktura, „Označi kao plaćeno“** (dogovor od 19.11., posle 0.15.0): u tabeli prihvaćenih se po želji vodi plaćanje, a jutarnji mejl upozorava na fakture kojima ističe valuta (npr. za 48 sati). Za plaćene se više ne šalje. Datum valute se već čuva u istoriji.
- **e-Faktura, poluprazne strane fakture u PDF-u za štampu** (21.11.): SEF-ov prikaz fakture ponekad prelije na stranu koja ima samo zaglavlje i jednu rečenicu (npr. „Dan nastanka PDV obaveze je datum prometa“). Pripada fakturi, pa ostaje. Ako takvih bude mnogo, smisliti bezbedno pravilo.
- **e-Faktura, uloge:** vlasnik/admin prihvata i odbija, ostali rade manje osetljive stvari. Za sada su svi nalozi iz `EFAKTURA_USERS` isti.
- **Lager (stanje artikala) iz faktura** (razgovor 19.11., odluka: ne sada). Ideja je bila stanje = popis + ulaz sa faktura − izlaz. Izlaz bi se računao „od popisa do popisa“ ili iz izvoza prodaje sa kase, uz nabavne cene i zaradu. Ne sada, jer dobar deo robe (voće, povrće sa pijace) ne dolazi preko e-Faktura, pa stanje iz faktura ne bi bilo tačno. Ako se ikad vratimo: prvo na pravim fakturama videti koliko dobavljača šalje barkod i u kojim jedinicama (karton ili komad).
- **e-Faktura, slanje knjigovođi:** polje „Fakture šalji na“ se otključava kad aplikacija dobije svoj domen u Resend-u (probna adresa isporučuje samo vlasniku naloga).

- **Izbor kolona u PDF-u popisa i trebovanja** (ideja od 31.10.): u Podešavanjima, pored „Redosled u PDF-u“, za popis i trebovanje posebno štiklira koje kolone ulaze u PDF. Podrazumevano kao sada; Naziv i Količina uvek uključeni. Samo biranje postojećih kolona (Barkod, Cena, Akcija) donosi malo; vredelo bi uz nove kolone iz podataka koje već imamo: Vrednost (cena × količina) sa zbirom na dnu, Akcija i na popisu, oznaka „nije u bazi“, vreme dodavanja. Otvoreno: važi za telefon (kao redosled) ili za celu radnju (u bazi).
