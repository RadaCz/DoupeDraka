# E2E (Playwright)

## Spuštění

```powershell
cd D:\DoupeDraka\frontend
npm run test:e2e
```

`e2e/run-tests.mjs` **nestahuje** browsery — pouze spustí `playwright test` s dočasnou E2E SQLite DB.

## Instalace browseru (jednou na stroji)

```powershell
cd D:\DoupeDraka\frontend
npx playwright install chromium
```

CI (`/.github/workflows/ci.yml`) volá totéž v jobu `e2e`.

## Kde leží cache (Windows)

| Prostředí | Typická cesta |
|-----------|----------------|
| Běžný shell / npm | `%USERPROFILE%\AppData\Local\ms-playwright` |
| Cursor sandbox (agent) | `%LOCALAPPDATA%\Temp\cursor-sandbox-cache\<id>\playwright\` |

Pokud agent hlásí `Executable doesn't exist at ... cursor-sandbox-cache ...`, je to **izolované sandbox prostředí**, ne chyba `test:e2e`. Řešení: v tom prostředí jednou `npx playwright install chromium`, nebo spouštět E2E mimo sandbox.

Proměnná `PLAYWRIGHT_BROWSERS_PATH` může cache přesměrovat; **nemaž** ji bez důvodu.

## Konfigurace

- `e2e/playwright.config.ts` — iPhone 13 viewport, jeden worker, lokální API + Vite dev server.
- Visual baseline: `npm run test:e2e:visual` (`E2E_SUITE=visual`).
