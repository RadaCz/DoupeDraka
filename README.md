# Solo D&D 5e — základ hry

Asynchronní sólová textová hra pro Telegram. AI je pouze vypravěč: hody, útoky,
zranění, HP a mana provádí deterministický Python engine.

## Projektová dokumentace

- [Project brain](./PROJECT_BRAIN.md) — aktuální stav a invarianty.
- [Roadmap](./ROADMAP.md) · [Decision log](./DECISIONS.md) · [session history](./CHANGELOG.md).
- Technické příručky: [architecture](./docs/ARCHITECTURE.md), [engine](./docs/ENGINE.md),
  [campaign content](./docs/CONTENT.md), [deployment](./docs/DEPLOYMENT.md).

## Interface languages

The Mini App uses English by default. Open **Settings → Language** to switch to
Czech (without diacritics); the choice is saved in this browser. UI controls and
guided character creation are localized. Rule-reference names and game-generated
journal text may still appear in English.

## Hotovo

- 12 tříd s jednou subclassou ze SRD 5.1 pro každou a 9 ras;
- postava s HP, manou, inventářem a postupem (XP → level-up);
- hody, útoky, zranění, iniciativa a odpověď nepřítele;
- obtížnost (easy/normal/hard) škáluje HP, AC, útok, zranění i odměnu XP;
- katalog nestvůr, čtveřice hotových hrdinů a pravidla pro tooltipy (rasy, třídy, subclassy, dračí původ);
- katalog SRD 5.1: 319 kouzel, feat Grappler a background Acolyte;
- MVP kouzlení pro 8 sesílacích tříd: třídní seznamy triků a kouzel 1. úrovně,
  naučená/připravená kouzla, sloty a omezený počet skutečných efektů;
- nástroje: kalkulačka vyvážení střetu podle XP prahů a referenční katalog kouzel;
- herní měna Adventure Mana (⚡) v celých desetinách; nový účet dostane 100,0 ⚡,
  Lite tahy jsou zdarma a placené tiery mají pevnou cenu;
- REST API, aiogram botové handlery a persistentní deník;
- AI hranice: narátor dostává výsledek engine a vrací jen prózu;
- postupné streamování narace přes SSE po uložení tahu;
- Telegram Mini App s pěti záložkami: Home, Tools, Character, Campaign a Settings;
  tvorba postavy, hraní s uloženým deníkem, přehled postavy, nastavení kampaně,
  knihovna kouzel a plánovač střetů.

### Co je ve hře skutečně podporované

Průvodce umožňuje vybrat hotového hrdinu nebo vytvořit postavu výběrem rasy a třídy.
Engine přiděluje základní statistiky a vybavení. Podtřídy, backgroundy a featy jsou
zatím pouze referenční katalog — jejich výběr ani mechanické efekty nejsou implementované.
Hra ukládá naučená nebo připravená kouzla pro barda, klerika, druida, paladina,
hraničáře, čaroděje, kouzelníka a warlocka. Sloty se řídí postupem plné, poloviční nebo
paktové magie; paladin a hraničář získají první sloty na 2. úrovni. Level-up přidá HP
podle třídní kostky životů a opravy Odolnosti, nové sloty a naučená/připravená kouzla;
za jeden tah se postava posune nejvýše o jednu úroveň. Vyšší úrovně kouzel se
zpřístupní až při odpovídající úrovni sesílání (plní sesilatelé od 3. úrovně postavy).
Odpočinek mimo boj obnoví HP na maximum a všechny spell sloty zdarma; v boji je
odmítnut a odpočinek při plných zdrojích je bezplatný no-op. Herní obrazovka ukazuje
dostupná kouzla aktivní postavy a aktuální/maximální sloty. Sloty se nespotřebovávají za
Adventure Mana ani za herní manu.

Skutečný efekt mají pouze tato kouzla:

- **Fire Bolt** a **Eldritch Blast**: útok na cíl a poškození;
- **Sacred Flame**: záchrana Obratností, při úspěchu žádné poškození;
- **Vicious Mockery**: záchrana Moudrostí a poškození; nevýhoda na další útok se
  pouze označí ve faktech a zatím se mechanicky neaplikuje;
