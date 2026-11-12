"""When narrator credits are held for a committed turn (decoupled from costs_adventure_mana)."""

from __future__ import annotations

from .engine import economy


def narration_charge_applies(*, billing_tier: str, state_changed: bool) -> bool:
    """Hold credits for any committed turn on paid tiers when a provider can narrate.

    Lite stays free. Rejected/no-op turns (state_changed=False) never trigger a hold,
    so invalid actions do not reserve credits or call paid providers.
    """
    if billing_tier == "lite" or not state_changed:
        return False
    from .ai.registry import has_external_paid_narration_provider
    from .settings import get_settings

    if not has_external_paid_narration_provider(get_settings()):
        return False
    return economy.turn_cost(billing_tier) > 0
