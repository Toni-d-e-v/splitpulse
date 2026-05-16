# split_pulse_correct_instants

# SPLIT PULSE — Live Heat Map + Location Instants

> SPLIT PULSE je live mapa grada koja pokazuje gdje se nešto događa sada. Glavni feature je **heat map**, a glavni sadržaj na toj mapi su **Location Instants** — brze, neuređene, privremene objave vezane uz GPS lokaciju.
> 

---

## 1. Ispravljena inspiracija: Instagram Instants

Instagram Instants su novi format za brzo dijeljenje trenutka.

Bitne karakteristike Instagram Instantsa:

- quick camera-first experience
- spontana, neuređena fotografija
- bez puno editiranja
- dijeli se s bliskim krugom / mutual followersima
- nestaje nakon gledanja ili nakon kratkog vremena
- fokus je na “real life, real quick”
- manje pritiska nego story ili post
- više privatno, direktno i casual

SPLIT PULSE ne kopira Instagram, nego uzima najbolju ideju:

> **brzo, sirovo, trenutno dijeljenje onoga što se događa sada**
> 

i spaja je s:

- GPS lokacijom
- heat mapom
- gradskim zonama
- eventima
- korisnim informacijama
- AI sažecima
- crowd activityjem

---

## 2. Glavna definicija SPLIT PULSE-a

**SPLIT PULSE je live heat mapa Splita pokretana Location Instantsima.**

Korisnik otvori aplikaciju i vidi:

- gdje je trenutno aktivno
- gdje se nešto događa
- gdje ljudi objavljuju Instants
- što se događa na određenoj lokaciji
- koje zone rastu u aktivnosti
- gdje je mirnije
- gdje vrijedi otići sada

Jedna rečenica:

> **SPLIT PULSE shows where the city is alive right now through GPS-based disappearing Instants.**
> 

Na hrvatskom:

> **SPLIT PULSE pokazuje gdje grad trenutno živi kroz GPS Instants koji nestaju nakon kratkog vremena.**
> 

---

## 3. Glavni feature #1: Heat Map

Heat map je glavni vizualni proizvod.

To nije dodatak.

To je prva stvar koju korisnik vidi.

Mapa prikazuje intenzitet aktivnosti po lokacijama.

### Aktivnost dolazi iz:

- broja Location Instantsa
- broja korisnika u blizini
- broja potvrda Instantsa
- broja pregleda lokacije
- broja pitanja i odgovora
- broja check-inova
- broja AI upita za lokaciju
- brzine rasta aktivnosti u zadnjih nekoliko minuta

### Statusi lokacije

| Status | Značenje |
| --- | --- |
| Quiet | malo aktivnosti |
| Active | normalna aktivnost |
| Rising | aktivnost raste |
| Trending | lokacija je trenutno popularna |
| High Pulse | vrlo aktivna lokacija |
| Live Event | event zona |

Primjer:

```
Technological Park — High Pulse
Riva — Trending
Bačvice — Active
Matejuška — Rising
Marjan — Quiet
```

---

## 4. Glavni feature #2: Location Instants

**Location Instants** su brze, privremene objave vezane uz GPS lokaciju.

To je najvažniji sadržaj na heat mapi.

Inspiracija iz Instagram Instantsa:

- brzo objavi
- bez editiranja
- trenutno
- casual
- nestaje nakon kratkog vremena
- nema prevelikog pritiska
- fokus na sadašnji trenutak

Razlika u SPLIT PULSE-u:

- Instant je vezan uz lokaciju
- pojavljuje se na mapi
- utječe na heat map
- može biti javan za ljude u blizini
- može biti anoniman ili s profilom
- može biti korisna informacija, atmosfera, pitanje ili preporuka

---

## 5. Što je Location Instant

Location Instant može biti:

- brza slika
- kratki tekst
- slika + tekst
- pitanje
- status gužve
- preporuka
- upozorenje
- event update
- help request

Primjeri:

```
"Pitch počinje za 10 min u Main Hallu."
"Riva je trenutno baš živa."
"Sunset na Matejuški je odličan."
"Treba nam netko za testirati app."
"Ima li netko USB-C punjač?"
"Bačvice su pune."
"Food area je otvoren."
```

---

## 6. Camera-first flow

Location Instants trebaju imati što manje trenja.

Idealni flow:

1. Korisnik otvori SPLIT PULSE.
2. Vidi heat map.
3. Klikne veliki gumb “Instant”.
4. Otvori se kamera ili quick input.
5. Korisnik slika ili upiše kratki tekst.
6. Aplikacija automatski veže Instant uz GPS zonu.
7. Instant se pojavi na mapi.
8. Pulse lokacije raste.

Ključ:

> **No edit. No overthinking. Just what is happening here right now.**
> 

---

## 7. Trajanje Instantsa

Instants ne smiju trajati zauvijek.

Njihova vrijednost je u tome da su svježi.

Predloženo trajanje:

| Tip Instanta | Trajanje |
| --- | --- |
| Crowd status | 30–60 min |
| Event update | trajanje eventa |
| Help request | dok se ne riješi ili 2 sata |
| Question | dok se ne riješi ili 4 sata |
| Recommendation | 4–6 sati |
| Warning | 1–2 sata |
| Photo moment | 24 sata |
| General location instant | 24 sata |

Za hackathon:

- Instants mogu trajati do kraja eventa
- ili 24 sata radi jednostavnosti

---

## 8. Instants na heat mapi

Svaki Instant se prikazuje kao točka, bubble ili marker na mapi.

Na mapi korisnik vidi:

- gdje je Instant objavljen
- koliko je svjež
- koji je tip
- koliko ima potvrda
- je li vezan uz pitanje, event ili atmosferu
- povećava li pulse lokacije

Primjer prikaza:

```
📍 Technological Park
🔥 High Pulse
12 Instants in last 30 min

Latest:
"Pitch presentation starting soon."
```

---

## 9. Tipovi Location Instantsa

### 9.1 Photo Instant

Brza fotografija trenutka.

Primjer:

```
Slika Main Halla + "Pitch uskoro počinje"
```

### 9.2 Text Instant

Kratki tekst bez slike.

```
"Food area je otvoren."
```

### 9.3 Crowd Instant

Status gužve ili atmosfere.

```
"Riva je trenutno puna, ali atmosfera je odlična."
```

### 9.4 Question Instant

Anonimno ili javno pitanje na lokaciji.

```
"Ima li netko USB-C punjač?"
```

### 9.5 Help Instant

Korisnik traži pomoć.

```
"Treba nam netko za testirati login flow."
```

### 9.6 Event Instant

Kratki event update.

```
"Final pitches start in 15 minutes."
```

### 9.7 Recommendation Instant

Korisnik preporučuje lokaciju ili aktivnost.

```
"Matejuška je top za sunset sada."
```

### 9.8 Warning Instant

Korisna obavijest.

```
"Gužva na ulazu, koristite drugi ulaz."
```

---

## 10. Zašto su Location Instants bolji od običnih objava

Klasične objave:

- ostaju dugo
- nisu nužno vezane uz sadašnji trenutak
- često su uređene i nerealne
- korisnik ih gleda nakon što više nisu relevantne

Location Instants:

- kratko traju
- vezani su uz GPS
- prikazuju što se događa sada
- utječu na heat map
- korisni su za ljude u blizini
- stvaraju osjećaj živog grada

---

## 11. Technological Park kao live test zona

Za hackathon koristimo **Technological Park** kao prvu live zonu.

Cilj:

> Ljudi danas mogu skenirati QR kod, objaviti Location Instant i vidjeti kako se heat map mijenja uživo.
> 

### Zone unutar Technological Parka

| Zona | Namjena |
| --- | --- |
| Main Hall | glavni prostor |
| Team Area | rad timova |
| Pitch Area | prezentacije |
| Food Area | hrana i piće |
| Entrance | ulaz |
| Chill Zone | odmor |
| Help Zone | pomoć |
| Networking Zone | feedback i upoznavanje |

### Demo Instants

```
"Pitch uskoro počinje u Main Hallu."
"Treba nam tester za app."
"Food area je otvoren."
"Ima li netko punjač?"
"Najviše ljudi je trenutno u Team Area."
```

---

## 12. Demo flow za žiri

### Korak 1: QR

Žiri skenira QR kod i otvara SPLIT PULSE.

### Korak 2: Heat map

Prikaže se live heat map s Technological Parkom kao aktivnom zonom.

Rečenica:

> “Ovo nije statična mapa. Ovo je live heat map koja se mijenja prema Instantsima korisnika.”
> 

