# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 28.10.2026. Stanje posle 0.12.2. Ostale su dve sitnice iz pregleda 0.12.2 i ono što čeka tebe ili proveru u radnji.

## Sitnice iz pregleda 0.12.2 (za sledeće sređivanje)

1. Ako bi kutija za datum ikad bila široka 0 mm, canvas vraća prazan PNG umesto „nema slike“. Danas to nije moguće, jer je kutija uvek bar onolika kolike su decimale. Popravka je jedna provera.
2. Kvadratić u PDF-u trebovanja izlazi 1 pt preko unutrašnje margine ćelije. Na papiru se ne vidi, a tako je bilo i ranije.

## Treba tvoja odluka, podešavanje ili provera u radnji

- **Vercel ključevi** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY`, najkasnije do 29.10. Bez njih liflet ne vraća cene i ne šalje podsetnike. Koraci su u `docs/pitanja.md`, odeljak 0.11.0.
- **Brisanje pogrešno uvezenog lifleta iz aplikacije.** Sada se to radi u Supabase-u (tabela `promo_leaflets`). Ponovni uvoz sa ispravljenim datumima ostavlja i stari zapis, pa stižu dupli podsetnici. Ovo je nova mala funkcija i treba dogovor.
- **Probna štampa** za raf („99,99“, „1.249,99“, „12.499,99“) i frižider („99,99“, „12.499,99“), svaki sa akcijom. „12.499,99“ na frižideru daje najkraći barkod (oko 16 mm) i najsitniji datum:
  - datum ispod decimala ne dodiruje cifre i čita se;
  - uspravni barkod, sada do dna cene, ceo se vidi u držaču i telefon ga skenira;
  - cifra na frižideru stoji gde je pregled pokazuje (pregled od 0.11.0 crta je niže, po proceni za Excel na Windows-u).
- **Oznaka „Liflet“ na trebovanju:** oktobarski liflet je uvezen pre 0.11.0, pa ga treba ponovo uvesti da bi se oznake pojavile.
- **Čitač barkoda:** ugrađeni ili zxing. Posle odluke se iz Podešavanja uklanja probni izbor „Čitač barkoda (test)“.
- **Popis i trebovanje:** ako dva telefona u istoj sekundi dodaju isti artikal, jedan pod 12, a drugi pod 13 cifara, mogu nastati dva reda. Retko je, a rešenje traži izmenu baze.
- **Posebno okruženje za probu** pre 1.0.0, da produkcija ne bude mesto za testiranje.

## Ostaje ovako (namerno)

- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.
