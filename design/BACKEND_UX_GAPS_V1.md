# Backend UX gaps V1

Frontend redesign nesmí vymýšlet data. Tyto položky vyžadují engine/API práci před „plnou“ mapou/deníkem/referral.

## Map

| Gap | Dnes | Návrh |
|-----|------|--------|
| Souřadnice uzlů | `CHAPTER_ONE_LAYOUT` v TS | `locations[].map { x, y, emoji? }` v `GET /reference` |
| Quest highlight | pouze text v `QuestPanel` | `active_quest_locations: string[]` z engine quest resolveru |
| Fog rules | duplikace `travel_allowed` + `mapNodeState` | `GET /characters/{id}/map` — computed visibility |

## Journal

| Gap | Dnes | Návrh |
|-----|------|--------|
| Kategorie beatů | client heuristika `journalCategories.ts` | optional `event_kind` enum při persist (`story`, `combat`, `quest`, `loot`) |
| Dedupe id | client merge | server idempotency na journal insert (již částečně přes turn receipt) |

## Referral

| Gap | Dnes | Návrh |
|-----|------|--------|
| Invite attribution | `?startapp=invite` bez trackingu | bot handler + `users.referred_by` (migrace) — **mimo scope** dokud není produktové rozhodnutí |
| Odměny | žádné | explicitně deferred v ROADMAP |

## Spells

| Gap | Dnes | Návrh |
|-----|------|--------|
| „Moje kouzla“ API | character payload | `GET /characters/{id}/spells` — known + prepared + can_cast |
| Learn spell | level-up / engine events only | dokumentovat; žádný UI „learn“ bez intentu |

## Bez změny schématu (okamžitě)

- Quest next step z `quest_flags` + `quest_catalog` — již v `/reference`  
- Travel — `travel to {location}` — engine  
- Tier gating — `/economy` — hotovo  
