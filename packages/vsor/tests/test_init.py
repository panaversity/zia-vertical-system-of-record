"""Unit contract for `vsor init` — written red-first from specs/vsor/init/spec.md.

The implementation does not exist yet; these tests define its obligations through the one
public entry `vsor.scaffold.run_init(args: list[str]) -> int`, where `args` is argv after
the verb: `[]` bare form, `["."]` in-place, `["<name>"]` named.

Seam contracts the implementation must honor so these tests can patch them:

- scaffold file writes go through `pathlib.Path.write_bytes` / `Path.write_text`
  (the fault-injection seam for the atomicity tests);
- the git binary is discovered via `shutil.which("git")` as a module attribute
  (`shutil.which(...)`, never `from shutil import which`);
- the distribution version is read via `importlib.metadata.version("vsor")` as a module
  attribute (`importlib.metadata.version(...)`);
- the platform check reads `sys.platform`.

Canonical bytes live in the package's `templates/`; where the spec pins stdout, these
tests diff against the templates rather than restating them.
"""

import importlib.metadata
import os
import shutil
import stat
import subprocess
import sys
from importlib import resources
from pathlib import Path

import pytest
from vsor.scaffold import run_init

DEV_VERSION = "0.1.0"

# The spec's file table, exactly — LC_ALL=C sort order (specs/vsor/init acceptance).
EXPECTED_FILES = [
    ".agents/skills/add-sources/SKILL.md",
    ".env",
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "instance.md",
    "knowledge/example.md",
    "site/docusaurus.config.ts",
    "site/src/css/custom.css",
    "site/src/pages/index.tsx",
]

# The one commit holds the table's files minus .env (on disk, ignored).
COMMITTED_FILES = [p for p in EXPECTED_FILES if p != ".env"]


# ---------------------------------------------------------------------------- helpers


def template(*rel: str) -> str:
    """Canonical template text shipped inside the vsor package."""
    return resources.files("vsor").joinpath("templates", *rel).read_text(encoding="utf-8")


def git(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False, cwd=cwd)


def tree(root: Path) -> list[str]:
    """Sorted relative paths of every file under root, excluding .git/."""
    return sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and ".git" not in p.relative_to(root).parts
    )


def byte_map(root: Path) -> dict[str, bytes]:
    return {rel: (root / rel).read_bytes() for rel in tree(root)}


def empty_dirs(root: Path) -> list[Path]:
    return [
        p
        for p in root.rglob("*")
        if p.is_dir() and ".git" not in p.relative_to(root).parts and not any(p.iterdir())
    ]


def slug(err: str) -> str:
    """First stderr line — the stable slug the spec promises to agents."""
    return err.splitlines()[0] if err else ""


@pytest.fixture
def sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """An isolated cwd, a stamped dev version, and hermetic git config.

    The installed workspace version is the 0.0.0 placeholder, so happy paths need
    VSOR_DEV_VERSION (the Makefile exports the same). Git is isolated so neither the
    machine's init.defaultBranch nor its user identity leaks into assertions — which
    also makes every fresh-path test exercise the unset-identity injection branch.
    """
    work = tmp_path / "work"
    work.mkdir()
    gitconfig = tmp_path / "gitconfig"
    gitconfig.write_text("", encoding="utf-8")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(gitconfig))
    monkeypatch.setenv("GIT_CONFIG_SYSTEM", os.devnull)
    monkeypatch.setenv("VSOR_DEV_VERSION", DEV_VERSION)
    monkeypatch.chdir(work)
    return work


