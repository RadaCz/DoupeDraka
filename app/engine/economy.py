"""Narrator credits charged per turn (shown as ⚡ in the UI).

Kept strictly separate from spell slots and the legacy `CharacterState.mana`.
Amounts are stored as integer tenths so decimal prices never drift.

No payment provider is wired here. Top-ups are explicit, audited calls; enabling
real money is a deployment decision, not a code default.
"""
from dataclasses import dataclass

TENTHS_PER_UNIT = 10

STARTING_BALANCE_TENTHS = 1000  # 100.0 Mana gives players room to explore.


@dataclass(frozen=True)
class ModelTier:
    key: str
    label: str
    cost_tenths: int
    description: str


MODEL_TIERS = {
    "lite": ModelTier("lite", "Lite", 0, "Built-in offline storyteller; free changed turns."),
    "normal": ModelTier(
        "normal",
        "Normal",
        10,
        "External AI narration when configured; 1.0 ⚡ per delivered paid turn.",
    ),
    "pro": ModelTier("pro", "Pro", 14, "Disabled in closed beta until OpenRouter is available."),
}
DEFAULT_TIER = "lite"


def effective_billing_tier(
    stored_tier: str,
    *,
    has_online_provider: bool,
    has_external_paid_provider: bool = False,
) -> str:
    """Tier used for affordability checks and debits (D31 / GDS01 E2)."""
    if stored_tier == "lite" or not has_online_provider:
        return "lite"
    if stored_tier == "pro":
        return "lite"
    if stored_tier == "normal" and not has_external_paid_provider:
        return "lite"
    return stored_tier


@dataclass(frozen=True)
class Package:
    key: str
    label: str
    mana_tenths: int
    price_rub: int


PACKAGES = {
    "starter": Package("starter", "Starter Pack", 500, 100),
}


def to_units(tenths: int) -> float:
    """Render tenths as display units. Always round for display, never for math."""
    return round(tenths / TENTHS_PER_UNIT, 1)


def from_units(units: float) -> int:
    return round(units * TENTHS_PER_UNIT)


def turn_cost(tier: str) -> int:
    try:
        return MODEL_TIERS[tier].cost_tenths
    except KeyError as error:
        raise ValueError(f"Unknown model tier: {tier}") from error


def can_afford(balance_tenths: int, tier: str) -> bool:
    return balance_tenths >= turn_cost(tier)


def charge(balance_tenths: int, tier: str) -> tuple[int, int]:
    """Return (new_balance, charged_amount). Raises when the balance is too low."""
    cost = turn_cost(tier)
    if balance_tenths < cost:
        raise ValueError("Insufficient mana")
    return balance_tenths - cost, cost


def package_for(key: str) -> Package:
    try:
        return PACKAGES[key]
    except KeyError as error:
        raise ValueError(f"Unknown package: {key}") from error


def tier_list() -> list[dict]:
    return [
        {
            "key": tier.key,
            "label": tier.label,
            "cost": to_units(tier.cost_tenths),
            "description": tier.description,
        }
        for tier in MODEL_TIERS.values()
    ]


def package_list() -> list[dict]:
    return [
        {
            "key": package.key,
            "label": package.label,
            "mana": to_units(package.mana_tenths),
            "price_rub": package.price_rub,
        }
        for package in PACKAGES.values()
    ]