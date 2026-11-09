import asyncio
from dataclasses import asdict
from datetime import datetime, timedelta
import json
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
import bcrypt
from .auth.telegram import InitDataError, TelegramUser, verify_init_data
from .db import ActionReceipt, AnalyticsEvent, CharacterRecord, EventRecord, EnergyTransaction, User, ApiKey, Session, decode_character_state, decode_state, encode_character_state, encode_state, init_db
from .engine import economy, reference, tools
from .engine.models import CharacterState, MonsterState
from .engine.locations import LOCATIONS
from .engine.service import GameEngine
from .heroes import HEROES, get_hero
from .campaign_memory import effective_long_term_memory
from .narration_dossier import narration_beats_from_journal, scene_dossier_for_character
from .narration_scene import infer_scene_kind
from .narration_events import defeat_facts_from_events
from .ai.completion_meta import take_completion_meta
from .narration_language import normalize_narration_language
from .memory_summarizer import maybe_archive_journal
from .admin_stats import aggregate_admin_stats
from .health_details import build_health_payload
from .telemetry import (
    analytics_rows_from_turn,
    append_analytics,
    record_character_created,
    record_llm_narration_status,
    record_llm_provider_usage,
    record_turn_billing,
)
from .narrator import NarrationContext, Narrator
from .ai.registry import narration_gateway_for
from .ai.stream_frames import StreamReplaceFrame
from .schemas import (
    ActionRequest,
    ActionResponse,
    AdminStatsResponse,
    CharacterCreate,
    CharacterSettings,
    CharacterTier,
    CombatCalculatorRequest,
    TelegramAuthRequest,
    Token,
    TopUpRequest,
    UserCreate,
    UserResponse,
)
from .settings import get_settings
from .logging import logger
import secrets
import hashlib

app = FastAPI(title="Solo D&D Engine", version="0.1.0")

@app.middleware("http")
async def legacy_v1_prefix(request: Request, call_next):
    """Keep old clients working while exposing a stable /v1 URL contract."""
    if request.scope.get("path", "").startswith("/v1/"):
        request.scope["path"] = request.scope["path"][3:]
    return await call_next(request)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)
game = GameEngine(); narrator = Narrator()
security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time-ish password check that never raises on a malformed hash.

    Accounts created through Telegram have no password, and bcrypt raises on a
    value that is not a valid hash. Treat any such value as a failed login rather
    than letting it become a 500.
    """
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False

def hash_token(token: str) -> str:
    """Hash API token using SHA-256 for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()

def narration_mock_requested(request: Request | None) -> bool:
    if request is None or not get_settings().load_test_enabled:
        return False
    return request.headers.get("X-Load-Test-Mock", "").strip() == "1"


@app.get("/health")
async def health():
    body, status_code = await build_health_payload()
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=body)
    return body


@app.get("/ready")
async def ready() -> dict:
    """Process is up and the database answers a trivial query."""
    try:
        async with Session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as error:
        logger.exception("Readiness check failed")
        raise HTTPException(503, "Database unavailable") from error

@app.on_event("startup")
async def startup() -> None:
    if get_settings().db_bootstrap == "create_all":
        await init_db()

def require_admin(token: str) -> None:
    """Guard for money-shaped routes. No configured token means no access."""
    expected = get_settings().admin_token
    if not expected or not secrets.compare_digest(token, expected):
        raise HTTPException(403, "Admin token required")

MAX_API_KEYS_PER_USER = 5

# Telegram-only accounts have no password to check, so they must never satisfy a
# password login. bcrypt can never produce this value, so verification always fails.
UNUSABLE_PASSWORD = "!telegram-no-password!"

async def prune_api_keys(session, user_id: int) -> None:
    """Keep only the newest keys so repeated logins cannot grow the table forever."""
    await session.flush()
    keys = (await session.scalars(
        select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
    )).all()
    for stale in keys[MAX_API_KEYS_PER_USER:]:
        await session.delete(stale)


async def get_or_create_telegram_user(session, tg_user: TelegramUser) -> User:
    """Create a Telegram account once; concurrent initData logins must converge on one row."""
    for attempt in range(6):
        existing = await session.scalar(select(User).where(User.telegram_id == tg_user.id))
        if existing is not None:
            return existing

        base = tg_user.display_name
        candidate = base
        for name_attempt in range(5):
            taken = await session.scalar(select(User).where(User.username == candidate))
            if taken is None:
                break
            candidate = f"{base[:26]}_{tg_user.id % 10000}_{name_attempt}"[:32]

        user = User(
            username=candidate,
            hashed_password=UNUSABLE_PASSWORD,
            telegram_id=tg_user.id,
        )
        session.add(user)
        try:
            await session.flush()
            logger.info(f"Telegram user created: {user.username} (tg {tg_user.id})")
            return user
        except IntegrityError as error:
            await session.rollback()
            # Unique telegram_id or username collision from a concurrent login — retry lookup.
            logger.debug(
                "Telegram user insert race for tg %s (attempt %s): %s",
                tg_user.id,
                attempt + 1,
                error.orig if hasattr(error, "orig") else error,
            )
            if attempt == 5:
                break
    existing = await session.scalar(select(User).where(User.telegram_id == tg_user.id))
    if existing is not None:
        return existing
    raise HTTPException(409, "Telegram account setup conflicted; retry sign-in")

