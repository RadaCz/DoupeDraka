# Architecture

## Runtime

- Backend: Python 3.11+, FastAPI, Pydantic, SQLAlchemy async, SQLite in development.
- Frontend: React 18 + Vite, served as a Telegram Mini App.
- Bot: aiogram; currently limited to entry-point handlers.
- Narration: `app/narrator.py` composes facts and prose prompts; `app/ai/` provides
  the provider protocol, Ollama streaming/completion, offline fallback, and provider
  selection. SSE prose starts only after the engine turn and journal event have committed.
- Migrations: Alembic. PostgreSQL configuration exists but a live database has not
  been verified in this environment.

## Authority boundaries

`app/engine/` is deterministic Python rules code. It does not call the database,
Telegram, or any LLM. The API loads state, calls the engine, persists the result, and
passes immutable resolved facts to the narrator. The narrator writes prose only and
cannot change dice, HP, XP, spell slots, encounters, locations, or economy.

## Turn transaction

1. Authenticate the Telegram `initData` or an API bearer token.
2. Verify character ownership and the submitted idempotency key.
3. Check the character version fence; resolve the action in `GameEngine`.
4. Persist the updated character, journal event, paid-energy ledger entry, and action
   receipt atomically.
5. Commit before narration. Stream SSE prose afterward; if narration fails, return the
   deterministic offline fallback without rolling back the game turn.

The JSON character payload is the versioned snapshot. New optional engine fields must
have defaults so old payloads continue to decode. Concurrency and idempotency must
remain enforced for both standard and streamed actions.

## Resources

- Spell slots are class/level-based game resources.
- `CharacterState.mana` is a legacy character resource and does not power spells.
- `users.energy_tenths` is the Adventure Mana ledger, represented as integer tenths.
- Gold is in-world treasure and currently has no spending mechanic.

See [ENGINE.md](./ENGINE.md), [DEPLOYMENT.md](./DEPLOYMENT.md), and
[DECISIONS.md](../DECISIONS.md) for detailed contracts.