def install_instance_md_fault(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the write of instance.md raise — the mid-run fault of the atomicity clause.

    instance.md is written last on the in-place path (settled), so this fault is
    guaranteed to land after other files exist; on the named path it lands mid-staging.
    """
    real_write_bytes = Path.write_bytes
    real_write_text = Path.write_text

    def boom_bytes(self: Path, data: bytes) -> int:
        if self.name == "instance.md":
            raise OSError("injected fault: disk full while writing instance.md")
        return real_write_bytes(self, data)

    def boom_text(
        self: Path,
        data: str,
        encoding: str | None = None,
        errors: str | None = None,
        newline: str | None = None,
    ) -> int:
        if self.name == "instance.md":
            raise OSError("injected fault: disk full while writing instance.md")
        return real_write_text(self, data, encoding=encoding, errors=errors, newline=newline)

    monkeypatch.setattr(Path, "write_bytes", boom_bytes)
    monkeypatch.setattr(Path, "write_text", boom_text)


# ---------------------------------------------------------------- name grammar / args


@pytest.mark.parametrize(
    "name",
    [
        "My SoR",  # the spec acceptance's own bad name
        "MySor",  # uppercase
        "my.sor",  # dots
        "my/sor",  # slashes — parents are never created
        "/tmp/demo",  # absolute path
        "..",  # dot-dot
        "-lead",  # must start [a-z0-9]
        "my_sor",  # underscore is outside the grammar
        "",  # empty
        "a" * 64,  # one past the 63-char ceiling
    ],
)
def test_bad_name_rejected(sandbox: Path, capsys: pytest.CaptureFixture[str], name: str) -> None:
    assert run_init([name]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: bad-name")
    assert list(sandbox.iterdir()) == []  # refusal touches nothing


def test_bad_name_suggests_slugged_form(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["My SoR"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: bad-name")
    assert "my-sor" in err  # the deterministic slug of the rejected name


def test_two_args_is_bad_name(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo", "extra"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: bad-name")
    assert list(sandbox.iterdir()) == []


def test_63_char_name_accepted(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    name = "n" * 63  # ^[a-z0-9][a-z0-9-]{0,62}$ — exactly the ceiling
    assert run_init([name]) == 0
    assert tree(sandbox / name) == EXPECTED_FILES


def test_inplace_bad_basename(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    bad = sandbox / "Bad_Name"
    bad.mkdir()
    monkeypatch.chdir(bad)
    assert run_init(["."]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: bad-name")
    assert "explicit" in err  # the in-place remedy: pass an explicit name
    assert list(bad.iterdir()) == []


# ------------------------------------------------------------------------- bare form


def test_bare_form_prints_instructions_creates_nothing(
    sandbox: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert run_init([]) == 0
    out = capsys.readouterr().out
    assert out == template("stdout", "bare.txt")  # stdout canon lives in templates/
    assert "vsor init" in out
    assert list(sandbox.iterdir()) == []  # never scaffolds


# ----------------------------------------------------------------------- named fresh


def test_named_fresh_exact_files(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo"]) == 0
    demo = sandbox / "demo"
    assert tree(demo) == EXPECTED_FILES  # exactly the table — nothing more, nothing less
    assert (demo / ".git").is_dir()


def test_env_mode_0600_and_no_empty_dirs(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo"]) == 0
    demo = sandbox / "demo"
    assert stat.S_IMODE((demo / ".env").stat().st_mode) == 0o600
    assert empty_dirs(demo) == []
    assert (demo / "CLAUDE.md").read_text(encoding="utf-8") == "@AGENTS.md\n"


def test_named_fresh_git_contract(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo"]) == 0
    demo = sandbox / "demo"
    assert git("rev-list", "--count", "HEAD", cwd=demo).stdout.strip() == "1"
    assert git("symbolic-ref", "--short", "HEAD", cwd=demo).stdout.strip() == "main"
    assert git("log", "-1", "--format=%s", cwd=demo).stdout.strip() == f"vsor init demo (vsor {DEV_VERSION})"
    # Identity was unset (hermetic config) — injected per-invocation, global config never written.
    assert git("log", "-1", "--format=%an|%ae", cwd=demo).stdout.strip() == "vsor|init@vsor.local"
    assert (sandbox.parent / "gitconfig").read_text(encoding="utf-8") == ""
    # .env on disk, ignored; everything else committed.
    assert git("check-ignore", "-q", ".env", cwd=demo).returncode == 0
    assert git("status", "--porcelain", cwd=demo).stdout == ""
    committed = git("show", "--name-only", "--pretty=format:", "HEAD", cwd=demo).stdout.split()
    assert sorted(committed) == COMMITTED_FILES


def test_named_fresh_stdout_canon(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo"]) == 0
    out = capsys.readouterr().out
    expected = (
        template("stdout", "success.txt")
        .replace("__VSOR_NAME__", "demo")
        .replace("__VSOR_VERSION__", DEV_VERSION)
    )
    assert out == expected
    assert "AGENTS.md" in out and "vsor dev" in out  # the pinned handoff greps


def test_configured_default_branch_wins(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    gitconfig = sandbox.parent / "gitconfig"
    gitconfig.write_text("[init]\n\tdefaultBranch = trunk\n", encoding="utf-8")
    assert run_init(["demo"]) == 0
    assert git("symbolic-ref", "--short", "HEAD", cwd=sandbox / "demo").stdout.strip() == "trunk"


def test_determinism(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    a = sandbox / "A"
    b = sandbox / "B"
    a.mkdir()
    b.mkdir()
    monkeypatch.chdir(a)
    assert run_init(["demo"]) == 0
    monkeypatch.chdir(b)
    assert run_init(["demo"]) == 0
    left = byte_map(a / "demo")
    right = byte_map(b / "demo")
    assert sorted(left) == EXPECTED_FILES
    assert left == right  # byte-identical outside .git/


# ----------------------------------------------------------------------- instance.md


def test_instance_md_roundtrip(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """The scaffold's instance.md carries exactly the required trio of the
    instance-format draft, with the exact-floor pin derived from the running version."""
    assert run_init(["demo"]) == 0
    text = (sandbox / "demo" / "instance.md").read_text(encoding="utf-8")
    assert text.startswith("---\n")
    end = text.index("\n---\n", 4)
    frontmatter = text[4:end]
    body = text[end + len("\n---\n") :]
    assert "format: 1" in frontmatter
    assert "name: demo" in frontmatter
    assert 'requires: ">=0.1.0,<0.2"' in frontmatter  # exact floor from 0.1.0
    for reserved in ("retrieval", "budgets", "governance"):
        assert reserved not in frontmatter  # reserved keys documented, never scaffolded
    assert "corpus" in body  # the starter prompt is real, not a placeholder


# -------------------------------------------------------- scaffold template content
# Pins added with specs/vsor/build (2026-08-13): the build/dev slice amends two
# scaffold templates — the config's themes seam and AGENTS.md's verb honesty.


def test_scaffold_config_declares_themes_seam(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """specs/vsor/build: the scaffold's docusaurus.config.ts declares the vocabulary and
    search themes as one visible, deletable line — assemble.mjs (e2e) and the site shell
    both depend on this exact spelling, so it is pinned here."""
    assert run_init(["demo"]) == 0
    config = (sandbox / "demo" / "site" / "docusaurus.config.ts").read_text(encoding="utf-8")
    assert 'themes: ["@vsor/sor-site-mdx", "@easyops-cn/docusaurus-search-local"],' in config


def test_scaffold_agents_md_verb_honesty(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """The scaffolded AGENTS.md documents ONLY implemented verbs in the present tense
    (init spec's AGENTS.md row): dev/build are implemented at the stamped version now,
    serve still is not; the exit table carries the build/dev slugs; and the .env note is
    honest — dev/build need nothing from .env (it serves the slice-2 MCP verbs)."""
    assert run_init(["demo"]) == 0
    text = (sandbox / "demo" / "AGENTS.md").read_text(encoding="utf-8")
    assert "| `vsor dev` | implemented" in text
    assert "| `vsor build` | implemented" in text
    assert "| `vsor serve` | arrives in a later release" in text
    assert text.count("arrives in a later release") == 1  # serve is the only future-tense verb
    for slug_name in (
        "instance-invalid",
        "build-failed",
        "bad-port",
        "port-in-use",
        "dev-failed",
        "missing-runtime",
        "install-failed",
        "build-crashed",
    ):
        assert slug_name in text, f"exit-code table lost the {slug_name} slug"
    assert "read nothing from `.env`" in text
    # The pre-build wording claimed .env gates build — that claim was false and must stay gone.
    assert "Before `vsor build` or `vsor serve` can run" not in text


# --------------------------------------------------------------------- target vetting


def test_exists_refused(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_init(["demo"]) == 0
    capsys.readouterr()
    assert run_init(["demo"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: exists")
    assert "vsor dev" in err  # nothing to do; the next step is named
    assert git("rev-list", "--count", "HEAD", cwd=sandbox / "demo").stdout.strip() == "1"


def test_invalid_instance_md_is_blocked_not_exists(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / "instance.md").write_text("not a vsor instance\n", encoding="utf-8")
    assert run_init(["proj"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: blocked")  # only a VALID instance.md means exists
    assert "instance.md" in err


def test_instance_md_without_pin_is_blocked_not_exists(
    sandbox: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """`format` + `name` alone is not valid — the required trio of specs/vsor/instance-format
    includes `vsor.requires`. Without the pin, the exists remedy ("next: vsor dev") would
    mislead, so the refusal must be `blocked`, not `exists`."""
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / "instance.md").write_text("---\nformat: 1\nname: proj\n---\nprompt\n", encoding="utf-8")
    assert run_init(["proj"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: blocked")
    assert "instance.md" in err


def test_blocked_names_first_five_lexicographic(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    proj = sandbox / "proj"
    proj.mkdir()
    blockers = [f"block-{c}.txt" for c in "abcdefg"]  # seven — five named, two counted
    for name in blockers:
        (proj / name).write_text("x\n", encoding="utf-8")
    before = byte_map(proj)
    assert run_init(["proj"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: blocked")
    for name in blockers[:5]:
        assert name in err
    for name in blockers[5:]:
        assert name not in err
    assert "and 2 more" in err
    assert byte_map(proj) == before  # refusal touches nothing


def test_allowlisted_target_accepted(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    proj = sandbox / "proj"
    (proj / ".vscode").mkdir(parents=True)
    (proj / ".vscode" / "settings.json").write_text("{}\n", encoding="utf-8")
    (proj / "README.md").write_text("# mine\n", encoding="utf-8")
    (proj / "LICENSE-MIT").write_text("MIT\n", encoding="utf-8")
    (proj / ".DS_Store").write_bytes(b"\x00")
    assert run_init(["proj"]) == 0
    for rel in EXPECTED_FILES:
        assert (proj / rel).is_file(), rel
    assert (proj / "README.md").read_text(encoding="utf-8") == "# mine\n"  # never modified


def test_boilerplate_fresh_target_one_commit_clean_tree(
    sandbox: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Fresh path over an allowlisted-boilerplate target: `git add -A` (the settled staging
    mechanism) makes ONE commit holding the scaffold plus the pre-existing boilerplate, leaving
    a clean tree with .env still the only uncommitted file. The ratified spec's "exactly the
    table's files" sentence describes the empty-target case; the wording amendment for this
    branch is recorded with the session lead (2026-08-13) — this test pins shipped behavior."""
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / "README.md").write_text("# mine\n", encoding="utf-8")
    (proj / "LICENSE").write_text("MIT\n", encoding="utf-8")
    (proj / ".vscode").mkdir()
    (proj / ".vscode" / "settings.json").write_text("{}\n", encoding="utf-8")
    assert run_init(["proj"]) == 0
    assert git("rev-list", "--count", "HEAD", cwd=proj).stdout.strip() == "1"
    assert git("check-ignore", "-q", ".env", cwd=proj).returncode == 0
    assert git("status", "--porcelain", cwd=proj).stdout == ""  # everything else committed
    committed = git("show", "--name-only", "--pretty=format:", "HEAD", cwd=proj).stdout.split()
    boilerplate = [".vscode/settings.json", "LICENSE", "README.md"]
    assert sorted(committed) == sorted(COMMITTED_FILES + boilerplate)


def test_nested_ancestor_refused(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    outer = sandbox / "outer"
    sub = outer / "docs"
    sub.mkdir(parents=True)
    (outer / "instance.md").write_text(
        '---\nformat: 1\nname: outer\nvsor:\n  requires: ">=0.1.0,<0.2"\n---\nprompt\n',
        encoding="utf-8",
    )
    monkeypatch.chdir(sub)
    assert run_init(["child"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: nested")
    assert str(outer) in err  # the ancestor path is named
    assert not (sub / "child").exists()


# -------------------------------------------------------------------- git integration


def test_inplace_existing_repo(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The fresh-GitHub-clone path: merge the ignore file, commit nothing, say why."""
    gh = sandbox / "gh"
    gh.mkdir()
    (gh / "README.md").write_text("# gh\n", encoding="utf-8")
    (gh / ".DS_Store").write_bytes(b"\x00")
    (gh / ".gitignore").write_text("node_modules/\n", encoding="utf-8")
    assert git("init", "-q", str(gh)).returncode == 0
    monkeypatch.chdir(gh)
    assert run_init(["."]) == 0
    out = capsys.readouterr().out
    ignore = (gh / ".gitignore").read_text(encoding="utf-8")
    assert "node_modules/" in ignore  # existing lines kept
    assert ignore.count("# vsor\n") == 1 and ignore.count("# end vsor\n") == 1
    assert git("check-ignore", "-q", ".env", cwd=gh).returncode == 0
    assert git("log", "--oneline", cwd=gh).stdout.strip() == ""  # no commit…
    assert git("diff", "--cached", "--name-only", cwd=gh).stdout.strip() == ""  # …nothing staged
    assert "existing git repository" in out
    assert out.index("existing git repository") < out.index("AGENTS.md")  # note before handoff
    assert f"Created gh in the current directory (vsor {DEV_VERSION})." in out
    for rel in EXPECTED_FILES:
        assert (gh / rel).is_file(), rel


def test_gitignore_merge_idempotent(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Running the merge over a .gitignore that already holds the block changes nothing."""
    proj = sandbox / "proj"
    proj.mkdir()
    seeded = "node_modules/\n" + template("scaffold", "_gitignore")
    (proj / ".gitignore").write_text(seeded, encoding="utf-8")
    assert run_init(["proj"]) == 0
    assert (proj / ".gitignore").read_text(encoding="utf-8") == seeded  # block present → no change


def test_negated_env_line_blocked(sandbox: Path, capsys: pytest.CaptureFixture[str]) -> None:
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / ".gitignore").write_text("!.env\n", encoding="utf-8")
    assert run_init(["proj"]) == 1
    err = capsys.readouterr().err
    assert slug(err).startswith("error: blocked")
    assert "!.env" in err  # the blocker is named with its remedy
    assert (proj / ".gitignore").read_text(encoding="utf-8") == "!.env\n"
    assert list(proj.iterdir()) == [proj / ".gitignore"]


def test_named_target_inside_parent_repo(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    parent = sandbox / "parent"
    parent.mkdir()
    assert git("init", "-q", "-b", "main", str(parent)).returncode == 0
    monkeypatch.chdir(parent)
    assert run_init(["notes"]) == 0
    assert not (parent / "notes" / ".git").exists()  # no nested repo…
    assert git("log", "--oneline", cwd=parent).stdout.strip() == ""  # …no commit into the parent
    assert tree(parent / "notes") == EXPECTED_FILES


def test_git_absent_scaffolds_and_skips(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(shutil, "which", lambda *_a, **_k: None)
    assert run_init(["demo"]) == 0
    out = capsys.readouterr().out
    demo = sandbox / "demo"
    assert tree(demo) == EXPECTED_FILES  # the scaffold completes
    assert not (demo / ".git").exists()
    assert "git not found" in out
    assert out.index("git not found") < out.index("AGENTS.md")  # note before handoff


# -------------------------------------------------------------------------- atomicity


def test_atomicity_named_fresh(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    install_instance_md_fault(monkeypatch)
    try:
        rc: int | None = run_init(["demo"])
    except OSError:
        rc = None  # a propagated fault is acceptable; a 0 return is not
    assert rc != 0
    assert list(sandbox.iterdir()) == []  # no target, no leftover staging temp dir


def test_atomicity_inplace_restores(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / "README.md").write_text("# mine\n", encoding="utf-8")
    (proj / ".gitignore").write_text("node_modules/\n", encoding="utf-8")
    before = byte_map(proj)
    monkeypatch.chdir(proj)
    install_instance_md_fault(monkeypatch)
    try:
        rc: int | None = run_init(["."])
    except OSError:
        rc = None
    assert rc != 0
    assert sorted(p.name for p in proj.iterdir()) == [".gitignore", "README.md"]
    assert byte_map(proj) == before  # created paths gone, prior .gitignore bytes restored


def test_atomicity_inplace_git_fault_restores(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A git-step failure AFTER `git init` succeeded (commit refused) must roll back
    target/.git along with every created file — a stray .git would survive the failure and
    make a retry misread the target as inside an existing repository (found by review)."""
    proj = sandbox / "proj"
    proj.mkdir()
    (proj / "README.md").write_text("# mine\n", encoding="utf-8")
    before = byte_map(proj)
    real_run = subprocess.run

    def refuse_commit(cmd: list[str], *args: object, **kwargs: object) -> object:
        if cmd and cmd[0] == "git" and "commit" in cmd:
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="injected fault: commit refused")
        return real_run(cmd, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(subprocess, "run", refuse_commit)
    with pytest.raises(RuntimeError, match="commit"):
        run_init(["proj"])
    assert sorted(p.name for p in proj.iterdir()) == ["README.md"]  # .git and scaffold gone
    assert byte_map(proj) == before  # restored byte-exact
    # And the retry the clause promises: with git healthy again, the same init succeeds fresh.
    monkeypatch.setattr(subprocess, "run", real_run)
    assert run_init(["proj"]) == 0
    assert git("rev-list", "--count", "HEAD", cwd=proj).stdout.strip() == "1"


# ---------------------------------------------------------------- version / platform


def test_unstamped_refused(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("VSOR_DEV_VERSION", raising=False)
    monkeypatch.setattr(importlib.metadata, "version", lambda _dist: "0.0.0")
    assert run_init(["demo"]) == 3
    err = capsys.readouterr().err
    assert slug(err).startswith("error: unstamped")
    assert "VSOR_DEV_VERSION" in err  # the remedy names the harness knob
    assert list(sandbox.iterdir()) == []


def test_dev_version_env_stamps_requires(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("VSOR_DEV_VERSION", "9.9.9")
    monkeypatch.setattr(importlib.metadata, "version", lambda _dist: "0.0.0")
    assert run_init(["demo"]) == 0
    demo = sandbox / "demo"
    text = (demo / "instance.md").read_text(encoding="utf-8")
    assert 'requires: ">=9.9.9,<9.10"' in text  # exact floor: minor+1, never 9.10.0
    assert git("log", "-1", "--format=%s", cwd=demo).stdout.strip() == "vsor init demo (vsor 9.9.9)"


def test_windows_refused(
    sandbox: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "platform", "win32")
    assert run_init(["demo"]) == 3
    err = capsys.readouterr().err
    assert slug(err).startswith("error: unsupported-platform")
    assert "WSL" in err  # the remedy names WSL
    assert list(sandbox.iterdir()) == []


def test_unwritable_target_is_blocked_not_traceback(
    sandbox: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """found live: a chmod-555 target crashed with a traceback — an unwritable target is a
    foreseeable refusal (`error: blocked`), and the directory is left as it was found."""
    rodir = sandbox / "rodir"
    rodir.mkdir()
    rodir.chmod(0o555)
    try:
        os.chdir(rodir)
        code = run_init(["."])
    finally:
        os.chdir(sandbox)
        rodir.chmod(0o755)
    assert code == 1
    err = capsys.readouterr().err
    assert err.startswith("error: blocked")
    assert "permission" in err.lower() or "cannot use" in err.lower()
    assert list(rodir.iterdir()) == []  # as it was found
