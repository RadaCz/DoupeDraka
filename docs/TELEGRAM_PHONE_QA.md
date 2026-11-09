# Telegram Mini App — telefonní QA (Etapa 6)

Otestuj na **Android** a **iOS** v oficiálním Telegramu (ne jen prohlížeč).

**Kódová baseline (audit):** `17ae9d2` (`clean-main`), obsah P3 narrátora `b7f1315`, CI lifecycle `ec646fc`.  
**Stav tohoto dokumentu:** šablona pro reálný playtest — sloupce níže jsou **prázdné**, dokud tester nevyplní výsledek na zařízení.

## Před testem

- Bot má nastavené `MINI_APP_URL` a Web App tlačítko v BotFather.
- API běží s platným `BOT_TOKEN` (po rotaci).
- Facilitátor: výchozí **Lite** pro closed beta; **Normal** jen pokud je nakonfigurovaný placený LLM provider (viz `tests/test_billing_contract.py`).
- Pro testy Normal s kredity: facilitator `POST /economy/topup` s `X-Admin-Token` (`ADMIN_API_KEY`) — ne pro hráče, jen pro přípravu účtu.
- Screenshoty u bugů: čas, platforma (Android/iOS), `git rev-parse --short HEAD`.

## Platformy (hodnotit zvlášť)

| Platforma | Stav | Tester | Datum | Build (short SHA) | Poznámka |
|-----------|------|--------|-------|-------------------|----------|
| Android | **NOT TESTED** | | | | |
| iOS | **NOT TESTED** | | | | |

Jeden úspěšný běh na Androidu **ne** znamená PASS na iOS.

## Scénáře — společná miniapka

| # | Scénář | Očekávání | Android | iOS |
|---|--------|-----------|---------|-----|
| 1 | `/start` → Otevřít DoupeDraka | Mini App se načte, Telegram theme, `WebApp.ready()` | | |
| 2 | Vytvoření postavy | Wizard dokončí, uloží se aktivní postava | | |
| 3 | Tah + MainButton | MainButton jednou odešle; po chybě retry se stejným idempotency klíčem (`pendingTurn`) | | |
| 5 | Klávesnice | Input nezakrývá composer; safe-area OK (`viewport-fit=cover`) | | |
| 6 | CS jazyk | Chips a UI česky; engine řádky mohou být EN | | |
| 7 | Mapa / quest | 9 uzlů (6 hlavních + 3 vedlejší); vault hint → Caldus po zvonu | | |
| 8 | Fallen + revive | 409 fallen, revive obnoví hru | | |
| 9 | Inventář → Equip / lektvar | Character → inventář → Equip nebo Use potion; stav po reload | | |
| 10 | Deník po tahu | Akce / vyprávění / mechanika vizuálně oddělené (P3 journal) | | |
| 11 | Boj | Banner „Tvůj tah“; HP nepřítele; ⚡ ≠ mana kouzel | | |

Vyplňuj **PASS** / **FAIL** / **BLOCKED** / **NOT TESTED** — nikoli předem.

## Scénáře — Lite vs Normal a SSE (povinné na telefonu)

Backend refund při přerušení placené narace je pokryt testem `tests/test_stream_cancellation.py` (simulace `CancelledError`). **To není náhrada** za chování Telegram WebView.

| # | Scénář | Očekávání | Android | iOS |
|---|--------|-----------|---------|-----|
| N1 | **Normal** + dostupný provider | Tier Normal v Settings, tah dokončí, `narration_status` narrated, ⚡ klesne podle tieru | | |
| N2 | **Normal** bez dostupného providera | Efektivní tier downshift (offline/fallback), žádná „tichá“ ztráta tahu | | |
| N3 | Přerušení streamu během generování | Tah v deníku zachován; u Normal refund ⚡ pokud narace nedokončena (backend); UI recovery / refresh | | |
| N4 | Znovuotevření Mini App po přerušení | Pending turn hint; retry se stejným klíčem; žádný dvojitý commit | | |
| N5 | Kontrola idempotence | Stejná akce po recovery neprovede mechaniku dvakrát | | |
| N6 | Konečný zůstatek ⚡ | Shodný s headerem a Settings po N1–N5 | | |

Scénář **4** (zavření během SSE) v původní tabulce = kombinace **N3–N6** — vyhodnoť explicitně na obou platformách.

## Automatické vs ruční důkazy

| Oblast | AUTO (CI/lokálně) | CODE | PHONE |
|--------|-------------------|------|-------|
| Telegram `initData` HMAC | `tests/test_telegram_auth.py` | `app/auth/telegram.py` | 1 |
| Idempotency / pending | Vitest `pendingTurn.test.ts` | `frontend/src/pendingTurn.ts` | 3, N4–N5 |
| Journal merge P3 | Vitest `journalFormat.test.ts` | `journalFormat.ts` | 10 |
| Lite/Normal billing | `test_billing_contract.py` | `app/narrator.py`, gateway | N1–N2 |
| SSE cancel + refund | `test_stream_cancellation.py` | `app/api.py` `reconcile_narrator_billing` | N3–N6 |
| MainButton / Back | Vitest `telegramWebApp.test.ts` | `telegramWebApp.ts` | 3, navigace |

- Funkční E2E: `npm run test:e2e` (syntetické `initData`, ne Telegram).
- Postgres migrace v005: v CI jobu `backend-postgres` (lokálně jen s `PYTEST_DATABASE_URL`).

## Poznámky

- Closed beta: výchozí **Lite**; **Pro** blokováno v economy.
- Nová postava při `cs` UI dostane `narration_language=cs` (lze změnit v Settings).
- ⚡ = **kredity vypravěče**, ne mana kouzel ani pay-to-win.
