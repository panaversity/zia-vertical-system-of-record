"""AGENTS.md's scaffold tree, rendered from the templates `vsor init` actually copies.

Why this file exists (2026-08-15). The tree under "What `vsor init` writes" was maintained by
hand, and it drifted four ways at once: it listed `vercel.json` and `netlify.toml`, withdrawn
from the scaffold on 2026-08-14 and recorded as withdrawn in the CHANGELOG; it never gained
`site/sidebars.ts`, added the same day; it stated a skill count nothing checked; and the
paragraph under it stated a file count of 30 against a list of 31 when the truth was 29 — the
second time that number had drifted, inside the file that records the first. One fact was living
in a document maintained by discipline, and discipline is exactly what failed.

So the tree is no longer written. It is rendered from
`packages/vsor/src/vsor/templates/scaffold/` — the same bytes `vsor.scaffold` copies, read
through the same `_ALIASED` map, parsed out of that module rather than restated here.

What is authored below: the order of the top-level entries, the note beside each line, and where
the two collapsed groups sit. What is derived: every path, every name, every count. Both
directions are closed —

  * a scaffold file no authored note claims raises, naming it (a new template cannot arrive
    silently);
  * an authored note nothing renders raises, naming it (a withdrawn template cannot linger —
    that is precisely the `vercel.json` failure).

Read by `tests/test_generated_docs.py`, which fails when AGENTS.md and the templates disagree.

    check:      uv run --package vsor python tests/scaffold_tree.py
    regenerate: uv run --package vsor python tests/scaffold_tree.py --write
"""

import argparse
import ast
import difflib
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCAFFOLD = REPO / "packages" / "vsor" / "src" / "vsor" / "templates" / "scaffold"
SCAFFOLD_WRITER = REPO / "packages" / "vsor" / "src" / "vsor" / "scaffold.py"
TEST_INIT = REPO / "packages" / "vsor" / "tests" / "test_init.py"
ACCEPTANCE = REPO / "tests" / "acceptance" / "init.sh"
AGENTS_MD = REPO / "AGENTS.md"

BEGIN = "<!-- generated from packages/vsor/src/vsor/templates/scaffold/ — see tests/scaffold_tree.py -->"
END = "<!-- /generated -->"

NOTE_COL = 33
MAX_WIDTH = 100

HEADER_NOTE = "← created by `vsor init my-sor`; yours, your licence"
FOOTER = "└── (a git repository — init runs `git init` unless one exists)"


class TreeError(Exception):
    """The authored half and the templates disagree — always with the remedy in the message."""


# --------------------------------------------------------------------------- authored


@dataclass(frozen=True)
class Group:
    """A directory of same-shaped files, collapsed onto one line with its members named.

    `base` is the directory whose immediate children ARE the members; `at` is the tree path the
    collapsed line hangs from ("" = top level); `segment` is what it sorts as in ORDER; `shape`
    is the exact path every member must have, which is what makes the collapse honest — a
    collapsed line is a claim about shape, and a group that stopped checking it would hide a
    second file inside a skill directory behind a display that says `SKILL.md`.
    """

    base: str
    at: str
    segment: str
    display: str
    key: str
    shape: str
    inline: bool


GROUPS: tuple[Group, ...] = (
    Group(
        base=".agents/skills",
        at="",
        segment=".agents",
        display=".agents/skills/<name>/SKILL.md",
        key=".agents/skills/<name>/SKILL.md",
        shape="{base}/{member}/SKILL.md",
        inline=False,
    ),
    Group(
        base=".claude/rules",
        at=".claude",
        segment="rules",
        display="rules/",
        key=".claude/rules/",
        shape="{base}/{member}.md",
        inline=True,
    ),
)

# The narrative order of the top-level entries. Every top-level segment must appear exactly once;
# a scaffold that grows or loses one fails here rather than in a reader's head.
ORDER: tuple[str, ...] = (
    "instance.md",
    "knowledge",
    ".agents",
    ".claude",
    "site",
    "AGENTS.md",
    "CLAUDE.md",
    ".env",
    ".gitignore",
)

# One note per rendered line, keyed by the path it renders (directories carry a trailing slash).
# `{...}` placeholders are filled from the templates themselves — a note may describe a file, but
# it may not restate its contents.
NOTES: dict[str, str] = {
    "instance.md": "frontmatter = machine config; body = the MCP server's prompt",
    "knowledge/example.md": "ONE real example document — never an empty directory",
    ".agents/skills/<name>/SKILL.md": "the agent kit (decision 5's revision) — {count} of them:",
    ".claude/": "",
    ".claude/rules/": "{members}",
    ".claude/settings.json": "the vsor verbs pre-permitted; no hooks, nothing phones out",
    "site/": "a REAL, thin Docusaurus shell — the seams agents know natively:",
    "site/docusaurus.config.ts": "live themeConfig (title, navbar items, footer, prism — wired)",
    "site/sidebars.ts": "the sidebar over `knowledge/`, named `tutorialSidebar`",
    "site/src/": "",
    "site/src/css/custom.css": "the design tokens, including --ifm-color-primary",
    "site/src/pages/index.tsx": "the homepage",
    "AGENTS.md": "how an agent works in the scaffolded project",
    "CLAUDE.md": "one line: `@AGENTS.md`",
    ".env": "what the user supplies: {env}",
    ".gitignore": "ignores {gitignore}",
}