async def require_energy(session, user_id: int, tier: str) -> User:
    """Load the stored user and refuse the turn (402) when it cannot be paid for.

    Affordability is checked before resolving so an exhausted player never gets a
    free turn, but the debit itself happens afterwards so a no-op turn (a refused
    rest, an action that changed nothing) is not charged.
    """
    record = await session.get(User, user_id)
    if not record: raise HTTPException(401, "User not found")
    if not economy.can_afford(record.energy_tenths, tier):
        logger.warning(f"Energy exhausted for user {record.username}: {record.energy_tenths} tenths")
        raise HTTPException(402, "Not enough narrator credits for this turn. Top up to continue.")
    return record

async def atomic_debit_energy(session, user_id: int, tier: str, detail: str) -> int:
    """Debit one turn with a conditional UPDATE so concurrent turns cannot lose a charge."""
    cost = economy.turn_cost(tier)
    if cost == 0:
        record = await session.get(User, user_id)
        if record is None:
            raise HTTPException(401, "User not found")
        return record.energy_tenths
    result = await session.execute(
        update(User)
        .where(User.id == user_id, User.energy_tenths >= cost)
        .values(energy_tenths=User.energy_tenths - cost)
        .returning(User.energy_tenths)
        .execution_options(synchronize_session=False)
    )
    balance = result.scalar_one_or_none()
    if balance is None:
        raise HTTPException(402, "Not enough narrator credits for this turn. Top up to continue.")
    session.add(EnergyTransaction(
        user_id=user_id, amount_tenths=-cost, reason="turn",
        detail=detail[:128], balance_after=balance,
    ))
    return balance


async def atomic_refund_energy(session, user_id: int, tenths: int, detail: str) -> int:
    """Restore credits when paid narration was not delivered (E2b)."""
    if tenths <= 0:
        record = await session.get(User, user_id)
        if record is None:
            raise HTTPException(401, "User not found")
        return record.energy_tenths
    result = await session.execute(
        update(User)
        .where(User.id == user_id)
        .values(energy_tenths=User.energy_tenths + tenths)
        .returning(User.energy_tenths)
        .execution_options(synchronize_session=False)
    )
    balance = result.scalar_one_or_none()
    if balance is None:
        raise HTTPException(401, "User not found")
    session.add(EnergyTransaction(
        user_id=user_id,
        amount_tenths=tenths,
        reason="refund",
        detail=detail[:128],
        balance_after=balance,
    ))
    return balance


def billing_tier_for_user(stored_tier: str) -> str:
    settings = get_settings()
    from .ai.registry import has_external_paid_narration_provider

    gateway = narration_gateway_for(settings)
    return economy.effective_billing_tier(
        stored_tier,
        has_online_provider=gateway.has_online_providers,
        has_external_paid_provider=has_external_paid_narration_provider(settings),
    )


async def reconcile_narrator_billing(
    *,
    user_id: int,
    stored_tier: str,
    billing_tier: str,
    charged_tenths: int,
    narration_status: str,
    action_detail: str,
    character_id: str,
    state_changed: bool,
    receipt_key: str,
    response: ActionResponse,
    narration_provider: str | None = None,
    narration_model: str | None = None,
) -> None:
    """Refund the commit-time hold when paid narration did not land (D32 / E2b)."""
    refunded = 0
    balance = response.energy_tenths
    if charged_tenths > 0 and narration_status != "narrated":
        async with Session() as session:
            balance = await atomic_refund_energy(
                session,
                user_id,
                charged_tenths,
                f"narration:{narration_status}:{action_detail[:96]}",
            )
            if receipt_key:
                receipt = await session.get(ActionReceipt, receipt_key)
                if receipt is not None:
                    stored = decode_state(receipt.response)
                    stored["energy_tenths"] = balance
                    stored["energy"] = economy.to_units(balance)
                    stored["narration_status"] = narration_status
                    receipt.response = encode_state(stored)
            await session.commit()
            refunded = charged_tenths
    net_charged = charged_tenths - refunded
    response.energy_tenths = balance
    response.energy = economy.to_units(balance)
    record_turn_billing(
        character_id,
        billing_tier=billing_tier,
        stored_tier=stored_tier,
        state_changed=state_changed,
        narration_status=narration_status,
        energy_charged_tenths=net_charged,
        energy_refunded_tenths=refunded,
        narration_provider=narration_provider,
        narration_model=narration_model,
    )

