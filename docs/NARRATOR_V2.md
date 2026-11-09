# Narrator V2 (P2) — kvalita vypravěče a paměť

**Baseline commit (P1):** `2e55059` · **Branch:** `clean-main`

## Co bylo špatně / matoucí (P1)

| Oblast | Problém |
|--------|---------|
| Paměť | `memory_summary` se plnil mechanickými `events` každý tah — duplicita s journalem a promptem. |
| Krátká vs dlouhá | Dlouhodobá paměť byla i v `Previous beats` i v system promptu. |
| Archivace | `summarize_entries` mohla volat placený/externí LLM gateway. |
| TALK | Engine vrací jen Charisma check — narrator spoléhal na dossier NPC. |
| NPC | Chyběla osobnost / hlas / motivace. |
| Styl | Málo scénického řízení, málo anti-repeat, slabší CZ instrukce. |

## P2 řešení

### Paměť (kanonické)

- **Krátkodobá:** poslední prose beats z journalu (`narration_beats_from_journal`), max ~5, bez mechanických řádků.
- **Dlouhodobá:** `effective_long_term_memory()` — primárně `long_term_memory`; legacy `memory_summary` jen při prázdném LTM (bez ztráty starých postav).
- Už **nepřidáváme** mechanické řádky do `memory_summary` po tahu.
- Archivace journalu: **jen heuristika** (prose beats), žádný LLM.
- Revive zapisuje do `long_term_memory` via `merge_long_term_memory`.

### Vypravěč

- `scene_kind` z `infer_scene_kind` (talk / combat / explore / travel / rest / story_moment).
- System prompt: variety rule, scénové direktivy, CZ natural prose.
- User prompt: `Scene kind`, dossier, facts, previous beats (bez LTM duplicity).

### NPC & lokace

- Caldus, Nib, Mara: personality, temperament, motivation, voice, `relationship_to_hero` podle flagů.
- Lokace: `first_visit_here`, `times_visited`, `familiarity` při návratu.

## Neměnné hranice (zachováno)

Engine authority, commit → narrate → billing, Lite/Normal/Strict, žádné nové mechaniky.

## Otevřené (P3+)

- Dynamické NPC vztahy v DB.
- Offline šablony rozšířené o scene_kind.
- Journal UI oddělení story vs mechanics (frontend).
