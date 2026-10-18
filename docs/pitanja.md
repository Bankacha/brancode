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
