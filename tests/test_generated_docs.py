"""One fact, one file — enforced, for the facts that are the scaffold's file list.

Boundary tier: reads source, never imports the package under test. Every check here replaces a
piece of discipline that measurably failed. On 2026-08-15 an external review found the tree in
AGENTS.md still listing `vercel.json` and `netlify.toml` (withdrawn from the scaffold the day
before), never listing `site/sidebars.ts` (added the same day), and the paragraph beneath it
stating a file count of 30 against a list of 31 when the truth was 29 — the second time that
number had drifted, in the file that records the first drift. The repair is not the edit.

So: the tree is generated (`tests/scaffold_tree.py`), and the other places that restate the same
fact by hand are pinned against it here. What used to need remembering now needs a passing test.
"""

import re
from pathlib import Path

import pytest
import scaffold_tree
from scaffold_tree import TreeError

REPO = Path(__file__).resolve().parent.parent
SCAFFOLD = REPO / "packages" / "vsor" / "src" / "vsor" / "templates" / "scaffold"
ACCEPTANCE = REPO / "tests" / "acceptance" / "init.sh"
PYPI_README = REPO / "packages" / "vsor" / "README.md"
SCAFFOLDED_AGENTS = SCAFFOLD / "AGENTS.md"

REGENERATE = "uv run --package vsor python tests/scaffold_tree.py --write"

# English, not a repo fact — the counts these words stand for are always derived.
NUMBER_WORDS = (
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
)


def skills() -> list[str]:
    return sorted(p.name for p in (SCAFFOLD / ".agents" / "skills").iterdir() if p.is_dir())


def rules() -> list[str]:
    return sorted(p.stem for p in (SCAFFOLD / ".claude" / "rules").glob("*.md"))


def first_cells(text: str, heading: str) -> list[str]:
    """The backticked first cell of every row of the markdown table under `heading`, sorted.

    Sorted because the tables are ordered for a reader — `add-sources` first, because it is the
    entry point — and that order is prose. What must not drift is the membership.
    """
    assert heading in text, f"the document no longer has a `{heading}` section"
    section = text.split(heading, 1)[1].split("\n## ", 1)[0]
    return sorted(
        match.group(1) for line in section.splitlines() if (match := re.match(r"\|\s*`([^`]+)`\s*\|", line))
    )


def flowed(text: str) -> str:
    """Markdown wrapped at 100 columns puts line breaks inside sentences; a phrase check has to
    read the sentence, not the line (found live: `the four\\n`.claude/rules/`` missed both ways)."""
    return re.sub(r"\s+", " ", text)


# ------------------------------------------------------- AGENTS.md's tree is generated


def test_the_scaffold_tree_in_agents_md_is_generated_from_the_templates() -> None:
    assert scaffold_tree.block() == scaffold_tree.current(), (
        "AGENTS.md's scaffold tree no longer matches "
        "packages/vsor/src/vsor/templates/scaffold/. The document is generated, so the templates "
        f"win: run `{REGENERATE}`"
    )


def test_a_template_the_tree_cannot_describe_fails_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    """A file added to the scaffold must be described, not silently omitted."""
    real = scaffold_tree.scaffold_paths()
    monkeypatch.setattr(scaffold_tree, "ORDER", (*scaffold_tree.ORDER, "vercel.json"))
    monkeypatch.setattr(scaffold_tree, "scaffold_paths", lambda: sorted([*real, "vercel.json"]))
    with pytest.raises(TreeError, match=r"no note for `vercel.json`"):
        scaffold_tree.render()


def test_a_withdrawn_template_cannot_leave_its_line_behind(monkeypatch: pytest.MonkeyPatch) -> None:
    """The 2026-08-14 failure, as a test: the host configs left the scaffold, their lines did not."""
    monkeypatch.setattr(
        scaffold_tree,
        "NOTES",
        {**scaffold_tree.NOTES, "vercel.json": "the git-connected deploy"},
    )
    with pytest.raises(TreeError, match=r"vercel.json.*which the scaffold does not write"):
        scaffold_tree.render()


