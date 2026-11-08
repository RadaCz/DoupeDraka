'''Bring PROJECT_BRAIN.md up to date after STEP 1.

Anchors are asserted, so a document that has drifted fails here instead of
being rewritten with stale sections. ASCII-only anchors: the file is UTF-8 and
its em dashes render as mojibake in a cp1252 console, so matching on them would
be unreliable.
'''
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
BRAIN = ROOT / "PROJECT_BRAIN.md"
text = BRAIN.read_text(encoding="utf-8")
original = len(text)


def must(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAILED: {message}")


# ---------------------------------------------------------------- 6.7 section
SECTION = '''### 6.7 STEP 1 complete - atomic character turns (2026-11-06)

**Result: 130 passed** (127 existing + 3 new), in `D:/DoupeDraka/.venv/Scripts/python.exe`.
Additive change; the four touched modules kept their public shape and no existing test was
edited or weakened.

**What the code actually did before this pass** (read, not assumed):

| Claim in the audit | What was really there |
|---|---|
| shared `BOT_API_TOKEN` breaks player identity | ownership comes from `owner_id` on the character; the token authenticates the *bot*, not the player. No identity defect. |
| concurrent turns clobber each other | confirmed. The route read a character, resolved, charged energy and committed with no version guard, so two in-flight turns both wrote and the later commit won. |
| narration placement | confirmed wrong. `narrator.narrate()` was awaited *before* `commit()`, holding the session open across an HTTP call with a 45 s timeout. |
| energy scope | per **user** (`User.energy_tenths`), not per character. Confirmed. |

**Mechanism, in the order the route now runs it:**

1. `Idempotency-Key` request header (optional). A receipt for that key returns the stored
   response; nothing is re-rolled or re-charged.
2. Read the character, record `base_version`.
3. Resolve the turn with the engine - pure, no I/O.
4. Claim the row: `UPDATE characters SET payload=..., version=v+1 WHERE id=? AND owner_id=?
   AND version=v`. A concurrent turn that already moved the version makes `rowcount = 0`, so
   this attempt writes nothing, charges nothing, and retries (max 3, then `409`).
5. In the winning transaction: state, `events` row, `energy_transactions` row and the
   `action_receipts` row commit together.
6. **After** the commit, narrate. A narrator failure returns `200` with
   `narration_status: "fallback"` and deterministic prose - it never rolls back a decided turn.
   On success the event row and stored receipt are updated and the status becomes `"narrated"`.

**Why optimistic versioning and not `SELECT ... FOR UPDATE`:** SQLite has no row lock, so a
pessimistic design behaves one way in development and another on PostgreSQL - the tests would
prove something the production path does not do. The version fence is identical on both. A
Postgres-only `FOR UPDATE` stays a valid optimisation *behind the same contract*.

**Schema additions (backward compatible):**
- `characters.version` - `INTEGER NOT NULL DEFAULT 0`, added in place on startup by
  `_migrate_character_version()` via `ALTER TABLE` for SQLite, because `create_all` never adds
  a column to an existing table and dropping it would take the player's characters with it.
  Verified on the live `data/dnd.db`: column present next to existing rows.
- `action_receipts` - `key` (pk), `owner_id`, `character_id`, `status`
  (`committed` / `complete`), `response`, `created_at`.
- `ActionResponse.narration_status` - defaults to `"narrated"`, so older clients are unaffected.

**Files changed:** `git diff --stat` -> `app/api.py` 223, `app/db.py` 35, `app/narrator.py` 16,
`app/schemas.py` 4; combined **+236 / -42**. Plus new `tests/test_concurrency.py` and
`tools/step1_patch.py` (the patcher that applies the changes; keeps the edit reproducible).

**Tests added (`tests/test_concurrency.py`):**
1. `test_repeated_idempotency_key_charges_once` - a repeated key replays the turn: one event,
   one receipt, one version bump, identical balance.
2. `test_stale_version_cannot_overwrite_character` - two sessions read one version; the second
   guarded write matches 0 rows and the payload stays intact. This pins the mechanism itself.
3. `test_narration_failure_keeps_the_committed_turn` - narrator raises; response is `200`,
   status `fallback`, and both the event row and the version bump are durable.

**Honest limits of this pass:**
- Test 2 asserts the *fence*, not two real HTTP requests racing. A genuine race on SQLite is
  timing-dependent and would flake in CI; the fence is the invariant that makes the race safe,
  so that is what is pinned. A load test against PostgreSQL is still owed in STEP 2.
- Dice are not seeded per request, so a retry after a version conflict re-rolls. Correct (the
  first attempt never committed) but not reproducible when debugging.
- `update_settings` now takes the same fence but raises `409` instead of retrying, so a player
  editing settings mid-turn can be asked to retry.
- Warnings rose 81 -> 102; still `datetime.utcnow()` and FastAPI `on_event`, untouched.

'''

anchor = "## 7. Roadmap & To-Do (NEXT STEPS)"
must(text.count(anchor) == 1, "roadmap heading not found exactly once")
text = text.replace(anchor, SECTION + anchor, 1)

# ------------------------------------------------------- close-out sentence
old_sentence = "**STEP 0 is complete.** STEP 1 (atomic character turns) is the next task and is not started."
must(text.count(old_sentence) == 1, "STEP 0 close-out sentence not found")
text = text.replace(
    old_sentence,
    "**STEP 0 is complete.** STEP 1 (atomic character turns) is complete as well - see 6.7.",
    1,
)

# ------------------------------------------------------------ STEP 0 ticked
for fragment in ("- [ ] **Clean venv with the project", "- [ ] `bcrypt` and any other", "- [ ] Baseline re-recorded"):
    must(text.count(fragment) == 1, f"unchecked STEP 0 box missing: {fragment}")
    text = text.replace(fragment, fragment.replace("[ ]", "[x]"), 1)

must(text.count("**IN PROGRESS**") == 1, "STEP 0 status marker not found exactly once")
text = text.replace("**IN PROGRESS**", "**COMPLETE**", 1)

# ------------------------------------------------------ STEP 1 block rewrite
start = text.index("### STEP 1 ")
end = text.index("### STEP 2 ")
NEW_STEP1 = '''### STEP 1 - Game-state concurrency  <- **COMPLETE** (see 6.7)
Must be a complete transactional operation, not a lock bolted around the endpoint.
- [x] Traced Telegram user id -> character ownership. Ownership is `owner_id`; the shared
      `BOT_API_TOKEN` authenticates the bot, not the player, so there was no identity defect.
- [x] Optimistic versioning via `characters.version` (chosen over `SELECT ... FOR UPDATE`,
      which SQLite cannot honour - see 6.7).
- [x] `Idempotency-Key` per action request; a retry replays the stored response and neither
      double-charges nor double-applies.
- [x] State change + `events` row + energy transaction + receipt commit atomically.
- [x] Narration outside the transaction: resolve -> commit -> narrate.
- [x] Regression tests: duplicate request, stale writer, narrator failure. **130 passed.**

'''
text = text[:start] + NEW_STEP1 + text[end:]

# ------------------------------------------------------ STEP 2 marked as next
must(text.count("### STEP 2 ") == 1, "STEP 2 heading not found exactly once")
text = re.sub(r"(?m)^### STEP 2 (.*)$", r"### STEP 2 \1  <- **NEXT**", text, count=1)

BRAIN.write_text(text, encoding="utf-8")
print(f"PROJECT_BRAIN.md: {original} -> {len(text)} chars (+{len(text) - original})")
print("sections 6.6:", text.count("### 6.6"), "| 6.7:", text.count("### 6.7"))
print("STEP 2 next marker:", text.count("<- **NEXT**"))
