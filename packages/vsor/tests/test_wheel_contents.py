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


def test_shipped_shell_identity_names_no_upstream_repository() -> None:
    """Pure — no node needed. The shell's own README and description name no fork source."""
    readme = APP_SOURCE / "README.md"
    manifest = APP_SOURCE / "package.json"
    assert readme.is_file() and manifest.is_file(), (
        f"the shipped shell lost {readme.name} or {manifest.name} — npm packs both, and "
        "the README is the one document a project's .vsor/site-runtime/ hands a reader"
    )
    violations: list[str] = []
    for line_no, line in enumerate(readme.read_text(encoding="utf-8").splitlines(), start=1):
        if _LINEAGE_RE.search(line):
            violations.append(f"{readme.relative_to(REPO_ROOT)}:{line_no} {line.strip()[:80]}")
    description = str(json.loads(manifest.read_text(encoding="utf-8")).get("description", ""))
    if _LINEAGE_RE.search(description):
        violations.append(f"{manifest.relative_to(REPO_ROOT)}: description: {description[:80]}")
    assert not violations, (
        "the shipped shell names the repository it was forked from (de-brand, lead "
        "decision 2026-08-14) — provenance belongs in docs/extraction.md and in the "
        "source headers, never in what the shell tells a stranger it is:\n"
        + "\n".join(violations)
    )
