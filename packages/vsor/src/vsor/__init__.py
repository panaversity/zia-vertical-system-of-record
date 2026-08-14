"""vsor — governed markdown in, a website and an MCP server out."""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _distribution_version

# One fact, one file: the version lives in packages/vsor/pyproject.toml and nowhere else.
# found live 2026-08-14 (clean-room walk of the 0.1.0 wheel): this was a hardcoded "0.0.0",
# so a user who installed 0.1.0 and ran `vsor --version` was told 0.0.0 while the same
# install's `build.lock.json`, `vsor.requires` pin and distribution metadata all correctly
# said 0.1.0 — those three read importlib.metadata; only this one did not.
#
# The fallback is reached only when the package is not installed at all (a bare source
# tree on sys.path). It keeps the placeholder's meaning — "no release stamp" — which is
# exactly what `vsor init` refuses with `error: unstamped` unless VSOR_DEV_VERSION names
# one. `--version` deliberately does NOT consult VSOR_DEV_VERSION: that variable is the
# dev/CI harness naming a version to *pin into a scaffold*, not a claim about the binary
# that is running.
try:
    __version__ = _distribution_version("vsor")
except PackageNotFoundError:  # pragma: no cover — requires an uninstalled source tree
    __version__ = "0.0.0"