- **Magic Missile**: tři automaticky zasahující šipky;
- **Burning Hands**: záchrana Obratností, při úspěchu poloviční poškození;
- **Cure Wounds**: léčení `1k8 + modifikátor sesílací vlastnosti`;
- **Healing Word**: léčení `1k4 + modifikátor sesílací vlastnosti`. SRD z něj dělá
  bonusovou akci, ale toto MVP ho řeší jako hlavní akci.
- **Scorching Ray** (2. úroveň): tři samostatné útoky, každý za `2k6` poškození;
- **Misty Step** (2. úroveň): při aktivním boji ukončí střet jako útěk; mimo boj není
  cíl přesunu modelován, takže kouzlo neodečte slot;
- **Invisibility** (2. úroveň): nastaví stav neviditelnosti, který skončí při útoku nebo
  seslání jiného kouzla. Neviditelnost zatím nemění útoky nepřátel ani další mechaniky.

Záchranné a plošné efekty se v současném souboji vyhodnocují pouze proti jednomu cíli.

Ostatní naučená či připravená kouzla jsou rozpoznána, ale jejich efekt není
modelován: hra oznámí omezení a slot nespotřebuje. Některé efekty jsou záměrně
zjednodušené (např. plošná a záchranná kouzla se vyhodnotí proti jedinému nepříteli);
plná délka trvání, koncentrace, bonusové akce a všechny navazující podmínky nejsou
implementované. Level-up přidává sloty a vybírá nová kouzla, ale kompletní pravidla
postupu všech povolání nad 2. úroveň postavy a celý katalog kouzel vyšších úrovní
zůstávají nedokončené. Úplný SRD katalog zůstává samostatnou referencí.

Průzkum (`explore`, `search`, `look around`, `travel` a české varianty) provádí
samostatný náhodný hod šestistěnnou kostkou: při výsledku 1 se objeví nepřítel odpovídající úrovni
postavy a nastavené obtížnosti; další výsledky mohou odhalit stopy nebo náhodně 1 až 4 zlaťáky.
Po boji nebo útěku je následující průzkum zaručeně bezpečný. Při průzkumu během boje
nelze přeskočit protivníka.
V boji se objevený nepřítel zatím nevrhne na postavu okamžitě — hráč dostane možnost
zvolit další akci. Herní obrazovka zobrazuje zdraví a obranu aktivního protivníka a
kontextové rychlé akce se mění podle boje, zranění a posledního objevu. Mimo boj se
nenabízí útok ani zbytečný odpočinek při plném zdraví. Kampaň (kapitola jedna) propojuje
šest lokací včetně The Vault of Echoes a The Bell Warden's Pit. Cesta do trezoru a jámy
je uzamčená, dokud Caldus po odevzdání zvonu neodhalí trasu (`vault_unlocked`).
Hráč cestuje jen do sousední otevřené lokace; každá má vlastní setkání a stopy.
První návštěva přidá krátký beat (Mara, Caldus, Nib). Úkol: přijmout u Calduse, získat
zvon od Niba, vrátit ho, projít vault, porazit Bell Wardena (`chapter_one_complete`).
Akce směruje parser `ActionIntent` v enginu (útok, kouzlo, mluvení, pohyb atd.);
negace typu „nechci zaútočit“ nespustí boj. Obecný dialog NPC mimo tyto questy zatím
není implementovaný.

Volné akce jako `inspect the door`, `sneak past the guard` nebo `persuade the guard`
vyhodnocují hod vlastnosti odpovídající záměru (Intelligence, Dexterity, Charisma atd.),
nikoli vždy stejný hod na Obratnost. V Mini App jsou příklady vlastností zobrazeny pod
herním vstupem.

Combat balance kalkulačka je oddělená plánovací pomůcka: odhaduje obtížnost ručně
zvolených nestvůr podle XP prahů 5e, ale sama nezačne souboj ani nehází náhodné
setkání.

