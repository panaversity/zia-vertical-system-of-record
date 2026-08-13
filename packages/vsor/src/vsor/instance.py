"""The strict `instance.md` parser — specs/vsor/instance-format.

The YAML frontmatter is machine config; the markdown body is the system prompt the
slice-2 MCP server hands every visiting agent, preserved byte-exact here from day one.
Strictness is the contract: an unknown top-level key is a named error carrying migration
guidance — never silently ignored. Reserved slice-2 keys (`retrieval`, `budgets`) are
accepted and inert.
"""

from dataclasses import dataclass
from pathlib import Path

import yaml
from packaging.specifiers import InvalidSpecifier, SpecifierSet

_RECOGNIZED = ("format", "name", "vsor")
_RESERVED = ("retrieval", "budgets")


class InstanceError(ValueError):
    """A parse or validation failure; the message names the field, the file, and the fix."""


@dataclass(frozen=True)
class Instance:
    """The required trio plus the body (the slice-2 system prompt, byte-exact)."""

    format: int
    name: str
    requires: str
    body: str


def _split_frontmatter(path: Path, text: str) -> tuple[str, str]:
    """Return (frontmatter yaml, body). The body is everything after the first closing
    `---` line — interior `---` lines belong to the body and survive byte-exact."""
    if not text.startswith("---\n"):
        raise InstanceError(
            f"{path}: no YAML frontmatter found — the file must open with a `---` line, the "
            "frontmatter block (format, name, vsor.requires), and a closing `---` line."
        )
    end = text.find("\n---\n", 3)
    if end >= 0:
        return text[4 : end + 1], text[end + 5 :]
    if text.endswith("\n---"):
        return text[4 : len(text) - 3], ""
    raise InstanceError(
        f"{path}: the YAML frontmatter is never closed — add a `---` line after the "
        "frontmatter block (format, name, vsor.requires)."
    )


def _require_mapping(path: Path, frontmatter: str) -> dict[str, object]:
    try:
        loaded = yaml.safe_load(frontmatter)
    except yaml.YAMLError as exc:
        raise InstanceError(
            f"{path}: the frontmatter is not valid YAML ({exc}). Fix the block between the two "
            "`---` lines; it must carry format, name, and vsor.requires."
        ) from exc
    if not isinstance(loaded, dict) or not all(isinstance(key, str) for key in loaded):
        raise InstanceError(
            f"{path}: the frontmatter must be a YAML mapping of string keys "
            "(format, name, vsor.requires) — got something else."
        )
    return {str(key): value for key, value in loaded.items()}


def _check_keys(path: Path, data: dict[str, object]) -> None:
    unknown = sorted(set(data) - set(_RECOGNIZED) - set(_RESERVED))
    if unknown:
        shown = ", ".join(repr(key) for key in unknown)
        raise InstanceError(
            f"{path}: unknown top-level key {shown} — the recognized keys are "
            f"{', '.join(_RECOGNIZED)} (with {', '.join(_RESERVED)} reserved for a later release). "
            "vsor never ignores a key silently: if it came from a newer vsor, upgrade; site "
            "branding belongs in site/, not here; otherwise remove it."
        )


def _read_format(path: Path, data: dict[str, object]) -> int:
    if "format" not in data:
        raise InstanceError(
            f"{path}: missing required key 'format' — add `format: 1` (the only recognized value)."
        )
    value = data["format"]
    if isinstance(value, bool) or not isinstance(value, int) or value != 1:
        raise InstanceError(
            f"{path}: `format: {value!r}` is not recognized — 1 is the only recognized value; "
            "set `format: 1`."
        )
    return value


def _read_name(path: Path, data: dict[str, object]) -> str:
    if "name" not in data:
        raise InstanceError(f"{path}: missing required key 'name' — add `name: <your-project-name>`.")
    value = data["name"]
    if not isinstance(value, str) or not value.strip():
        raise InstanceError(f"{path}: `name` must be a non-empty string — got {value!r}.")
    return value


def _read_requires(path: Path, data: dict[str, object]) -> str:
    if "vsor" not in data:
        raise InstanceError(
            f"{path}: missing required key 'vsor' with its 'requires' pin — add:\n"
            'vsor:\n  requires: ">=<version>,<<next-minor>"'
        )
    block = data["vsor"]
    if not isinstance(block, dict) or "requires" not in block:
        raise InstanceError(
            f"{path}: the 'vsor' block must carry 'requires' — add:\n"
            'vsor:\n  requires: ">=<version>,<<next-minor>"'
        )
    value = block["requires"]
    if not isinstance(value, str) or not value.strip():
        raise InstanceError(f"{path}: `vsor.requires` must be a version-specifier string — got {value!r}.")
    try:
        SpecifierSet(value)
    except InvalidSpecifier as exc:
        raise InstanceError(
            f"{path}: `vsor.requires: {value!r}` is not a valid version specifier — "
            'use the pip form, e.g. ">=0.1.0,<0.2".'
        ) from exc
    return value


def parse_instance(path: Path) -> Instance:
    """Read and strictly parse ``path`` per specs/vsor/instance-format."""
    text = path.read_text(encoding="utf-8")
    frontmatter, body = _split_frontmatter(path, text)
    data = _require_mapping(path, frontmatter)
    _check_keys(path, data)
    return Instance(
        format=_read_format(path, data),
        name=_read_name(path, data),
        requires=_read_requires(path, data),
        body=body,
    )
