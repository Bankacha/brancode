# Handoff: Brancode redesign ("Pijaca")

## ⚠ Napomene autora (imaju prednost nad mockom)
1. **Pregled štampe (06) mora da bude 1:1 sa pravim printom.** Mock je približan, a cene u njemu deluju veće nego na stvarnom printu. Pregled treba da koristi iste dimenzije cenovnika, raspored, broj kolona i veličine fonta kao stvarni izlaz (Excel/štampa) za izabrani format. Najbolje je da ga renderuje isti kod/konfiguracija koja generiše print, umanjeno (`transform: scale`), a ne posebno nacrtan. Isto važi za mali pregled cenovnika u 04.
2. **03 je tok posle skeniranja**: kad se skenira artikal, izmena se otvara sama.
3. **04 je izmena već skeniranog artikla iz liste** (i unos novog artikla koji nije u bazi). Otvara se **dugim pritiskom (long-press, oko 500 ms) na artikal u listi** i odmah prikazuje izmenu sa živim pregledom cenovnika. Običan tap na red ne otvara izmenu.

## Pregled
Redizajn mobilne web aplikacije **Brancode** (skener cena: skeniraš barkod, upišeš ili izmeniš naziv/cenu, napraviš listu cenovnika i pošalješ je ili preuzmeš kao Excel). Tok rada ostaje isti kao u postojećoj aplikaciji. Menjaju se vizuelni identitet, raspored i nekoliko koraka u toku:
- Posle skeniranja se **odmah otvara izmena** artikla (naziv + cena), cena je u fokusu.
- Lista je **grupisana po statusu**: „Za proveru · nije u bazi“ i „Spremno“.
- Pre slanja postoji **pregled štampe** (A4 sa cenovnicima) i izbor formata.
- **Pošalji** je glavna akcija, a **Excel** sporedna. Dugmad su iste širine.
- Novi logo („Nišan“, 3c).

Aplikacija se koristi **jednom rukom, na telefonu, u radnji**. Glavne akcije su pri dnu ekrana, ispod palca.

## O dizajn fajlovima
`Brancode C - Pijaca.dc.html` je **dizajn referenca napravljena u HTML-u**: prototip izgleda i ponašanja, a ne produkcijski kod. Zadatak je da se ovi ekrani **ponovo naprave u postojećem kodu** (`brancode/`: React + Vite, `lucide-react`, Supabase), uz postojeće obrasce i postojeću logiku: skeniranje, Supabase, slanje mejla (`api/send-email.js`), Excel export, uvoz lifleta. Logiku ne treba menjati, osim promena u toku opisanih ispod.

Fajl se otvara direktno u browseru (pored njega mora da bude `support.js`). Na vrhu su predlozi logoa, a ispod je sekcija `1c` sa 9 ekrana.

## Verodostojnost
**High-fidelity.** Boje, tipografija, razmaci, zaobljenja i tekstovi su konačni. Mere su date za ekran širine 390 px. Layout treba da bude fluidan po širini (bez fiksne širine), a visinu određuje sadržaj, uz safe-area padding pri dnu.

## Dizajn tokeni