### Korak 3: Post Instant

Objavimo novi Instant:

```
"Pitch presentations starting soon in Main Hall."
```

### Korak 4: Instant se pojavi na mapi

Instant se pojavljuje na Technological Park zoni.

### Korak 5: Pulse raste

Pulse Score i status lokacije se ažuriraju.

### Korak 6: Drugi korisnik reagira

Drugi mobitel potvrdi, odgovori ili označi kao helpful.

### Korak 7: AI summary

Pitamo AI:

```
"What is happening here right now?"
```

AI odgovori na temelju Instantsa i heat map aktivnosti.

### Korak 8: Split expansion

Pokažemo da se isti model širi na:

- Rivu
- Bačvice
- Matejušku
- Marjan
- Žnjan
- Poljud
- Dioklecijanovu palaču
- studentske zone
- evente
- festivale
- klubove
- restorane

---

## 13. Location panel

Kada korisnik klikne lokaciju na heat mapi, otvara se panel.

Panel prikazuje:

- naziv lokacije
- pulse status
- broj Instantsa
- najnovije Instants
- pitanja
- potvrđene informacije
- AI summary
- gumb “Post Instant”
- gumb “Ask here”
- gumb “Navigate”
- gumb “Follow location”

Primjer:

```
Technological Park

Status: High Pulse
Instants last 30 min: 12
Active users: 38
Top type: Help / Event
Latest Instant:
"Pitch presentations starting soon."

AI Summary:
"Most activity is around Main Hall and Team Area. People are posting about pitches, testing apps and looking for chargers."
```

---

## 14. Pulse Score

Pulse Score se računa iz stvarnih aktivnosti.

Formula:

```
Pulse Score =
active_sessions
+ instants_last_30_min * 4
+ confirmed_instants * 5
+ question_instants * 3
+ answers * 4
+ solved_questions * 6
+ ai_queries * 2
+ location_clicks
```

Statusi:

| Score | Status |
| --- | --- |
| 0–10 | Quiet |
| 11–30 | Active |
| 31–60 | Rising |
| 61–100 | Trending |
| 100+ | High Pulse |

---

## 15. Login

Login nije glavna stvar, ali pomaže retentionu.

Opcije:

- Continue as Guest
- Create Pulse Name
- Google login

Najbrži hackathon flow:

```
Choose your Pulse name
@petar
```

Login omogućuje:

- streak
- Pulse points
- profil
- helper score
- badges
- lokacije kojima je korisnik doprinio

---

## 16. Daily streak

Daily streak se održava kroz korisne akcije.

Akcije:

- objavi Location Instant
- potvrdi tuđi Instant
- odgovori na Question Instant
- označi informaciju helpful
- pomogni riješiti pitanje
- doda korisnu lokacijsku informaciju

Poruka:

```
🔥 You kept your streak alive by helping people nearby.
```

---

## 17. Streak nije glavni feature

Važno:

> Streak nije core proizvod. Core je heat map + Instants.
> 

Streak samo daje korisnicima razlog da se vraćaju i doprinose.

---

## 18. AI uloga

AI nije chatbot kao glavni proizvod.

AI služi da objasni heat map.

AI može:

- sažeti što se događa na lokaciji
- objasniti zašto je lokacija trending
- preporučiti gdje otići sada
- reći gdje je mirnije
- izvući najvažnije iz Instantsa
- složiti mini plan po Splitu

Primjeri pitanja:

```
"Why is this place trending?"
"What is happening around me?"
"Where should I go now?"
"Summarize this location."
"Where is it quieter?"
```

---

## 19. Split lokacije

Aplikacija prikazuje širu mapu Splita.

| Zona | Tip |
| --- | --- |
| Riva | walk, coffee, tourists, events |
| Dioklecijanova palača | culture, tourism, restaurants |
| Peristil | sightseeing, events |
| Pjaca | coffee, food, social |
| Prokurative | concerts, public events |
| Matejuška | sunset, local vibe, drinks |
| Zapadna obala | walk, restaurants, view |
| Marjan | nature, sport, viewpoints |
| Sustipan | sunset, chill |
| Poljud | sports, concerts |
| Spinut | students, local cafes |
| Bačvice | beach, nightlife |
| Firule | beach, sport |
| Žnjan | beach, recreation |
| Trstenik | beach, hotels |
| Meje | sea, quiet |
| Varoš | local restaurants |
| FESB / kampus | students, study, events |
| HNK Split | culture, theatre |

