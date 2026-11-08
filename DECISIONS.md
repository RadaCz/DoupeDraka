# Decisions of Record

| # | Decision | Rationale |
|---|---|---|
| D1 | Engine owns all mechanics; LLM narrates only | Prevents hallucinated rules. Core invariant. |
| D2 | Python backend, not Node | Preserves a tested engine; async fits LLM I/O. |
| D3 | React + Vite SPA, not Next.js | Mini App runs in Telegram's WebView; SSR buys nothing. |
| D4 | Mechanical casting resources ≠ paid ⚡ | Spell slots and legacy character mana are never paid currency; casting cannot spend real money. |
| D5 | Money in integer tenths | Decimal prices are represented exactly; never use floats for ledger math. |
| D6 | Character sheet stays JSON(B) | Rewritten wholesale per turn; no field queries. |
| D7 | Redis for locks/idempotency/rate limits — **not** vector memory | Right-size the infrastructure. |
| D8 | Flat per-turn tier pricing, not per-token | Predictable for players; model cannot inflate it. |
| D9 | Top-up admin-gated; no gateway yet | Wiring real money is irreversible and needs merchant sign-off. |
| D10 | No-op turns are free | A refused rest must not burn currency. |
| D11 | `flee` exists | Without it a mismatched fight is an unwinnable ⚡ sink. |
| D12 | Mini App authenticates with Telegram `initData`; API tokens stay in memory and only the active character id is persisted | Avoids persistent credentials while allowing the game to restore after reload. |
| D13 | Playable reference content is restricted to SRD 5.1 CC BY 4.0 | The catalog contains only licensed SRD material and carries the required attribution in Settings and README. |
| D14 | Character creation exposes only mechanically supported choices | Subclasses, backgrounds and feats remain reference-only until the engine can persist and apply their effects. |
| D15 | Journal history is read from persisted character events | Returning players see previous turns; saved entries include narration and engine-resolved facts without requiring a schema migration. |
| D16 | The narrator describes engine results; it never chooses mechanics | Narrator-quality tiers affect prose generation only. |
| D17 | A spell costs a slot only when its effect resolves | Unsupported effects, invalid targets, missing slots and unavailable spells leave state unchanged; never pretend the effect happened. |
| D18 | Encounter balance and random encounters are distinct features | The XP calculator is an optional planning aid; random exploration rolls are resolved and persisted by the deterministic engine. |
| D19 | English is the default Mini App language; Czech UI uses no diacritics | Language choice is persisted in browser storage. This localizes UI strings only; server-generated narrative and reference content may remain English. |
| D20 | E2E uses synthetic signed Telegram initData and a temporary SQLite database | Browser tests exercise the actual API without real credentials, production data or collisions with normal development ports. |
| D21 | Spell System MVP scope | Spell slots, not mana, fund casting; unmodeled spells consume no slot. The implemented class spell lists and effects are explicitly bounded and do not claim full SRD casting. |
| D22 | Lite narration costs 0.0 ⚡; new users start with 100.0 ⚡ | Core play is free and the starter balance supports meaningful play on paid tiers. No-op turns remain free. Existing balances are not retroactively adjusted. |
| D23 | Narration streams over SSE after the turn commits | The engine commits state first; prose streams afterward. Streaming shares the standard optimistic version fence and idempotency receipt, and failures fall back without undoing a turn. |
| D24 | Long rest restores all HP and spell slots for free outside combat | Rest is refused in combat; a full-resource rest is a no-op. It never spends Adventure Mana, including at a zero balance. |
| D25 | Level-up advances at most one level per resolved turn | HP increases by the class hit die plus Constitution modifier (minimum 1), newly gained slot capacity becomes available, and class-specific spells are learned/prepared. Existing spent slots stay spent; level-up does not fully heal. |
| D26 | Campaign routes and location encounter/discovery tables are engine-owned data | Keeps travel and random encounters deterministic and independently testable; narrative text cannot unlock or alter a route. |
| D27 | Narration providers implement an isolated complete/stream protocol | Provider-specific I/O stays outside prompt orchestration; offline fallback and post-commit streaming remain available without changing engine authority. |
| D28 | NPC quest flags and rewards are engine-owned character state | Quest choices and rewards must persist deterministically and cannot be invented by narration. |
| D29 | Pre-launch DB bootstrap and stream fallback | Production sets `DB_BOOTSTRAP=none` so Alembic is the only schema writer (no `create_all` race on startup). Mid-stream provider aborts emit a `StreamReplaceFrame` / SSE `replace` event with full offline prose so partial LLM tokens are discarded instead of duplicated in the client. |
| D30 | UI: Adventure Mana → **Kredity vypravěče** | Account-level ⚡ pays optional narration tiers only; never spell slots or legacy character mana (extends D4). Spec: `design/DICE_AND_ECONOMY_V1.md` §B–C. |
| D31 | Closed beta default tier **Lite** | New accounts start Lite; free core play must not spend narrator credits. Paid tiers only when an online provider can deliver them. Implement after GDS01 sign-off. |
| D32 | Narrator billing on delivery | No charge (or refund) when paid tier falls back to offline or stream is replaced mid-flight — player must not lose credit without promised narration quality. Spec: §C.4. |
| D33 | Pro tier ≠ shipped product | `1.4` cost in `MODEL_TIERS` is a placeholder; `/economy/tier` rejects `pro` until OpenRouter (or equivalent) is live. |
| D34 | GDS01 dice exploration | Keep D6/D20; adopt exploration **variant A** (differentiated 5/6) after playtest unless data favors B. Variable DC table 5–20+. Spec: `design/DICE_AND_ECONOMY_V1.md` §A. |
| D35 | Monetization pillars | Sell premium narration and story chapters, not play energy or mechanical advantage. No pay-to-win on rolls/loot/stats. Hypothesis pricing in `design/ECONOMY_MODEL_V1.md` only. |
| D36 | `explore_track:<location>` once per site | D6 variant A result 5 sets `quest_flags["explore_track:<location>"]` at most once per location; repeats yield “already known track” prose only. Spec: `design/DICE_AND_ECONOMY_V1.md` §A.4. |
