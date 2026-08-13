"""Workspace boundary rules, enforced by AST — never imported, never regex.

Baseline ZERO, by design: this file predates the first feature code, so no violation is
grandfathered and none ever will be (AGENTS.md: guards added late carry debt forever).

Rules:
  1. A workspace package may import only the internal packages named in ALLOWED.
     A package absent from ALLOWED fails loudly — enrolment is a decision, not a default.
  2. Nothing imports vsor.cli. The CLI is the top of the graph, never a library.

Covers every import form the language has: plain, from, and importlib/__import__ with a
string-literal target. A dynamic import with a non-literal target of an internal package
is itself a violation of rule 3 (don't hide the graph) and fails.
"""

import ast
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PACKAGES = REPO / "packages"

# package name -> internal packages it may import. Extend DELIBERATELY as packages arrive:
# sor-platform imports nothing internal; sor-content -> {sor-platform}; etc.
ALLOWED: dict[str, set[str]] = {
    "vsor": set(),
}

DYNAMIC_IMPORTERS = {"import_module", "__import__"}


def _workspace_packages() -> dict[str, Path]:
    return {
        p.name: p / "src"
        for p in sorted(PACKAGES.iterdir())
        if p.is_dir() and (p / "pyproject.toml").exists()
    }


def _module_root(dotted: str) -> str:
    return dotted.split(".", 1)[0].replace("_", "-")


def _imports_of(path: Path) -> list[tuple[str, int]]:
    tree = ast.parse(path.read_text(), filename=str(path))
    found: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.extend((alias.name, node.lineno) for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            found.append((node.module, node.lineno))
        elif isinstance(node, ast.Call):
            fn = node.func
            name = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else ""
            if name in DYNAMIC_IMPORTERS and node.args:
                arg = node.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    found.append((arg.value, node.lineno))
    return found


def test_every_package_is_enrolled() -> None:
    unenrolled = set(_workspace_packages()) - set(ALLOWED)
    assert not unenrolled, (
        f"packages not enrolled in the boundary rules: {sorted(unenrolled)} — "
        "add each to ALLOWED in tests/test_boundaries.py with its permitted imports. "
        "Enrolment is a decision with a name on it, not a silence."
    )


def test_internal_imports_respect_the_graph() -> None:
    packages = _workspace_packages()
    internal = set(packages)
    violations: list[str] = []
    for pkg, src in packages.items():
        for py in sorted(src.rglob("*.py")):
            for dotted, line in _imports_of(py):
                root = _module_root(dotted)
                if root in internal and root != pkg and root not in ALLOWED[pkg]:
                    violations.append(f"{py.relative_to(REPO)}:{line} — {pkg} imports {root}")
    assert not violations, "cross-package imports outside the declared graph:\n" + "\n".join(violations)


def test_nothing_imports_the_cli() -> None:
    packages = _workspace_packages()
    violations: list[str] = []
    for src in packages.values():
        for py in sorted(src.rglob("*.py")):
            if py.match("*/vsor/cli.py"):
                continue
            for dotted, line in _imports_of(py):
                if dotted == "vsor.cli" or dotted.startswith("vsor.cli."):
                    violations.append(f"{py.relative_to(REPO)}:{line}")
    assert not violations, "vsor.cli is the top of the graph; nothing may import it:\n" + "\n".join(
        violations
    )