AI je **vypravěč**: převádí pevně vyhodnocené výsledky enginu na prózu. Nerozhoduje o
hodech, poškození ani pravidlech. Změna kvality vypravěče mění modelový tier, ne pravidla.
Ve výchozí konfiguraci (`LLM_PROVIDER=fallback`) neběží jazykový model; hru rámuje
vestavěný offline vypravěč. AI próza je dostupná po nastavení `LLM_PROVIDER=ollama` a
spuštění Ollama. Tah se uloží před začátkem streamování prózy; Mini App ji postupně
zobrazuje a při chybě modelu použije offline fallback. Lite stojí 0,0 ⚡, Normal 1,0 ⚡
za zpoplatněný změněný tah; tier Pro je v této verzi vypnutý (až do OpenRouter adapteru).
Nové účty začínají se 100,0 ⚡; stávající
zůstatky se automaticky nemění. Tahy bez změny stavu a dlouhý odpočinek jsou zdarma.
Placené dobíjení přes Telegram Stars nebo jinou platební bránu není zapojené; mana na
účtu se zobrazuje, ale skutečné nákupy nejsou dostupné.

## Lokální spuštění

### Nejrychlejší hra bez instalace

Python 3.11+ stačí pro malou lokální textovou ukázku:

```powershell
cd D:\DoupeDraka
python -m app.play
```

Vytvoří se nabídka hotových hrdinů (tank, skirmisher, support, healer) nebo
vlastní postava, poté volba obtížnosti. Hraje se příkazy `attack`, `cast`,
`flee`, `rest`, `travel to <connected location>` a `/sheet`, `/spells`, `/bestiary`,
`/tools`, `/settings`.
`cast <spell> [at target]` sesílá dostupná modelovaná kouzla; nepodporované efekty
slot nespotřebují. `/sheet` zobrazuje kouzla a sloty.
Každý tah, který nic nezměnil, je zdarma.
Příkaz `/quit` hru ukončí.

### API, bot a Mini App

Pro tento plný vývojový režim jsou nutné Python 3.11+ a Node.js 20+ (LTS).

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.api:app --reload
```

API poběží na `http://127.0.0.1:8000/docs`.

Mini App ověřuje uživatele přes Telegram `initData` a vyžaduje nastavený
`BOT_TOKEN`. Přímé API účty nadále používají registrační a přihlašovací endpointy
uvedené níže.

**Ověření:** Pro přístup k API potřebujete token. Vytvořte účet přes `POST /auth/register` s tělesem `{"username":"...","password":"..."}` a přihlaste se přes `POST /auth/login` se stejným datem. Oba endpointy vrátí token, který použijte v hlavičce `Authorization: Bearer <token>`.

Pro bota doplňte `BOT_TOKEN` a `BOT_API_TOKEN` (token pro bota, který získáte po registraci a přihlášení) a spusťte `python -m app.bot`.

### Browser end-to-end tests

The Playwright suite starts an isolated FastAPI server with a temporary SQLite
database and a Vite frontend. It uses synthetic, correctly signed Telegram
`initData`; no real bot token or Telegram account is needed.

```powershell
cd D:\DoupeDraka\frontend
npm install
npx playwright install chromium
npm run test:e2e
```

The tests cover the outside-Telegram auth gate and a full browser journey:
Telegram sign-in, custom character creation, a real engine action and journal
restoration after reload. The E2E API uses port 8001 and Vite uses 5174 so the
usual local development ports remain untouched. Its runner removes the isolated
temporary database after both test servers have shut down.

### Ověření backendu

```powershell
cd D:\DoupeDraka
python -m pytest -q
```

