from app.engine.intent import ATTACK, CAST, CHECK, EXPLORE, parse_action_intent


def test_intent_recognizes_attack_and_cast():
    assert parse_action_intent("attack the goblin").kind == ATTACK
    assert parse_action_intent("cast Fire Bolt").kind == CAST


def test_intent_flags_negated_attack():
    intent = parse_action_intent("do not attack the guard")
    assert intent.kind == CHECK
    assert intent.needs_clarification


def test_intent_defaults_unknown_to_check():
    assert parse_action_intent("mumble something cryptic").kind == CHECK
    assert parse_action_intent("look around").kind == EXPLORE