---

## 20. MVP za hackathon

### Must have

- QR kod
- mobile-first web app
- mapa ili pseudo-mapa
- heat map vizual
- Technological Park kao live zona
- Post Instant flow
- Location Instants prikazani na mapi
- location panel
- Pulse Score
- basic AI summary
- guest / simple login
- popis Split lokacija

### Should have

- camera-first Instant
- potvrda Instantsa
- Question Instant
- odgovori
- streak
- realtime update
- filter po tipovima Instantsa
- Split map layer

### Nice to have

- prava mapa
- prava GPS geofence logika
- heatmap intenzitet po stvarnim korisnicima
- push notifications
- map clustering
- moderation
- venue dashboard
- analytics dashboard

---

## 21. Što ne želimo

Ne želimo da projekt izgleda kao:

- obična lista lokacija
- obična Q&A aplikacija
- samo chatbot
- samo turistički vodič
- statična mapa
- fake crowd demo

Glavni demo mora pokazati:

> **Objavi Instant → pojavi se na mapi → pulse lokacije se promijeni → heat map živi.**
> 

---

## 22. Pitch za žiri

> SPLIT PULSE je live heat mapa grada pokretana Location Instantsima.
> 
> 
> Instants su kratke, brze i privremene objave vezane uz GPS lokaciju — slično ideji casual, no-edit sharinga, ali umjesto privatnog inboxa stavljamo ih na mapu grada.
> 
> Korisnik otvori aplikaciju i odmah vidi gdje grad pulsira, što se tamo događa i zašto je neka lokacija aktivna. Danas to testiramo u Technological Parku: ljudi mogu skenirati QR kod, objaviti Instant i gledati kako se heat map mijenja uživo. Isti model se može proširiti na Rivu, Bačvice, Marjan, Matejušku, Poljud, kampuse, evente i cijeli Split.
> 

---

## 23. Jedna jaka pitch rečenica

> **SPLIT PULSE is a live heat map of the city powered by GPS-based disappearing Instants.**
> 

Druga:

> **Instagram Instants are for private friends. SPLIT PULSE Instants are for live places.**
> 

Treća:

> **SPLIT PULSE shows where the city is alive and what is happening there right now.**
> 

Na hrvatskom:

> **SPLIT PULSE je live heat mapa grada pokretana brzim GPS Instantsima koji pokazuju što se događa sada.**
> 

---

## 24. Finalna definicija

**SPLIT PULSE** je live heat map platforma koja prikazuje puls grada kroz **Location Instants** — kratke, neuređene i privremene GPS objave koje se pojavljuju na mapi i mijenjaju aktivnost lokacija u stvarnom vremenu.

Za hackathon se testira u **Technological Parku** kao prvoj live zoni.

Dugoročno se širi na cijeli Split kao real-time city activity layer.

---

## 25. Finalna poruka

> **SPLIT PULSE takes the casual immediacy of Instants and turns it into a live map of the city.**
> 

Na hrvatskom:

> **SPLIT PULSE uzima spontanost Instantsa i pretvara je u živu mapu grada.**
> 

## Dodatni feature: Favorites + Social Sharing

SPLIT PULSE treba imati mogućnost da korisnik sprema omiljene lokacije, objekte i zone u svoju listu favorita.

Favorites nisu samo obična lista spremljenih mjesta, nego osobni “city pulse” korisnika — mjesta koja korisnik prati, voli, želi posjetiti ili često koristi.

Korisnik može spremiti:

- kafiće
- restorane
- plaže
- barove
- klubove
- event lokacije
- study/work mjesta
- sunset spotove
- hidden gems
- lokacije s dobrim pulseom
- lokacije koje želi posjetiti kasnije

Primjer:

My Favorites

- Riva — Trending, evening walk
- D16 Coffee — coffee spot
- Matejuška — sunset
- Bačvice — beach / nightlife
- Marjan — chill / nature
- Technological Park — live event zone

Favorites daju korisniku razlog da se vraća u aplikaciju jer može pratiti kada njegova omiljena lokacija postane aktivna, kada se pojave novi Instants ili kada se promijeni pulse status.

---

## Favorite Collections

Korisnik može organizirati favorite u kolekcije.

Primjeri kolekcija:

### My Split Night Out

