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
from vsor import build_cmd, dev_cmd, site_runtime
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


# ── the flat-corpus warning ────────────────────────────────────────────────
# Measured 2026-08-14: 2,000 flat documents build to 806 MB (378 KB of HTML per
# page, because Docusaurus writes the whole sidebar into every one); the same
# 2,000 in twenty folders build to 155 MB in half the time. The warning exists
# so that ceiling is met with advice rather than with a slow build and a
# hosting bill.


def _docs(paths: list[str]) -> list[object]:
    return [{"path": p, "sha256": "0" * 64} for p in paths]


def test_flat_corpus_warns_only_past_the_measured_threshold(
    capsys: pytest.CaptureFixture[str],
) -> None:
    from vsor.build_cmd import _FLAT_CORPUS_WARNING_THRESHOLD, _warn_flat_corpus

    small = _docs([f"knowledge/doc-{i}.md" for i in range(_FLAT_CORPUS_WARNING_THRESHOLD - 1)])
    _warn_flat_corpus(small)
    assert capsys.readouterr().err == "", "a small flat corpus is the normal case, not a warning"

    big = _docs([f"knowledge/doc-{i}.md" for i in range(_FLAT_CORPUS_WARNING_THRESHOLD)])
    _warn_flat_corpus(big)
    err = capsys.readouterr().err
    assert err.startswith("warning:")
    assert "knowledge/" in err
    assert "806 MB" in err, "the remedy carries the measurement that motivates it"


def test_foldered_corpus_never_warns(capsys: pytest.CaptureFixture[str]) -> None:
    """The layout the warning asks for must not itself trip the warning."""
    from vsor.build_cmd import _FLAT_CORPUS_WARNING_THRESHOLD, _warn_flat_corpus

    nested = _docs(
        [
            f"knowledge/section-{i // 100}/doc-{i}.md"
            for i in range(_FLAT_CORPUS_WARNING_THRESHOLD * 3)
        ]
    )
    _warn_flat_corpus(nested)
    assert capsys.readouterr().err == ""


# ── the placeholder-url warning ────────────────────────────────────────────
# The scaffold ships `url: "http://localhost:3000"`, and Docusaurus bakes that
# value into build/sitemap.xml, every <link rel="canonical">, the og:/twitter:
# image URLs and each page's JSON-LD. A user who uploads the output publishes a
# site whose machine-readable half names their laptop, and every page still
# looks right — so no other tier can see it. `vsor build` says so; it is a
# WARNING, because building against localhost is what every local preview does.
#
# One seam beyond the two in this file's header, used by the wiring rows below:
# `build_cmd._run_docusaurus_build(runtime_dir, staging)` is the Node boundary —
# stubbed here to write the staging tree Docusaurus would have written, so the
# unit tier can assert on the emitted artifact without npm.

SITEMAP = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    "<url><loc>{loc}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>"
    "</urlset>"
)


@pytest.mark.parametrize(
    "host",
    [
        "localhost",  # the scaffold's own placeholder
        "127.0.0.1",
        "127.0.0.53",  # the whole loopback /8, not one address
        "::1",
        "0.0.0.0",
        "example.com",  # RFC 2606
        "your-docusaurus-site.example.com",  # create-docusaurus' own default
        "my-sor.test",  # RFC 6761
        "notes.invalid",
        "sor.example",
    ],
)
def test_placeholder_hosts_are_the_ones_nobody_can_reach(host: str) -> None:
    assert build_cmd.is_placeholder_host(host) is True


@pytest.mark.parametrize(
    "host",
    [
        "sor.acme.com",
        "acme.github.io",
        "192.168.1.10",  # a LAN deployment is a real deployment…
        "10.4.0.7",
        "wiki.internal",  # …so is an intranet name…
        "macbook.local",  # …and so is mDNS (RFC 6762)
        "myexample.org",  # only `example.<tld>` itself is reserved
        "example-corp.com",
    ],
)
def test_real_hosts_never_trip_the_warning(host: str) -> None:
    """Crying wolf is the failure mode that makes a warning worthless — these are
    the hosts a user legitimately deploys to."""
    assert build_cmd.is_placeholder_host(host) is False