async def get_user_by_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    token_hash = hash_token(token)
    async with Session() as session:
        result = await session.execute(select(ApiKey).where(ApiKey.token_hash == token_hash))
        api_key = result.scalar_one_or_none()
        if not api_key: raise HTTPException(401, "Invalid API token")
        result = await session.execute(select(User).where(User.id == api_key.user_id))
        user = result.scalar_one_or_none()
        if not user: raise HTTPException(401, "User not found")
        return user

@app.post("/auth/register", response_model=UserResponse)
@limiter.limit(get_settings().auth_rate_limit)
async def register(request: Request, payload: UserCreate) -> User:
    async with Session() as session:
        result = await session.execute(select(User).where(User.username == payload.username))
        if result.scalar_one_or_none(): 
            logger.warning(f"Registration attempt with existing username: {payload.username}")
            raise HTTPException(400, "Username already exists")
        user = User(username=payload.username, hashed_password=hash_password(payload.password))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info(f"User registered: {user.username}")
        return user

@app.post("/auth/login", response_model=Token)
@limiter.limit(get_settings().auth_rate_limit)
async def login(request: Request, payload: UserCreate) -> Token:
    async with Session() as session:
        result = await session.execute(select(User).where(User.username == payload.username))
        user = result.scalar_one_or_none()
        if not user or not verify_password(payload.password, user.hashed_password):
            logger.warning(f"Failed login attempt for user: {payload.username}")
            raise HTTPException(401, "Invalid credentials")
        token = secrets.token_urlsafe(32)
        api_key = ApiKey(token_hash=hash_token(token), user_id=user.id)
        session.add(api_key)
        await prune_api_keys(session, user.id)
        await session.commit()
        logger.info(f"User logged in: {user.username}")
        return Token(access_token=token)

def build_character(user: User, name: str, race: str, character_class: str, abilities: dict[str, int] | None = None, settings_payload: dict | None = None) -> CharacterState:
    """Create and validate a character, applying any campaign settings."""
    from .engine.ruleset_v1 import validate_mvp_creation

    validate_mvp_creation(race, character_class)
    character = game.create_character(
        owner_id=user.id,
        name=name,
        race=race,
        character_class=character_class,
        abilities=abilities,
    )
    if settings_payload: game.apply_settings(character, **settings_payload)
    return character

async def persist_character(session, character: CharacterState) -> None:
    session.add(CharacterRecord(id=character.id, owner_id=character.owner_id, payload=encode_character_state(asdict(character))))

@app.get("/characters/presets")
async def list_presets() -> list[dict]:
    # Unauthenticated on purpose: the preset list is static reference data.
    return [{"key": hero.key, "name": hero.name, "race": hero.race, "character_class": hero.character_class, "role": hero.role} for hero in HEROES.values()]

@app.post("/characters/presets/{key}", status_code=201)
async def create_from_preset(
    key: str,
    user: User = Depends(get_user_by_token),
    language: str | None = None,
) -> dict:
    try: hero = get_hero(key)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    character = build_character(
        user,
        hero.name,
        hero.race,
        hero.character_class,
        hero.abilities,
        {"language": language} if language else None,
    )
    async with Session() as session:
        await persist_character(session, character)
        record_character_created(session, character.id, character.race, character.character_class)
        await session.commit()
    logger.info(f"Preset character created: {character.name} from {key} by {user.username}")
    return asdict(character)

@app.post("/auth/telegram", response_model=Token)
@limiter.limit(get_settings().auth_rate_limit)
async def telegram_login(request: Request, payload: TelegramAuthRequest) -> Token:
    """Authenticate a Mini App player from Telegram-signed initData.

    This is the only trusted way to claim a Telegram identity: the signature is
    computed with the bot token, so a forged `user.id` cannot be accepted.
    """
    try:
        tg_user = verify_init_data(payload.init_data, get_settings().bot_token)
    except InitDataError as error:
        logger.warning(f"Rejected initData: {error}")
        raise HTTPException(401, f"Invalid Telegram credentials: {error}") from error

    async with Session() as session:
        user = await get_or_create_telegram_user(session, tg_user)
        token = secrets.token_urlsafe(32)
        session.add(ApiKey(token_hash=hash_token(token), user_id=user.id))
        await prune_api_keys(session, user.id)
        await session.commit()
    return Token(access_token=token)

@app.post("/characters", status_code=201)
async def create_character(request: CharacterCreate, user: User = Depends(get_user_by_token)) -> dict:
    try: 
        character = build_character(
            user,
            request.name,
            request.race,
            request.character_class,
            request.abilities,
            {
                "difficulty": request.difficulty,
                "tone": request.tone,
                "humor": request.humor,
                "language": request.language,
            },
        )
    except ValueError as error: 
        logger.warning(f"Character creation failed for user {user.username}: {error}")
        raise HTTPException(422, str(error)) from error
    async with Session() as session:
        await persist_character(session, character)
        record_character_created(session, character.id, character.race, character.character_class)
        await session.commit()
    logger.info(f"Character created: {character.name} by user {user.username}")
    return asdict(character)