# ------------------------------------------------------------------- derived from source


def _module_literal(module: Path, name: str) -> object:
    """A module-level literal, read with `ast` rather than by importing it.

    The boundary tier's own technique (tests/test_boundaries.py): reading source proves what the
    file says, and cannot be satisfied by a value some import-time branch happened to produce.
    """
    tree = ast.parse(module.read_text(encoding="utf-8"), filename=str(module))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names = [node.target.id]
        else:
            continue
        if name in names and node.value is not None:
            return ast.literal_eval(node.value)
    raise TreeError(f"{module.relative_to(REPO)} assigns no module-level literal named {name}")


def aliases() -> dict[str, str]:
    """`vsor.scaffold._ALIASED` — `_gitignore` → `.gitignore`, `_env` → `.env`."""
    value = _module_literal(SCAFFOLD_WRITER, "_ALIASED")
    if not isinstance(value, dict):
        raise TreeError("vsor.scaffold._ALIASED is not a dict literal")
    return {str(k): str(v) for k, v in value.items()}


def expected_files() -> list[str]:
    """`test_init.EXPECTED_FILES` — the ratified contract list, as the test file states it."""
    value = _module_literal(TEST_INIT, "EXPECTED_FILES")
    if not isinstance(value, list):
        raise TreeError("test_init.EXPECTED_FILES is not a list literal")
    return [str(item) for item in value]


def scaffold_paths() -> list[str]:
    """Every path `vsor init` writes, as the project sees it, in LC_ALL=C order."""
    alias = aliases()
    paths: list[str] = []
    for path in SCAFFOLD.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(SCAFFOLD).as_posix()
        head, _, tail = rel.rpartition("/")
        name = alias.get(tail, tail)
        paths.append(f"{head}/{name}" if head else name)
    return sorted(paths)


def _template_text(*parts: str) -> str:
    return SCAFFOLD.joinpath(*parts).read_text(encoding="utf-8")


