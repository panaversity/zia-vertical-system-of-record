"""The CLI's promises today: --version works, help works, the one unimplemented
verb (`serve`) says so honestly with exit code 2 — never a stack trace, never
silence — and `init` is dispatched to the scaffold BEFORE argparse can impose its
own exit-2 usage errors (the init contract owes exit 1 `error: bad-name` instead).
The `build`/`dev` contracts live in test_build_dev.py."""

import importlib.metadata
from pathlib import Path

import pytest
from vsor import __version__
from vsor.cli import main


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert capsys.readouterr().out.strip() == f"vsor {__version__}"


def test_version_is_the_distribution_version() -> None:
    """Not a tautology, deliberately: the old test asserted `__version__ in stdout`,
    which passed while `__version__` was a hardcoded "0.0.0" and a 0.1.0 install
    reported 0.1.0 everywhere else (metadata, build.lock.json, the scaffold's pin).
    This row pins the fact itself — one version, read from the distribution."""
    assert __version__ == importlib.metadata.version("vsor")
    assert __version__ != "0.0.0"


def test_no_verb_prints_help(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([]) == 0
    assert "init" in capsys.readouterr().out


def test_unimplemented_serve_is_honest(capsys: pytest.CaptureFixture[str]) -> None:
    """`serve` is the one remaining stub. `dev` and `build` are implemented now —
    their contract lives in test_build_dev.py and never exits 2."""
    assert main(["serve"]) == 2
    err = capsys.readouterr().err
    assert "not implemented" in err
    assert "later release" in err
    # It used to name specs/vsor/serve/spec.md and docs/status.md. Neither is in the
    # wheel or in a scaffolded project, and the serve spec has never been written —
    # a printed path that does not exist is worse than no path (found live 2026-08-14).
    assert "spec.md" not in err and "docs/status.md" not in err
    assert "AGENTS.md" in err and "CHANGELOG.md" in err


def test_init_bare_form_exits_zero(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`vsor init` is implemented: the bare form prints the instructional screen,
    creates nothing, and exits 0 — no longer the honest exit-2 stub."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("VSOR_DEV_VERSION", "0.1.0")
    assert main(["init"]) == 0
    out = capsys.readouterr().out
    assert "vsor init" in out
    assert list(tmp_path.iterdir()) == []


def test_init_intercepted_before_argparse(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """argparse rejects unknown positionals with SystemExit(2); the init contract
    requires exit 1 with the `error: bad-name` slug — so init must be intercepted
    before argparse dispatch ever sees its arguments."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("VSOR_DEV_VERSION", "0.1.0")
    assert main(["init", "My SoR"]) == 1
    err = capsys.readouterr().err
    assert err.splitlines()[0].startswith("error: bad-name")
    assert list(tmp_path.iterdir()) == []
