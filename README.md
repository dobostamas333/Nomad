# Nomad 🌍 – országos fun factek, online multiplayer

GeoGuessr, csak országadatokkal: hány lakosa van Brazíliának? Mekkora Mongólia? Melyik országnak van
18 millió lakosa, 41 900 km² területe és 62 ezer USD egy főre jutó GDP-je?
Telefonra optimalizált, telepíthető webapp (PWA), magyar és angol nyelven.

## Játékmódok

| Mód | Mit csinálsz | Pontozás |
| --- | --- | --- |
| **Számtippelés** | Logaritmikus csúszkával (vagy pontos szám beírásával) megbecsülöd egy ország népességét, területét, GDP-jét… | A relatív hiba Gauss-görbéje: 1%-on belül 1000 pont, 2× eltérés ≈ 480, 10× ≈ 0 |
| **Melyik ország?** | 4 számadatból és a kontinensből kitalálod az országot | Helyes = 1000, rossz = távolság alapján max. 600 (a szomszéd ország is ér pontot) |
| **Vegyes** | A kettő felváltva | |

Multiplayer: privát szoba 4 betűs kóddal vagy meghívó linkkel (max. 12 fő). Mindenki egyszerre tippel, a
felfedésnél mindenki tippje látszik a skálán, majd jön a következő kör. A házigazda állítja a módot, a körök
számát (5/10/15), az időkorlátot (15–45 mp) és a nehézséget (ismert / haladó / mind a ~195 ország).

## Futtatás

```bash
npm install
npm run dev        # szerver :3001 + Vite :5173 (a telefonról is elérhető ugyanazon a Wi-Fin)
```

Éles mód:

```bash
npm run build
npm start          # http://localhost:3001 – a klienst is kiszolgálja
# vagy: docker build -t nomad . && docker run -p 3001:3001 nomad
```

### Deploy Renderre

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dobostamas333/Nomad)

A `render.yaml` Blueprint egy Docker alapú web service-t hoz létre (Frankfurt, ingyenes csomag), ami a klienst és a
Socket.IO szervert is kiszolgálja. Minden push után automatikusan újratelepül, ha a GitHub ellenőrzések zöldek –
így a heti adatfrissítés is magától kimegy.

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** (vagy a fenti gomb)
2. GitHub-fiók összekötése, a `dobostamas333/Nomad` repó kiválasztása
3. **Apply** – pár perc múlva él a `https://nomad-xxxx.onrender.com` cím

Az ingyenes csomag 15 perc tétlenség után elalszik: az első betöltés ilyenkor ~1 percig tart, és a futó szobák
egy újraindításkor elvesznek. Állandó működéshez a Starter csomag kell (`plan: starter` a `render.yaml`-ban).

Ellenőrzések: `npm run typecheck`, `npm test` (unit tesztek + egy teljes kétjátékos Socket.IO meccs).

## Adatforrások

A kérdésbank a `data/countries.json`, amit a `scripts/build-dataset.ts` állít elő:

1. **Wikidata** (a Wikipédia infoboxai mögötti strukturált adat) – elsődleges forrás: népesség, terület, GDP,
   egy főre jutó GDP, várható élettartam, legmagasabb pont, Wikipédia-linkek, ismertség (sitelinkek száma).
2. **World Bank Open Data** – kontroll: ha a Wikidata nagyon eltér (>1,5×), a World Bank értéke nyer, és a
   build naplózza az ütközést. Idősoroknál mindig a legfrissebb év nyer.
3. **mledoze/countries** – országlista, magyar/angol nevek, kontinens, koordináták.

```bash
npm run data              # minden elérhető forrást használ
npm run data -- --strict  # hibával leáll, ha a Wikidata vagy a World Bank API nem válaszol
```

A **Refresh dataset** GitHub Action minden hétfőn (és kézzel indítva) újraépíti az adatokat, lefuttatja a
teszteket, és commitolja az új adatot. A válaszfelfedésnél mindig látszik a forrás, az évszám és a
Wikipédia-cikk linkje.

## Architektúra

```
shared/    típusok, statisztika-definíciók, pontozás, Socket.IO protokoll (kliens és szerver közös)
server/    Express + Socket.IO; Room = autoritatív állapotgép (lobby → question → reveal → finished)
client/    React PWA (Vite), manifest + service worker
scripts/   adatbázis-építő (Wikidata, World Bank, mledoze források)
data/      a generált adatbázis
test/      Vitest
```

- A szerver autoritatív: a helyes válasz csak a felfedéskor jut el a kliensekhez, a pontozás a szerveren fut.
- Vendégjáték: csak becenév kell. Egy titkos token (`localStorage`) alapján újratöltés vagy szakadás után
  vissza lehet ülni a helyedre; ha a házigazda kiesik, 15 mp után a szerep továbbszáll.
- A `RoomManager` független attól, hogyan jön létre egy szoba, így a matchmaking is erre épülhet.

## Ütemterv

- [x] **M1 – Játszható privát szoba**: adatpipeline, PWA, valós idejű szoba, mindkét mechanika, HU/EN
- [ ] **M2 – Fiókok**: opcionális Google/Apple belépés, tartós profil és statisztikák
- [ ] **M3 – Nyilvános matchmaking**: várólista, gyors meccs idegenekkel (1v1 és csoportos)
- [ ] **M4 – Rangsorolt (ELO)**: pontszám, divíziók, szezonok, rangsorolt 1v1 párbaj (szerveroldali csalásvédelem)
- [ ] **M5 – Store app**: Capacitor csomagolás App Store / Google Play-re, push értesítések
- [ ] További tények: főváros, pénznem, szomszédok, közlekedési oldal, kézzel válogatott érdekességek
