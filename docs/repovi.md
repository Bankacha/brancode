# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 27.10.2026, posle 0.12.1. Sve sitnice iz pregleda koda do 0.12.0 su sređene u 0.12.1. Ostalo je ono što čeka tebe ili proveru u radnji.

## Treba tvoja odluka, podešavanje ili provera u radnji

- **Vercel ključevi** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY`, najkasnije do 29.10. Bez njih liflet ne vraća cene i ne šalje podsetnike. Koraci su u `docs/pitanja.md`, odeljak 0.11.0.
- **Brisanje pogrešno uvezenog lifleta iz aplikacije.** Sada se to radi u Supabase-u (tabela `promo_leaflets`). Ponovni uvoz sa ispravljenim datumima ostavlja i stari zapis, pa stižu dupli podsetnici. Ovo je nova mala funkcija i treba dogovor.
- **Probna štampa:**
  - frižider: pregled sada crta cifru niže, kao Excel, pa proveri da li papir odgovara;
  - red „Akcija važi do“ na sva tri formata;
  - cifre ispod kratkog barkoda (7, 11 i 12 cifara): sada su računate za broj cifara koji se stvarno štampa.
- **Čitač barkoda:** ugrađeni ili zxing. Posle odluke se iz Podešavanja uklanja probni izbor „Čitač barkoda (test)“.
- **Popis i trebovanje:** ako dva telefona u istoj sekundi dodaju isti artikal, jedan pod 12, a drugi pod 13 cifara, mogu nastati dva reda. Retko je, a rešenje traži izmenu baze.
- **Posebno okruženje za probu** pre 1.0.0, da produkcija ne bude mesto za testiranje.

## Ostaje ovako (namerno)

- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.
