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
| 4   | Zavření během SSE             | Po reopen pending nebo journal odpovídá commitu (žádný dvojitý tah) | pass        |
| 5   | Klávesnice                    | Input nezakrývá composer; safe-area OK                              | pass        |
| 6   | CS jazyk                      | Chips a UI česky; engine řádky mohou být EN                         | pass        |
| 7   | Mapa / quest                  | 9 uzlů, hlavní quest viditelný                                      | pass        |
| 8   | Fallen + revive               | 409 fallen, revive obnoví hru                                       | pass        |

## Poznámky z posledního playtestu

- Mixed CS UI + EN engine/LLM — sledovat `narration_language` a offline CS.
- Screenshoty ukládat k bugům s časem a buildem (`git rev-parse --short HEAD`).
