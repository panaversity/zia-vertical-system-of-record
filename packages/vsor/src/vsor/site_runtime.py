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

The command layer reaches `probe_node_version` and `ensure_runtime` as module attributes —
the unit tier's monkeypatch seam; keep them that way.
"""

import hashlib
import io
import json
import os
import shutil
import subprocess
import tarfile
from collections.abc import Mapping
from importlib import resources
from pathlib import Path

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
    and `../site` — when it is developed in its own workspace."""
    env = dict(os.environ if base is None else base)
    env[_KNOWLEDGE_ENV] = "./knowledge"
    env[_SITE_ENV] = "./site"
    return env


_AUTHORED_TREES = ("site", "knowledge")


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
    and dies inside `.vsor/`."""
    for name in _AUTHORED_TREES:
        dest = runtime_dir / name
        if dest.is_symlink() or dest.is_file():
            dest.unlink()
        elif dest.is_dir():
            shutil.rmtree(dest)
        src = project_root / name
        if src.is_dir():
            shutil.copytree(src, dest, symlinks=True)


def _visible_files(root: Path) -> dict[Path, tuple[int, int]]:
    """Relative path -> (mtime_ns, size) for files with no dot-prefixed segment."""
    found: dict[Path, tuple[int, int]] = {}
    if not root.is_dir():
        return found
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if not name.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            file_path = Path(dirpath) / name
            try:
                info = file_path.stat()
            except OSError:
                continue
            found[file_path.relative_to(root)] = (info.st_mtime_ns, info.st_size)
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
        for rel in dest_files.keys() - src_files.keys():
            (dest_root / rel).unlink(missing_ok=True)
            changed = True
        for rel, signature in src_files.items():
            if dest_files.get(rel) != signature:
                target = dest_root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_root / rel, target)  # preserves mtime: the comparison key
                changed = True
    return changed


def ensure_runtime(project_root: Path) -> Path:
    """Materialize (or reuse) `.vsor/site-runtime/` and return it. First run prints one
    owned notice line, then streams npm's own output unmodified; the second run prints
    neither."""
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
