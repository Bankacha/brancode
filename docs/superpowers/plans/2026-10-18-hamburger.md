# Hamburger meni: plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Cilj:** meni aplikacije koji drži sekcije (Cenovnici, a kasnije Popis i Trebovanje), Podešavanja i Odjavu. Ovo je osnova za sledeće funkcije.

**Spec:** [`2026-10-18-brancode-popis-trebovanje-design.md`](../specs/2026-10-18-brancode-popis-trebovanje-design.md), odluka 1 i odeljak „Meni“.

**Grana:** `hamburger`. Na `main` ide jedan squash commit, posle testova i pregleda.

## Globalna ograničenja

- Sva pravila iz `.claude/rules/` važe: tokeni, `useSheet`, `useToast`, `plural`, bez inline stilova.
- Dugme menija je ikonica `Menu` u zaglavlju, a meni je `BottomSheet` (dohvatljiv jednom rukom).
- **Sekcije** su jedan niz `SECTIONS` u `components/AppMenu.jsx` (`{ path, label, icon }`). Popis i Trebovanje dodaju svoje stavke u svojim commit-ovima.
- **Podešavanja** je sheet sa privremenim izborom čitača. Meni se sa njim smenjuje kroz `replace` (`useSheet.open`).
- **Sesija** dolazi kroz `SessionContext`, a ne kroz props svakog ekrana.

## Task 1: `SessionContext`, `AppMenu` i `AppHeader`

**Fajlovi:**
- Novo: `src/auth/session.js`, `src/components/AppMenu.jsx`, `src/components/AppHeader.jsx`, `src/sheets/SettingsSheet.jsx`, `src/components/AppMenu.test.jsx`
- Izmena: `src/App.jsx`, `src/screens/Home.jsx`, `src/screens/Home.test.jsx`
- Brisanje: `src/sheets/MenuSheet.jsx`

**Interfejsi:**
- `SessionProvider` i `useSession(): session`.
- `AppHeader({ title, actions })`: levo `title`, a desno `actions` pa dugme menija.
- `AppMenu` sadrži dugme `aria-label="Meni"` i sheet „menu“ sa:
  - sekcijama, gde aktivna ima `aria-current="page"`;
  - „Podešavanja“ (otvara sheet „settings“);
  - emailom i „Odjavi se“.
- `SettingsSheet` sadrži „Čitač barkoda (test)“, segment Automatski / Ugrađeni / zxing (`useScannerReader`).

- [ ] **Testovi** (`AppMenu.test.jsx`, jsdom, `MemoryRouter` na `/`):
  - meni pokazuje „Cenovnici“ sa `aria-current="page"`;
  - „Podešavanja“ otvara segment čitača, a klik na „zxing“ ga bira;
  - „Odjavi se“ zove `supabase.auth.signOut`;
  - klik na sekciju vodi na njenu adresu i zatvara meni.
- [ ] Pokreni testove i proveri da padaju (RED), pa implementiraj. Home koristi `AppHeader` sa „brancode“ i dugmetom za liflet, a `MenuSheet` se briše.
- [ ] `npm test && npm run build`, pa ručna provera u browseru (390×844): meni, Podešavanja, „nazad“ zatvara.
- [ ] Ažuriraj `CLAUDE.md` i `ui-conventions.md`, dopuni `docs/pitanja.md` i spisak za testiranje.