def test_built_site_origin_reads_the_emitted_sitemap(tmp_path: Path) -> None:
    """The origin is measured from the artifact Docusaurus wrote, never from the
    config text: the shell merges the project's config over its own, whose default
    is the same placeholder, so a project that deletes `url` still ships localhost."""
    build_dir = tmp_path / "build"
    build_dir.mkdir()
    (build_dir / "sitemap.xml").write_text(
        SITEMAP.format(loc="https://sor.acme.com:8443/docs/example"), encoding="utf-8"
    )
    assert build_cmd.built_site_origin(build_dir) == "https://sor.acme.com:8443"


@pytest.mark.parametrize("sitemap", [None, "not xml at all", "<urlset><url/></urlset>"])
def test_built_site_origin_is_none_when_there_is_nothing_to_read(
    tmp_path: Path, sitemap: str | None
) -> None:
    """A warning never crashes a build that succeeded."""
    build_dir = tmp_path / "build"
    build_dir.mkdir()
    if sitemap is not None:
        (build_dir / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    assert build_cmd.built_site_origin(build_dir) is None


def given_built_site(monkeypatch: pytest.MonkeyPatch, loc: str) -> None:
    """Stand in for the whole Node half: a materialized shell carrying the two files
    the record reads, and a build that writes the sitemap Docusaurus would emit."""

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        core = runtime / "node_modules" / "@docusaurus" / "core"
        core.mkdir(parents=True, exist_ok=True)
        (core / "package.json").write_text('{"version": "3.10.2"}\n', encoding="utf-8")
        (runtime / "package-lock.json").write_text('{"lockfileVersion": 3}\n', encoding="utf-8")
        return runtime

    def fake_docusaurus_build(runtime_dir: Path, staging: Path) -> None:
        staging.mkdir(parents=True)
        (staging / "index.html").write_text("<html><body>built</body></html>", encoding="utf-8")
        (staging / "sitemap.xml").write_text(SITEMAP.format(loc=loc), encoding="utf-8")

    monkeypatch.setattr(site_runtime, "ensure_runtime", fake_runtime)
    monkeypatch.setattr(build_cmd, "_run_docusaurus_build", fake_docusaurus_build)


def test_build_warns_when_the_built_site_carries_a_placeholder_url(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "http://localhost:3000/docs/example")

    assert main(["build"]) == 0, "building against localhost is legitimate — warn, never fail"

    captured = capsys.readouterr()
    err = captured.err
    assert err.startswith("warning:"), err
    assert "http://localhost:3000" in err  # what was measured
    assert "site/docusaurus.config.ts" in err  # the file…
    assert "`url`" in err  # …and the key
    assert "sitemap" in err and "canonical" in err  # the consequence, named
    assert "vsor build" in err  # the fix ends in a rerun
    assert (project / "build" / "sitemap.xml").exists(), "the build still completed"
    assert "build/ written" in captured.out


@pytest.mark.parametrize(
    ("host", "kind"),
    [
        ("localhost", "this-machine"),
        ("127.0.0.1", "this-machine"),
        ("::1", "this-machine"),
        ("0.0.0.0", "this-machine"),
        ("example.com", "resolves-nowhere"),
        ("mysite.example.com", "resolves-nowhere"),
        ("my-sor.test", "resolves-nowhere"),
        ("sor.example", "resolves-nowhere"),
        ("sor.acme.com", None),
    ],
)
def test_placeholder_kind_separates_the_two_ways_of_being_wrong(
    host: str, kind: str | None
) -> None:
    """A loopback address really does name the machine that built the site; a reserved
    documentation name names no machine at all. One message covering both told a user
    who had just set `https://mysite.example.com` that their site "lives on this
    machine" — two falsehoods in a sentence they had already acted on."""
    assert build_cmd.placeholder_kind(host) == kind


def test_the_reserved_name_warning_does_not_say_this_machine(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "https://mysite.example.com/docs/example")

    assert main(["build"]) == 0
    err = capsys.readouterr().err
    assert err.startswith("warning:")
    assert "https://mysite.example.com" in err
    assert "resolves nowhere" in err
    assert "on this machine" not in err


def test_build_says_nothing_when_the_url_is_a_real_domain(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "https://sor.acme.com/docs/example")

    assert main(["build"]) == 0
    captured = capsys.readouterr()
    assert captured.err == "", f"a configured site must build silently, got: {captured.err!r}"
    assert "build/ written" in captured.out
