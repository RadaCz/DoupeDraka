# Telegram Mini App — telefonní QA (Etapa 6)

Otestuj na **Android** i **iOS** v oficiálním Telegramu (ne jen prohlížeč).

## Před testem

- Bot má nastavené `MINI_APP_URL` a Web App tlačítko v BotFather.
- API běží s platným `BOT_TOKEN` (po rotaci).

## Scénáře

| #   | Scénář                        | Očekávání                                                           | PASS / FAIL |
| --- | ----------------------------- | ------------------------------------------------------------------- | ----------- |
| 1   | `/start` → Otevřít DoupeDraka | Mini App se načte, Telegram theme                                   | pass        |
| 2   | Vytvoření postavy             | Wizard dokončí, uloží se aktivní postava                            | pass        |
| 3   | Tah + MainButton              | MainButton jednou odešle; po chybě Try again se stejným klíčem      | pass        |
| 4   | Zavření během SSE             | Tah zůstane v deníku; ⚡ refund při nedokončené placené naraci (Normal); žádný dvojitý tah | manual      |
| 5   | Klávesnice                    | Input nezakrývá composer; safe-area OK                              | pass        |
| 6   | CS jazyk                      | Chips a UI česky; engine řádky mohou být EN                         | pass        |
| 7   | Mapa / quest                  | 9 uzlů (6 hlavních + 3 vedlejší); vault hint → Caldus po zvonu       | manual      |
| 8   | Fallen + revive               | 409 fallen, revive obnoví hru                                       | pass        |

## Poznámky z posledního playtestu

- Closed beta: výchozí **Lite** (offline vypravěč); **Normal** jen s externím providerem.
- Nová postava při `cs` UI dostane `narration_language=cs` (lze změnit v Settings).
- ⚡ = **kredity vypravěče**, ne mana kouzel ani pay-to-win.
- Automatické testy: funkční E2E 7, visual volitelně `npm run test:e2e:visual`; Postgres migrace v005 v CI.
- Telefonní PASS/FAIL v tabulce výše zůstávají **ruční** až do reálného playtestu.
- Screenshoty ukládat k bugům s časem a buildem (`git rev-parse --short HEAD`).
