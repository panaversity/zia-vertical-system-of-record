"""`vsor init` — ownership-by-scaffold, implemented to specs/vsor/init/spec.md (ratified 2026-08-13).

The public entry is ``run_init(args)``, where ``args`` is argv after the verb: ``[]`` is the bare
instructional form (never scaffolds), ``["."]`` scaffolds the cwd, ``["<name>"]`` scaffolds
``<name>/``; anything else is ``error: bad-name``.

Canonical bytes live in this package's ``templates/``: scaffold files under ``templates/scaffold/``
and stdout canon under ``templates/stdout/``. Two scaffold filenames ship under an alias —
``_gitignore`` → ``.gitignore`` and ``_env`` → ``.env`` — because a real ``.gitignore`` template
would act as a live ignore file inside this package and silently drop its sibling. Stamping
replaces exactly the authored values and their derivations — ``__VSOR_NAME__``,
``__VSOR_VERSION__``, ``__VSOR_REQUIRES__`` (the exact-floor pin derived from the version) and
``__VSOR_YEAR__`` (the footer copyright year) — so the same name + version + year yields
byte-identical trees.

Seams the unit tests patch — keep these as module-attribute calls, never ``from x import y``:
every scaffold write goes through ``Path.write_bytes``; git discovery is ``shutil.which``;
the distribution version is ``importlib.metadata.version``; the platform gate reads
``sys.platform``.

Nothing here imports ``vsor.cli`` — the CLI is the top of the graph, never a library.
"""

import contextlib
import datetime
import importlib.metadata
import os
import re
import shutil
import subprocess
import sys
import tempfile
from fnmatch import fnmatch
from importlib import resources
from importlib.resources.abc import Traversable
from pathlib import Path

_NAME_RULE = "^[a-z0-9][a-z0-9-]{0,62}$"
_NAME_RE = re.compile(_NAME_RULE)
_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")

# The two aliased template names — and only these two (the .agents/ directory is stored literally).
_ALIASED = {"_gitignore": ".gitignore", "_env": ".env"}

# specs/vsor/init "Target acceptance" — the exact allowlist. Slash-marked entries must be
# directories; LICENSE* is a glob; the rest are exact file names.
_ALLOW_DIRS = {".git", ".vscode", ".idea"}
_ALLOW_FILES = {
    ".gitignore",
    ".gitattributes",
    "README.md",
    ".DS_Store",
    ".nvmrc",
    ".node-version",
    ".python-version",
    ".tool-versions",
    ".editorconfig",
}


class _EnvNotIgnored(Exception):
    """Post-write verification found .env would not be ignored by git."""


class _Tracker:
    """Everything the in-place path created, so a failure can restore the filesystem."""

    def __init__(self, gitignore_prior: bytes | None) -> None:
        self.gitignore_prior = gitignore_prior
        self.files: list[Path] = []
        self.dirs: list[Path] = []
        self.git_dir: Path | None = None


def _refuse(code: int, slug: str, prose: str) -> int:
    """Errors go to stderr; the first line is the stable slug agents branch on."""
    sys.stderr.write(f"error: {slug}\n{prose}\n")
    return code


def _templates() -> Traversable:
    return resources.files("vsor").joinpath("templates")


def _stdout_text(name: str) -> str:
    return _templates().joinpath("stdout", name).read_text(encoding="utf-8")


def _stamp_text(text: str, subs: dict[str, str]) -> str:
    for token, value in subs.items():
        text = text.replace(token, value)
    return text


def _scaffold_entries() -> list[tuple[str, bytes]]:
    """(relative path, template bytes) in the pinned write order: .gitignore first,
    instance.md last, sorted traversal between — deterministic on every backend."""
    entries: list[tuple[str, bytes]] = []

    def walk(node: Traversable, prefix: str) -> None:
        for child in sorted(node.iterdir(), key=lambda t: t.name):
            if child.is_dir():
                walk(child, f"{prefix}{child.name}/")
            else:
                entries.append((prefix + _ALIASED.get(child.name, child.name), child.read_bytes()))

    walk(_templates().joinpath("scaffold"), "")

    def order(item: tuple[str, bytes]) -> tuple[int, str]:
        rank = 0 if item[0] == ".gitignore" else 2 if item[0] == "instance.md" else 1
        return (rank, item[0])

    entries.sort(key=order)
    return entries


def _slugged(raw: str) -> str:
    """The deterministic slug suggested by the bad-name error, or "" when there is
    nothing honest to suggest.

    A string starting with `-` is a mistyped FLAG, never a project name — suggesting
    `vsor init help` for `--help` was how a stranger's first exploratory keystroke
    could scaffold a project called `help` (found live 2026-08-14; `-h`/`--help`
    itself is now answered before this is reached, but any other flag lands here)."""
    if raw.startswith("-"):
        return ""
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    return slug[:63].strip("-")


