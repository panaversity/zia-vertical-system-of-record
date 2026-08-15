"""The site-runtime shell — materialization and staleness (specs/vsor/build).

**The shell IS the site.** `sor-site-app.tgz` — the forked Docusaurus app shipped as wheel
data — is unpacked over `.vsor/site-runtime/`, so that directory is the siteDir Docusaurus
builds: its `docusaurus.config.ts`, its `src/`, its `static/`. Beside it land the workspace
library tarballs it depends on, the shell `package.json` (which replaces the app's own — it
is the one home of the exact versions) and the shell `package-lock.json`; `npm ci` installs
them into `.vsor/site-runtime/node_modules/`. Then `copy_authored` mirrors the project's
`site/` and `knowledge/` INTO the shell, and the two verbs point the app's own env seams at
those copies (`runtime_env`) — the app reads `./site` and `./knowledge` instead of the
sibling directories it uses when it is developed in its own workspace.

The copies are the spec's recorded fallback, taken after the symlink experiment failed live
twice (Docusaurus realpaths siteDir; webpack realpaths md resources) — see `copy_authored`.

`.materialized.json` is written only AFTER a successful install, and each run reuses the
shell iff the stamp matches the freshly shipped bytes — that is what keeps an upgraded vsor
from silently building with old JS. The stamp hashes the app tarball as well as the
manifest and the lockfile: the app is unpacked, not installed, so a shell rebuilt from a
changed fork with an unchanged dependency set would otherwise be reused as current. The
library tarballs need no hash of their own — their sha512 is recorded in the lockfile, so
changing one changes `lock_sha256`.

The shell is scratch: deleting `.vsor/` costs a re-install, never work.

Two rules protect that tree, both added 2026-08-15 and both with their own note below:
**one vsor at a time** inside `.vsor/` (`project_lock`), because every invoke rewrites the
shell a running `vsor dev` is serving from — and it holds against a killed vsor whose node
process is still alive, which is the case it exists for; and **a document is a regular
file** (`check_authored`), because the record can only name files it can hash.

The command layer reaches `probe_node_version` and `ensure_runtime` as module attributes —
the unit tier's monkeypatch seam; keep them that way.
"""

import contextlib
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import tarfile
from collections.abc import Iterator, Mapping
from datetime import UTC, datetime
from importlib import resources
from pathlib import Path
from typing import NamedTuple

from vsor.errors import CommandError

# The app tarball is unpacked over the shell; the other two are written as files.
APP_TARBALL = "sor-site-app.tgz"
_SHELL_MANIFESTS = ("package.json", "package-lock.json")
_NODE_FLOOR = 20

_INSTALL_NOTICE = "installing site runtime — one time, ~1–2 minutes"

# npm's own output streams through unmodified (specs/vsor/build), which means its audit
# summary — "25 vulnerabilities (6 moderate, 19 high)" — is among the first things a new
# user ever sees from this product. Suppressing it would be dishonest; leaving it
# unanswered lets an alarm stand in for a fact. So it is answered, once, by us.
#
# Measured 2026-08-14 against the shipped shell lockfile (`npm audit --json` in
# packages/vsor/src/vsor/_site_runtime): 25 advisories, all transitive, from exactly
# THREE roots — serialize-javascript (via copy-webpack-plugin and
# css-minimizer-webpack-plugin, both Docusaurus's bundler), image-size (Docusaurus's
# image handling) and uuid (via sockjs, via webpack-dev-server). Every one of them is
# build-time toolchain: none is in the built site, which ships static HTML, CSS, JS and
# a search index and executes no npm package at serve time. Recorded, with the date and
# the method, in SECURITY.md; recheck when the Docusaurus pin moves.
_AUDIT_NOTICE = (
    "note: npm's audit summary above is the site TOOLCHAIN, not your site — the "
    "advisories are\n  build-time only and none ships in build/. Reviewed 2026-08-14; "
    "see SECURITY.md."
)

# Where the shell finds the project's two authored trees. `copy_authored` puts them
# inside the shell (the spec's layout); the app defaults to siblings, because that is
# what it has when it is developed in its own workspace — so the verbs say which.
_KNOWLEDGE_ENV = "VSOR_KNOWLEDGE_DIR"
_SITE_ENV = "VSOR_SITE_DIR"