### Boje
| Token | Hex | Upotreba |
|---|---|---|
| bg | `#FBF6EE` | pozadina ekrana (krem) |
| surface | `#FFFFFF` | polja, redovi liste |
| surface-muted | `#F2EADD` | ikonična dugmad, segment kontrola, pozadina pregleda |
| border | `#E2D8C8` | ivice polja (1.5px) |
| border-soft | `#EDE4D5` | ivice redova liste (1.5px) |
| ink | `#1D3B2A` | glavni tekst, tamna dugmad, tamna kartica |
| ink-2 | `#55685B` | sekundarni tekst |
| ink-3 | `#7A8A7E` | labele, barkodovi, pomoćni tekst |
| ink-4 | `#A7B2A9` | ikona brisanja reda |
| ink-on-dark-muted | `#B7C7BA` | sekundarni tekst na tamnoj kartici |
| accent | `#D9502B` | primarna akcija (skeniraj, pošalji, sačuvaj), fokus polja |
| danger-bg | `#FCE3D9` | „nije u bazi“, greške |
| danger-ink | `#9E3218` | tekst na danger-bg |
| success | `#3E8B57` | uspeh, okvir kamere kad je barkod pročitan |
| success-light | `#7BD39A` | ikona uspeha na tamnoj kameri |
| success-bg | `#E3EFE5` | „u bazi“ bedž, statistika lifleta |
| success-ink | `#2C6B40` | tekst na success-bg |
| scrim | `#3A4A3F` | pozadina iza bottom sheet-a |
| camera-placeholder | `#3A4A3F` / `#33433A` | pruge (135°, 14px) dok nema slike kamere |

### Tipografija
Google Fonts:
- **Bricolage Grotesque** 500/700/800: naslovi, cene, brojevi, logotip.
- **DM Sans** 400/500/600/700: UI tekst.
- **DM Mono** 500: barkodovi, tehničke labele.

Zamenjuju IBM Plex u `index.html`.

| Uloga | Font | Veličina / težina / ostalo |
|---|---|---|
| Naslov prijave | Bricolage | 44 / 800 / line-height 1 / letter-spacing -0.03em |
| Naslov ekrana | Bricolage | 24 / 800 |
| Naslov sheet-a | Bricolage | 28 / 800 / -0.02em |
| Logotip u zaglavlju | Bricolage | 22 / 800 / -0.02em |
| Broj u kartici liste | Bricolage | 40 / 800 (jedinica „cenovnika“ 18 / 500) |
| Cena u polju za unos | Bricolage | 36 / 800 / lh 1.1 |
| Cena u redu liste | Bricolage | 22 / 800 |
| Cena na pregledu cenovnika | Bricolage | 56 / 800 (decimale 26, vertical-align top) |
| Tekst dugmeta | DM Sans | 17 / 700 (sekundarna 15–16 / 600) |
| Naziv u redu liste | DM Sans | 15 / 600, jedan red, ellipsis |
| Vrednost polja | DM Sans | 17 / 500–600 |
| Labela polja | DM Sans | 12 / 500 (u fokusu 600, boja accent) |
| Naslov grupe u listi | DM Sans | 13 / 700 + tačka 8px |
| Barkod | DM Mono | 11–12 / 500 |
| Ručni unos barkoda | DM Mono | 34 / letter-spacing 0.06em |

### Zaobljenja
- pill `99px`: sva glavna dugmad, ikonična dugmad, segment kontrola, bedževi
- `32px`: gornji uglovi bottom sheet-a
- `24px`: tamna kartica liste, okvir pregleda štampe, okvir kamere (24–28)
- `18px`: polja, redovi liste, tasteri tastature
- `20px`: statusni toastovi, ikona logoa (64px)
- `16px`: inline greška na prijavi

### Visine (hit targets)
- Primarno dugme: **62px**
- Sekundarno pill dugme: 52–56px
- Ikonično dugme u zaglavlju: 44px krug
- Dugme za skeniranje (početna): **84px** krug, senka `0 10px 24px rgba(217,80,43,.35)`
- Sporedna okrugla dugmad pored njega: 52px
- Tasteri tastature: 60px

### Senke
- toast: `0 6px 16px rgba(29,59,42,.1)`
- papir u pregledu: `0 8px 20px rgba(29,59,42,.14)`
- cenovnik u izmeni: `0 4px 12px rgba(29,59,42,.12)`

### Razmaci
Bočni padding ekrana je 20px (prijava 24px). Razmak između redova liste je 8px, između polja u formi 12–14px. Na vrhu ekrana je safe-area + oko 16px (u mocku 60px ukupno). Na dnu je safe-area + oko 34px.

