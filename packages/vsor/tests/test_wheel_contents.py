"""Wheel-transport contract for specs/vsor/build — the `_site_runtime` artifacts.

`make wheel` (npm ci + `npm pack` of the forked app and the workspace libraries + shell
lockfile regeneration, then `uv build`) must precede `uv build`; this test is the gate on
that ordering: absent artifacts are built via `make wheel` when node is available, and the
run skips with the remedy when it is not.

What ships changed on 2026-08-14 with the fork: **`sor-site-app.tgz`** is the runtime shell
itself — the whole Docusaurus site, unpacked over `.vsor/site-runtime` rather than installed
into `node_modules` — beside one tarball per workspace library it imports. The expected set
is not written here twice: it is derived from the shell manifest's own `file:` dependencies
(`site_runtime.library_tarballs`), which is also what materialization copies, so the wheel,
the installer and this gate cannot disagree. hatchling's artifacts glob is what that
protects: a glob cannot notice a missing file, and this does.

Two contracts here are about what the shell CARRIES rather than how it travels, and
they live at this tier because this is where the shipped bytes are: the vendored
typefaces ship with both of their SIL OFL licences and are reached only by relative
URL, and the shell's own README and description — the only two things it says about
itself to whoever finds it in `.vsor/site-runtime/` — name no upstream repository.

found live 2026-08-13 (npm 11.16.0): the shell package-lock.json records sha512 integrity
for the `file:` tarballs. A tgz repacked without regenerating the lockfile fails `npm ci`
with EINTEGRITY on a cold cache — and on a warm cache `npm ci` exits 0 and silently installs
the OLD cached bytes. The integrity-consistency test below is the guard that a shipped wheel
can never carry that mismatch.
"""

import base64
import hashlib
import importlib.util
import io
import json
import re
import shutil
import subprocess
import tarfile
import zipfile
from collections.abc import Iterable
from pathlib import Path

import pytest
from vsor import site_runtime

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "_site_runtime"
TEMPLATE = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "templates" / "site_runtime" / "package.json"
APP_SOURCE = REPO_ROOT / "packages" / "sor-site" / "app"

MANIFESTS = ("package.json", "package-lock.json")
LIBRARY_TARBALLS = site_runtime.library_tarballs(TEMPLATE.read_bytes())
ARTIFACT_NAMES = (site_runtime.APP_TARBALL, *MANIFESTS, *LIBRARY_TARBALLS)

# The vendored typefaces. Lead decision 2026-08-14: KEEP them — they close a measured
# typography gap, and the surface contract forbids the off-origin FETCH, not the
# typeface. This module is where that decision stops being incidental: the faces AND
# both licences must be inside the shipped tarball, and the stylesheet that declares
# them must reach them by relative URL. Neither is self-enforcing — one `.npmignore`
# line, or one `@font-face` edited back to a font CDN, and the shipped shell either
# distributes an OFL font with no licence beside it (a legal defect, and a silent one)
# or phones a third party on every page load.
FONT_DIR = "package/src/css/fonts/"
FONT_FILES = (
    "inter-latin-400-normal.woff2",
    "inter-latin-500-normal.woff2",
    "inter-latin-600-normal.woff2",
    "inter-latin-700-normal.woff2",
    "jetbrains-mono-latin-400-normal.woff2",
    "jetbrains-mono-latin-500-normal.woff2",
)
# One per family, both SIL OFL 1.1, named individually: "a licence file shipped" is
# not the claim — "each family's own licence shipped" is.
FONT_LICENCES = ("LICENSE-Inter.txt", "LICENSE-JetBrainsMono.txt")
_OFL_TITLE = "sil open font license"
_WOFF2_MAGIC = b"wOF2"

