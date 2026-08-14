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
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path

import pytest
from vsor import site_runtime

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "_site_runtime"
TEMPLATE = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "templates" / "site_runtime" / "package.json"

MANIFESTS = ("package.json", "package-lock.json")
LIBRARY_TARBALLS = site_runtime.library_tarballs(TEMPLATE.read_bytes())
ARTIFACT_NAMES = (site_runtime.APP_TARBALL, *MANIFESTS, *LIBRARY_TARBALLS)


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


def test_wheel_carries_every_artifact_the_shell_manifest_names(wheel_path: Path) -> None:
    with zipfile.ZipFile(wheel_path) as whl:
        names = set(whl.namelist())
    missing = [name for name in ARTIFACT_NAMES if f"vsor/_site_runtime/{name}" not in names]
    assert not missing, f"{wheel_path.name} lacks {missing} under vsor/_site_runtime/ — run make wheel"


def test_app_tgz_is_the_whole_site(wheel_path: Path) -> None:
    """The app ships as source, not as a build: it becomes the siteDir, so what has to be
    inside is the config the merge seam lives in, the MDX vocabulary a corpus writes
    against, the token stylesheet a project re-brands through, and the sidebar file its
    own `site/sidebars.ts` replaces."""
    names = set(_members(wheel_path, site_runtime.APP_TARBALL))
    # npm pack prefixes every member with "package/".
    for required in (
        "package/docusaurus.config.ts",
        "package/sidebars.ts",
        "package/src/theme/MDXComponents.tsx",
        "package/src/css/tokens.css",
        "package/src/pages/index.tsx",
    ):
        assert required in names, f"the app tarball has no {required}"
    assert not any(name.startswith("package/build/") for name in names), (
        "the app tarball carries a built site — pack from a clean tree"
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
