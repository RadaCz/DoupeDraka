"""Static wares at The Goblin Market (Nib's stall)."""

from dataclasses import dataclass
import re

from .economy_balance import HEALING_POTION_PRICE_GP, SHORTSWORD_PLUS_ONE_PRICE_GP


@dataclass(frozen=True)
class ShopListing:
    key: str
    aliases: tuple[str, ...]
    price_gp: int
    inventory_label: str
    shelf_name: str


SHOP_LOCATION = "The Goblin Market"

SHOP_LISTINGS: tuple[ShopListing, ...] = (
    ShopListing(
        key="healing_potion",
        aliases=("healing potion", "potion", "lektvar"),
        price_gp=HEALING_POTION_PRICE_GP,
        inventory_label="healing potion",
        shelf_name="Healing Potion (2d4+2 HP)",
    ),
    ShopListing(
        key="shortsword_plus_1",
        aliases=("shortsword +1", "shortsword+1", "short sword +1", "+1 shortsword"),
        price_gp=SHORTSWORD_PLUS_ONE_PRICE_GP,
        inventory_label="shortsword +1",
        shelf_name="Shortsword +1",
    ),
)


def shop_catalog_message() -> str:
    lines = [f"{item.shelf_name} — {item.price_gp} gp" for item in SHOP_LISTINGS]
    return "Nib's wares: " + "; ".join(lines) + ". Say buy <item>."


def match_shop_listing(action: str) -> ShopListing | None:
    text = re.sub(r"\s+", " ", action.casefold().strip())
    if not any(verb in text for verb in ("buy", "purchase", "kup", "nakup", "koupit")):
        return None
    best: ShopListing | None = None
    best_len = 0
    for listing in SHOP_LISTINGS:
        for alias in listing.aliases:
            if alias in text and len(alias) > best_len:
                best = listing
                best_len = len(alias)
    return best
