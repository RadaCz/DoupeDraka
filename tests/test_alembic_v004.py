"""Alembic chain for narrator tier default (E2)."""

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_v004_follows_v003_in_revision_chain():
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)
    v004 = script.get_revision("v004")
    assert v004 is not None
    assert v004.down_revision == "v003"
    v005 = script.get_revision("v005")
    assert v005 is not None
    assert v005.down_revision == "v004"
    heads = script.get_heads()
    assert "v005" in heads
