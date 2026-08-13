"""Unit contract for the `vsor build` / `vsor dev` command layer — written red-first
from specs/vsor/build/spec.md ("Failure honesty — the closed slug set", "`vsor dev`").

Public surface these tests define:

- `vsor/errors.py`:
  - `SLUG_EXITS: Mapping[str, int]` — the closed slug set, exactly as the spec states it.
  - `CommandError(slug, message)` — carries `.slug`, `.exit_code` (derived from the
    table), and `str(err)` is the prose. The CLI prints `error: <slug>` as the FIRST
    stderr line, prose below.
- `vsor/dev_cmd.py`:
  - `validate_port(raw: str) -> int` — integer 1–65535 or `CommandError("bad-port")`
    whose message names `--port`. Never argparse's exit-2 usage error.
  - `port_is_free(port: int) -> bool` — the SO_REUSEADDR pre-bind probe on 127.0.0.1.
- `vsor/cli.py` wires `build` and `dev` (with `--port`, default 3000) through argparse;
  `main([...])` returns the exit code and the first stderr line is the slug.

Seam contracts (so unit tests never touch npm or a real node):

- the node probe is called as `site_runtime.probe_node_version()` (module attribute);
- materialization is called as `site_runtime.ensure_runtime(project_root)` (module
  attribute) and runs only AFTER instance validation and port validation — failing fast
  must never cost the user a ~2-minute npm install first.
"""

import socket
from pathlib import Path

import pytest
from vsor import dev_cmd, site_runtime
from vsor.cli import main
from vsor.errors import SLUG_EXITS, CommandError

# The closed slug set — exit 1 is the user's input speaking, exit 3 the environment.
EXPECTED_SLUG_EXITS = {
    "build-failed": 1,
    "instance-invalid": 1,
    "bad-port": 1,
    "port-in-use": 1,
    "dev-failed": 1,
    "missing-runtime": 3,
    "install-failed": 3,
    "build-crashed": 3,
}

INSTANCE_MD = (
    "---\n"
    "format: 1\n"
    "name: demo\n"
    "vsor:\n"
    '  requires: ">=0.1.0,<0.2"\n'
    "---\n"
    "\n"
    "Answer only from this corpus; cite every answer; abstain honestly.\n"
)


def make_project(root: Path) -> None:
    """The minimal valid slice-1 project: instance trio, one document, the site shell."""
    (root / "knowledge").mkdir()
    (root / "knowledge" / "example.md").write_text(
        "---\ntitle: Example\n---\n\nA real body.\n", encoding="utf-8"
    )
    (root / "site" / "src" / "css").mkdir(parents=True)
    (root / "site" / "src" / "pages").mkdir(parents=True)
    (root / "site" / "docusaurus.config.ts").write_text("export default {};\n", encoding="utf-8")
    (root / "site" / "src" / "css" / "custom.css").write_text(":root {}\n", encoding="utf-8")
    (root / "site" / "src" / "pages" / "index.tsx").write_text(
        "export default () => null;\n", encoding="utf-8"
    )
    (root / "instance.md").write_text(INSTANCE_MD, encoding="utf-8")