def _resolve_version() -> tuple[str | None, str]:
    """The one contract value: the running distribution version, or the harness override.

    Returns (version, reported) — ``reported`` names what the distribution said, for the
    unstamped error. No filesystem sniffing, ever.
    """
    try:
        installed: str | None = importlib.metadata.version("vsor")
    except importlib.metadata.PackageNotFoundError:
        installed = None
    if installed is not None and installed != "0.0.0" and _VERSION_RE.fullmatch(installed):
        return installed, installed
    env = os.environ.get("VSOR_DEV_VERSION", "")
    if _VERSION_RE.fullmatch(env):
        return env, env
    return None, installed if installed is not None else "missing"


def _requires_pin(version: str) -> str:
    """Exact floor: running X.Y.Z writes >=X.Y.Z,<X.(Y+1) — specs/vsor/init, one fact one file."""
    major, minor, _patch = version.split(".")
    return f">={version},<{major}.{int(minor) + 1}"


def _is_vsor_instance(path: Path) -> bool:
    """Only a *valid* instance.md means `error: exists`; anything else is a blocker.

    Valid = the required trio of specs/vsor/instance-format: `format: 1`, `name:`, and the
    `vsor.requires` pin. A file missing the pin gets `error: blocked`, not `exists` — the
    exists remedy says "next: vsor dev", which a pinless instance.md could not satisfy.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    if not text.startswith("---\n"):
        return False
    end = text.find("\n---\n", 4)
    if end < 0:
        return False
    frontmatter = text[4:end]
    has_format = re.search(r"^format:\s*1\s*$", frontmatter, re.MULTILINE) is not None
    has_name = re.search(r"^name:\s*\S", frontmatter, re.MULTILINE) is not None
    has_pin = (
        re.search(r"^vsor:", frontmatter, re.MULTILINE) is not None
        and re.search(r"^\s+requires:\s*\S", frontmatter, re.MULTILINE) is not None
    )
    return has_format and has_name and has_pin


def _blockers(target: Path) -> list[str]:
    """Entries that keep a target from being accepted, lexicographically sorted."""
    found: list[str] = []
    for entry in sorted(target.iterdir(), key=lambda p: p.name):
        name = entry.name
        if entry.is_dir() and name in _ALLOW_DIRS:
            continue
        if entry.is_file() and (name in _ALLOW_FILES or fnmatch(name, "LICENSE*")):
            continue
        found.append(name)
    return found


def _merged_gitignore(existing: str, block: str) -> str:
    """Idempotent marker-block merge with newline hygiene — the one permitted modification."""
    if block in existing:
        return existing
    if existing and not existing.endswith("\n"):
        existing += "\n"
    return existing + block


def _git(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False)


def _git_ok(args: list[str]) -> None:
    proc = _git(args)
    if proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")


def _fresh_git_repo(repo: Path, name: str, version: str) -> None:
    """git init + the one commit, per the spec's fresh-target contract.

    The user's configured init.defaultBranch wins; otherwise the branch is main. Identity is
    injected per-invocation only for whichever keys are unset — global config is never written.
    """
    if _git(["config", "--get", "init.defaultBranch"]).stdout.strip():
        _git_ok(["-C", str(repo), "init", "-q"])
    else:
        _git_ok(["-C", str(repo), "init", "-q", "-b", "main"])
    _git_ok(["-C", str(repo), "add", "-A"])
    identity: list[str] = []
    if _git(["-C", str(repo), "config", "--get", "user.name"]).returncode != 0:
        identity += ["-c", "user.name=vsor"]
    if _git(["-C", str(repo), "config", "--get", "user.email"]).returncode != 0:
        identity += ["-c", "user.email=init@vsor.local"]
    message = f"vsor init {name} (vsor {version})"
    _git_ok(["-C", str(repo), *identity, "commit", "-q", "--no-gpg-sign", "--no-verify", "-m", message])


def _verify_env_ignored(repo: Path) -> None:
    """The spec's post-merge check: with a repo present, `git check-ignore -q .env` must pass."""
    if _git(["-C", str(repo), "check-ignore", "-q", ".env"]).returncode != 0:
        raise _EnvNotIgnored


_ENV_NOT_IGNORED_PROSE = (
    "the repository's ignore rules leave .env tracked (git check-ignore .env fails), so secrets\n"
    "would land in version control. Fix the enclosing ignore rules, then re-run."
)