def substitutions() -> dict[str, str]:
    """The note placeholders, every one of them read out of a template file."""
    ignore = [
        line.strip()
        for line in _template_text("_gitignore").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    env = [
        line.split("=", 1)[0].strip()
        for line in _template_text("_env").splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    ]
    return {"gitignore": ", ".join(ignore), "env": " + ".join(env)}


# --------------------------------------------------------------------------- the tree


@dataclass
class Node:
    segment: str
    display: str
    key: str
    children: list[Node] = field(default_factory=list)
    members: tuple[str, ...] = ()
    group: Group | None = None


def _child(parent: Node, segment: str, display: str, key: str) -> Node:
    for existing in parent.children:
        if existing.segment == segment:
            return existing
    node = Node(segment=segment, display=display, key=key)
    parent.children.append(node)
    return node


def build() -> Node:
    paths = scaffold_paths()
    root = Node(segment="", display="", key="")

    for path in paths:
        if any(path.startswith(f"{g.base}/") for g in GROUPS):
            continue
        parts = path.split("/")
        node = root
        for depth, part in enumerate(parts[:-1]):
            walked = "/".join(parts[: depth + 1])
            node = _child(node, part, f"{part}/", f"{walked}/")
        _child(node, parts[-1], parts[-1], path)

    for group in GROUPS:
        under = [path for path in paths if path.startswith(f"{group.base}/")]
        members = sorted({path[len(group.base) + 1 :].split("/")[0].removesuffix(".md") for path in under})
        if not members:
            raise TreeError(
                f"the authored group `{group.display}` matches no file under {group.base}/ — "
                "either the templates lost it or the group is stale; remove the group from "
                "GROUPS in tests/scaffold_tree.py, or restore the templates"
            )
        shaped = {group.shape.format(base=group.base, member=member) for member in members}
        odd = sorted(set(under) - shaped)
        if odd:
            raise TreeError(
                f"{odd} do not fit `{group.display}` — a collapsed line is a claim that every file "
                f"under {group.base}/ has that shape, so a second file inside one of them would "
                "ship invisibly. Give the group its own lines in tests/scaffold_tree.py, or move "
                "the file"
            )
        parent = root
        if group.at:
            for depth, part in enumerate(group.at.split("/")):
                walked = "/".join(group.at.split("/")[: depth + 1])
                parent = _child(parent, part, f"{part}/", f"{walked}/")
        parent.children.append(
            Node(
                segment=group.segment,
                display=group.display,
                key=group.key,
                members=tuple(members),
                group=group,
            )
        )

    _collapse(root, is_root=True)
    _order(root)
    return root


def _collapse(node: Node, *, is_root: bool = False) -> None:
    """A directory holding exactly one thing is joined to it — `css/` + `custom.css`."""
    for child in node.children:
        _collapse(child)
    if is_root:
        return
    while len(node.children) == 1 and node.group is None:
        only = node.children[0]
        if only.group is not None:
            break
        node.display = node.display + only.display
        node.key = only.key
        node.members = only.members
        node.group = only.group
        node.children = only.children


def _order(root: Node) -> None:
    top = {child.segment for child in root.children}
    if top != set(ORDER):
        missing = sorted(top - set(ORDER))
        stale = sorted(set(ORDER) - top)
        raise TreeError(
            "ORDER in tests/scaffold_tree.py no longer covers the scaffold's top level — "
            f"unordered: {missing or 'none'}; ordered but absent: {stale or 'none'}"
        )
    root.children.sort(key=lambda child: ORDER.index(child.segment))
    _sort_below(root)


def _sort_below(node: Node) -> None:
    for child in node.children:
        child.children.sort(key=lambda grandchild: grandchild.display)
        _sort_below(child)


# ------------------------------------------------------------------------- rendering


def _wrap(words: list[str], width: int) -> list[str]:
    """Members joined by ` · `, broken at the separator so a line never ends mid-name."""
    lines: list[str] = []
    current = ""
    for index, word in enumerate(words):
        piece = word if index == len(words) - 1 else f"{word} ·"
        candidate = f"{current} {piece}".strip()
        if current and len(candidate) > width:
            lines.append(current)
            current = piece
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def _line(left: str, note: str) -> str:
    if not note:
        return left
    pad = max(NOTE_COL - len(left), 2)
    return f"{left}{' ' * pad}{note}"


def _emit(node: Node, prefix: str, child_prefix: str, subs: dict[str, str], seen: set[str]) -> list[str]:
    if node.key not in NOTES:
        raise TreeError(
            f"no note for `{node.key}` — the scaffold gained a file the tree cannot describe; "
            "add it to NOTES in tests/scaffold_tree.py"
        )
    seen.add(node.key)
    local = dict(subs)
    if node.group is not None:
        local["count"] = str(len(node.members))
        local["members"] = " · ".join(node.members)
    left = prefix + node.display
    lines = [_line(left, NOTES[node.key].format(**local))]

    if node.group is not None and not node.group.inline:
        indent = child_prefix.ljust(max(NOTE_COL, len(left) + 2))
        lines.extend(indent + row for row in _wrap(list(node.members), MAX_WIDTH - len(indent)))

    for index, child in enumerate(node.children):
        last = index == len(node.children) - 1
        lines.extend(
            _emit(
                child,
                child_prefix + ("└── " if last else "├── "),
                child_prefix + ("    " if last else "│   "),
                subs,
                seen,
            )
        )
    return lines


def render() -> str:
    root = build()
    subs = substitutions()
    seen: set[str] = set()
    lines = [_line("my-sor/", HEADER_NOTE)]
    for child in root.children:
        # Every top-level entry uses ├──: the footer, which is not a file, holds the last slot.
        lines.extend(_emit(child, "├── ", "│   ", subs, seen))
    lines.append(FOOTER)

    unused = sorted(set(NOTES) - seen)
    if unused:
        raise TreeError(
            f"NOTES describes {unused}, which the scaffold does not write — a withdrawn template "
            "left its line behind; delete the entry from NOTES in tests/scaffold_tree.py"
        )
    return "\n".join(lines) + "\n"


def block() -> str:
    return f"{BEGIN}\n```\n{render()}```\n{END}"


# --------------------------------------------------------------------------- splicing


def _bounds(text: str) -> tuple[int, int]:
    if text.count(BEGIN) > 1 or text.count(END) > 1:
        raise TreeError(
            "AGENTS.md carries the generated-block markers more than once — `--write` would "
            "rewrite the first pair and leave the rest, so exactly one block is allowed"
        )
    start = text.find(BEGIN)
    end = text.find(END)
    if start < 0 or end < 0 or end < start:
        raise TreeError(
            f"AGENTS.md is missing the generated-block markers ({BEGIN} … {END}) — the scaffold "
            "tree must sit between them so it can be regenerated"
        )
    return start, end + len(END)


def current() -> str:
    text = AGENTS_MD.read_text(encoding="utf-8")
    start, end = _bounds(text)
    return text[start:end]


def write() -> bool:
    text = AGENTS_MD.read_text(encoding="utf-8")
    start, end = _bounds(text)
    updated = text[:start] + block() + text[end:]
    if updated == text:
        return False
    AGENTS_MD.write_text(updated, encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--write", action="store_true", help="splice the tree into AGENTS.md")
    args = parser.parse_args(argv)
    try:
        if args.write:
            print("AGENTS.md: rewritten" if write() else "AGENTS.md: already current")
            return 0
        want, have = block(), current()
        if want == have:
            print("AGENTS.md: scaffold tree matches the templates")
            return 0
        sys.stdout.writelines(
            difflib.unified_diff(
                have.splitlines(keepends=True),
                want.splitlines(keepends=True),
                fromfile="AGENTS.md",
                tofile="templates/scaffold/",
            )
        )
        print("\nrun: uv run --package vsor python tests/scaffold_tree.py --write")
        return 1
    except TreeError as error:
        print(f"scaffold-tree: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