@pytest.fixture
def project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    make_project(tmp_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("VSOR_DEV_VERSION", "0.1.0")
    return tmp_path


def given_node(monkeypatch: pytest.MonkeyPatch, version: str | None) -> None:
    monkeypatch.setattr(site_runtime, "probe_node_version", lambda: version)


def forbid_materialization(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*args: object, **kwargs: object) -> Path:
        raise AssertionError("unit tier: the site runtime must not be materialized on this path")

    monkeypatch.setattr(site_runtime, "ensure_runtime", boom)


def slug_line(err: str) -> str:
    return err.splitlines()[0]


# ------------------------------------------------------------------ the slug/exit table


def test_slug_exit_table_is_the_closed_set() -> None:
    assert dict(SLUG_EXITS) == EXPECTED_SLUG_EXITS


def test_command_error_carries_slug_exit_and_prose() -> None:
    err = CommandError("bad-port", "use --port with an integer 1-65535")
    assert err.slug == "bad-port"
    assert err.exit_code == 1
    assert "--port" in str(err)
    env = CommandError("install-failed", "npm said no")
    assert env.exit_code == 3
    assert "npm said no" in str(env)


# ------------------------------------------------------------------ port validation bounds


@pytest.mark.parametrize(("raw", "expected"), [("1", 1), ("3000", 3000), ("65535", 65535)])
def test_validate_port_accepts_the_bounds(raw: str, expected: int) -> None:
    assert dev_cmd.validate_port(raw) == expected


@pytest.mark.parametrize("raw", ["0", "65536", "99999", "-1", "abc", "3.5", ""])
def test_validate_port_rejects_out_of_range_and_non_integers(raw: str) -> None:
    with pytest.raises(CommandError) as exc:
        dev_cmd.validate_port(raw)
    assert exc.value.slug == "bad-port"
    assert exc.value.exit_code == 1
    assert "--port" in str(exc.value)


# ------------------------------------------------------------------ the pre-bind probe


def test_port_is_free_on_an_unbound_port() -> None:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = int(probe.getsockname()[1])
    assert dev_cmd.port_is_free(port) is True


def test_port_is_not_free_while_something_listens() -> None:
    with socket.socket() as held:
        held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        held.bind(("127.0.0.1", 0))
        held.listen(1)
        port = int(held.getsockname()[1])
        assert dev_cmd.port_is_free(port) is False


# ------------------------------------------------------------------ missing-runtime, measured


def test_build_without_node_is_missing_runtime(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, None)
    forbid_materialization(monkeypatch)
    assert main(["build"]) == 3
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: missing-runtime")
    assert "nodejs.org" in err


def test_build_old_node_names_the_measured_version(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "18.19.0")
    forbid_materialization(monkeypatch)
    assert main(["build"]) == 3
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: missing-runtime")
    assert "18.19" in err  # found
    assert "20" in err  # needed


def test_dev_old_node_is_the_same_slug(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "18.19.0")
    forbid_materialization(monkeypatch)
    assert main(["dev"]) == 3
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: missing-runtime")
    assert "18.19" in err


# ------------------------------------------------------------------ instance-invalid, fail fast


def test_build_without_instance_md_is_instance_invalid(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    forbid_materialization(monkeypatch)
    (project / "instance.md").unlink()
    assert main(["build"]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: instance-invalid")
    assert "instance.md" in err


def test_build_invalid_instance_names_the_offending_key_before_any_install(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Validation failure must cost seconds, never a ~2-minute npm install —
    forbid_materialization is the ordering assertion."""
    given_node(monkeypatch, "24.4.1")
    forbid_materialization(monkeypatch)
    (project / "instance.md").write_text(
        INSTANCE_MD.replace("vsor:\n", "banner: hello\nvsor:\n"), encoding="utf-8"
    )
    assert main(["build"]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: instance-invalid")
    assert "banner" in err


# ------------------------------------------------------------------ dev's port contract, end to end


@pytest.mark.parametrize("raw", ["99999", "0", "abc"])
def test_dev_bad_port_is_exit_1_with_the_slug(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], raw: str
) -> None:
    """Never argparse's exit-2 usage error, never a traceback — the spec owes
    exit 1 `error: bad-port` for anything outside 1–65535."""
    given_node(monkeypatch, "24.4.1")
    forbid_materialization(monkeypatch)
    assert main(["dev", "--port", raw]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: bad-port")


def test_dev_occupied_port_is_port_in_use_never_a_prompt_or_increment(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        return runtime

    monkeypatch.setattr(site_runtime, "ensure_runtime", fake_runtime)
    with socket.socket() as held:
        held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        held.bind(("127.0.0.1", 0))
        held.listen(1)
        port = int(held.getsockname()[1])
        assert main(["dev", "--port", str(port)]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: port-in-use")
    assert str(port) in err  # names the port…
    assert "--port" in err  # …and the way out
