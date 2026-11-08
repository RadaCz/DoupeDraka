'''Apply the STEP 1 atomic-turn changes in place.

Every replacement asserts its anchor appears exactly once, so a file that has
already been patched (or drifted since) fails loudly instead of being written
twice, and no anchor that is merely *similar* is ever matched.

Run from the repository root:  python tools/step1_patch.py
'''
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    hits = text.count(old)
    if hits != 1:
        raise SystemExit(f"{path.name}: anchor found {hits} times, expected 1:\n{old[:160]}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"  edit   {path.name}: {old.splitlines()[0][:60]!r}")


def replace_block(path: Path, start_marker: str, end_marker: str | None, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    start = text.find(start_marker)
    if start == -1:
        raise SystemExit(f"{path.name}: start marker missing: {start_marker[:80]}")
    if text.find(start_marker, start + 1) != -1:
        raise SystemExit(f"{path.name}: start marker appears more than once: {start_marker[:80]}")
    end = len(text) if end_marker is None else text.find(end_marker, start)
    if end == -1:
        raise SystemExit(f"{path.name}: end marker missing: {end_marker[:80]}")
    path.write_text(text[:start] + new + text[end:], encoding="utf-8")
    print(f"  block  {path.name}: {start_marker[:60]!r} -> {len(new.splitlines())} lines")


# --------------------------------------------------------------------------
# app/db.py - version column, idempotency receipts, in-place migration
# --------------------------------------------------------------------------
DB = ROOT / "app" / "db.py"

replace_block(
    DB,
    'class CharacterRecord(Base):',
    'class EventRecord(Base):',
    '''class CharacterRecord(Base):
    __tablename__ = "characters"
    id: Mapped[str] = mapped_column(String(36), primary_key=True); owner_id: Mapped[int] = mapped_column(Integer, index=True); payload: Mapped[str] = mapped_column(Text)
    # Optimistic concurrency guard. Every accepted turn claims the row at the
    # version it read, so a second writer holding a stale copy writes nothing.
    version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
class ActionReceipt(Base):
    """One row per accepted turn, keyed by the client's Idempotency-Key.

    Written in the same commit as the turn it describes, so a retry finds the
    result instead of rolling the dice again and charging a second time.
    """
    __tablename__ = "action_receipts"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True)
    character_id: Mapped[str] = mapped_column(String(36), index=True)
    # committed = state + ledger + event are durable; complete = narration landed.
    status: Mapped[str] = mapped_column(String(16), default="committed")
    response: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
''',
)

replace_block(
    DB,
    'async def init_db() -> None:',
    'def encode_state(data: dict) -> str:',
    '''async def init_db() -> None:
    # Local SQLite development database; production PostgreSQL needs no directory.
    if get_settings().database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(_migrate_character_version)

def _migrate_character_version(connection) -> None:
    """Add characters.version to a database created before STEP 1.

    create_all creates missing tables but never adds a column to an existing
    one, and dropping the table would take the player's characters with it, so
    the column is added in place and existing rows start at version 0.
    """
    if connection.dialect.name != "sqlite":
        return
    columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(characters)").fetchall()}
    if columns and "version" not in columns:
        connection.exec_driver_sql("ALTER TABLE characters ADD COLUMN version INTEGER NOT NULL DEFAULT 0")

''',
)

# --------------------------------------------------------------------------
# app/schemas.py - report whether the prose came from the model or the fallback
# --------------------------------------------------------------------------
SCHEMAS = ROOT / "app" / "schemas.py"

replace_once(
    SCHEMAS,
    '''    energy: float = 0.0
    tier: str = "normal"''',
    '''    energy: float = 0.0
    tier: str = "normal"
    # "narrated" when the LLM wrote the prose, "fallback" when it was
    # unreachable and deterministic framing was used instead. The turn itself is
    # committed either way.
    narration_status: str = "narrated"''',
)

# --------------------------------------------------------------------------
# app/narrator.py - expose whether the prose is real narration or the fallback
# --------------------------------------------------------------------------
NARRATOR = ROOT / "app" / "narrator.py"

replace_block(
    NARRATOR,
    '    async def narrate(self, context: NarrationContext) -> str:',
    '    @staticmethod\n    def narrate_offline',
    '''    async def narrate(self, context: NarrationContext) -> str:
        return (await self.narrate_detailed(context))[0]

    async def narrate_detailed(self, context: NarrationContext) -> tuple[str, str]:
        """Return (prose, status) so callers can tell narration from fallback.

        The status is what lets the API report honestly whether the model
        actually answered, instead of labelling fallback prose as narration.
        """
        settings = get_settings()
        if settings.llm_provider.lower() == "ollama":
            try:
                return await self._ollama(context, settings.ollama_url, settings.ollama_model), "narrated"
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
                pass
        return self._fallback(context), "fallback"

''',
)

# --------------------------------------------------------------------------
# app/api.py - imports
# --------------------------------------------------------------------------
API = ROOT / "app" / "api.py"

replace_once(
    API,
    'from dataclasses import asdict\n',
    'import asyncio\nfrom dataclasses import asdict\nfrom datetime import datetime\n',
)
replace_once(API, 'from sqlalchemy import select\n', 'from sqlalchemy import select, update\n')
replace_once(
    API,
    'from .db import CharacterRecord, EventRecord, EnergyTransaction, User, ApiKey, Session, decode_state, encode_state, init_db',
    'from .db import ActionReceipt, CharacterRecord, EventRecord, EnergyTransaction, User, ApiKey, Session, decode_state, encode_state, init_db',
)

# --------------------------------------------------------------------------
# app/api.py - settings route + action route, replaced as one tail
# --------------------------------------------------------------------------
TAIL_START = '@app.patch("/characters/{character_id}/settings")'

NEW_TAIL = '''IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_KEY_LIMIT = 64
MAX_TURN_ATTEMPTS = 3


def build_narration_context(character: CharacterState, text: str, events: tuple[str, ...], history: list[str]) -> NarrationContext:
    """Everything the narrator is allowed to see. Facts come from the engine."""
    return NarrationContext(
        text, events, character.location, tuple(history),
        difficulty=character.difficulty, tone=character.tone, humor=character.humor,
        verbose=character.verbose,
    )


async def replay_receipt(key: str, user: User) -> ActionResponse | None:
    """Return the stored response for a repeated key instead of resolving again."""
    if not key:
        return None
    async with Session() as session:
        receipt = await session.get(ActionReceipt, key)
        if receipt is None:
            return None
        if receipt.owner_id != user.id:
            raise HTTPException(409, "Idempotency key belongs to another account")
        return ActionResponse(**decode_state(receipt.response))


async def narrate_committed(context: NarrationContext, event_id: int, key: str, fallback: str) -> tuple[str, str]:
    """Narrate a turn that is already durable.

    The model only chooses wording, and it runs after the commit, so a slow or
    unreachable provider can neither roll back a decided turn nor hold a
    database transaction open while it thinks.
    """
    try:
        narration, status = await narrator.narrate_detailed(context)
    except Exception:  # a broken model must never cost the player their turn
        logger.exception(f"Narration failed for event {event_id}; keeping fallback prose")
        return fallback, "fallback"
    if status != "narrated" or not narration.strip():
        return fallback, "fallback"
    async with Session() as session:
        row = await session.get(EventRecord, event_id)
        if row is not None:
            row.result = narration
        if key:
            receipt = await session.get(ActionReceipt, key)
            if receipt is not None:
                stored = decode_state(receipt.response)
                stored["narration"] = narration
                stored["narration_status"] = "narrated"
                receipt.response = encode_state(stored)
                receipt.status = "complete"
        await session.commit()
    return narration, "narrated"


@app.patch("/characters/{character_id}/settings")
async def update_settings(character_id: str, request: CharacterSettings, user: User = Depends(get_user_by_token)) -> dict:
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        if not record or record.owner_id != user.id:
            raise HTTPException(404, "Character not found")
        base_version = record.version
        character = CharacterState(**decode_state(record.payload))
        try: game.apply_settings(character, **request.model_dump(exclude_none=True))
        except ValueError as error: raise HTTPException(422, str(error)) from error
        # Settings are state too: a turn that read the old payload must not put
        # the old settings back, so this write takes the same version fence.
        updated = await session.execute(
            update(CharacterRecord)
            .where(
                CharacterRecord.id == character_id,
                CharacterRecord.owner_id == user.id,
                CharacterRecord.version == base_version,
            )
            .values(
                payload=encode_state(asdict(character)),
                version=base_version + 1,
                updated_at=datetime.utcnow(),
            )
            .execution_options(synchronize_session=False)
        )
        if updated.rowcount != 1:
            await session.rollback()
            logger.warning(f"Settings conflict on character {character_id} at v{base_version}")
            raise HTTPException(409, "Character changed while saving settings; retry")
        await session.commit()
    logger.info(f"Settings updated for character {character_id}")
    return asdict(character)

@app.post("/characters/{character_id}/actions", response_model=ActionResponse)
async def action(
    character_id: str,
    request: ActionRequest,
    user: User = Depends(get_user_by_token),
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
) -> ActionResponse:
    """Resolve one turn as a single atomic operation.

    Order matters and is the whole point of this route:
      1. read the character and the version it was read at
      2. let the engine decide the outcome (pure, no I/O)
      3. claim the row with a version-guarded UPDATE - a concurrent turn that
         already moved the version makes rowcount 0, so this attempt writes
         nothing, charges nothing, and retries
      4. write state, ledger entry, event and idempotency receipt in ONE commit
      5. narrate afterwards, outside that transaction
    """
    text = request.action.strip()
    if not text:
        logger.warning(f"Empty action for character {character_id}")
        raise HTTPException(400, "Action cannot be empty")
    key = idempotency_key.strip()[:IDEMPOTENCY_KEY_LIMIT]

    replayed = await replay_receipt(key, user)
    if replayed is not None:
        logger.info(f"Replayed committed turn for character {character_id}")
        return replayed

    for _ in range(MAX_TURN_ATTEMPTS):
        async with Session() as session:
            record = await session.get(CharacterRecord, character_id)
            # Same response for missing and foreign characters so ownership cannot be probed.
            if not record or record.owner_id != user.id:
                logger.warning(f"Character not found for user {user.username}: {character_id}")
                raise HTTPException(404, "Character not found")
            base_version = record.version
            character = CharacterState(**decode_state(record.payload))
            if character.hp <= 0:
                logger.warning(f"Action attempted by dead character {character_id}")
                raise HTTPException(409, "Character has fallen and can no longer act")
            # Affordability is checked before resolving so an exhausted player never
            # gets a free turn; the debit itself lands on the winning attempt only.
            account = await require_energy(session, user.id, user.model_tier)
            history = (await session.scalars(
                select(EventRecord).where(EventRecord.character_id == character_id)
                .order_by(EventRecord.id.desc()).limit(5)
            )).all()
            memories = [row.result for row in reversed(history)]

            active_monster = MonsterState(**character.combatant) if character.combatant else None
            result, monster = game.resolve_action(character, text, active_monster)
            character.combatant = asdict(monster) if monster else None
            context = build_narration_context(character, text, tuple(result.events), memories)

            claimed = await session.execute(
                update(CharacterRecord)
                .where(
                    CharacterRecord.id == character_id,
                    CharacterRecord.owner_id == user.id,
                    CharacterRecord.version == base_version,
                )
                .values(
                    payload=encode_state(asdict(character)),
                    version=base_version + 1,
                    updated_at=datetime.utcnow(),
                )
                .execution_options(synchronize_session=False)
            )
            if claimed.rowcount != 1:
                # Another turn moved this character first. Nothing below has run,
                # so no energy was spent and no event was recorded.
                await session.rollback()
                logger.warning(f"Version conflict on character {character_id} at v{base_version}; retrying")
                await asyncio.sleep(0)
                continue

            balance = charge_energy(session, account, user.model_tier, text) if result.state_changed \\
                else account.energy_tenths
            fallback = Narrator.narrate_offline(context)
            event = EventRecord(character_id=character_id, action=text, result=fallback)
            session.add(event)
            await session.flush()
            event_id = event.id

            response = ActionResponse(
                events=result.events, narration=fallback, character=asdict(character),
                energy_tenths=balance, energy=economy.to_units(balance), tier=user.model_tier,
                narration_status="fallback",
            )
            # The receipt is written in the same commit as the turn, so a retry
            # arriving a millisecond later finds the turn and cannot repeat it.
            if key:
                session.add(ActionReceipt(
                    key=key, owner_id=user.id, character_id=character_id,
                    status="committed", response=encode_state(response.model_dump()),
                ))
            await session.commit()

        response.narration, response.narration_status = await narrate_committed(context, event_id, key, fallback)
        logger.info(f"Action processed for character {character_id}: {text[:50]}")
        return response

    raise HTTPException(409, "Character state changed during the turn; retry")
'''

replace_block(API, TAIL_START, None, NEW_TAIL)

print("done: 4 files patched")