def probe_node_version() -> str | None:
    """The measured node version, no leading `v` (e.g. "24.4.1"); None when node is
    absent from PATH or refuses to report."""
    node = shutil.which("node")
    if node is None:
        return None
    try:
        proc = subprocess.run([node, "--version"], capture_output=True, text=True, check=False, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    version = proc.stdout.strip().lstrip("v")
    return version or None


def check_node(version: str | None) -> None:
    """The stated precondition: Node >= 20 on PATH. Absent or too old is exit 3
    `missing-runtime`; the remedy names what was measured and where to install."""
    if version is None:
        raise CommandError(
            "missing-runtime",
            f"node was not found on PATH — the site verbs run Docusaurus, which needs "
            f"Node >= {_NODE_FLOOR} and npm. Install from nodejs.org (or: brew install node / "
            "apt install nodejs npm), then rerun.",
        )
    try:
        major = int(version.split(".", 1)[0])
    except ValueError:
        major = -1
    if major < _NODE_FLOOR:
        raise CommandError(
            "missing-runtime",
            f"found node {version}, need >= {_NODE_FLOOR} — upgrade from nodejs.org "
            "(or: brew upgrade node / your distro's NodeSource repo), then rerun.",
        )


def running_vsor_version() -> str:
    """The running distribution version — init's one rule (importlib.metadata, with
    VSOR_DEV_VERSION as the dev/CI harness override). Falls back to whatever the
    distribution reported when neither yields a release version: mismatch is recorded
    in build.lock.json, never a refusal (the build spec's WARN-and-record posture)."""
    from vsor import scaffold

    version, reported = scaffold._resolve_version()
    return version if version is not None else reported


def docusaurus_version(runtime_dir: Path) -> str:
    """The installed @docusaurus/core version — read from the shell, so the record names
    what actually built the site."""
    manifest = runtime_dir / "node_modules" / "@docusaurus" / "core" / "package.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    return str(data["version"])


def runtime_file(name: str) -> bytes:
    """The shipped bytes of one `vsor/_site_runtime/` wheel-data file."""
    return resources.files("vsor").joinpath("_site_runtime", name).read_bytes()


def library_tarballs(package_json: bytes) -> tuple[str, ...]:
    """The tarball filenames the shell manifest names as `file:./…tgz` dependencies.

    The manifest is the single source of truth for which libraries ship, so adding one
    is a one-line edit there plus a line in `make wheel`'s `packed` list — never a code
    change here, and never a hatchling artifacts entry (that side is a glob, gated by
    the wheel-content test which reads this same list)."""
    prefix, suffix = "file:./", ".tgz"
    data = json.loads(package_json)
    return tuple(
        sorted(
            spec[len(prefix) :]
            for spec in data.get("dependencies", {}).values()
            if isinstance(spec, str) and spec.startswith(prefix) and spec.endswith(suffix)
        )
    )


def _stamp_contents(*, vsor_version: str, package_json: bytes, lock: bytes, app: bytes) -> dict[str, str]:
    return {
        "vsor": vsor_version,
        "package_json_sha256": hashlib.sha256(package_json).hexdigest(),
        "lock_sha256": hashlib.sha256(lock).hexdigest(),
        "app_sha256": hashlib.sha256(app).hexdigest(),
    }


def write_stamp(
    runtime_dir: Path, *, vsor_version: str, package_json: bytes, lock: bytes, app: bytes
) -> None:
    """Write `.materialized.json` — only ever called AFTER a successful `npm ci`
    (an interrupted install never writes it)."""
    stamp = _stamp_contents(vsor_version=vsor_version, package_json=package_json, lock=lock, app=app)
    (runtime_dir / ".materialized.json").write_text(
        json.dumps(stamp, indent=2) + "\n", encoding="utf-8"
    )


def stamp_is_current(
    runtime_dir: Path, *, vsor_version: str, package_json: bytes, lock: bytes, app: bytes
) -> bool:
    """Reuse the shell iff the stamp matches the freshly generated bytes; absence,
    mismatch, or a corrupt stamp all mean wipe-and-rematerialize — never a crash."""
    stamp_path = runtime_dir / ".materialized.json"
    try:
        stored = json.loads(stamp_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    if not isinstance(stored, dict):
        return False
    return stored == _stamp_contents(
        vsor_version=vsor_version, package_json=package_json, lock=lock, app=app
    )


def unpack_app(app_tarball: bytes, runtime_dir: Path) -> None:
    """Unpack the forked app over `runtime_dir`, stripping npm pack's `package/` prefix.

    Every member is checked to land inside the destination before anything is written:
    the tarball is ours, but a path-traversal entry must fail loudly rather than write
    outside `.vsor/`, which is the one directory these verbs are allowed to own."""
    prefix = "package/"
    with tarfile.open(fileobj=io.BytesIO(app_tarball), mode="r:gz") as tar:
        members = []
        for member in tar.getmembers():
            if not member.name.startswith(prefix):
                continue
            relative = member.name[len(prefix) :]
            if not relative:
                continue
            destination = (runtime_dir / relative).resolve()
            if not destination.is_relative_to(runtime_dir.resolve()):
                raise CommandError(
                    "install-failed",
                    f"the shipped site runtime contains a path that escapes its own "
                    f"directory ({member.name!r}) — the wheel is damaged; reinstall vsor.",
                )
            member.name = relative
            members.append(member)
        tar.extractall(runtime_dir, members=members, filter="data")


def runtime_env(base: Mapping[str, str] | None = None) -> dict[str, str]:
    """The environment Docusaurus runs under: the app's own corpus/site seams pointed
    at the copies `copy_authored` made inside the shell. Set here rather than baked
    into the app, because the app keeps working standalone — sibling `../knowledge`
    and `../site` — when it is developed in its own workspace.

    **Every other `VSOR_*` variable is stripped, and that is the contract**: the shell's
    config reads six of them (title, tagline, url, baseUrl, favicon, social image), so an
    ambient export decided the site's published identity while `build_id` — which is taken
    over the config FILE — could not see it. Found live 2026-08-15: two builds with the
    same build_id published at two different origins, every canonical link, og:/twitter:
    URL, JSON-LD @id and sitemap entry differing. The config file is the only door; the
    environment is a closed, non-input surface. This also stops a stray export in a shell
    profile from silently changing what a project builds.
    """
    env = {
        key: value
        for key, value in (os.environ if base is None else base).items()
        if not key.startswith("VSOR_")
    }
    env[_KNOWLEDGE_ENV] = "./knowledge"
    env[_SITE_ENV] = "./site"
    return env


_AUTHORED_TREES = ("site", "knowledge")

# ── a symbolic link is not a document ───────────────────────────────────────────────────
#
# Decided 2026-08-15, from the audit: the corpus is real files. Three code paths used to
# disagree about what a link is — `copy_authored` recreated it inside the shell
# (`copytree(symlinks=True)`), `sync_authored` then wrote THROUGH that copy (`shutil.copy2`
# opens the destination path `'wb'`, which follows a link and truncates whatever it points
# at, outside the project entirely), and `lock.walk_tree` (os.lstat + S_ISREG) left it out
# of `build.lock.json` altogether. The net effect was the one thing this product cannot
# ship: a document the site served and the record could not name.
#
# Either both follow links or neither does. Neither is the answer at v0, because following
# one imports bytes that no commit of this project contains — `corpus.git` names HEAD, and
# HEAD would not hold the document that was built. So a link inside the trees is refused,
# loudly, before anything is installed or copied; `lock.walk_tree`'s exclusion is then
# honest rather than silent.
#
# The tree's own ROOT is deliberately not inspected: `ln -s ~/docs knowledge` keeps the
# record and the site in agreement (the copy and the walk both follow the root), so the
# corpus may live wherever its owner keeps it — it is links INSIDE the tree that split the
# two apart. Dot-prefixed segments are skipped for the same reason the corpus walk skips
# them: nothing under one is ever served.
#
# The rule is the record's, so it is stated as the record states it: **a document is a
# regular file**. `lock.walk_tree`'s `S_ISREG` test is the definition, and everything it
# excludes has to be refused here or the site serves bytes the record cannot name. Links
# are the common case; a FIFO, a socket or a device node is the same defect with a worse
# failure (found live 2026-08-15: `mkfifo knowledge/pipe.md` reached `copytree` and came
# back as a raw `shutil.Error` list-of-tuples repr under `io-failed`, where the neighbouring
# rule would have said "vsor serves real files only" and exited 1).
_IRREGULARS_NAMED = 5


def _irregular_kind(path: Path) -> str | None:
    """What is wrong with this entry, in the user's vocabulary — or None if nothing is."""
    if path.is_symlink():
        return "a symbolic link"
    try:
        mode = os.lstat(path).st_mode
    except OSError:
        return None
    if stat.S_ISDIR(mode) or stat.S_ISREG(mode):
        return None
    if stat.S_ISFIFO(mode):
        return "a named pipe"
    if stat.S_ISSOCK(mode):
        return "a socket"
    return "a device node"


def authored_irregulars(project_root: Path) -> list[str]:
    """Everything inside the authored trees that is not a regular file or a directory,
    project-relative, sorted, each named with what it is."""
    found: list[str] = []
    for name in _AUTHORED_TREES:
        root = project_root / name
        if not root.is_dir():
            continue
        # followlinks stays False: a linked directory is REPORTED here and never walked
        # into, so a cycle (`ln -s . loop`) costs one row rather than an infinite walk.
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [entry for entry in dirnames if not entry.startswith(".")]
            here = Path(dirpath)
            for entry in (*dirnames, *filenames):
                if entry.startswith("."):
                    continue
                path = here / entry
                kind = _irregular_kind(path)
                if kind is not None:
                    found.append(f"{path.relative_to(project_root).as_posix()} ({kind})")
    return sorted(found)


def check_authored(project_root: Path) -> None:
    """Refuse a corpus whose documents are not real files — the record could not name them.

    Called first thing in `ensure_runtime`, so both verbs pass through it and the refusal
    costs seconds rather than a ~2-minute npm install. The slug stays `symlink-unsupported`
    (the set in errors.py is closed; a rename is queued with the spec) while the rule it
    enforces is the wider one."""
    irregulars = authored_irregulars(project_root)
    if not irregulars:
        return
    shown = ", ".join(irregulars[:_IRREGULARS_NAMED])
    more = (
        f", and {len(irregulars) - _IRREGULARS_NAMED} more"
        if len(irregulars) > _IRREGULARS_NAMED
        else ""
    )
    raise CommandError(
        "symlink-unsupported",
        f"the authored trees contain entries that are not real files: {shown}{more}.\n"
        "vsor serves real files only. Every document the site publishes is hashed into\n"
        "build.lock.json, and that record counts regular files — so any of these would be\n"
        "served by the site and absent from the record your citations point at, which is the one\n"
        "disagreement this project cannot ship.\n"
        "Copy each one in instead of linking to it (`cp -RL` reads through the link), then rerun.",
    )


def _skip_symlinks(directory: str, names: list[str]) -> set[str]:
    """`copytree`'s ignore hook: never carry a link into the shell.

    `check_authored` has already refused these, so this is the structural guarantee behind
    that promise rather than the promise itself — nothing under `.vsor/` is a link, and
    therefore nothing in the shell can be written through to somewhere else."""
    base = Path(directory)
    return {name for name in names if (base / name).is_symlink()}


def copy_authored(project_root: Path, runtime_dir: Path) -> None:
    """Copy-on-invoke of the authored `site/` and `knowledge/` into the shell — the build
    spec's recorded fallback, taken after the symlink experiment failed live BOTH ways
    (found live 2026-08-13, docusaurus 3.10.2):

    - a symlinked siteDir dies at preset resolution: every command entry realpaths it
      (`@docusaurus/core/lib/commands/build/build.js:25`, `fs.realpath(siteDirParam)`),
      so `createRequire(siteConfigPath)` walks the authored project — not the shell —
      for node_modules;
    - a symlinked `knowledge/` beside a copied siteDir compiles but breaks SSR: webpack
      (`resolve.symlinks: true`) realpaths each `.md` resource OUT of the docs rule's
      `include: [contentDir]`, the mdx-loader then never attaches the doc metadata
      export, and SSG crashes in DocItem reading `metadata.id`.

    The trees are wiped and re-copied on EVERY invoke, so an authored edit is still what
    the next build sees; `sync_authored` keeps `vsor dev` hot. Everything copied lives
    and dies inside `.vsor/`. Links are dropped rather than recreated — see the note above
    `authored_irregulars`; the copy is followed everywhere else, root included."""
    for name in _AUTHORED_TREES:
        dest = runtime_dir / name
        if dest.is_symlink() or dest.is_file():
            dest.unlink()
        elif dest.is_dir():
            shutil.rmtree(dest)
        src = project_root / name
        if src.is_dir():
            shutil.copytree(src, dest, symlinks=False, ignore=_skip_symlinks)


def _visible_files(root: Path) -> dict[Path, tuple[int, int] | None]:
    """Relative path -> (mtime_ns, size) for regular files with no dot-prefixed segment;
    None for an entry that exists and is not a regular file — **linked directories
    included**.

    `lstat`, never `stat`: a link is described as itself, so it can never be mistaken for
    the file it points at. The None carries the distinction the mirror needs in both
    directions — source-side it means "not a document, do not mirror"; destination-side it
    means "debris", and because None never equals a source signature the mirror always
    replaces it with the real file instead of writing through it.

    A linked DIRECTORY is reported by that same None, and it has to be reported here
    because nothing else in the mirror can see one: `os.walk` never lists it among
    `filenames`, and (`followlinks` being False) never descends it either, so it appeared
    in neither half of the comparison — not debris to remove, not a document to replace.
    A destination parent that resolves outside the project then survives
    `mkdir(exist_ok=True)`, because it IS a directory, and `shutil.copy2` writes the
    corpus into it. Found 2026-08-15 reviewing the file-level guard below: that guard made
    the promise true one entry at a time and false one level up."""
    found: dict[Path, tuple[int, int] | None] = {}
    if not root.is_dir():
        return found
    for dirpath, dirnames, filenames in os.walk(root):
        here = Path(dirpath)
        walk_into: list[str] = []
        for name in dirnames:
            if name.startswith("."):
                continue
            directory = here / name
            if directory.is_symlink():
                found[directory.relative_to(root)] = None
            else:
                walk_into.append(name)
        dirnames[:] = walk_into
        for name in filenames:
            if name.startswith("."):
                continue
            file_path = here / name
            try:
                info = file_path.lstat()
            except OSError:
                continue
            relative = file_path.relative_to(root)
            regular = stat.S_ISREG(info.st_mode)
            found[relative] = (info.st_mtime_ns, info.st_size) if regular else None
    return found


def sync_authored(project_root: Path, runtime_dir: Path) -> bool:
    """Mirror authored edits into the shell's copies while `vsor dev` serves — the
    fallback's hot-reload half: Docusaurus watches the copied trees (real files, so its
    watcher fires natively), and this poll-driven mirror carries each authored save
    across. Dot-prefixed paths are left alone in both directions (`.docusaurus`, the
    webpack cache and other generated state live inside the copies). Returns whether
    anything changed."""
    changed = False
    for name in _AUTHORED_TREES:
        src_root = project_root / name
        dest_root = runtime_dir / name
        src_files = _visible_files(src_root)
        dest_files = _visible_files(dest_root)
        for rel, signature in dest_files.items():
            # The shell must equal the corpus, so a path goes when EITHER side says it is
            # not a document: `src_files.get(rel) is None` covers both "gone from the
            # corpus" and "still there, but no longer a regular file" (the mid-serve
            # `rm doc.md && ln -s ~/docs/doc.md .`, which the next `vsor build` refuses
            # outright — until then the dev server must stop showing bytes the record
            # would not name), and the destination's own None covers debris.
            # `unlink`, never rmtree and never open — on a link this removes the link
            # itself and never touches what it points at, and that holds for a link to a
            # DIRECTORY too, which is why the removal can be one rule. Top-down walk order
            # means a linked directory is dropped before the copy loop reaches anything the
            # corpus keeps under that path.
            if src_files.get(rel) is None or signature is None:
                (dest_root / rel).unlink(missing_ok=True)
                changed = True
        for rel, signature in src_files.items():
            if signature is None:
                continue  # a link (file or directory), a fifo, a socket — not a document
            if dest_files.get(rel) != signature:
                target = dest_root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.is_symlink():
                    # NEVER write through a link: shutil.copy2 opens the destination path
                    # 'wb', which follows it and truncates whatever it points at — outside
                    # the project, if that is where it points. Nothing this code wrote can
                    # be a link any more; a hand-made one is removed rather than trusted.
                    target.unlink()
                shutil.copy2(src_root / rel, target)  # preserves mtime: the comparison key
                changed = True
    return changed


def ensure_runtime(project_root: Path) -> Path:
    """Materialize (or reuse) `.vsor/site-runtime/` and return it. First run prints one
    owned notice line, then streams npm's own output unmodified; the second run prints
    neither.

    Callers hold `project_lock` around this: everything below rewrites the shell, and on
    the reuse path `copy_authored` deletes and rebuilds the corpus copy inside the very
    directory a running `vsor dev` is serving from."""
    check_authored(project_root)
    runtime_dir = project_root / ".vsor" / "site-runtime"
    package_json = runtime_file("package.json")
    lockfile = runtime_file("package-lock.json")
    app = runtime_file(APP_TARBALL)
    vsor_version = running_vsor_version()

    current = stamp_is_current(
        runtime_dir, vsor_version=vsor_version, package_json=package_json, lock=lockfile, app=app
    )
    if current and (runtime_dir / "node_modules" / ".bin" / "docusaurus").exists():
        copy_authored(project_root, runtime_dir)
        return runtime_dir

    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)
    runtime_dir.mkdir(parents=True)
    # The app first, then the shell manifests OVER it: the tarball carries the app's own
    # package.json (workspace ranges, versions no registry has), and the shipped one is
    # the manifest that must survive.
    unpack_app(app, runtime_dir)
    for name in (*_SHELL_MANIFESTS, *library_tarballs(package_json)):
        (runtime_dir / name).write_bytes(runtime_file(name))
    copy_authored(project_root, runtime_dir)

    npm = shutil.which("npm")
    if npm is None:
        raise CommandError(
            "missing-runtime",
            "npm was not found on PATH — it arrives with Node from nodejs.org "
            "(or: brew install node / apt install npm). Install it, then rerun.",
        )
    print(_INSTALL_NOTICE, flush=True)
    proc = subprocess.run([npm, "ci"], cwd=runtime_dir, stdin=subprocess.DEVNULL, check=False)
    if proc.returncode != 0:
        raise CommandError(
            "install-failed",
            f"npm ci exited {proc.returncode} installing the site runtime under "
            ".vsor/site-runtime — npm's own output above names the cause (registry, disk, or "
            "peer conflict; npm knows, we do not guess). Fix that and rerun; the install "
            "restarts cleanly.",
        )
    print(_AUDIT_NOTICE, flush=True)
    write_stamp(
        runtime_dir, vsor_version=vsor_version, package_json=package_json, lock=lockfile, app=app
    )
    return runtime_dir


# ── one vsor at a time ──────────────────────────────────────────────────────────────────
#
# Added 2026-08-15, from the audit. Both site verbs rewrite the shell: a stamp mismatch
# rmtree's the whole of `.vsor/site-runtime`, and `copy_authored` deletes and rebuilds the
# authored trees inside it on EVERY invoke — inside the very directory a running `vsor dev`
# is serving from. So a `vsor build` in the second terminal corrupts the dev server's site
# underneath it, mid-serve. Two terminals is the ordinary workflow here (the site in one,
# the agent in the other) and an agent loop re-invokes eagerly, so this is the normal case
# rather than a corner — and at slice 2 `serve` becomes a third long-running verb sharing
# `.vsor/`, which is why it is here now rather than after two more verbs learn to live
# without it.
#
# The mechanism is one file created with O_EXCL — atomic on every filesystem these verbs
# run on — carrying the holder's pid, its verb and when it started. It is advisory in the
# only sense that matters: nothing but vsor writes under `.vsor/`.
#
# Two properties it must have, and each is why this is thirty lines rather than a library:
#
# - **Never a wedge.** A killed holder (kill -9, a closed terminal, an agent session torn
#   down) leaves the file behind. So the record names a pid, and a lock whose pid is gone
#   is debris: removed, and taken over. `os.kill(pid, 0)` is the probe — PermissionError
#   means alive-and-not-ours, which is still alive, and any other OSError means unknowable,
#   where the safe answer is "alive": we never take a lock over on a guess.
# - **Never a wait.** A held project is a refusal, exactly as `port-in-use` is a refusal —
#   never a prompt, never a queue. An agent that blocked here would hang with no output,
#   which is the one outcome worse than the corruption.
#
# The pid is a MACHINE-LOCAL fact: two machines sharing one project over a network mount
# would each read the other's pid against their own process table. v0 is a local CLI on
# macOS and Linux (init's platform gate); if that ever changes, the record gains a host and
# the probe gains a "not this machine, cannot say" branch.

LOCK_NAME = "lock"


class _Holder(NamedTuple):
    """Who holds the lock, as the file records it.

    `child` is the long-running node process this verb spawned — the dev server, or the
    Docusaurus build — recorded once it exists (`record_child`). It is what makes the
    takeover rule safe: a killed vsor (kill -9, a closed terminal, an agent session torn
    down) leaves its child ALIVE and still writing into `.vsor/`, and taking the lock over
    on the strength of the dead parent walked the next verb straight into the shell that
    child is serving from. Found live 2026-08-15: the takeover then rmtree'd the runtime
    under a live dev server and killed a build mid-flight."""

    pid: int
    verb: str
    started: str
    child: int = 0

    @property
    def identity(self) -> tuple[int, str]:
        """What makes this record ours — stable across `record_child`'s rewrite."""
        return (self.pid, self.started)


def _process_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # alive, just not ours to signal
    except OSError:
        return True  # unknowable — never take a lock over on a guess
    return True


def _holder_alive(holder: _Holder) -> bool:
    """A holder is alive while EITHER its vsor or the child it spawned is."""
    return _process_alive(holder.pid) or _process_alive(holder.child)


def _holder_of(lock_path: Path) -> _Holder | None:
    """The record inside a lock file, or None when there is nothing usable in it.

    None covers the interrupted create — the file exists because O_EXCL made it, and the
    payload never landed because the process died in the microseconds before the write.
    Bytes nobody can read name nobody, so they are debris."""
    try:
        data = json.loads(lock_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    pid = data.get("pid")
    if not isinstance(pid, int) or isinstance(pid, bool):
        return None
    child = data.get("child")
    return _Holder(
        pid,
        str(data.get("verb", "?")),
        str(data.get("started", "?")),
        child if isinstance(child, int) and not isinstance(child, bool) else 0,
    )


def record_child(lock_path: Path, child_pid: int) -> None:
    """Name the node process this verb just spawned in the lock we hold.

    Best-effort by construction: if the rewrite is interrupted the payload is unreadable,
    which `_holder_of` already treats as debris — the same outcome as the interrupted
    create it was written for. Only ever rewrites a record that is still ours."""
    holder = _holder_of(lock_path)
    if holder is None or holder.pid != os.getpid():
        return
    with contextlib.suppress(OSError):
        lock_path.write_text(
            json.dumps(holder._replace(child=child_pid)._asdict()) + "\n", encoding="utf-8"
        )


def _claim(lock_path: Path, holder: _Holder) -> bool:
    """O_EXCL create plus the payload on the same descriptor. False means someone has it."""
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
    except FileExistsError:
        return False
    try:
        os.write(fd, (json.dumps(holder._asdict()) + "\n").encode("utf-8"))
    finally:
        os.close(fd)
    return True


def _signalable(pid: int) -> bool:
    """Whether telling the user to `kill <pid>` is advice rather than a trap.

    Two ways it is a trap, both reachable through pid reuse after a reboot: pid 1 is init,
    and a pid we may not signal at all belongs to another user — neither is the vsor that
    wrote this lock (found live 2026-08-15: a lock naming pid 1 produced the remedy
    "stop it (Ctrl-C in its terminal, or: kill 1)")."""
    if pid <= 1:
        return False
    try:
        os.kill(pid, 0)
    except PermissionError:
        return False
    except OSError:
        return True
    return True


def _busy(lock_path: Path) -> CommandError:
    """The refusal, carrying who holds the project and every way out of it.

    The pid it tells you to stop is the pid that is actually RUNNING, which is not always
    the one that took the lock: a `kill -9`'d `vsor dev` leaves its node process serving,
    and that orphan is the reason this refusal exists (found live 2026-08-15 — the first
    version of this message named the dead parent, which is advice that does nothing)."""
    holder = _holder_of(lock_path)
    if holder is None:
        return CommandError(
            "project-busy",
            f"another vsor is already working in this project.\n{_WHY_TWO_AT_ONCE}"
            f"Wait for it to finish, or stop it, then rerun.\n{_REUSED_PID.format(lock=lock_path)}",
        )

    parent_alive = _process_alive(holder.pid)
    child_alive = bool(holder.child) and _process_alive(holder.child)
    if parent_alive:
        who = f"`vsor {holder.verb}` (pid {holder.pid}), started {holder.started}"
        if child_alive:
            who = f"{who}, still running node (pid {holder.child})"
        target = holder.pid
    else:
        # The parent is gone and its node process is not: the lock is held on the child's
        # account, so the child is what has to stop.
        who = (
            f"`vsor {holder.verb}` (pid {holder.pid}, started {holder.started}) is gone, but the\n"
            f"node process it started (pid {holder.child}) is still running in this project"
        )
        target = holder.child

    if not _signalable(target):
        # No `kill` advice for a pid vsor cannot signal: it is not this project's vsor.
        ways_out = (
            f"vsor cannot signal pid {target} — it is not a process of yours, so this is almost\n"
            f"certainly a REUSED pid rather than a running vsor: delete {lock_path} and rerun.\n"
            f"If a vsor really is working here, wait for it or stop it from its own terminal."
        )
    else:
        where = "Ctrl-C in its terminal, or: " if parent_alive else ""
        ways_out = (
            f"Wait for it to finish, or stop it ({where}kill {target}), then rerun.\n"
            f"{_REUSED_PID.format(lock=lock_path)}"
        )
    return CommandError(
        "project-busy",
        f"another vsor is already working in this project: {who}.\n{_WHY_TWO_AT_ONCE}{ways_out}",
    )


_WHY_TWO_AT_ONCE = (
    "Two at once rewrite .vsor/site-runtime underneath each other — the copy of knowledge/\n"
    "and site/ inside it is deleted and rebuilt on every invoke — so this one stops instead\n"
    "of corrupting the site the other is serving.\n"
)

_REUSED_PID = (
    "vsor clears the lock of a process that has died; if one outlives its holder the pid was\n"
    "reused — delete {lock} and rerun."
)


def _remove_lock_debris(lock_path: Path) -> None:
    """Remove whatever is at the lock path — a DIRECTORY included.

    `mkdir .vsor/lock` used to wedge a project permanently: `_claim` got FileExistsError,
    `_holder_of` read nothing usable, and the debris `unlink()` failed silently, so every
    verb refused forever (found live 2026-08-15). `.vsor/` is vsor's own scratch — nothing
    else writes there — so clearing debris inside it is within this verb's ownership."""
    with contextlib.suppress(OSError):
        if lock_path.is_dir() and not lock_path.is_symlink():
            shutil.rmtree(lock_path)
        else:
            lock_path.unlink()


@contextlib.contextmanager
def project_lock(project_root: Path, *, verb: str) -> Iterator[Path]:
    """Hold `.vsor/lock` for the window that touches the shell; release it on every exit."""
    scratch = project_root / ".vsor"
    scratch.mkdir(parents=True, exist_ok=True)
    lock_path = scratch / LOCK_NAME
    mine = _Holder(
        os.getpid(), verb, datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    )

    if not _claim(lock_path, mine):
        holder = _holder_of(lock_path)
        if holder is not None and holder.pid != mine.pid and _holder_alive(holder):
            raise _busy(lock_path)
        # Debris: the holder is gone (child included), or died before it could say who it
        # was, or is us.
        _remove_lock_debris(lock_path)
        if not _claim(lock_path, mine):
            raise _busy(lock_path)  # somebody else won the same takeover — they hold it

    # The one race O_EXCL cannot close by itself: two processes can both find debris and
    # both take it over, and the second one's create wins the file. Re-reading is what
    # makes that harmless — whoever's record is in the file holds the lock, and the other
    # refuses rather than running alongside it. Compared on `identity` rather than on the
    # whole record, because `record_child` rewrites our own row while we hold it.
    current = _holder_of(lock_path)
    if current is None or current.identity != mine.identity:
        raise _busy(lock_path)

    try:
        yield lock_path
    finally:
        # Only ever remove OUR lock: if a takeover happened while we ran, the file is now
        # somebody else's and deleting it would hand the project to a third process.
        held = _holder_of(lock_path)
        if held is not None and held.identity == mine.identity:
            with contextlib.suppress(OSError):
                lock_path.unlink()
