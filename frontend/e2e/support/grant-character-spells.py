"""E2E harness only — patch character spells / combat distance in the temp SQLite DB."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.db import decode_character_state, encode_character_state  # noqa: E402


def _parse_args(argv: list[str]) -> tuple[str, str, list[str], int | None]:
    if len(argv) < 3:
        raise SystemExit("usage: grant-character-spells.py <e2e.db> <character_id> [spell ...] [--distance-ft N]")
    db_path = argv[1]
    character_id = argv[2]
    spells: list[str] = []
    distance_ft: int | None = None
    i = 3
    while i < len(argv):
        if argv[i] == "--distance-ft" and i + 1 < len(argv):
            distance_ft = int(argv[i + 1])
            i += 2
            continue
        spells.append(argv[i])
        i += 1
    return db_path, character_id, spells, distance_ft


def main() -> None:
    db_path, character_id, spells, distance_ft = _parse_args(sys.argv)
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT payload, version FROM characters WHERE id = ?",
        (character_id,),
    ).fetchone()
    if row is None:
        raise SystemExit(f"character not found: {character_id}")
    payload = decode_character_state(row[0])
    prepared = list(payload.get("prepared_spells") or [])
    known = list(payload.get("known_spells") or [])
    for spell in spells:
        if spell in prepared or spell in known:
            continue
        if payload.get("character_class") in {"wizard", "sorcerer", "bard"}:
            known.append(spell)
        else:
            prepared.append(spell)
    payload["known_spells"] = known
    payload["prepared_spells"] = prepared
    if distance_ft is not None:
        payload["combat_distance_ft"] = distance_ft
        payload["in_combat"] = True
        payload["combat_turn"] = "player"
        flags = dict(payload.get("combat_flags") or {})
        flags["action_used"] = False
        flags["bonus_action_used"] = False
        flags["reaction_used"] = False
        payload["combat_flags"] = flags
        payload["max_hp"] = max(int(payload.get("max_hp") or 0), 24)
        payload["hp"] = max(int(payload.get("hp") or 0), 16)
    conn.execute(
        "UPDATE characters SET payload = ?, version = version + 1 WHERE id = ?",
        (encode_character_state(payload), character_id),
    )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()