# CSS request positions, for the same claim from the other side. `data:` is allowed —
# it inlines bytes and initiates no request; a scheme or a protocol-relative `//host`
# is off-origin by definition.
_CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)([^'")]*)\1\s*\)""")
# `@import "https://…";` is valid CSS and fetches without an url() wrapper — the one
# request position a url()-only scan misses. (`@import "tailwindcss";` is a bare
# specifier the postcss plugin resolves at build time: no scheme, so not a request.)
_CSS_IMPORT_RE = re.compile(r"""@import\s+(['"])([^'"]+)\1""")
_OFF_ORIGIN_RE = re.compile(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//)")


def _newest_vsor_wheel() -> Path | None:
    wheels = sorted((REPO_ROOT / "dist").glob("vsor-*.whl"), key=lambda p: p.stat().st_mtime)
    return wheels[-1] if wheels else None


@pytest.fixture(scope="module")
def wheel_path() -> Path:
    staged = all((RUNTIME_DIR / name).is_file() for name in ARTIFACT_NAMES)
    wheel = _newest_vsor_wheel()
    if not staged or wheel is None:
        if shutil.which("node") is None or shutil.which("npm") is None:
            pytest.skip(
                "node/npm not on PATH — `make wheel` stages the _site_runtime artifacts and needs "
                "both; run `make wheel` on a node-equipped machine (the CI surface job does)"
            )
        subprocess.run(["make", "wheel"], cwd=REPO_ROOT, check=True, timeout=900)
        wheel = _newest_vsor_wheel()
    assert wheel is not None, "make wheel completed but no vsor-*.whl landed in dist/"
    return wheel


def _members(wheel: Path, artifact: str) -> list[str]:
    with zipfile.ZipFile(wheel) as whl:
        tgz = whl.read(f"vsor/_site_runtime/{artifact}")
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as tar:
        return tar.getnames()


def _member_bytes(wheel: Path, artifact: str, wanted: Iterable[str]) -> dict[str, bytes]:
    """The bytes of the named tarball members, in one pass over the archive."""
    names = set(wanted)
    with zipfile.ZipFile(wheel) as whl:
        tgz = whl.read(f"vsor/_site_runtime/{artifact}")
    out: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as tar:
        for member in tar.getmembers():
            if member.name in names and member.isfile():
                handle = tar.extractfile(member)
                if handle is not None:
                    out[member.name] = handle.read()
    return out


def test_wheel_carries_every_artifact_the_shell_manifest_names(wheel_path: Path) -> None:
    with zipfile.ZipFile(wheel_path) as whl:
        names = set(whl.namelist())
    missing = [name for name in ARTIFACT_NAMES if f"vsor/_site_runtime/{name}" not in names]
    assert not missing, f"{wheel_path.name} lacks {missing} under vsor/_site_runtime/ — run make wheel"


def test_the_wheel_ships_its_notice_beside_its_licence() -> None:
    """A wheel is the only artifact a reader of the PyPI page can open, so the
    attribution has to be inside it. `packages/vsor/NOTICE` is a copy of the repo-root
    NOTICE for the same reason `packages/vsor/LICENSE` is a copy of the root LICENSE:
    PEP 639's `license-files` globs cannot escape the project root."""
    root = (REPO_ROOT / "NOTICE").read_text(encoding="utf-8")
    shipped = (REPO_ROOT / "packages" / "vsor" / "NOTICE").read_text(encoding="utf-8")
    assert shipped == root, "packages/vsor/NOTICE has drifted from the repo-root NOTICE"
    for obligation in ("shadcn", "SIL Open Font License", "Apache License, Version 2.0"):
        assert obligation in shipped, f"NOTICE no longer names {obligation}"


def test_every_shipped_package_carries_the_licence_it_declares(wheel_path: Path) -> None:
    """Ten npm packages ship into every user's `.vsor/site-runtime/`, each declaring
    `"license": "Apache-2.0"` in its own manifest — and, until 2026-08-14, none of them
    carrying a word of the licence text. Asserted by CONTENT for the reason the OFL row
    gives: an empty LICENSE satisfies a membership check and nothing else."""
    missing: list[str] = []
    for artifact in (site_runtime.APP_TARBALL, *LIBRARY_TARBALLS):
        blob = _member_bytes(wheel_path, artifact, ["package/LICENSE"]).get("package/LICENSE")
        if blob is None or "Apache License" not in blob.decode("utf-8", "replace"):
            missing.append(artifact)
    assert not missing, (
        "these shipped tarballs declare a licence and carry no licence text: "
        f"{missing} — every packed package needs its own LICENSE beside its package.json"
    )


def test_app_tgz_is_the_whole_site(wheel_path: Path) -> None:
    """The app ships as source, not as a build: it becomes the siteDir, so what has to be
    inside is the config the merge seam lives in, the MDX vocabulary a corpus writes
    against, the token stylesheet a project re-brands through, and the sidebar file its
    own `site/sidebars.ts` replaces — plus the README, which npm always packs and which
    is therefore the one prose file that lands in a stranger's `.vsor/site-runtime/`
    (`test_shipped_shell_identity_names_no_upstream_repository` governs what it says)."""
    names = set(_members(wheel_path, site_runtime.APP_TARBALL))
    # npm pack prefixes every member with "package/".
    for required in (
        "package/docusaurus.config.ts",
        "package/sidebars.ts",
        "package/src/theme/MDXComponents.tsx",
        "package/src/css/tokens.css",
        "package/src/pages/index.tsx",
        "package/README.md",
    ):
        assert required in names, f"the app tarball has no {required}"
    assert not any(name.startswith("package/build/") for name in names), (
        "the app tarball carries a built site — pack from a clean tree"
    )


def test_app_tgz_ships_the_vendored_fonts_with_both_licences(wheel_path: Path) -> None:
    """The typefaces AND their licences travel inside the shipped shell.

    Redistributing an OFL face obliges us to redistribute its licence with it, and the
    two are only ever one packing rule apart. The licence half is asserted by CONTENT,
    not by name: an empty or truncated `LICENSE-*.txt` satisfies a membership check and
    satisfies nothing else. The faces are asserted by their woff2 magic for the same
    reason — a zero-byte font ships silently and fails only in a browser.
    """
    required = [FONT_DIR + name for name in (*FONT_FILES, *FONT_LICENCES)]
    names = set(_members(wheel_path, site_runtime.APP_TARBALL))
    missing = [name for name in required if name not in names]
    assert not missing, (
        f"{site_runtime.APP_TARBALL} is missing {missing} — the shell vendors Inter and "
        "JetBrains Mono (lead decision 2026-08-14: keep them; the contract forbids the "
        "off-origin fetch, not the typeface), and each family's SIL OFL licence ships "
        "beside its files. If a face was dropped deliberately, drop its licence and this "
        "list in the same change; a licence that stops shipping on its own is a defect."
    )

    blobs = _member_bytes(wheel_path, site_runtime.APP_TARBALL, required)
    for licence in FONT_LICENCES:
        text = blobs[FONT_DIR + licence].decode("utf-8", errors="replace")
        assert _OFL_TITLE in text.lower(), (
            f"{licence} ships but does not carry the SIL Open Font License text — "
            "the file is the obligation, not its filename"
        )
    for face in FONT_FILES:
        blob = blobs[FONT_DIR + face]
        assert blob[:4] == _WOFF2_MAGIC, (
            f"{face} ships but is not a woff2 file ({blob[:4]!r}) — a truncated or "
            "placeholder font passes every membership check and no browser"
        )


def test_shipped_stylesheets_fetch_the_fonts_from_this_origin(wheel_path: Path) -> None:
    """The other half of the same claim: nothing in the shipped CSS points off-origin.

    The surface contract's "the theme introduces no external requests" is enforced at
    runtime by B8 (network interception over a built fixture site), which is strictly
    stronger — and needs a build, a browser and a corpus to say anything. This is the
    unit-tier version over the bytes actually shipped: every `url()` in every stylesheet
    inside the app tarball is relative, and every vendored face is reached by one, so a
    face cannot ship unused while an `@font-face` quietly names a font CDN.
    """
    css_members = [
        name for name in _members(wheel_path, site_runtime.APP_TARBALL) if name.endswith(".css")
    ]
    assert css_members, f"{site_runtime.APP_TARBALL} carries no stylesheets — did src/css move?"
    blobs = _member_bytes(wheel_path, site_runtime.APP_TARBALL, css_members)

    referenced: set[str] = set()
    off_origin: list[str] = []
    for name, blob in sorted(blobs.items()):
        text = blob.decode("utf-8")
        for form, pattern in (("url({})", _CSS_URL_RE), ("@import {!r}", _CSS_IMPORT_RE)):
            for _, target in pattern.findall(text):
                if _OFF_ORIGIN_RE.match(target) and not target.startswith("data:"):
                    off_origin.append(f"{name}: {form.format(target)}")
                referenced.add(target.rsplit("/", 1)[-1])
    assert not off_origin, (
        "the shipped stylesheets request assets off-origin — the surface contract's "
        "'the theme introduces no external requests' (Google Fonts is the one this "
        "shell was forked away from):\n" + "\n".join(off_origin)
    )

    unused = [face for face in FONT_FILES if face not in referenced]
    assert not unused, (
        f"these faces ship but no shipped stylesheet references them: {unused} — either "
        "an @font-face was repointed at a hosted copy or the vendoring is dead weight"
    )


def test_shipped_lockfile_integrity_matches_shipped_tarballs(wheel_path: Path) -> None:
    """The wrinkle guard: lockfile sha512 for each file: tarball equals the shipped bytes.

    A mismatch means `make wheel` repacked a tgz without regenerating the lockfile —
    EINTEGRITY for cold-cache users, silently stale JS for warm-cache ones.
    """
    with zipfile.ZipFile(wheel_path) as whl:
        lock = json.loads(whl.read("vsor/_site_runtime/package-lock.json"))
        for artifact in LIBRARY_TARBALLS:
            dep = f"@vsor/{artifact.removesuffix('.tgz')}"
            entry = lock["packages"][f"node_modules/{dep}"]
            assert entry["resolved"] == f"file:{artifact}", f"{dep} must resolve to the relative tarball"
            digest = hashlib.sha512(whl.read(f"vsor/_site_runtime/{artifact}")).digest()
            expected = "sha512-" + base64.b64encode(digest).decode("ascii")
            assert entry["integrity"] == expected, (
                f"{dep}: lockfile integrity does not match the shipped {artifact} — "
                "make wheel must regenerate the shell lockfile whenever it repacks"
            )


def _surface_contract_denylist() -> tuple[str, ...]:
    """The one committed denylist, loaded from the tier that owns it.

    Imported rather than restated: the surface spec pairs one allowlist with one
    denylist, and two copies of a security list is one copy that stops being
    edited. Loaded by path because the boundary tier is a repo-root test module,
    not an importable package.
    """
    path = REPO_ROOT / "tests" / "test_surface_contract.py"
    spec = importlib.util.spec_from_file_location("vsor_surface_contract", path)
    assert spec is not None and spec.loader is not None, f"cannot load {path}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.DENYLIST)


def test_shipped_lockfile_contains_no_denylisted_name(wheel_path: Path) -> None:
    """The denylist backstop, over the lockfile a USER's `npm ci` actually resolves.

    A1 (tests/test_surface_contract.py) scans the workspace lockfile, which is the
    development graph — 1,493 packages, resolved from the workspace's own ranges.
    It is not the graph that reaches a project: `make wheel` regenerates a SEPARATE
    lockfile by fresh resolution against the shell manifest (Makefile: `npm install
    --package-lock-only` in the runtime dir), that file ships as
    `vsor/_site_runtime/package-lock.json`, and `npm ci` installs it into every
    project's `.vsor/site-runtime`. It resolves a different, larger set and pins
    different versions, so it is not a subset of the scanned one — a denylisted
    package could arrive transitively there and nothing looked.

    Added 2026-08-14; verified zero occurrences in the 0.1.0 wheel at the time, so
    this closes an unguarded gap rather than a live breach.
    """
    with zipfile.ZipFile(wheel_path) as whl:
        text = whl.read("vsor/_site_runtime/package-lock.json").decode("utf-8")
    hits = [name for name in _surface_contract_denylist() if name in text]
    assert not hits, (
        f"denylisted names in the SHIPPED shell lockfile (transitives included): {hits} — "
        "this is the lockfile a user's `npm ci` resolves, so the product dependency the "
        "negative contract excludes would land in their .vsor/site-runtime"
    )


def test_shell_template_pins_exact_versions() -> None:
    """Pure — no node needed. The template is the one home of the shell's versions."""
    deps: dict[str, str] = json.loads(TEMPLATE.read_text(encoding="utf-8"))["dependencies"]
    for name, spec in sorted(deps.items()):
        if name.startswith("@vsor/"):
            assert spec.startswith("file:./"), f"{name} must ship as a relative tarball, got {spec!r}"
            continue
        assert spec[0].isdigit(), f"{name} must pin an exact version, got {spec!r}"
    for required in (
        "@docusaurus/core",
        "@docusaurus/preset-classic",
        "@docusaurus/faster",
        "@easyops-cn/docusaurus-search-local",
        "react",
        "react-dom",
    ):
        assert required in deps


# ----------------------------------------------------------------- shipped lineage
# The shell is a fork, and the fork's provenance belongs in THIS repository: the
# upstream repo and the SHA are pinned in docs/extraction.md, and each copied
# component cites them in its own header (AGENTS.md "How we work" #1 — cite
# file:line against the pinned SHAs, or say you do not know). Those comments stay.
#
# What must not carry them is what the shell says about ITSELF, because that is the
# text a stranger meets: the README ships inside sor-site-app.tgz and is unpacked into
# every project's `.vsor/site-runtime/`, and the manifest's `description` is this
# package's own metadata (on disk it is then replaced by the shell manifest — but it
# ships in the wheel either way, and it is the sentence the package answers with).
# Upstream repository and directory names in a stranger's project are noise at best.
#
# The pattern is deliberately NOT in packages/sor-site/e2e/tests/exclusions.json: that
# file is the negative PRODUCT contract, scanned across all shipped source, where ~30
# provenance headers legitimately name the upstream path. This is a two-file rule with
# the opposite sign, so it lives beside the transport it constrains.
_LINEAGE_RE = re.compile(r"\bag2\b|learn[-_ ]app|d764f334", re.IGNORECASE)


LIB_SOURCE = REPO_ROOT / "packages" / "sor-site" / "lib"


def _shipped_package_dirs() -> list[Path]:
    """Every package whose self-identity reaches a project: the shell plus the
    libraries the shell manifest installs beside it.

    Widened 2026-08-14 from two files to all ten packages. The rule was written
    for the app and enforced only there, so the nine siblings shipped
    descriptions naming the upstream repository and the short SHA — and those are
    exactly what `npm ls` and `npm view` print out of a user's
    `.vsor/site-runtime/node_modules/@vsor/*`. Derived from the tarball names the
    shell manifest declares rather than listed, so a new library is covered the
    day it ships.
    """
    dirs = [APP_SOURCE]
    for tarball in LIBRARY_TARBALLS:
        # lib-remark-tabs.tgz -> packages/sor-site/lib/remark-tabs
        name = tarball.removesuffix(".tgz").removeprefix("lib-")
        candidate = LIB_SOURCE / name
        assert candidate.is_dir(), (
            f"the shell manifest names {tarball} but {candidate.relative_to(REPO_ROOT)} "
            "does not exist — the tarball-to-directory mapping moved"
        )
        dirs.append(candidate)
    return dirs


def test_shipped_shell_identity_names_no_upstream_repository() -> None:
    """Pure — no node needed. No shipped package's README or description names the fork source."""
    packages = _shipped_package_dirs()
    assert len(packages) > 1, "the shell manifest declares no library tarballs — did the fork move?"
    violations: list[str] = []
    for package in packages:
        manifest = package / "package.json"
        assert manifest.is_file(), (
            f"{package.relative_to(REPO_ROOT)} has no package.json — npm packs it, and its "
            "description is the sentence this package answers with in a stranger's project"
        )
        description = str(json.loads(manifest.read_text(encoding="utf-8")).get("description", ""))
        if _LINEAGE_RE.search(description):
            violations.append(f"{manifest.relative_to(REPO_ROOT)}: description: {description[:80]}")
        readme = package / "README.md"
        if package is packages[0]:
            assert readme.is_file(), (
                "the shipped shell lost README.md — npm packs it, and it is the one document "
                "a project's .vsor/site-runtime/ hands a reader"
            )
        if not readme.is_file():
            continue
        for line_no, line in enumerate(readme.read_text(encoding="utf-8").splitlines(), start=1):
            if _LINEAGE_RE.search(line):
                violations.append(f"{readme.relative_to(REPO_ROOT)}:{line_no} {line.strip()[:80]}")
    assert not violations, (
        "a shipped package names the repository it was forked from (de-brand, lead "
        "decision 2026-08-14) — provenance belongs in docs/extraction.md and in the "
        "source headers, never in what a package tells a stranger it is:\n"
        + "\n".join(violations)
    )