@app.get("/reference")
async def get_reference() -> dict:
    from .engine.quests import quest_catalog
    from .engine.ruleset_v1 import public_summary as ruleset_summary

    return {
        "ruleset": ruleset_summary(),
        "quests": quest_catalog(),
        "races": reference.race_list(),
        "classes": reference.class_list(),
        "feats": reference.feat_list(),
        "backgrounds": reference.background_list(),
        "draconic_ancestry": reference.draconic_ancestry(),
        "locations": [
            {
                "name": location.name,
                "connections": list(location.connections),
                "arrival_beat": location.arrival_beat,
            }
            for location in LOCATIONS.values()
        ],
    }

@app.get("/reference/spells")
async def get_spells() -> list[dict]:
    return tools.spell_library()

@app.post("/tools/combat-calculator")
async def combat_calculator(request: CombatCalculatorRequest) -> dict:
    try: return tools.combat_calculator(request.party_levels, request.monsters)
    except ValueError as error: raise HTTPException(422, str(error)) from error

def _available_narration_tiers() -> list[dict]:
    from .ai.registry import has_external_paid_narration_provider

    settings = get_settings()
    tiers = economy.tier_list()
    if not has_external_paid_narration_provider(settings):
        return [tier for tier in tiers if tier["key"] == "lite"]
    if settings.llm_provider.lower() != "openrouter" or not settings.openrouter_api_key.strip():
        return [tier for tier in tiers if tier["key"] != "pro"]
    return tiers


@app.get("/economy")
async def get_economy(user: User = Depends(get_user_by_token)) -> dict:
    tier = user.model_tier
    from .ai.registry import has_external_paid_narration_provider

    if not has_external_paid_narration_provider(get_settings()) and tier != "lite":
        async with Session() as session:
            record = await session.get(User, user.id)
            if record is not None:
                record.model_tier = "lite"
                await session.commit()
                tier = "lite"
    return {
        "balance": economy.to_units(user.energy_tenths),
        "balance_tenths": user.energy_tenths,
        "tier": tier,
        "tiers": _available_narration_tiers(),
        "packages": economy.package_list(),
    }

@app.post("/economy/tier")
async def set_tier(request: CharacterTier, user: User = Depends(get_user_by_token)) -> dict:
    """Switch the model tier that prices each turn (lite / normal / pro)."""
    if request.tier not in economy.MODEL_TIERS:
        raise HTTPException(422, f"Unknown tier: {request.tier}")
    if request.tier == "pro":
        raise HTTPException(422, "Pro tier is not available in this build.")
    from .ai.registry import has_external_paid_narration_provider

    if request.tier != "lite" and not has_external_paid_narration_provider(get_settings()):
        raise HTTPException(422, "Paid narration tiers require a configured external provider; use lite.")
    async with Session() as session:
        record = await session.get(User, user.id)
        if not record: raise HTTPException(404, "User not found")
        record.model_tier = request.tier
        await session.commit()
    tier = economy.MODEL_TIERS[request.tier]
    logger.info(f"Tier changed for {user.username}: {request.tier}")
    return {"tier": tier.key, "cost": economy.to_units(tier.cost_tenths), "label": tier.label}