## Ekrani

### 01 · Prijava (`Login.jsx`)
- Kolona, padding 110 / 24 / 40. Gore je logo (64×64, radius 20, pozadina accent, znak 44px), ispod naslov „Dobro jutro.<br>Prijavi se u radnju.“ (margin-top 28).
- Forma je pri dnu (`margin-top:auto`), gap 12: inline greška (danger-bg, ikona `circle-alert`, tekst „Pogrešan email ili lozinka.“) → polje Email → polje Lozinka → dugme „Prijavi se →“ (ink pozadina, bg tekst).
- Polje: belo, ivica 1.5px border, radius 18, padding 12/16, labela iznad vrednosti, u istom okviru. **Fokus**: ivica 2px accent, labela accent 600.
- Greška se prikazuje samo posle neuspele prijave.

### 02 · Početna + lista (`App.jsx`, glavni ekran)
- **Zaglavlje**: levo „brancode“ (logotip), desno dva ikonična dugmeta 44px na surface-muted: `file-up` (uvoz lifleta) i `ellipsis` (meni: odjava, obriši sve…).
- **Tamna kartica** (ink, radius 24, padding 18/18/18/20, margin-top 18): „7 cenovnika“ + „2 traže proveru pre štampe“ (#B7C7BA), desno pill dugme „Pregled“ (bg pozadina, ikona `eye`, visina 48) koje vodi na 06.
- **Lista**, grupisana:
  1. Naslov grupe „Za proveru · nije u bazi“ (accent tačka i tekst). Redovi sa pozadinom danger-bg, barkod u danger-ink, desno cena i `chevron-right`. Long-press otvara 04.
  2. Naslov grupe „Spremno · N“ (zelena tačka), desno link „Obriši sve“ (otvara 08). Beli redovi sa ivicom border-soft, desno cena i `x` (uklanja iz liste). Long-press na red otvara 04 (izmena + pregled), uz kratku haptičku vibraciju ako je dostupna (`navigator.vibrate(10)`).
- Red: radius 18, padding 10/12/10/16, gap 12. Naziv (15/600, ellipsis) iznad barkoda (DM Mono 11).
- **Donja akciona traka** (fiksna, 140px, gradijent od providnog ka bg na 40%): u sredini **Skeniraj** (84px, accent, `scan-barcode` 36px), levo ručni unos (52px, belo, `keyboard`), desno štampa (52px, ink, `printer`), gap 28. Lista ima padding-bottom 140 da se poslednji red ne sakrije.
- Prazno stanje nije dizajnirano. Predlog: tamna kartica sa „0 cenovnika“ i tekstom „Skeniraj prvi artikal“.

### 03 · Skeniranje → izmena se otvara sama (**promena toka**)
- Kamera preko celog ekrana. Gore tri kontrole na `rgba(0,0,0,.4)`: zatvori (`x`), oznaka „kamera“, blic (`flashlight`).
- **Dok traži**: okvir 280×170, radius 28, ivica 3px bg, horizontalna linija accent 85% širine. Tekst „Usmeri na barkod“.
- **Kad pročita barkod artikla koji JE u bazi**: kamera se pauzira, a okvir se smanji (240×120, radius 24) i postane zelen (`#3E8B57`, linija takođe). Ispod piše „Pročitano · kamera na pauzi“ uz ikonu `circle-check` (#7BD39A). Gornjih oko 250px ostaje kamera, a od dna izlazi sheet (bg, radius 32 gore, handle 40×5):
  - Red: bedž „U bazi“ (success-bg / success-ink), barkod (DM Mono 12), desno „3. u nizu“ (broj skeniranih u ovoj sesiji).
  - Polje **Naziv** (popunjeno iz baze).
  - Polje **Cena**, odmah u fokusu (ivica 2px accent, kursor). Labela „Cena · bila 79,00“ prikazuje staru cenu, sufiks „din“. Na mobilnom odmah otvori numeričku tastaturu (`inputmode="decimal"`, select all).
  - Primarno dugme „Sačuvaj i skeniraj sledeći“ (accent, `scan-barcode`): čuva izmenu, zatvara sheet i nastavlja kameru.
  - Ispod, levo „Preskoči“ (artikal ide u listu bez izmene, kamera nastavlja), desno „Sačuvaj i završi (3)“ (čuva i vraća na 02).
- **Kad pročita barkod koji NIJE u bazi**: otvara se 04 (novi artikal).
- Ako nema dozvole za kameru, prikaži status „Nema dozvole za kameru.“ sa akcijom „Upiši ručno“ (vodi na 05).

### 04 · Izmena skeniranog artikla iz liste / novi artikal (bottom sheet)
Otvara se long-pressom na red u listi (02) ili posle skeniranja barkoda koji nije u bazi.
- Scrim `#3A4A3F`, sheet odozdo (bg, radius 32 gore, padding 12/20/34, gap 14).
- Bedž „Novi artikal“ (danger-bg / danger-ink) + barkod. Za postojeći artikal otvoren iz liste koristi bedž „U bazi“.
- **Živi pregled cenovnika**: okvir surface-muted radius 22 sa belim cenovnikom 210px (naziv 14/600 iznad isprekidane linije, cena 56/800 sa decimalama 26 gore). Ispod piše „Ovako izgleda cenovnik na rafu“. Pregled se ažurira dok korisnik kuca i prati izabrani format (raf / frižider / voće).
- Polja Naziv i Cena (cena 36/800, ivica 2px ink, sufiks „din“).
- „Sačuvaj i skeniraj sledeći“ (accent) i tekst-dugme „Sačuvaj i zatvori“.

### 05 · Ručni unos barkoda
- Zaglavlje: nazad (44px, `arrow-left`) + „Upiši barkod“.
- Centrirano: uneti broj (DM Mono 34) + kursor 3×38 accent. Ispod indikator od 13 crtica (10×4, radius 2; popunjene ink, prazne `#E2D8C8`) i tekst „9 od 13 cifara · EAN, UPC ili interna šifra“.
- Numerička tastatura 3×4 (60px, belo, ivica border-soft, radius 18, Bricolage 26/700): 1–9, ⌫, 0, ✓. Može i sistemska tastatura sa `inputmode="numeric"`, ako je to jednostavnije.
- Dugme „Nastavi“ (ink) vodi na isti tok kao posle skeniranja (03 sheet ili 04).

### 06 · Format + pregled štampe
- Zaglavlje: nazad + „Pregled štampe“ + desno „7 kom“.
- **Segment kontrola** (surface-muted, pill, padding 5): Raf (`layout-grid`), Frižider (`refrigerator`), Voće (`apple`). Aktivna opcija ima ink pozadinu i bg tekst. Ovo zamenjuje postojeći izbor formata.
- **Pregled**: okvir surface-muted radius 24, u njemu A4 list (262×370 u mocku, odnos 1:√2) sa mrežom cenovnika (3 kolone za Raf). Ispod piše „A4 · 3 kolone · strana 1 od 1“. **Pregled mora da bude identičan stvarnom printu** (vidi Napomene autora #1): iste proporcije cenovnika i iste veličine teksta, samo umanjeno. Ako ima više strana, dodaj horizontalno listanje.
- **Akcije** (gap 10, **jednake širine**, flex 1/1): levo **Pošalji** (accent, `send`, primarno), desno **Excel** (belo, ivica border, `download`, sporedno).

### 07 · Uvoz akcijskog lifleta (bottom sheet, posle čitanja PDF-a)
- Naslov „Pročitano 42 artikla“ + ime fajla (DM Mono 12).
- Dve kartice 1fr/1fr: „35 · u bazi, cena se ažurira“ (success) i „7 · nisu u bazi, samo u listu“ (danger). Broj je Bricolage 36/800.
- Info blok (surface-muted, `info`): „Trenutna lista (7) biće zamenjena. Nepotrebne artikle ukloni pre štampe.“
- „Zameni listu i uvezi“ (ink) i „Otkaži“.
- Dok čita fajl, prikaži status „Čitam liflet… strana 2 / 6“ (09).

### 08 · Potvrda brisanja (bottom sheet)
- Ikona `trash-2` u kvadratu 56 (danger-bg, accent ikona, radius 18).
- „Obrisati svih 7 cenovnika?“ i „Lista se briše samo sa ovog telefona. Cene u bazi ostaju.“
- „Obriši sve“ (accent) i „Zadrži listu“ (surface-muted).

### 09 · Statusi (toastovi, gore ili iznad donje trake)
Radius 20, padding 12/16, ikona u krugu 32px, tekst 15/600:
- Uspeh: belo + senka, zelena ikona. „Dodato: Coca-Cola 2L“ + cena; „Poslato na mejl radnje“ (`mail-check`).
- Greška: danger-bg / danger-ink, accent ikona, desno belo pill dugme sa akcijom. „Nema veze. Nije sačuvano.“ + „Ponovi“ (`wifi-off`); „Nema dozvole za kameru.“ + „Upiši ručno“ (`camera-off`).
- Učitavanje: ink pozadina, `loader` (rotira se), desno progres u DM Mono.
- Uspeh nestaje posle oko 2.5 s. Greška ostaje dok se ne reši ili zatvori.

## Interakcije i stanja
- Sheet-ovi: ulazak odozdo oko 250 ms ease-out, scrim se pojavljuje postepeno. Zatvaraju se prevlačenjem nadole ili tapom na scrim (osim 03, gde je kamera iza).
- Pritisnuto dugme: `transform: scale(.97)`, oko 100 ms.
- Validacija cene: broj > 0, decimalni zarez ili tačka, format prikaza `sr-RS` sa 2 decimale („1.249,99“).
- Brojač sesije („3. u nizu“, „Sačuvaj i završi (3)“) se resetuje kad se kamera zatvori.

## Stanje (dodaci postojećem)
- `scanSession: { count, lastItem }`
- `editSheet: { open, item, isNew, source: 'scan' | 'list' | 'manual' }`
- `printFormat: 'raf' | 'frizider' | 'voce'` (verovatno već postoji)
- Grupisanje liste se izvodi iz postojećeg polja „nije u bazi“.

## Logo („Nišan“, 3c)
Malo slovo **b** (Bricolage Grotesque 800), isečeno horizontalno na oko 55% visine, sa donjom polovinom pomerenom udesno. Linija skenera prelazi preko cele širine, a slovo je u uglovima okvira kamere. Na accent pozadini su slovo belo i linije/uglovi ink. Na tamnoj (ink) pozadini su slovo krem `#FBF6EE` i linije accent. Fajl: `assets/logo-nisan.svg` (viewBox 48×48).
**Važno:** SVG koristi `<text>` sa fontom. Za favicon/PWA ikonice (`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png`) konvertuj slovo u putanje (outline) ili renderuj PNG sa učitanim fontom.

## Ikone
Lucide (već postoji `lucide-react`): scan-barcode, keyboard, printer, file-up, ellipsis, eye, chevron-right, x, flashlight, circle-check, arrow-left, arrow-right, layout-grid, refrigerator, apple, send, download, info, trash-2, check, mail-check, wifi-off, camera-off, loader, circle-alert.

## Fajlovi
- `Brancode C - Pijaca.dc.html`: svi ekrani i predlozi logoa (otvori u browseru)
- `support.js`: potreban da bi se HTML otvorio
- `assets/logo-nisan.svg`: logo

Ostale varijante (A, B, D–G) su odbačeni pravci i nisu uključene.
