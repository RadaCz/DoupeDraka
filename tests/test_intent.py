from app.engine.intent import ATTACK, AMBIGUOUS, CAST, EQUIP, EXPLORE, TALK, UNKNOWN, parse_action_intent


def test_intent_recognizes_attack_and_cast():
    assert parse_action_intent("attack the goblin").kind == ATTACK
    assert parse_action_intent("cast Fire Bolt").kind == CAST


def test_intent_flags_negated_attack():
    from app.engine.intent import REJECTED

    intent = parse_action_intent("do not attack the guard")
    assert intent.kind == REJECTED


def test_czech_talk_over_negated_attack():
    intent = parse_action_intent("Nechci zaútočit, chci s ním mluvit")
    assert intent.kind == TALK


def test_conflicting_attack_and_talk_is_ambiguous():
    intent = parse_action_intent("attack the guard and ask about the bell")
    assert intent.kind == AMBIGUOUS
    assert intent.needs_clarification


def test_intent_defaults_unknown_to_check():
    assert parse_action_intent("mumble something cryptic").kind == UNKNOWN
    assert parse_action_intent("look around").kind == EXPLORE


def test_unequip_routes_to_equip_intent():
    assert parse_action_intent("unequip shield").kind == EQUIP
    assert parse_action_intent("unequip armor").kind == EQUIP
    assert parse_action_intent("sundat štít").kind == EQUIP