@app.get("/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(x_admin_token: str = Header(default="", alias="X-Admin-Token")) -> AdminStatsResponse:
    """Aggregated product telemetry (admin token required)."""
    require_admin(x_admin_token)
    async with Session() as session:
        return await aggregate_admin_stats(session)


@app.post("/economy/topup")
async def top_up(request: TopUpRequest, user: User = Depends(get_user_by_token), x_admin_token: str = Header(default="")) -> dict:
    """Admin-gated top-up. Real payment providers are not wired here on purpose."""
    require_admin(x_admin_token)
    try: package = economy.package_for(request.package)
    except ValueError as error: raise HTTPException(404, str(error)) from error
    async with Session() as session:
        record = await session.get(User, user.id)
        if not record: raise HTTPException(404, "User not found")
        record.energy_tenths += package.mana_tenths
        session.add(EnergyTransaction(user_id=record.id, amount_tenths=package.mana_tenths, reason="topup", detail=package.key, balance_after=record.energy_tenths))
        await session.commit()
    logger.info(f"Energy top-up for {user.username}: +{economy.to_units(package.mana_tenths)}")
    return {"balance": economy.to_units(record.energy_tenths), "balance_tenths": record.energy_tenths}

@app.get("/characters")
async def list_characters(user: User = Depends(get_user_by_token)) -> list[dict]:
    async with Session() as session:
        records = await session.scalars(
            select(CharacterRecord)
            .where(CharacterRecord.owner_id == user.id)
            .order_by(CharacterRecord.updated_at.desc(), CharacterRecord.id.desc())
        )
        return [decode_character_state(record.payload) for record in records]

@app.get("/characters/{character_id}/events")
async def list_character_events(
    character_id: str,
    user: User = Depends(get_user_by_token),
    limit: int = 100,
) -> list[dict]:
    """Return the recent saved journal for one of the user's characters."""
    if not 1 <= limit <= 200:
        raise HTTPException(422, "Event limit must be between 1 and 200")
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        if not record or record.owner_id != user.id:
            logger.warning(f"Character events not found for user {user.username}: {character_id}")
            raise HTTPException(404, "Character not found")
        rows = (await session.scalars(
            select(EventRecord)
            .where(EventRecord.character_id == character_id)
            .order_by(EventRecord.id.desc())
            .limit(limit)
        )).all()
        return [
            {
                "id": row.id,
                "action": row.action,
                "result": row.result,
                "created_at": row.created_at.isoformat(),
            }
            for row in reversed(rows)
        ]

@app.get("/characters/{character_id}")
async def get_character(character_id: str, user: User = Depends(get_user_by_token)) -> dict:
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        # Same response for missing and foreign characters so ownership cannot be probed.
        if not record or record.owner_id != user.id: 
            logger.warning(f"Character not found for user {user.username}: {character_id}")
            raise HTTPException(404, "Character not found")
        return decode_character_state(record.payload)

IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_KEY_LIMIT = 64
MAX_TURN_ATTEMPTS = 3
IDEMPOTENCY_WINDOW = timedelta(hours=24)


def build_narration_context(
    character: CharacterState,
    text: str,
    events: tuple[str, ...],
    history: list[str],
    spell_facts: dict | None = None,
    rest_facts: dict | None = None,
    level_up_facts: dict | None = None,
) -> NarrationContext:
    """Everything the narrator is allowed to see. Facts come from the engine."""
    return NarrationContext(
        text, events, character.location, tuple(history),
        difficulty=character.difficulty, tone=character.tone, humor=character.humor,
        verbose=character.verbose, language=normalize_narration_language(character.narration_language),
        spell_facts=spell_facts,
        rest_facts=rest_facts,
        level_up_facts=level_up_facts,
        defeat_facts=defeat_facts_from_events(events),
        long_term_memory=effective_long_term_memory(character),
        scene_dossier=scene_dossier_for_character(character),
        scene_kind=infer_scene_kind(text, events, in_combat=character.in_combat),
    )


def record_narration_delivery(character_id: str | None, status: str) -> tuple[str | None, str | None]:
    meta = take_completion_meta()
    provider = meta.provider if meta else None
    model = (meta.model or None) if meta else None
    record_llm_narration_status(character_id, status, provider=provider, model=model)
    if meta:
        record_llm_provider_usage(
            character_id,
            provider=meta.provider,
            model=meta.model,
            narration_status=status,
            delivered_to_player=meta.delivered_to_player or status in ("narrated", "offline", "fallback"),
            latency_ms=meta.latency_ms,
            prompt_tokens=meta.prompt_tokens,
            completion_tokens=meta.completion_tokens,
            total_tokens=meta.total_tokens,
            provider_request_status=meta.provider_request_status,
            fallback_reason=meta.fallback_reason,
        )
    return provider, model


def journal_result(narration: str, events: tuple[str, ...]) -> str:
    """Keep the saved journal complete without changing the action API contract."""
    facts = "\n".join(events)
    return f"{narration}\n\n{facts}" if facts else narration


async def replay_receipt(key: str, user: User) -> ActionResponse | None:
    """Return the stored response for a repeated key instead of resolving again."""
    async with Session() as session:
        now = datetime.utcnow()
        await session.execute(
            ActionReceipt.__table__.delete().where(
                (ActionReceipt.expires_at <= now) | ActionReceipt.expires_at.is_(None)
            )
        )
        await session.commit()
        if not key:
            return None
        receipt = await session.get(ActionReceipt, key)
        if receipt is None:
            return None
        if receipt.owner_id != user.id:
            raise HTTPException(409, "Idempotency key belongs to another account")
        return ActionResponse(**decode_state(receipt.response))


async def narrate_committed(
    context: NarrationContext,
    event_id: int,
    key: str,
    fallback: str,
    character_id: str | None = None,
    billing_tier: str = "lite",
) -> tuple[str, str, str | None, str | None]:
    """Narrate a turn that is already durable.

    The model only chooses wording, and it runs after the commit, so a slow or
    unreachable provider can neither roll back a decided turn nor hold a
    database transaction open while it thinks.
    """
    try:
        narration, status = await narrator.narrate_detailed(context, billing_tier=billing_tier)
    except Exception:  # a broken model must never cost the player their turn
        logger.exception(f"Narration failed for event {event_id}; keeping fallback prose")
        provider, model = record_narration_delivery(character_id, "fallback")
        return fallback, "fallback", provider, model
    if not narration.strip():
        provider, model = record_narration_delivery(character_id, "fallback")
        return fallback, "fallback", provider, model
    provider, model = record_narration_delivery(character_id, status)
    if status not in ("narrated", "offline"):
        return fallback, "fallback", provider, model
    from .narration_prose_guard import maybe_record_prose_language_mismatch

    maybe_record_prose_language_mismatch(context.language, narration, character_id)
    async with Session() as session:
        row = await session.get(EventRecord, event_id)
        if row is not None:
            row.result = journal_result(narration, context.events)
        if key:
            receipt = await session.get(ActionReceipt, key)
            if receipt is not None:
                stored = decode_state(receipt.response)
                stored["narration"] = narration
                stored["narration_status"] = status
                receipt.response = encode_state(stored)
                receipt.status = "complete"
        await session.commit()
    return narration, status, provider, model


@app.patch("/characters/{character_id}/settings")
async def update_settings(character_id: str, request: CharacterSettings, user: User = Depends(get_user_by_token)) -> dict:
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        if not record or record.owner_id != user.id:
            raise HTTPException(404, "Character not found")
        base_version = record.version
        character = CharacterState(**decode_character_state(record.payload))
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
                payload=encode_character_state(asdict(character)),
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
@limiter.limit(get_settings().action_rate_limit)
async def action(
    request: Request,
    character_id: str,
    payload: ActionRequest,
    user: User = Depends(get_user_by_token),
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
) -> ActionResponse:
    (
        response,
        context,
        event_id,
        key,
        replayed,
        charged_tenths,
        billing_tier,
        stored_tier,
        state_changed,
    ) = await commit_action_turn(character_id, payload, user, idempotency_key)
    if replayed:
        logger.info(f"Replayed committed turn for character {character_id}")
        return response
    assert context is not None and event_id is not None
    if narration_mock_requested(request):
        response.narration_status = "fallback"
        delivery_provider, delivery_model = None, None
    else:
        response.narration, response.narration_status, delivery_provider, delivery_model = await narrate_committed(
            context,
            event_id,
            key,
            response.narration,
            character_id=character_id,
            billing_tier=billing_tier,
        )
    await reconcile_narrator_billing(
        user_id=user.id,
        stored_tier=stored_tier,
        billing_tier=billing_tier,
        charged_tenths=charged_tenths,
        narration_status=response.narration_status,
        action_detail=payload.action.strip(),
        character_id=character_id,
        state_changed=state_changed,
        receipt_key=key,
        response=response,
        narration_provider=delivery_provider,
        narration_model=delivery_model,
    )
    logger.info(f"Action processed for character {character_id}: {payload.action.strip()[:50]}")
    return response


def sse_message(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}\n\n"


@app.post("/characters/{character_id}/actions/stream")
@limiter.limit(get_settings().action_rate_limit)
async def action_stream(
    request: Request,
    character_id: str,
    payload: ActionRequest,
    user: User = Depends(get_user_by_token),
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
) -> StreamingResponse:
    (
        response,
        context,
        event_id,
        key,
        replayed,
        charged_tenths,
        billing_tier,
        stored_tier,
        state_changed,
    ) = await commit_action_turn(character_id, payload, user, idempotency_key)

    async def events():
        yield sse_message("turn", response.model_dump())
        if replayed:
            yield sse_message(
                "complete",
                {"narration": response.narration, "narration_status": response.narration_status},
            )
            return

        assert context is not None and event_id is not None
        chunks: list[str] = []
        mock = narration_mock_requested(request)
        from .ai.registry import has_external_paid_narration_provider

        status = "fallback" if mock else (
            "offline" if billing_tier == "lite" else (
                "narrated" if has_external_paid_narration_provider(get_settings()) else "fallback"
            )
        )
        narration = response.narration
        delivery_provider: str | None = None
        delivery_model: str | None = None
        billing_settled = False

        async def finalize_turn() -> None:
            nonlocal billing_settled, narration, status, delivery_provider, delivery_model
            if billing_settled:
                return
            billing_settled = True
            response.narration = narration
            response.narration_status = status
            async with Session() as session:
                row = await session.get(EventRecord, event_id)
                if row is not None:
                    row.result = journal_result(narration, context.events)
                if key:
                    receipt = await session.get(ActionReceipt, key)
                    if receipt is not None:
                        receipt.response = encode_state(response.model_dump())
                        receipt.status = "complete"
                await session.commit()
            from .narration_prose_guard import maybe_record_prose_language_mismatch

            maybe_record_prose_language_mismatch(context.language, narration, character_id)
            delivery_provider, delivery_model = record_narration_delivery(character_id, status)
            await reconcile_narrator_billing(
                user_id=user.id,
                stored_tier=stored_tier,
                billing_tier=billing_tier,
                charged_tenths=charged_tenths,
                narration_status=status,
                action_detail=payload.action.strip(),
                character_id=character_id,
                state_changed=state_changed,
                receipt_key=key,
                response=response,
                narration_provider=delivery_provider,
                narration_model=delivery_model,
            )

        try:
            if mock:
                narration = response.narration
            else:
                async for chunk in narrator.stream(context, billing_tier=billing_tier):
                    if isinstance(chunk, StreamReplaceFrame):
                        chunks.clear()
                        chunks.append(chunk.narration)
                        status = "fallback"
                        yield sse_message("replace", {"narration": chunk.narration})
                    elif chunk:
                        chunks.append(chunk)
                        yield sse_message("delta", {"text": chunk})
                narration = "".join(chunks).strip()
            if not narration:
                status = "fallback"
                narration = response.narration
                yield sse_message("replace", {"narration": narration})
        except asyncio.CancelledError:
            logger.info("Client disconnected during narration stream for event %s", event_id)
            status = "fallback"
            narration = response.narration
            await finalize_turn()
            raise
        except Exception:
            logger.exception(f"Streaming narration failed for event {event_id}; using offline fallback")
            status = "fallback"
            narration = Narrator.narrate_offline(context)
            yield sse_message("replace", {"narration": narration})

        await finalize_turn()
        yield sse_message(
            "complete",
            {
                "narration": narration,
                "narration_status": status,
                "energy_tenths": response.energy_tenths,
                "energy": response.energy,
            },
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def commit_action_turn(
    character_id: str,
    payload: ActionRequest,
    user: User,
    idempotency_key: str,
) -> tuple[ActionResponse, NarrationContext | None, int | None, str, bool, int, str, str, bool]:
    """Resolve and persist the engine turn under the version fence.

    Order matters and is the whole point of this route:
      1. read the character and the version it was read at
      2. let the engine decide the outcome (pure, no I/O)
      3. claim the row with a version-guarded UPDATE - a concurrent turn that
         already moved the version makes rowcount 0, so this attempt writes
         nothing, charges nothing, and retries
      4. write state, ledger entry, event and idempotency receipt in ONE commit
      5. return the committed turn; narration happens after the commit
    """
    text = payload.action.strip()
    if not text:
        logger.warning(f"Empty action for character {character_id}")
        raise HTTPException(400, "Action cannot be empty")
    key = idempotency_key.strip()[:IDEMPOTENCY_KEY_LIMIT]

    billing_tier = billing_tier_for_user(user.model_tier)
    stored_tier = user.model_tier

    replayed = await replay_receipt(key, user)
    if replayed is not None:
        return replayed, None, None, key, True, 0, billing_tier, stored_tier, False

    for _ in range(MAX_TURN_ATTEMPTS):
        async with Session() as session:
            record = await session.get(CharacterRecord, character_id)
            # Same response for missing and foreign characters so ownership cannot be probed.
            if not record or record.owner_id != user.id:
                logger.warning(f"Character not found for user {user.username}: {character_id}")
                raise HTTPException(404, "Character not found")
            base_version = record.version
            character = CharacterState(**decode_character_state(record.payload))
            if character.hp <= 0:
                logger.warning(f"Action attempted by dead character {character_id}")
                raise HTTPException(409, "Character has fallen and can no longer act")
            history = (await session.scalars(
                select(EventRecord)
                .where(
                    EventRecord.character_id == character_id,
                    EventRecord.id > character.journal_archived_through_event_id,
                )
                .order_by(EventRecord.id.desc())
                .limit(5)
            )).all()
            short_term_beats = narration_beats_from_journal(
                [row.result or "" for row in reversed(history)]
            )

            turn_location = character.location
            active_monster = MonsterState(**character.combatant) if character.combatant else None
            result, monster = game.resolve_action(character, text, active_monster)
            account = (
                await require_energy(session, user.id, billing_tier)
                if result.state_changed and result.costs_adventure_mana
                else await session.get(User, user.id)
            )
            if account is None:
                raise HTTPException(401, "User not found")
            character.combatant = asdict(monster) if monster else None
            context = build_narration_context(
                character, text, tuple(result.events), list(short_term_beats),
                result.spell_facts or None,
                result.rest_facts or None,
                result.level_up_facts or None,
            )

            claimed = await session.execute(
                update(CharacterRecord)
                .where(
                    CharacterRecord.id == character_id,
                    CharacterRecord.owner_id == user.id,
                    CharacterRecord.version == base_version,
                )
                .values(
                    payload=encode_character_state(asdict(character)),
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
                replayed = await replay_receipt(key, user)
                if replayed is not None:
                    return replayed, None, None, key, True, 0, billing_tier, stored_tier, False
                await asyncio.sleep(0)
                continue

            charged_tenths = 0
            try:
                if result.state_changed and result.costs_adventure_mana and economy.turn_cost(billing_tier) > 0:
                    balance = await atomic_debit_energy(session, user.id, billing_tier, text)
                    charged_tenths = economy.turn_cost(billing_tier)
                else:
                    balance = account.energy_tenths
            except HTTPException:
                await session.rollback()
                raise
            fallback = Narrator.narrate_offline(context)
            event = EventRecord(
                character_id=character_id,
                action=text,
                result=journal_result(fallback, context.events),
            )
            session.add(event)
            await session.flush()
            event_id = event.id
            character.turn_count += 1
            character = await maybe_archive_journal(session, character_id, character)
            record.payload = encode_character_state(asdict(character))
            append_analytics(
                session,
                analytics_rows_from_turn(
                    character_id,
                    result,
                    location=turn_location,
                    monster_name=active_monster.name if active_monster else None,
                ),
            )

            response = ActionResponse(
                events=result.events, narration=fallback, character=asdict(character),
                energy_tenths=balance, energy=economy.to_units(balance), tier=stored_tier,
                narration_status="fallback",
                spell_facts=result.spell_facts or None,
                rest_facts=result.rest_facts or None,
                level_up_facts=result.level_up_facts or None,
            )
            # The receipt is written in the same commit as the turn, so a retry
            # arriving a millisecond later finds the turn and cannot repeat it.
            if key:
                receipt_created_at = datetime.utcnow()
                session.add(ActionReceipt(
                    key=key, owner_id=user.id, character_id=character_id,
                    status="committed", response=encode_state(response.model_dump()),
                    created_at=receipt_created_at,
                    expires_at=receipt_created_at + IDEMPOTENCY_WINDOW,
                ))
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                logger.warning(f"Idempotency receipt race for key {key[:8]}…")
                replayed = await replay_receipt(key, user)
                if replayed is not None:
                    return replayed, None, None, key, True, 0, billing_tier, stored_tier, False
                raise HTTPException(409, "Concurrent idempotency conflict; retry") from None

        return (
            response,
            context,
            event_id,
            key,
            False,
            charged_tenths,
            billing_tier,
            stored_tier,
            result.state_changed,
        )

    raise HTTPException(409, "Character state changed during the turn; retry")

def e2e_hooks_enabled() -> bool:
    """Playwright E2E runs the API with a dedicated bot token; never enable in production."""
    return get_settings().bot_token == "123456:e2e-test-token"


@app.post("/characters/{character_id}/__e2e/fallen")
async def e2e_force_fallen(character_id: str, user: User = Depends(get_user_by_token)) -> dict:
    """Set hp to 0 so browser tests can exercise revive without simulating combat death."""
    if not e2e_hooks_enabled():
        raise HTTPException(404, "Not found")
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        if not record or record.owner_id != user.id:
            raise HTTPException(404, "Character not found")
        character = CharacterState(**decode_character_state(record.payload))
        character.hp = 0
        character.in_combat = False
        character.combatant = None
        character.death_state = "fallen"
        claimed = await session.execute(update(CharacterRecord).where(
            CharacterRecord.id == character_id,
            CharacterRecord.owner_id == user.id,
            CharacterRecord.version == record.version,
        ).values(payload=encode_character_state(asdict(character)), version=record.version + 1, updated_at=datetime.utcnow()))
        if claimed.rowcount != 1:
            raise HTTPException(409, "Character changed while updating; retry")
        await session.commit()
        return {"character": asdict(character)}


@app.post("/characters/{character_id}/revive")
async def revive_character(character_id: str, user: User = Depends(get_user_by_token)) -> dict:
    """Recover a fallen hero at the cost of 10% of carried gold (minimum 1)."""
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        if not record or record.owner_id != user.id:
            raise HTTPException(404, "Character not found")
        character = CharacterState(**decode_character_state(record.payload))
        if character.hp > 0:
            raise HTTPException(409, "Character has not fallen")
        lost = min(character.gold, max(1, character.gold // 10)) if character.gold else 0
        character.gold -= lost
        character.hp = 1
        character.in_combat = False
        character.combatant = None
        character.death_state = "alive"
        from .memory_summarizer import merge_long_term_memory

        character.long_term_memory = merge_long_term_memory(
            character.long_term_memory,
            "Revived at the last safe location.",
        )
        claimed = await session.execute(update(CharacterRecord).where(
            CharacterRecord.id == character_id,
            CharacterRecord.owner_id == user.id,
            CharacterRecord.version == record.version,
        ).values(payload=encode_character_state(asdict(character)), version=record.version + 1, updated_at=datetime.utcnow()))
        if claimed.rowcount != 1:
            raise HTTPException(409, "Character changed while reviving; retry")
        await session.commit()
        return {"character": asdict(character), "gold_lost": lost}
