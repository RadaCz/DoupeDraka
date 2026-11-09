# Narrator V1 — audit, kontrakty, closed-beta

**Repo:** `RadaCz/DoupeDraka` · **Branch:** `clean-main` · **P1 shipped:** `2e55059`  
**P2 kvalita vypravěče:** viz `NARRATOR_V2.md`

## Neměnná pravidla

Engine rozhoduje o mechanice; narrator jen prose po commitu. Lite = vždy offline. Normal = placená externí narrace (`narrated`); při `fallback` / `offline` na Normal tier → refund ⚡. Pro vypnuto. ⚡ ≠ API token; API usage je samostatná telemetrie.

## P1 — hotové v kódu

| Oblast | Stav |
|--------|------|
| Turn pipeline | Commit → journal fallback → narrace / SSE → `reconcile_narrator_billing` |
| Scene dossier | HRo, lokace, questy, boj, **NPC presence** (flag-gated) |
| Paměť promptu | Prose beats z journalu (bez duplicitních engine řádků) |
| Delivery telemetrie | `llm_narration`, `turn_billing`: `provider`, `model` |
| Usage telemetrie | `llm_provider_usage`: tokeny jen pokud API vrátí usage, latence |
| **PAID_NARRATION_STRICT** | První externí provider v řetězci; selhání → offline, ne další API |
| NVIDIA env | `NVIDIA_*` + alias `NVIDIA_NIM_*` |
| Gateway fallback log | `llm_fallback_triggered` + `error_kind` |

## NVIDIA-only closed beta

`LLM_PROVIDER_CHAIN=nvidia` sám o sobě **nepoužije Groq**, pokud je v chain jen `nvidia`. Pokud je v `.env` nastaveno `nvidia,groq,...`, bez strict režimu gateway po 429 zkusí Groq.

Pro experiment **doporučeno obojí**:

```powershell
$env:LLM_PROVIDER = "auto"
$env:LLM_PROVIDER_CHAIN = "nvidia"
$env:PAID_NARRATION_STRICT = "1"
$env:NVIDIA_API_KEY = "<pouze backend>"
$env:NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
$env:NVIDIA_MODEL = "meta/llama-3.1-8b-instruct"
# Volitelná latence / timeout
$env:LLM_READ_TIMEOUT_S = "120"
```

### Význam `PAID_NARRATION_STRICT=1`

- `paid_narration_gateway_for` bere **jen první** nakonfigurovaný externí provider.
- Gateway při chybě **nezkouší** další externí providery (Groq, Cerebras, …).
- Offline fallback zůstává; `narration_status` = `fallback` (ne `narrated`) → **refund ⚡**.
- Lite beze změny (`offline`).
- Při `PAID_NARRATION_STRICT=0` (default) zůstává původní řetězení providerů.

### Placená AI vs offline fallback

| Stav | `narration_status` | Provider v telemetrii | ⚡ |
|------|-------------------|----------------------|-----|
| Externí API doručilo text | `narrated` | např. `NVIDIA NIM` | −1.0 při Normal |
| Externí selhalo → offline | `fallback` | `offline` + `provider_request_status=offline_fallback` | refund |
| Lite | `offline` | `offline` | 0 |

## Usage telemetry (`llm_provider_usage`)

Event obsahuje (když je k dispozici):

- `provider`, `model`, `narration_status`, `delivered_to_player`
- `latency_ms`
- `prompt_tokens`, `completion_tokens`, `total_tokens` — **jen z API**, jinak chybí
- `provider_request_status` (`success`, `offline_fallback`, …)
- `fallback_reason` (např. `NVIDIA NIM_failed`)

**Nelze odvodit** cenu v Kč/USD bez explicitního ceníku modelu (zatím neimplementováno). Žádné logování API klíčů.

### Limity providerů

- Non-stream `usage` v JSON odpovědi.
- Stream: `stream_options.include_usage` jen u známých OpenAI-kompatibilních jmen (`nvidia`, `groq`, …); provider bez usage → OK, žádné odhady.
- Ollama / offline: bez token usage.

## NPC dossier (`engine/npc_presence.py`)

Datová mezera v enginu: **žádný** plný NPC stav v DB — minimální chapter-one profily jsou statické, odemčení přes `quest_flags`.

Do `scene_dossier.npcs_present`:

- Caldus (Shrine), Nib (Market), Mara (Sunken Corridor)
- `knows` jen veřejná fakta + `facts_when_all` podle flagů
- `does_not_know` např. Vault před `vault_hint_given`, bell motive u Niba před `bell_quest_accepted`

Model smí popisovat, ale **nesmí** vymýšlet herní výsledky.

## P3 — compare scénáře Lite vs Normal

Stejný engine, stejné akce; měřit prose, latenci, `llm_provider_usage`, refund rate.

(Viz tabulka scénářů v předchozí verzi dokumentu — průzkum, NPC, boj, quest, …)

## Otevřené (P2+)

- Ceny modelů vs API usage
- Bohatší NPC state v engine (ne jen quest_flags)
- Sjednocení `memory_summary` / `long_term_memory`
- UI oddělení story vs mechanism footer