- Matejuška
- Basta
- Central
- Bačvice

### Coffee Spots

- D16 Coffee
- Kava2
- Teak
- 4coffee soul food

### Sunset List

- Matejuška
- Sustipan
- Marjan
- Zapadna obala

### Places To Show Friends

- Riva
- Dioklecijanova palača
- Marjan
- Bačvice
- Peristil

Ovo je korisno jer korisnik može planirati dan, spremati preporuke i dijeliti svoje liste s drugima.

---

## Social Sharing

SPLIT PULSE treba imati mogućnost dijeljenja sadržaja na društvene mreže.

Korisnik može dijeliti:

- lokaciju
- Instant
- heat map screenshot
- favorite listu
- svoju kolekciju favorita
- svoj daily pulse
- svoj streak
- lokaciju koja je trenutno trending
- AI preporuku
- plan za izlazak / dan u Splitu

Platforme za share:

- Instagram Story
- Instagram DM
- WhatsApp
- TikTok
- Snapchat
- X / Twitter
- Facebook
- Messenger
- copy link
- native mobile share sheet

Za MVP web aplikaciju dovoljno je imati:

- copy link
- Web Share API
- share card kao sliku
- share button na lokaciji
- share button na Instantu
- share button na favorite listi

---

## Share Cards

Kada korisnik dijeli lokaciju, Instant ili favorite listu, aplikacija može generirati vizualnu share karticu.

Primjer share kartice za lokaciju:

SPLIT PULSE

Riva is Trending 🔥

Live Pulse: High

Instants last 30 min: 14

See what is happening now

splitpulse.app/riva

---

Primjer share kartice za Instant:

SPLIT PULSE Instant

“Sunset at Matejuška is unreal right now.”

📍 Matejuška

Posted 4 min ago

Live Pulse: Rising

Open on SPLIT PULSE

---

Primjer share kartice za favorite listu:

My Split Sunset List 🌅

1. Matejuška
2. Sustipan
3. Marjan
4. Zapadna obala

Made on SPLIT PULSE

---

Primjer share kartice za streak:

🔥 5-day Pulse Streak

I helped people nearby 5 days in a row.

SPLIT PULSE

---

## Viral Loop

Social sharing je važan jer stvara prirodan viral loop.

Primjer flowa:

1. Korisnik vidi da je Riva trending.
2. Klikne share.
3. Podijeli story: “Riva is trending right now.”
4. Drugi korisnik otvori link.
5. Vidi heat map i Instants na toj lokaciji.
6. Objavi svoj Instant ili spremi lokaciju.
7. Time se povećava pulse lokacije.
8. Aplikacija se organski širi.

Drugi primjer:

1. Korisnik napravi favorite listu “Best sunset spots in Split”.
2. Podijeli listu na Instagram Story.
3. Prijatelji otvore listu.
4. Spreme lokacije u svoje favorite.
5. SPLIT PULSE postaje alat za dijeljenje lokalnih preporuka.

---

## Zašto je ovo bitno

Favorites i social sharing čine aplikaciju puno jačom jer korisnik više nije samo pasivni promatrač mape.

Korisnik može:

- spremati mjesta
- graditi svoje liste
- dijeliti preporuke
- pratiti omiljene lokacije
- pozivati druge da vide gdje se nešto događa
- širiti aplikaciju kroz društvene mreže

Ovo pretvara SPLIT PULSE iz obične live mape u social city platformu.

Glavna ideja:

SPLIT PULSE nije samo mjesto gdje vidiš što se događa.

SPLIT PULSE je mjesto gdje spremaš, dijeliš i gradiš svoj osobni puls grada.

---

## Kratka pitch verzija

Петя, [5/16/26 11:31 AM]
SPLIT PULSE korisnicima omogućuje da spremaju omiljene lokacije i dijele ih na društvene mreže kroz vizualne share kartice. Korisnik može podijeliti trending lokaciju, Instant, heat map screenshot, favorite listu ili svoj streak. Time aplikacija dobiva prirodan viral loop jer svaki share vodi nove korisnike natrag na live mapu i Instants.

---

## Jedna jaka rečenica

SPLIT PULSE lets users save their favorite places and share the live pulse of the city with friends.

Na hrvatskom:

SPLIT PULSE omogućuje korisnicima da spremaju omiljena mjesta i dijele živi puls grada s prijateljima.