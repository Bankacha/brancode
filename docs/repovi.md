# Repovi: sve što je ostalo za kasnije

Jedno mesto za sitnice koje su pregledi koda našli, a nisu popravljene pre puštanja, i za stvari koje čekaju odluku ili proveru u radnji. Kad se nešto sredi, briše se odavde (istorija ostaje u git-u). Svako novo puštanje dopisuje svoje repove ovde, ne samo u izveštaj.

Stanje: 27.10.2026, posle 0.12.0.

## Sređujem u 0.12.1

**Barkodovi**
1. Ručni unos cene: 12 cifara za artikal koji u bazi već ima pun kod od 13 cifara daje „Novi artikal“, a čuvanje pravi duplikat u bazi (0.9.3).
2. Isto za liste: na popisu i trebovanju ukucan kratak kod (7 ili 11 cifara) ostaje kratak, iako u bazi postoji pun kod. Za 12 → 13 to već radi (0.9.3).
3. Cifre ispod kratkog barkoda (7, 11 i 12 cifara) se računaju za kod bez kontrolne cifre, pa su za nijansu prevelike (0.9.3).

**Broj kopija**

4. Posle osvežavanja ili gašenja aplikacije dok je otvoren „Broj kopija“, „nazad“ treba pritisnuti dvaput (0.10.0).
5. U prozoru „Broj kopija“ pozadina ima probnu oznaku za testove umesto pravog dugmeta „Zatvori“ (0.10.0).

**Liflet**

6. Stavke jednog lifleta se učitavaju po stranama bez redosleda. Važno je tek preko 1000 artikala, ali tada stavke mogu da se preskoče ili dupliraju (0.11.0).
7. Ako jutarnja provera pukne na pogrešnom mestu, mejl sa ručno menjanim cenama se više ne šalje (0.11.0).
8. Jutarnja provera poredi tajni ključ običnim poređenjem i prima svaki metod zahteva, a treba bezbedno poređenje i samo GET (0.11.0).
9. Ponovni uvoz istog lifleta ne osvežava „kada je uvezen“ (0.11.0).
10. Liflet u kome neki red ima cenu 0 obara ceo uvoz sa opštom porukom. Takav red treba preskočiti (0.11.0).

**Mix**

11. Kad zapamćeni formati nisu učitani, poruka posle štampe ne kaže da format nije zapamćen (0.12.0).
12. Mix, pa drugi format, pa opet Mix: na trenutak se vidi stara lista (0.12.0).
13. SQL za `tag_format` nema „if not exists“, pa ponovno pokretanje daje grešku. SQL je već pokrenut, pa je ovo samo da fajl bude ispravan (0.12.0).

**Izvoz i mejl**

14. Ako pravljenje Excel fajla pukne, nema nikakve poruke. Tako je i od ranije (0.12.0).
15. Mejl funkcija na pogrešan naziv priloga odgovara 500 umesto 400. Fale i testovi za čudne zahteve (0.12.0).

## Treba tvoja odluka, podešavanje ili provera u radnji

- **Vercel ključevi** `CRON_SECRET` i `SUPABASE_SERVICE_ROLE_KEY`, najkasnije do 29.10. Bez njih liflet ne vraća cene i ne šalje podsetnike. Koraci su u `docs/pitanja.md`, odeljak 0.11.0.
- **Brisanje pogrešno uvezenog lifleta iz aplikacije.** Sada se to radi u Supabase-u (tabela `promo_leaflets`). Ponovni uvoz sa ispravljenim datumima ostavlja i stari zapis, pa stižu dupli podsetnici. Ovo je nova mala funkcija i treba dogovor.
- **Probna štampa:**
  - frižider: pregled sada crta cifru niže, kao Excel, pa proveri da li papir odgovara;
  - red „Akcija važi do“ na sva tri formata;
  - cifre ispod kratkog barkoda, posle stavke 3.
- **Čitač barkoda:** ugrađeni ili zxing. Posle odluke se iz Podešavanja uklanja probni izbor „Čitač barkoda (test)“.
- **Popis i trebovanje:** ako dva telefona u istoj sekundi dodaju isti artikal, jedan pod 12, a drugi pod 13 cifara, mogu nastati dva reda. Retko je, a rešenje traži izmenu baze.
- **Posebno okruženje za probu** pre 1.0.0, da produkcija ne bude mesto za testiranje.

## Ostaje ovako (namerno)

- Artikal koji pre akcije nije imao cenu posle akcije opet ostaje bez cene.
- Mejlovi podsetnici navode samo artikle iz baze, jer samo njih liflet pamti.
- Štampa cele liste kao Raf ili Friz ne menja format zapamćen u Mix-u. Tako je dogovoreno, za sada.
