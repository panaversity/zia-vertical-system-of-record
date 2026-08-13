"""Wheel-transport contract for specs/vsor/build — the four `_site_runtime` artifacts.

`make wheel` (npm ci + workspace builds + npm pack + shell-lockfile regeneration, then
`uv build`) must precede `uv build`; this test is the gate on that ordering: absent
artifacts are built via `make wheel` when node is available, and the run skips with the
remedy when it is not.

found live 2026-08-13 (npm 11.16.0): the shell package-lock.json records sha512
integrity for the `file:` tarballs. A tgz repacked without regenerating the lockfile
fails `npm ci` with EINTEGRITY on a cold cache — and on a warm cache `npm ci` exits 0
and silently installs the OLD cached bytes. The integrity-consistency test below is the
guard that a shipped wheel can never carry that mismatch.
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

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "_site_runtime"
TEMPLATE = REPO_ROOT / "packages" / "vsor" / "src" / "vsor" / "templates" / "site_runtime" / "package.json"
ARTIFACT_NAMES = ("sor-site-mdx.tgz", "sor-site-theme.tgz", "package.json", "package-lock.json")


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


def test_wheel_carries_all_four_artifacts(wheel_path: Path) -> None:
    with zipfile.ZipFile(wheel_path) as whl:
        names = set(whl.namelist())
    missing = [name for name in ARTIFACT_NAMES if f"vsor/_site_runtime/{name}" not in names]
    assert not missing, f"{wheel_path.name} lacks {missing} under vsor/_site_runtime/ — run make wheel"


def test_mdx_tgz_is_prebuilt_with_src_retained(wheel_path: Path) -> None:
    with zipfile.ZipFile(wheel_path) as whl:
        tgz = whl.read("vsor/_site_runtime/sor-site-mdx.tgz")
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as tar:
        names = tar.getnames()
    # prebuilt: lib/ compiled before pack — nothing compiles inside the uv cache
    assert "package/lib/theme/MDXComponents.js" in names
    # src/ retained so `docusaurus swizzle --typescript` works against the shipped package
    assert any(name.startswith("package/src/") for name in names)


def test_shipped_lockfile_integrity_matches_shipped_tarballs(wheel_path: Path) -> None:
    """The wrinkle guard: lockfile sha512 for each file: tarball equals the shipped bytes.

    A mismatch means `make wheel` repacked a tgz without regenerating the lockfile —
    EINTEGRITY for cold-cache users, silently stale JS for warm-cache ones.
    """
    with zipfile.ZipFile(wheel_path) as whl:
        lock = json.loads(whl.read("vsor/_site_runtime/package-lock.json"))
        for dep, artifact in (
            ("@vsor/sor-site-mdx", "sor-site-mdx.tgz"),
            ("@vsor/sor-site-theme", "sor-site-theme.tgz"),
        ):
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
    data = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    deps: dict[str, str] = data["dependencies"]
    assert deps["@vsor/sor-site-mdx"] == "file:./sor-site-mdx.tgz"
    assert deps["@vsor/sor-site-theme"] == "file:./sor-site-theme.tgz"
    for required in (
        "@docusaurus/core",
        "@docusaurus/preset-classic",
        "@easyops-cn/docusaurus-search-local",
        "react",
        "react-dom",
    ):
        spec = deps[required]
        assert spec[0].isdigit(), f"{required} must pin an exact version, got {spec!r}"
