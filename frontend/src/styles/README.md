# Frontend styles

| File | Role |
|------|------|
| `fonts.css` | Google Fonts (Manrope, DM Mono, Literata, Source Serif 4) |
| `theme-dark.css` | Telegram-first semantic tokens (`--surface`, `--accent-verb`, …) |
| `polish.css` | Hub, wizard, map/quest, character/settings overrides (phases 2–4) |
| `play.css` | Play-screen deltas (imported from `styles.css`) |
| `styles.css` | Legacy monolith — migrate sections into modules over time |
| `tokens.css` | Deferred parchment theme (`design/direction.md`) |

Import order is defined at the top of `styles.css`.