def _write_entries(
    root: Path, entries: list[tuple[str, bytes]], subs: dict[str, str], tracker: _Tracker | None
) -> None:
    """Write every stamped template under root; track creations when a tracker is given."""
    for rel, data in entries:
        dest = root / rel
        if rel == ".gitignore" and tracker is not None and tracker.gitignore_prior is not None:
            prior = tracker.gitignore_prior.decode("utf-8")
            block = _stamp_text(data.decode("utf-8"), subs)
            dest.write_bytes(_merged_gitignore(prior, block).encode("utf-8"))
            continue
        missing: list[Path] = []
        parent = dest.parent
        while not parent.exists():
            missing.append(parent)
            parent = parent.parent
        for directory in reversed(missing):
            directory.mkdir()
            if tracker is not None:
                tracker.dirs.append(directory)
        if tracker is not None:
            tracker.files.append(dest)
        dest.write_bytes(_stamp_text(data.decode("utf-8"), subs).encode("utf-8"))
        if rel == ".env":
            os.chmod(dest, 0o600)


def _rollback(target: Path, tracker: _Tracker) -> None:
    """Undo exactly what the in-place path created; restore the pre-merge .gitignore bytes."""
    if tracker.git_dir is not None:
        shutil.rmtree(tracker.git_dir, ignore_errors=True)
    for file in reversed(tracker.files):
        file.unlink(missing_ok=True)
    for directory in reversed(tracker.dirs):
        with contextlib.suppress(OSError):
            directory.rmdir()
    if tracker.gitignore_prior is not None:
        (target / ".gitignore").write_bytes(tracker.gitignore_prior)


def _scaffold_staged(
    target: Path,
    entries: list[tuple[str, bytes]],
    subs: dict[str, str],
    name: str,
    version: str,
    git_present: bool,
    in_repo: bool,
) -> int:
    """Named nonexistent target: stage the complete tree (commit included) in a same-filesystem
    sibling temp dir, then one rename. A failure removes the temp dir — the filesystem is as
    init found it."""
    tmp = Path(tempfile.mkdtemp(dir=target.parent, prefix=f".{name}."))
    try:
        _write_entries(tmp, entries, subs, tracker=None)
        if git_present:
            if not in_repo:
                _fresh_git_repo(tmp, name, version)
            _verify_env_ignored(tmp)
        os.rename(tmp, target)
    except _EnvNotIgnored:
        shutil.rmtree(tmp, ignore_errors=True)
        return _refuse(1, "blocked", _ENV_NOT_IGNORED_PROSE)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return 0


def _scaffold_into(
    target: Path,
    entries: list[tuple[str, bytes]],
    subs: dict[str, str],
    name: str,
    version: str,
    git_present: bool,
    in_repo: bool,
) -> int:
    """Existing target (in-place form, or a named empty/allowlisted directory): .gitignore is
    written first, instance.md last; every created path and the pre-merge .gitignore bytes are
    restored on failure."""
    gitignore = target / ".gitignore"
    tracker = _Tracker(gitignore.read_bytes() if gitignore.is_file() else None)
    try:
        _write_entries(target, entries, subs, tracker)
        if git_present:
            if not in_repo:
                # Tracked BEFORE the repo exists (found by review): a git-step failure after
                # `git init` (e.g. commit refused) must roll back target/.git too — a stray
                # .git would make a retry misread the target as inside an existing repository.
                tracker.git_dir = target / ".git"
                _fresh_git_repo(target, name, version)
            _verify_env_ignored(target)
    except _EnvNotIgnored:
        _rollback(target, tracker)
        return _refuse(1, "blocked", _ENV_NOT_IGNORED_PROSE)
    except BaseException:
        _rollback(target, tracker)
        raise
    return 0