def test_a_second_file_in_a_collapsed_directory_cannot_hide(monkeypatch: pytest.MonkeyPatch) -> None:
    """`.agents/skills/<name>/SKILL.md` is a claim about shape, not just a place to hang a count.

    A skill directory that grew a `reference.md` would ship in every project while the tree still
    said `SKILL.md` — the collapse would be doing the hiding.
    """
    real = scaffold_tree.scaffold_paths()
    stowaway = ".agents/skills/deploy/reference.md"
    monkeypatch.setattr(scaffold_tree, "scaffold_paths", lambda: sorted([*real, stowaway]))
    with pytest.raises(TreeError, match=r"reference\.md.*do not fit"):
        scaffold_tree.render()


# ------------------------------------------- the contract's two homes still say one thing


def test_expected_files_is_exactly_what_the_templates_hold() -> None:
    """`test_init.EXPECTED_FILES` is the ratified contract; the templates are the bytes.

    The unit suite proves init's OUTPUT matches EXPECTED_FILES by running it. This proves the
    same set statically, so a template added without a contract line fails in `make gate`'s
    boundary tier too — and so this module can trust either name for the same fact.
    """
    assert scaffold_tree.expected_files() == scaffold_tree.scaffold_paths()


def test_the_shell_acceptance_pins_the_same_file_list() -> None:
    """AGENTS.md calls init.sh and EXPECTED_FILES "the contract" — two homes, deliberately.

    Deliberate duplication is only safe while something checks it. Nothing did: the shell list
    and the python list could have disagreed for a whole release and both suites stayed green.
    """
    text = ACCEPTANCE.read_text(encoding="utf-8")
    assert text.count("<<'EOF'") == 1, "init.sh grew a second heredoc — this check reads the first"
    body = text.split("<<'EOF'", 1)[1].split("\nEOF", 1)[0]
    listed = [line for line in body.splitlines() if line.startswith("demo/")]
    assert listed == [f"demo/{path}" for path in scaffold_tree.expected_files()], (
        "tests/acceptance/init.sh's file list and test_init.py's EXPECTED_FILES disagree — "
        "they are the same contract in two languages and must be edited together"
    )


# ------------------------------------- what a scaffolded project is told about itself


def test_the_scaffolded_agents_md_lists_every_skill_it_ships() -> None:
    text = SCAFFOLDED_AGENTS.read_text(encoding="utf-8")
    assert first_cells(text, "## The skills") == skills(), (
        "the scaffolded AGENTS.md's skill table and .agents/skills/ disagree — a user would be "
        "told about a skill they do not have, or not told about one they do"
    )


def test_the_scaffolded_agents_md_lists_every_rule_it_ships() -> None:
    text = SCAFFOLDED_AGENTS.read_text(encoding="utf-8")
    assert [cell.removesuffix(".md") for cell in first_cells(text, "## The rules")] == rules()


def test_the_scaffolded_agents_md_counts_are_the_real_counts() -> None:
    """ "the fourteen `.agents/skills/`" is a count written in words — the drift-prone kind."""
    text = flowed(SCAFFOLDED_AGENTS.read_text(encoding="utf-8"))
    for count, phrase in ((len(rules()), "`.claude/rules/`"), (len(skills()), "`.agents/skills/`")):
        assert f"the {NUMBER_WORDS[count]} {phrase}" in text, (
            f"the scaffolded AGENTS.md does not say `the {NUMBER_WORDS[count]} {phrase}` — there are {count}"
        )


def test_the_pypi_page_counts_are_the_real_counts() -> None:
    """packages/vsor/README.md IS the PyPI page: a wrong count there is the first thing read."""
    text = flowed(PYPI_README.read_text(encoding="utf-8"))
    expected = f"{NUMBER_WORDS[len(rules())]} rules and {NUMBER_WORDS[len(skills())]} skills"
    assert expected in text, f"packages/vsor/README.md does not say `{expected}`"


# --------------------------------------------- nothing still ships the withdrawn configs


@pytest.mark.parametrize("name", ["vercel.json", "netlify.toml"])
def test_the_host_configs_are_not_scaffolded_anywhere(name: str) -> None:
    """The withdrawal, as an assertion. They live in `.agents/skills/deploy/SKILL.md` as blocks
    an agent writes once the owner picks a host — never as files every project carries."""
    assert not (SCAFFOLD / name).exists()
    assert name not in scaffold_tree.expected_files()
