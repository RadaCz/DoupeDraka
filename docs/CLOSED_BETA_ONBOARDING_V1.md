# Closed beta onboarding — 10–15 hráčů (V1)

**Baseline kódu:** `885ea4e` na `clean-main` (ověř `git rev-parse HEAD` před startem; CI run `42822949152` 4/4 SUCCESS).  
**Technický checklist (telefon):** [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md) · [`PHYSICAL_TELEGRAM_QA_V2.md`](PHYSICAL_TELEGRAM_QA_V2.md)  
**Herní protokol:** [`design/CHAPTER_ONE_PLAYTEST_V1.md`](../design/CHAPTER_ONE_PLAYTEST_V1.md)

Fyzické testy: **Android NOT TESTED** · **iOS NOT TESTED** (vyplní tester po běhu).

---

## 1. Facilitátor — před startem

| # | Úkol |
|---|------|
| F1 | Nasazená Mini App na **HTTPS** (`MINI_APP_URL` v botovi odpovídá produkci/staging). |
| F2 | API `/health` a `/ready` vrací OK; `alembic upgrade head` na produkční DB. |
| F3 | `LLM_PROVIDER=fallback` nebo jen Lite — **žádný** povinný placený Normal pro betu. |
| F4 | `BOT_TOKEN` a `BOT_API_TOKEN` pouze na serveru; **nikdy** v chatu s hráči. |
| F5 | Každému hráči **vlastní** Telegram účet / nová postava (žádné sdílení JWT). |
| F6 | Volitelný Normal test: facilitator top-up přes `POST /economy/topup` + `X-Admin-Token`, ne veřejný endpoint. |
| F7 | Výchozí tier u nových uživatelů: ověř **Lite** v Nastavení před prvním tahem. |

---

## 2. Tester — první 45–90 min

1. Otevři bota → **Play** / Mini App.
2. Vytvoř postavu (doporučeno: Human Fighter nebo Wizard) nebo quick hero.
3. Záložka **Hra**: první akce `search` / „prohledat“ — sleduj deník (příběh + mechanika).
4. Projdi záložky **Přehled → Hra → Postava → Více** (Mapa, Úkoly volitelně).
5. Pokračuj v questu zvonu dle vlastního tempa (viz playtest tabulka v CHAPTER_ONE_PLAYTEST).
6. Na konci odpověz na dotazník níže (žádné placené otázky).

---

## 3. Dotazník po session (hráč)

| Otázka | Odpověď |
|--------|---------|
| Chápal jsi výsledky hodů / boje? | ano / částečně / ne |
| Víš, co dělat dál v příběhu? | ano / ne |
| Kde ses ztratil nebo nudil? | volný text |
| Otevřel bys hru zase do týdne? | ano / možná / ne |
| Zařízení + OS | |
| Jazyk UI | CS / EN |

---

## 4. Záznam problémů

Pro každý bug: krok reprodukce, očekávané vs skutečné, screenshot, čas, postava.

---

## 5. Go / no-go (facilitátor)

| Kritérium | Ano? |
|-----------|------|
| Hra se otevře v Telegramu bez JS fatální chyby | |
| První tah dokončí stream / offline naraci | |
| Deník a postava po reloadu konzistentní | |
| Lite hratelné bez kreditů | |
| Min. 8/10 testerů „chápu, co dělat“ | |

**Doporučení:** go k širší betě jen po **PASS** fyzického QA na Android **a** iOS (alespoň 1 zařízení každé).
