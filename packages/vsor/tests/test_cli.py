"""The CLI's only promises today: --version works, help works, and an
unimplemented verb says so honestly with exit code 2 — never a stack trace,
never silence."""

import pytest
from vsor import __version__
from vsor.cli import main


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert __version__ in capsys.readouterr().out


def test_no_verb_prints_help(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([]) == 0
    assert "init" in capsys.readouterr().out


@pytest.mark.parametrize("verb", ["init", "dev", "build", "serve"])
def test_unimplemented_verb_is_honest(verb: str, capsys: pytest.CaptureFixture[str]) -> None:
    assert main([verb]) == 2
    err = capsys.readouterr().err
    assert "not implemented" in err
    assert "spec" in err