Aktuální baseline: **223** pytest; frontend **18** Vitest. CI na větvi `clean-main` spouští
navíc Postgres migrace a Playwright (viz [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

### Lokální AI přes Ollama

Nainstalujte Ollama, stáhněte jeden model a spusťte ji (výchozí API je
`http://127.0.0.1:11434`). Například:

```powershell
ollama pull qwen2.5:7b
ollama serve
```

V `.env` nastavte `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5:7b` a restartujte
backend. Pokud Ollama nebo zvolený model neběží, hra se nezastaví: použije lokální
deterministický textový fallback.

**Databázové migrace:** Po aktualizaci modelu stačí spustit `alembic upgrade head`. Pro vytvoření nové migrace použijte `alembic revision --autogenerate -m "Popis"`.

Pro PostgreSQL nastavte `DATABASE_URL` ve tvaru
`postgresql+asyncpg://user:password@host:5432/database` a spusťte
`alembic upgrade head` se stejnou proměnnou prostředí před spuštěním API.
Databázový soubor ani databázové přihlašovací údaje nejsou součástí image.

V druhém PowerShellu spusťte Mini App:

```powershell
cd D:\DoupeDraka\frontend
npm install
npm run dev
```

Vite proxy předává `/api/*` backendu na stejném počítači, takže nedochází ke
konfliktu adresy `localhost` při otevření aplikace v telefonu.

**Náhled na tomto počítači:** otevři `http://localhost:5173`. Zobrazí se obrazovka
vyžadující Telegram — to je očekávané, protože aplikace odmítá přihlášení mimo
Telegram. Lokální SQLite a API běží bez Dockeru/PostgreSQL.

**Hraní v Telegramu (odpovídá pohledu hráče):**

1. Do kořenového `.env` vlož platný `BOT_TOKEN` od BotFather a spusť API výše.
   Token nikomu neposílej a nevkládej ho do URL.
2. Spusť `npm run dev` ve `frontend` a nech oba procesy běžet.
3. V dalším PowerShellu spusť ngrok na frontend: `ngrok http 5173`. Zkopíruj
   přidělenou HTTPS adresu; její hostname bude například
   `abc123.ngrok-free.dev`.
4. V `frontend` uprav lokální soubor **`.env`**, nikoli `.env.example`.
   `.env.example` je pouze šablona a Vite ji nenačítá. Do `.env` nastav
   `NGROK_HOST=abc123.ngrok-free.dev` — pouze hostname, bez `https://` a bez
   koncového lomítka. Restartuj Vite, aby načetl povolený hostname.
5. V BotFather nastav tlačítko Mini App (např. `/setmenubutton`) na HTTPS adresu
   pro svého bota. V Telegramu otevři chat s botem a stiskni tlačítko — obyčejné
   otevření URL v prohlížeči `initData` neposkytne.
6. Backend ověří Telegram `initData` pomocí `BOT_TOKEN`; přes stejnou HTTPS adresu
   se API požadavky bezpečně proxyují zpět na lokální server.

Tímto zveřejníš svůj vývojový frontend přes tunel. Používej dočasnou adresu jen
pro vlastní testování, nesdílej ji a po hraní tunel ukonči. Hráč po přihlášení
vytvoří postavu a po obnovení Mini App se aktivní postava obnoví.

## Docker

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Doplňte BOT_TOKEN a BOT_API_TOKEN; databáze zůstává mimo image.
docker compose up --build
```

API: http://localhost:8000
Frontend: http://localhost:5173

## Architektura

`app/engine/` nikdy nevolá LLM. Orchestrátor nejprve vyhodnotí a uloží tah a až
poté předá neměnný kontext narátorovi. Model tak nemůže měnit herní stav.

### Placená měna vs. spell pool

Kouzla používají pravidlové sloty postavy (`spell_slots`), nikoli
`CharacterState.mana`. Placené tahy se odečítají z `users.energy_tenths` (celé
desetiny, žádné floaty) a každý pohyb se zapisuje do tabulky `energy_transactions`.
Adventure Mana, spell sloty a historická mana postavy jsou oddělené zdroje.

### Doplňování many

`POST /economy/topup` je záměrně zamčené na `ADMIN_TOKEN`. Bez nastaveného tokenu
vrátí 403. Reálné platební brány (YooMoney, Telegram Stars) tu nejsou zapojené:
zapnutí peněz je rozhodnutí při nasazení, ne výchozí stav kódu.

### Nové endpointy

- `GET /characters` — postavy přihlášeného uživatele (nejnověji změněné první)
- `POST /characters/{id}/actions/stream` — provede a uloží tah, poté posílá naraci jako SSE
- `GET /characters/presets`, `POST /characters/presets/{key}` — hotoví hrdinové
- `PATCH /characters/{id}/settings` — obtížnost, tón, humor, délka prózy
- `GET /reference`, `GET /reference/spells` — tooltipy, feat/background a knihovna kouzel
- `POST /tools/combat-calculator` — obtížnost střetu podle 5e
- `GET /economy`, `POST /economy/topup` — zůstatek, tiery, balíčky

Na tierech Normal a Pro dostane hráč bez dostatku Adventure Many při změněném tahu
**402 Payment Required**; Lite je zdarma.

## Licence a atribuce

Katalog pravidel používá materiál ze SRD 5.1 pod licencí CC BY 4.0. Kouzla,
feat Grappler, background Acolyte a subclass data vycházejí z oficiálního SRD;
API nabízí stručný text kouzel a další katalogová metadata.

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.