def run_init(args: list[str]) -> int:
    """The `vsor init` verb. ``args`` is argv after the verb; returns the process exit code."""
    if sys.platform in {"win32", "cygwin"}:
        return _refuse(
            3,
            "unsupported-platform",
            "vsor v0 runs on macOS and Linux. On Windows, install WSL"
            " (https://learn.microsoft.com/windows/wsl/) and run vsor inside it.",
        )

    # `-h`/`--help` is answered BEFORE the name rule, because `init` is the one verb
    # argparse never sees (see the module note in cli.py) and it therefore has to own
    # the flag argparse owns for `dev`, `build` and `serve`. found live 2026-08-14:
    # without this, a stranger's first exploratory keystroke — `vsor init --help` —
    # exited 1 with `error: bad-name` and suggested `vsor init help`, which scaffolds a
    # 31-file project called `help`.
    if any(arg in {"-h", "--help"} for arg in args):
        sys.stdout.write(_stdout_text("init-help.txt"))
        return 0

    if not args:  # the bare form never scaffolds — one instructional screen, exit 0
        sys.stdout.write(_stdout_text("bare.txt"))
        return 0

    if len(args) > 1:
        return _refuse(
            1,
            "bad-name",
            f"vsor init takes one name; got {len(args)} arguments.\n"
            f"The rule: one path segment matching {_NAME_RULE}. Run: vsor init <name>",
        )

    raw = args[0]
    in_place = raw == "."
    name = Path.cwd().name if in_place else raw
    if not _NAME_RE.fullmatch(name):
        suggestion = _slugged(name)
        if in_place:
            prose = (
                f"the current directory's name '{name}' fails the project-name rule {_NAME_RULE}.\n"
                f"Pass an explicit name instead: vsor init {suggestion or '<name>'}"
            )
        else:
            prose = (
                f"'{raw}' fails the project-name rule {_NAME_RULE} — lowercase letters, digits and\n"
                "hyphens, one path segment: no dots, slashes or absolute paths; parents are never created."
            )
            if suggestion:
                prose += f"\nTry: vsor init {suggestion}"
        return _refuse(1, "bad-name", prose)

    version, reported = _resolve_version()
    if version is None:
        return _refuse(
            3,
            "unstamped",
            f"the installed vsor distribution reports version '{reported}' — a placeholder, so the\n"
            "vsor.requires pin would point at nothing. This is a packaging defect: the wheel was\n"
            "built without a release stamp. Dev/CI harnesses set VSOR_DEV_VERSION=<x.y.z> to name\n"
            "the version to pin (the Makefile exports 0.1.0).",
        )

    target = Path.cwd() if in_place else Path.cwd() / name
    try:
        return _init_target(target, in_place, name, version)
    except OSError as exc:
        # found live: a chmod-555 target died with a traceback. An unreadable or unwritable
        # target is a foreseeable refusal, not an internal fault; rollback has already run.
        return _refuse(
            1,
            "blocked",
            f"cannot use {target}: {exc.strerror or exc}.\n"
            "Fix the directory's permissions, or scaffold somewhere writable.",
        )


def _init_target(target: Path, in_place: bool, name: str, version: str) -> int:
    """Scaffold ``target`` (validated name, resolved version); raises OSError on I/O refusal."""
    if target.exists() and not target.is_dir():
        return _refuse(
            1,
            "blocked",
            f"{target} exists and is not a directory. Move it aside, or run: vsor init <new-name>",
        )

    if target.is_dir() and _is_vsor_instance(target / "instance.md"):
        return _refuse(1, "exists", f"{target} is already a vsor project — nothing to do; next: vsor dev")

    for ancestor in target.resolve().parents:
        marker = ancestor / "instance.md"
        if marker.is_file():
            return _refuse(
                1,
                "nested",
                f"{marker} — the target sits inside an existing vsor project.\n"
                "Scaffold outside it, or add documents to that project's knowledge/ instead.",
            )

    if target.is_dir():
        blockers = _blockers(target)
        if blockers:
            shown = ", ".join(blockers[:5])
            more = f" and {len(blockers) - 5} more" if len(blockers) > 5 else ""
            return _refuse(
                1,
                "blocked",
                f"{target} is not an empty or freshly-cloned directory — found: {shown}{more}.\n"
                "Init accepts only an empty target or repo boilerplate (.git/, README.md, LICENSE*,\n"
                "editor config). Move the rest aside, or run: vsor init <new-name>",
            )
        gitignore = target / ".gitignore"
        if gitignore.is_file():
            lines = gitignore.read_text(encoding="utf-8").splitlines()
            if any(line.strip() == "!.env" for line in lines):
                return _refuse(
                    1,
                    "blocked",
                    f"{gitignore} contains the line '!.env', which would force .env — your secrets —\n"
                    "into version control. Remove the '!.env' line, then re-run.",
                )

    subs = {
        "__VSOR_NAME__": name,
        "__VSOR_VERSION__": version,
        "__VSOR_REQUIRES__": _requires_pin(version),
        "__VSOR_YEAR__": str(datetime.date.today().year),
    }
    entries = _scaffold_entries()

    git_present = shutil.which("git") is not None
    anchor = target if target.is_dir() else target.parent
    in_repo = git_present and _git(["-C", str(anchor), "rev-parse", "--git-dir"]).returncode == 0

    if target.is_dir():
        code = _scaffold_into(target, entries, subs, name, version, git_present, in_repo)
    else:
        code = _scaffold_staged(target, entries, subs, name, version, git_present, in_repo)
    if code != 0:
        return code

    # Notes print before the handoff; the success canon ends with the handoff lines.
    if not git_present:
        sys.stdout.write(_stdout_text("note-git-skipped.txt"))
        sys.stdout.write("\n")
    elif in_repo:
        sys.stdout.write(_stdout_text("note-existing-repo.txt"))
        sys.stdout.write("\n")
    success = "success-here.txt" if in_place else "success.txt"
    sys.stdout.write(_stamp_text(_stdout_text(success), subs))
    return 0
