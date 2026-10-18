# Pitanja za sutra

Odluke koje sam doneo sam dok smo radili meni, cene, popis i trebovanje. Za svaku napiši „ostaje“ ili kako da se promeni, pa to rešavamo na grani `fixes`.

## ⚠️ Prvo: Vercel ne objavljuje ništa od redizajna

Od spajanja redizajna (PR #8) **svaki deploy na Vercel-u pada**, i na `main` i u pregledima grana. Produkcija (`brancode.vercel.app`) i dalje pokazuje staru aplikaciju. Poslednji uspešan deploy je `a987b4b` (pre redizajna).

Šta sam proverio:
- isti kod se čisto instalira i builduje na Linux-u (Docker) sa Node 20, 22 i 24;
- `vercel.json` je ispravan;
- `api/` je nepromenjen;
- lockfile ima Linux pakete;
- putanje se poklapaju po velikim i malim slovima.

Greška je u nekom koraku koji radi samo Vercel, a log ne mogu da vidim bez prijave. Treba jedno od ovoga:
1. Otvori Vercel → projekat brancode → Deployments → poslednji crveni → **Build Logs** i pošalji mi grešku. Usput proveri Settings → General → **Node.js Version**.
2. Ili u Claude Code uključi Vercel konektor (`/mcp` → vercel → authorize), pa ću log pročitati sam.
3. Brza proba: na poslednjem deploy-u „Redeploy“ **bez** „Use existing Build Cache“.

Dok se ovo ne reši, sve testiraj lokalno (`npm run dev`, telefon na istoj mreži).

## Meni (hamburger)

1. **Meni se otvara odozdo** (sheet), da bude pod palcem, a dugme ☰ je gore desno, gde je bilo „…“. Može i obrnuto (dugme dole ili meni koji izlazi sa strane), ako ti je tako prirodnije.
2. **Dugme za liflet ostaje u zaglavlju Cenovnika**, pored menija, jer pripada samo cenovnicima. Da li ga radije premestiti u meni?
3. **Email prijavljenog korisnika** stoji sitno ispod „Odjavi se“. Da li treba više gore ili uopšte?
4. **Podešavanja** za sada imaju samo privremeni izbor čitača. Kad izaberemo čitač, ostaju prazna. Predlog: tada sakriti stavku dok ne dobije nešto novo.
5. **„Nazad“ posle prelaska u drugu sekciju** vraća na prethodnu sekciju (npr. iz Popisa na Cenovnike), a ne zatvara aplikaciju.

## Cene (barkod na rafu i frižideru)

1. **Barkod je u svojoj uskoj koloni** (oko 9 mm) desno od cene, a naziv ide preko cele širine. Cena se sada centrira i smanjuje u preostalih 40 mm. Ukupna širina, visina i broj po strani su isti. Da li je širina barkoda dobra ili treba uža/šira?
2. **Čitljivost na kasi je glavni rizik.** Kod sebe sam proverio da se svi barkodovi očitavaju u štampanoj veličini na 300 dpi. Na rafu se očitava i na 200 dpi, a **barkod za frižider (21,6 mm) na 200 dpi ne**. Odštampaj stranu Raf i stranu Frižider i probaj na kasi. Ako frižider ne prolazi, opcije su:
   - barkod vodoravno ispod cene;
   - viši red cene;
   - bez barkoda na frižideru.
3. **Kodovi sa 12 cifara** (iz baze, bez kontrolne cifre) štampaju se kao pun EAN-13 sa izračunatom 13. cifrom, kao na ambalaži. Ako neki takav kod nije pravi EAN, kasa ga neće prepoznati. Javi ako vidiš takav artikal.
4. **Decimale:** u Excel-u su „superscript“ na 0,75 veličine cene, pa ih Excel crta otprilike upola manje. Tačnu veličinu na papiru nisam mogao da vidim. Ako su premale ili prevelike, to je jedan broj (`DECIMALS_SUPERSCRIPT_SCALE`).
5. **Sitne cifre uz barkod** su uvek tu, jer ima mesta. Okrenute su da se čitaju odozdo nagore.
6. **Probnu stranu nisam pravio** (spec je predlagao da se prvo štampa probna strana sa više veličina). Prava strana za Raf i Frižider sada služi kao proba.
