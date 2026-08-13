"""Unit contract for the `instance.md` parser — written red-first from
specs/vsor/instance-format/spec.md (plus the build spec's `instance-invalid` clause).

Public surface these tests define, in `vsor/instance.py`:

- `Instance` — frozen dataclass carrying the required trio plus the body:
  `format: int` (1 is the only recognized value), `name: str`, `requires: str`
  (the `vsor.requires` pin), and `body: str` — everything after the closing `---`
  line, preserved byte-exact for the slice-2 MCP server.
- `InstanceError(ValueError)` — every parse/validation failure raises it; `str(err)`
  names the field, the file, and the fix. An unknown top-level key carries migration
  guidance that names the recognized keys (`format`, `name`, `vsor`) — never silence.
- `parse_instance(path: Path) -> Instance` — reads and strictly parses the file.
  Reserved slice-2 keys (`retrieval`, `budgets`) are accepted and inert.
"""

from importlib import resources
from pathlib import Path

import pytest
from vsor.instance import Instance, InstanceError, parse_instance

REQUIRES = ">=0.1.0,<0.2"

TRIO_FRONTMATTER = f'---\nformat: 1\nname: demo\nvsor:\n  requires: "{REQUIRES}"\n---\n'


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "instance.md"
    path.write_text(text, encoding="utf-8")
    return path


def parse_error(tmp_path: Path, text: str) -> str:
    with pytest.raises(InstanceError) as exc:
        parse_instance(write(tmp_path, text))
    return str(exc.value)


# ------------------------------------------------------------------ the trio round-trips


def test_scaffold_instance_round_trips(tmp_path: Path) -> None:
    """The scaffold's own instance.md (stamped like init stamps it) parses to the trio,
    and the body comes back byte-exact — the instance-format spec's first unit clause."""
    raw = resources.files("vsor").joinpath("templates", "scaffold", "instance.md").read_text("utf-8")
    stamped = raw.replace("__VSOR_NAME__", "demo").replace("__VSOR_REQUIRES__", REQUIRES)
    inst = parse_instance(write(tmp_path, stamped))
    assert inst.format == 1
    assert inst.name == "demo"
    assert inst.requires == REQUIRES
    assert inst.body == stamped.split("---\n", 2)[2]


def test_trio_fields_parsed(tmp_path: Path) -> None:
    inst = parse_instance(write(tmp_path, TRIO_FRONTMATTER + "Prompt.\n"))
    assert isinstance(inst, Instance)
    assert (inst.format, inst.name, inst.requires) == (1, "demo", REQUIRES)
    assert inst.body == "Prompt.\n"


def test_body_preserved_byte_exact(tmp_path: Path) -> None:
    """The body is the slice-2 system prompt: interior `---` lines, trailing spaces,
    unicode, and a missing final newline all survive exactly."""
    body = "Line one — «unicode» ☃\n\n---\n\nnot frontmatter, trailing spaces   \nno final newline"
    inst = parse_instance(write(tmp_path, TRIO_FRONTMATTER + body))
    assert inst.body == body


def test_empty_body_is_empty_string(tmp_path: Path) -> None:
    inst = parse_instance(write(tmp_path, TRIO_FRONTMATTER))
    assert inst.body == ""


# ------------------------------------------------------------------ strictness: the trio


def test_missing_format_is_named_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, f'---\nname: demo\nvsor:\n  requires: "{REQUIRES}"\n---\nbody\n')
    assert "format" in msg
    assert "instance.md" in msg


def test_unrecognized_format_value_rejected(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, f'---\nformat: 2\nname: demo\nvsor:\n  requires: "{REQUIRES}"\n---\n')
    assert "format" in msg
    assert "1" in msg  # the only recognized value, named in the fix


def test_missing_name_is_named_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, f'---\nformat: 1\nvsor:\n  requires: "{REQUIRES}"\n---\n')
    assert "name" in msg
    assert "instance.md" in msg


def test_missing_requires_is_named_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, "---\nformat: 1\nname: demo\n---\n")
    assert "requires" in msg
    assert "instance.md" in msg


def test_vsor_key_without_requires_is_named_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, "---\nformat: 1\nname: demo\nvsor: {}\n---\n")
    assert "requires" in msg


# ------------------------------------------------------- strictness: unknown keys are loud


def test_unknown_top_level_key_is_named_with_guidance(tmp_path: Path) -> None:
    """Never silently ignored: the error names the offending key, the file, and the
    migration guidance names the keys that ARE recognized."""
    msg = parse_error(
        tmp_path, f'---\nformat: 1\nname: demo\nbanner: hello\nvsor:\n  requires: "{REQUIRES}"\n---\n'
    )
    assert "banner" in msg
    assert "instance.md" in msg
    for recognized in ("format", "name", "vsor"):
        assert recognized in msg


def test_governance_key_is_rejected(tmp_path: Path) -> None:
    """There is no `governance:` key and never will be — the level is derived from
    `governance/`, never declared. The unknown-key error must fire and name it."""
    msg = parse_error(
        tmp_path, f'---\nformat: 1\nname: demo\ngovernance: 2\nvsor:\n  requires: "{REQUIRES}"\n---\n'
    )
    assert "governance" in msg


# ------------------------------------------------------- reserved slice-2 keys stay inert


def test_reserved_slice2_keys_accepted_inert(tmp_path: Path) -> None:
    """The spec's reserved block — retrieval floors and budgets — parses without error
    and changes nothing at slice 1: same trio, same byte-exact body."""
    reserved = (
        "---\n"
        "format: 1\n"
        "name: demo\n"
        "vsor:\n"
        f'  requires: "{REQUIRES}"\n'
        "retrieval:\n"
        "  vector_floor: null\n"
        "  keyword_floor: null\n"
        "budgets:\n"
        "  maximum_response_characters: 72000\n"
        "---\n"
    )
    body = "The prompt.\n"
    inst = parse_instance(write(tmp_path, reserved + body))
    assert (inst.format, inst.name, inst.requires) == (1, "demo", REQUIRES)
    assert inst.body == body


# ------------------------------------------------------------------ malformed files


def test_missing_frontmatter_is_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, "Just a body, no frontmatter.\n")
    assert "instance.md" in msg


def test_unterminated_frontmatter_is_error(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, "---\nformat: 1\nname: demo\n")
    assert "instance.md" in msg


def test_malformed_yaml_is_instance_error_not_traceback(tmp_path: Path) -> None:
    msg = parse_error(tmp_path, "---\nformat: [1\n---\nbody\n")
    assert "instance.md" in msg


def test_instance_error_is_a_value_error() -> None:
    assert issubclass(InstanceError, ValueError)
