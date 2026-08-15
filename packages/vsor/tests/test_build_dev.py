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

import errno
import hashlib
import io
import json
import os
import shutil
import socket
import subprocess
from collections.abc import Callable
from pathlib import Path

import pytest
from vsor import build_cmd, dev_cmd, lock, site_runtime
from vsor.cli import main
from vsor.errors import SLUG_EXITS, CommandError, io_refusal

# The closed slug set — exit 1 is the user's input speaking, exit 3 the environment.
EXPECTED_SLUG_EXITS = {
    "build-failed": 1,
    "instance-invalid": 1,
    "bad-port": 1,
    "port-in-use": 1,
    "dev-failed": 1,
    # Two the shell's safety contract added, 2026-08-15 — both proved in
    # test_shell_safety.py: another vsor already working in this project, and a corpus
    # whose documents are symbolic links (served by the site, unnameable by the record).
    "project-busy": 1,
    "symlink-unsupported": 1,
    # Effective dating and supersession, 2026-08-15 — proved in test_knowledge.py: a
    # `superseded_by` naming a document this build is not publishing. Exit 1, beside
    # instance-invalid, because it is the user's own markdown speaking.
    "knowledge-invalid": 1,
    "missing-runtime": 3,
    "install-failed": 3,
    "build-crashed": 3,
    # The filesystem refusing vsor's own work — the disk filling mid-build is the
    # measured one (2026-08-15). Exit 3 because it is the environment speaking: not the
    # user's markdown, not their config, and not something rerunning the same command
    # fixes. Without it the OSError escaped as a raw traceback — no slug for an agent to
    # branch on, and a code that reads as "your input was wrong".
    "io-failed": 3,
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


# The file being unreadable AS TEXT is a parse failure like any other, and the spec's
# closed slug set has no room for a traceback: `instance.md` was decoded as UTF-8 with
# nothing catching UnicodeDecodeError, so a file saved as UTF-16 — PowerShell's
# `Out-File` default, and what a converted corpus arrives as — exited 1 with a Python
# stack trace and no `error:` line for an agent to branch on. Both verbs read this file,
# so both are asserted here; the fix belongs to the parser, which is the one place that
# decides what `instance.md` is allowed to be.
@pytest.mark.parametrize("verb", ["build", "dev"])
def test_a_non_utf8_instance_is_a_slug_not_a_traceback(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], verb: str
) -> None:
    given_node(monkeypatch, "24.4.1")
    forbid_materialization(monkeypatch)
    (project / "instance.md").write_bytes(INSTANCE_MD.encode("utf-16"))

    assert main([verb]) == 1
    err = capsys.readouterr().err
    assert slug_line(err) == "error: instance-invalid"
    assert "instance.md" in err  # which file
    assert "UTF-8" in err  # what it must be
    assert "iconv" in err  # and how to make it that


def test_a_byte_order_mark_is_named_rather_than_denied(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A UTF-8 BOM decodes cleanly, so the file reached the frontmatter split and was
    refused with "the file must open with a `---` line" — of a file that visibly does.
    Three invisible bytes, and an error the reader can prove wrong teaches them to
    distrust the next one. It still refuses; it now says what it can see."""
    given_node(monkeypatch, "24.4.1")
    forbid_materialization(monkeypatch)
    (project / "instance.md").write_bytes(b"\xef\xbb\xbf" + INSTANCE_MD.encode("utf-8"))

    assert main(["build"]) == 1
    err = capsys.readouterr().err
    assert slug_line(err) == "error: instance-invalid"
    assert "byte-order mark" in err
    assert "EF BB BF" in err  # the bytes, since the eye cannot find them
    assert "must open with a `---` line" not in err  # the falsehood it replaces


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
# `build_cmd._run_docusaurus_build(runtime_dir, staging, *, lock_path)` is the Node
# boundary (the keyword names the lock so the child can be recorded in it) —
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


FAKE_DOCUSAURUS_VERSION = "3.10.2"
FAKE_SHELL_LOCK = '{"lockfileVersion": 3}\n'
# The forked app's own bytes, as `.materialized.json` records them. It is a build_id input
# at format 2 (the app is unpacked over the shell rather than installed, so no npm
# integrity hash covers it), so the fake shell carries a stamp exactly as an install does.
FAKE_APP_SHA = hashlib.sha256(b"the forked site app").hexdigest()


def given_built_site(
    monkeypatch: pytest.MonkeyPatch,
    loc: str,
    *,
    during_build: Callable[[], None] | None = None,
    during_materialization: Callable[[], None] | None = None,
) -> None:
    """Stand in for the whole Node half: a materialized shell carrying the two files
    the record reads, and a build that writes the sitemap Docusaurus would emit.

    The fake shell SNAPSHOTS the authored trees exactly as `ensure_runtime` does
    (`copy_authored`), because that snapshot is what the record has to hash: a fake that
    skipped it would let a test pass over a record measured from a tree the build never
    read.

    Two hooks, because the real verb has two windows in which the authored trees can move
    underneath it and they are different lengths:

    - `during_build` runs at the instant Docusaurus would be running — 45 seconds cold,
      231 at 2,000 documents;
    - `during_materialization` runs AFTER the snapshot and BEFORE `ensure_runtime`
      returns: the `npm ci` window, which the verb's own notice advertises as one to two
      minutes. Only this hook makes the snapshot and the authored trees disagree, which
      is what tells a record measured from the shell apart from one measured from the
      project.
    """

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        core = runtime / "node_modules" / "@docusaurus" / "core"
        core.mkdir(parents=True, exist_ok=True)
        (core / "package.json").write_text(
            f'{{"version": "{FAKE_DOCUSAURUS_VERSION}"}}\n', encoding="utf-8"
        )
        (runtime / "package-lock.json").write_text(FAKE_SHELL_LOCK, encoding="utf-8")
        (runtime / ".materialized.json").write_text(
            json.dumps({"app_sha256": FAKE_APP_SHA}), encoding="utf-8"
        )
        site_runtime.copy_authored(project_root, runtime)
        if during_materialization is not None:
            during_materialization()
        return runtime

    def fake_docusaurus_build(runtime_dir: Path, staging: Path, **_: object) -> None:
        if during_build is not None:
            during_build()
        staging.mkdir(parents=True)
        (staging / "index.html").write_text("<html><body>built</body></html>", encoding="utf-8")
        (staging / "sitemap.xml").write_text(SITEMAP.format(loc=loc), encoding="utf-8")

    monkeypatch.setattr(site_runtime, "ensure_runtime", fake_runtime)
    monkeypatch.setattr(build_cmd, "_run_docusaurus_build", fake_docusaurus_build)


def read_record(project: Path) -> dict[str, object]:
    loaded = json.loads((project / "build.lock.json").read_text(encoding="utf-8"))
    assert isinstance(loaded, dict)
    return loaded


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


# ── the record describes the bytes that were built ─────────────────────────
#
# `ensure_runtime` snapshots `knowledge/` and `site/` into the shell and Docusaurus reads
# ONLY that snapshot. Measuring the record from the authored trees afterwards leaves the
# whole Docusaurus run between the two — 231 seconds at 2,000 documents — and an agent
# writing into knowledge/ during a build (which is exactly what the add-sources skill
# does) then produces a record describing bytes the site does not contain. The whole MCP
# pitch is that a citation points at a generation; a record of the wrong generation is
# the one defect that cannot be caught downstream.

REAL_LOC = "https://sor.acme.com/docs/example"


def expected_build_id(corpus_rows: list[tuple[str, str]], site_rows: list[tuple[str, str]]) -> str:
    """The recipe over the SNAPSHOT — what the record must say."""
    return lock.compute_build_id(
        corpus_tree=lock.tree_hash(corpus_rows),
        site_tree=lock.tree_hash(site_rows),
        instance_sha256=hashlib.sha256(INSTANCE_MD.encode("utf-8")).hexdigest(),
        vsor_version=site_runtime.running_vsor_version(),
        docusaurus_version=FAKE_DOCUSAURUS_VERSION,
        node_version="24.4.1",
        lock_sha256=hashlib.sha256(FAKE_SHELL_LOCK.encode("utf-8")).hexdigest(),
        app_sha256=FAKE_APP_SHA,
    )


def test_the_record_follows_the_snapshot_the_build_read(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """An agent lands two documents and edits the config while Docusaurus runs. None of it
    is in the site that was just written, so none of it may be in the record."""
    given_node(monkeypatch, "24.4.1")
    snapshot: dict[str, list[tuple[str, str]]] = {}

    def agent_writes_mid_build() -> None:
        # Measured at the instant the build starts: the authored trees still hold exactly
        # what ensure_runtime copied, so this IS the tree Docusaurus is reading.
        snapshot["corpus"] = lock.walk_tree(project, "knowledge")
        snapshot["site"] = lock.walk_tree(project, "site")
        (project / "knowledge" / "example.md").write_text("rewritten mid-build\n", encoding="utf-8")
        (project / "knowledge" / "late.md").write_text(
            "---\ntitle: Late\n---\n\nArrived during the build.\n", encoding="utf-8"
        )
        (project / "site" / "docusaurus.config.ts").write_text(
            "export default {changed: true};\n", encoding="utf-8"
        )

    given_built_site(monkeypatch, REAL_LOC, during_build=agent_writes_mid_build)
    assert main(["build"]) == 0

    record = read_record(project)
    corpus = record["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["documents"] == [
        {"path": path, "sha256": digest} for path, digest in snapshot["corpus"]
    ], "the record must describe the corpus the site was built from"
    assert [d["path"] for d in corpus["documents"]] == ["knowledge/example.md"], (
        "knowledge/late.md is in no page of this build — recording it claims a site that "
        "does not exist"
    )
    assert corpus["tree"] == lock.tree_hash(snapshot["corpus"])
    assert record["build_id"] == expected_build_id(snapshot["corpus"], snapshot["site"]), (
        "site/ is snapshotted by the same copy, so build_id owes the same instant"
    )


def test_an_undisturbed_build_records_exactly_the_authored_rows(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The normal path is unchanged by all of the above: `walk_tree` composes every row
    path as f"{subdir}/{rel}" from its ARGUMENT, so hashing the shell's copies yields
    byte-identical rows. This is the guard that the fix moved WHAT is measured and
    nothing else."""
    given_node(monkeypatch, "24.4.1")
    (project / "knowledge" / "sub").mkdir()
    (project / "knowledge" / "sub" / "deep.md").write_text(
        "---\ntitle: Deep\n---\n\nNested.\n", encoding="utf-8"
    )
    corpus_rows = lock.walk_tree(project, "knowledge")
    site_rows = lock.walk_tree(project, "site")

    given_built_site(monkeypatch, REAL_LOC)
    assert main(["build"]) == 0

    record = read_record(project)
    corpus = record["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["documents"] == [
        {"path": path, "sha256": digest} for path, digest in corpus_rows
    ]
    assert [d["path"] for d in corpus["documents"]] == [
        "knowledge/example.md",
        "knowledge/sub/deep.md",
    ]
    assert record["build_id"] == expected_build_id(corpus_rows, site_rows)


def snapshot_rows(project: Path, subdir: str) -> list[tuple[str, str]]:
    """The shell's copy — the bytes Docusaurus is given, whatever the project holds now."""
    return lock.walk_tree(project / ".vsor" / "site-runtime", subdir)


def test_the_record_hashes_the_snapshot_not_the_authored_tree(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The install window, which is the LONGER of the two and the one moving the
    measurement earlier does not close.

    `ensure_runtime` snapshots the authored trees and then runs `npm ci` — its own notice
    says one to two minutes. A document landing in `knowledge/` inside that window is in
    the project and in no page of the site the shell goes on to build, so it may not be in
    the record either. Measuring the authored trees records it — even measured before the
    build, which is where a fix aimed only at the Docusaurus window stops. What makes the
    record honest is not WHEN it is measured but WHICH tree: the one that was built.
    """
    given_node(monkeypatch, "24.4.1")
    snapshot: dict[str, list[tuple[str, str]]] = {}

    def agent_writes_during_npm_ci() -> None:
        snapshot["corpus"] = snapshot_rows(project, "knowledge")
        snapshot["site"] = snapshot_rows(project, "site")
        (project / "knowledge" / "during-install.md").write_text(
            "---\ntitle: During\n---\n\nArrived while npm ran.\n", encoding="utf-8"
        )
        (project / "site" / "src" / "css" / "custom.css").write_text(
            ":root { --ifm-color-primary: rebeccapurple; }\n", encoding="utf-8"
        )

    given_built_site(monkeypatch, REAL_LOC, during_materialization=agent_writes_during_npm_ci)
    assert main(["build"]) == 0

    assert lock.walk_tree(project, "knowledge") != snapshot["corpus"], (
        "the premise: the authored corpus and the snapshot genuinely disagree here"
    )
    assert lock.walk_tree(project, "site") != snapshot["site"]

    record = read_record(project)
    corpus = record["corpus"]
    assert isinstance(corpus, dict)
    assert [d["path"] for d in corpus["documents"]] == ["knowledge/example.md"], (
        "knowledge/during-install.md is in no page of this build — the shell never saw it"
    )
    assert corpus["tree"] == lock.tree_hash(snapshot["corpus"])
    assert record["build_id"] == expected_build_id(snapshot["corpus"], snapshot["site"]), (
        "build_id owes the trees that were built, site/ included"
    )


def test_the_record_hashes_the_instance_the_build_validated(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`instance.md` is the one input the shell keeps no copy of, so honesty here is the
    read itself: it is hashed from the same bytes the run parsed, at the top of the verb.

    Read a second time after materialization, a rewrite inside the install window put two
    versions of one file into a single record — `build_id` naming bytes vsor never
    validated, beside a `requires_satisfied` computed from the bytes it did. The rewrite
    below pins a version this vsor does not satisfy, so the two answers are visibly
    different rather than merely differently-hashed.
    """
    given_node(monkeypatch, "24.4.1")

    def rewritten_during_npm_ci() -> None:
        (project / "instance.md").write_text(
            INSTANCE_MD.replace('">=0.1.0,<0.2"', '">=9.0"'), encoding="utf-8"
        )

    given_built_site(monkeypatch, REAL_LOC, during_materialization=rewritten_during_npm_ci)
    assert main(["build"]) == 0

    record = read_record(project)
    assert record["requires_satisfied"] is True, (
        "the file this build validated pins >=0.1.0,<0.2, and 0.1.0 satisfies it"
    )
    assert record["build_id"] == expected_build_id(
        snapshot_rows(project, "knowledge"), snapshot_rows(project, "site")
    ), "build_id owes the instance.md this build read, not the one that landed during npm ci"
    assert capsys.readouterr().err == "", "nothing about this build is a warning"


# ── corpus.git names a commit that HAS the corpus, or nothing ──────────────
#
# `git status --porcelain` does not report ignored files; the walk hashes every non-dot
# regular file whether git tracks it or not. One `.gitignore` line for a drafts directory
# is therefore enough to make a clean-status inference name a commit that reproduces a
# DIFFERENT site — the same class of lie `git rev-parse HEAD:knowledge` was rejected for.

needs_git = pytest.mark.skipif(shutil.which("git") is None, reason="git is not on PATH")


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=False
    )


def commit_project(root: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    """Commit everything present and return HEAD, with git isolated from the machine's
    own config (identity, default branch and signing all leak into assertions otherwise)."""
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_SYSTEM", os.devnull)
    assert git(root, "init", "-q", "-b", "main").returncode == 0
    assert git(root, "add", "-A").returncode == 0
    committed = git(
        root,
        "-c",
        "user.name=vsor",
        "-c",
        "user.email=test@vsor.local",
        "commit",
        "-q",
        "--no-gpg-sign",
        "--no-verify",
        "-m",
        "corpus",
    )
    assert committed.returncode == 0, committed.stderr
    head = git(root, "rev-parse", "HEAD").stdout.strip()
    assert len(head) == 40
    return head


@needs_git
def test_corpus_git_is_head_when_every_hashed_document_is_in_it(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    head = commit_project(project, monkeypatch)

    assert main(["build"]) == 0
    corpus = read_record(project)["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["git"] == head
    assert capsys.readouterr().err == "", "a committed corpus builds silently"


@needs_git
def test_a_gitignored_document_costs_the_commit_and_says_so(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`git status` reports nothing for an ignored path, so the tree reads clean while
    HEAD demonstrably lacks part of what was built. Null, and a warning that names the
    file — silently claiming a clean commit is the lie the record exists to prevent."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    (project / ".gitignore").write_text("knowledge/drafts/\n", encoding="utf-8")
    head = commit_project(project, monkeypatch)
    (project / "knowledge" / "drafts").mkdir()
    (project / "knowledge" / "drafts" / "secret.md").write_text(
        "---\ntitle: Draft\n---\n\nIgnored by git, built into the site.\n", encoding="utf-8"
    )
    assert git(project, "status", "--porcelain", "--", "knowledge").stdout == "", (
        "the premise: git reports this tree as clean"
    )

    assert main(["build"]) == 0

    record = read_record(project)
    corpus = record["corpus"]
    assert isinstance(corpus, dict)
    assert "knowledge/drafts/secret.md" in [d["path"] for d in corpus["documents"]], (
        "the walk hashes it, which is why the commit cannot be claimed"
    )
    assert corpus["git"] is None, f"HEAD {head} does not contain this corpus"
    err = capsys.readouterr().err
    assert err.startswith("warning:")
    assert "knowledge/drafts/secret.md" in err  # which document
    assert "corpus.git" in err  # which field went null
    assert "git" in err and ".gitignore" in err  # and why


@needs_git
def test_an_ignored_dot_file_in_the_corpus_never_costs_the_commit(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The scaffold ignores `.DS_Store` and the walk excludes every dot segment, so a
    Finder-dropped one inside knowledge/ is a document this record claims nothing about.
    Crying wolf on it would make the real warning worthless."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    (project / ".gitignore").write_text(".DS_Store\n", encoding="utf-8")
    head = commit_project(project, monkeypatch)
    (project / "knowledge" / ".DS_Store").write_bytes(b"finder junk")

    assert main(["build"]) == 0
    corpus = read_record(project)["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["git"] == head
    assert capsys.readouterr().err == ""


# ── the record survives a failed write ─────────────────────────────────────
#
# `Path.write_text` opens the destination with O_TRUNC, so a failure anywhere in the write
# leaves a zero-byte build.lock.json where a valid record used to be — the one artifact
# nothing else can repair, since it is what a citation resolves through. The disk filling
# is not hypothetical: it happened on this machine on 2026-08-15.


def install_write_refusal(monkeypatch: pytest.MonkeyPatch, marker: str, error: int) -> None:
    """Make every write whose payload carries `marker` fail with `error`.

    Injected at `io.open` because that is the one call BOTH shapes of the write go
    through — `Path.write_text` (which opens the destination itself) and a temp-then-
    rename staging via `os.fdopen`, which is `io.open` on a file descriptor. A fault
    installed on `Path.write_text` instead would go quiet the moment the implementation
    stopped calling it, and quietly stop testing anything.
    """
    real_open = io.open

    class _Refusing:
        def __init__(self, handle: object) -> None:
            self._handle = handle

        def write(self, data: object) -> int:
            payload = data if isinstance(data, str) else bytes(data).decode("utf-8", "replace")  # type: ignore[arg-type]
            if marker in payload:
                raise OSError(error, os.strerror(error))
            return int(self._handle.write(data))  # type: ignore[attr-defined]

        def __getattr__(self, name: str) -> object:
            return getattr(self._handle, name)

        def __enter__(self) -> _Refusing:
            self._handle.__enter__()  # type: ignore[attr-defined]
            return self

        def __exit__(self, *exc: object) -> object:
            return self._handle.__exit__(*exc)  # type: ignore[attr-defined]

    def refusing_open(*args: object, **kwargs: object) -> object:
        return _Refusing(real_open(*args, **kwargs))  # type: ignore[arg-type]

    monkeypatch.setattr(io, "open", refusing_open)


def test_a_full_disk_never_costs_the_previous_record(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    assert main(["build"]) == 0
    previous = (project / "build.lock.json").read_bytes()
    capsys.readouterr()

    install_write_refusal(monkeypatch, marker='"build_id"', error=errno.ENOSPC)
    assert main(["build"]) == 3, "the filesystem refusing is exit 3 — never a traceback"

    err = capsys.readouterr().err
    assert slug_line(err) == "error: io-failed"
    assert "No space left on device" in err  # the OS's own reason
    assert "build.lock.json" in err  # what was being written
    assert (project / "build.lock.json").read_bytes() == previous, (
        "the previous valid record must survive a failed write of the next one"
    )
    leftovers = [p.name for p in project.iterdir() if "build.lock.json" in p.name]
    assert leftovers == ["build.lock.json"], f"a staging temp file was left behind: {leftovers}"


def test_a_filesystem_refusal_in_dev_is_a_slug_not_a_traceback(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The boundary is the verb's, not one call site's: `dev` reaches the filesystem too,
    and an unwritable `.vsor/` must arrive as a slug an agent can branch on."""
    given_node(monkeypatch, "24.4.1")
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = int(probe.getsockname()[1])

    def unwritable(project_root: Path, *args: object, **kwargs: object) -> Path:
        raise OSError(errno.EACCES, os.strerror(errno.EACCES), str(project_root / ".vsor"))

    monkeypatch.setattr(site_runtime, "ensure_runtime", unwritable)
    assert main(["dev", "--port", str(port)]) == 3

    err = capsys.readouterr().err
    assert slug_line(err) == "error: io-failed"
    assert "Permission denied" in err
    assert ".vsor" in err  # the path the OS named


# ── effective dating and supersession (specs queued; vsor/knowledge.py) ────────────────
#
# The unit contract for the keys themselves is test_knowledge.py. What belongs here is the
# VERB's half: the refusal is wired into `build`, it stops before Docusaurus runs, and it
# is not wired into `dev`.


def _superseded_by(project: Path, value: str) -> None:
    (project / "knowledge" / "example.md").write_text(
        f"---\ntitle: Example\nsuperseded_by: {value}\n---\n\nA real body.\n", encoding="utf-8"
    )


def test_build_refuses_a_supersession_pointer_that_names_no_document(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The whole point of the refusal: the page would tell a reader this document was
    replaced and then lead nowhere, and build.lock.json would carry the same claim."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "https://records.test/docs/example")
    _superseded_by(project, "rules/filing-2027.md")

    assert main(["build"]) == 1
    err = capsys.readouterr().err
    assert slug_line(err) == "error: knowledge-invalid"
    assert "knowledge/example.md" in err  # which document
    assert "rules/filing-2027.md" in err  # which value
    assert "superseded_by" in err  # which key
    assert not (project / "build.lock.json").exists(), (
        "a refused build must not leave a record describing a corpus it did not publish"
    )


def test_the_refusal_lands_before_docusaurus_runs(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Ordering is the contract: the corpus is checked against the shell's own copy — the
    documents this build publishes — and the site build never starts."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "https://records.test/docs/example")

    def never(runtime_dir: Path, staging: Path, **_: object) -> None:
        raise AssertionError("the site build must not start once the corpus is refused")

    monkeypatch.setattr(build_cmd, "_run_docusaurus_build", never)
    _superseded_by(project, "rules/filing-2027.md")
    assert main(["build"]) == 1
    assert slug_line(capsys.readouterr().err) == "error: knowledge-invalid"


def test_a_pointer_that_resolves_builds(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The falsification of the two above: the same corpus with the successor present."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, "https://records.test/docs/example")
    (project / "knowledge" / "filing-2026.md").write_text(
        "---\ntitle: 2026\neffective: 2026-01-01\n---\n\nThe current statement.\n", encoding="utf-8"
    )
    _superseded_by(project, "filing-2026.md")

    assert main(["build"]) == 0, capsys.readouterr().err
    assert (project / "build.lock.json").exists()


def test_dev_does_not_refuse_a_pointer_at_a_document_not_written_yet(
    project: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`dev` is the editing loop, where marking a document superseded before writing its
    successor is an ordinary intermediate state; the page degrades to a notice with no
    link. `build` is the gate. Asserted through the port refusal, which happens after
    materialization and is therefore proof that no corpus refusal preceded it."""
    given_node(monkeypatch, "24.4.1")
    _superseded_by(project, "rules/filing-2027.md")

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        site_runtime.copy_authored(project_root, runtime)
        return runtime

    monkeypatch.setattr(site_runtime, "ensure_runtime", fake_runtime)
    with socket.socket() as held:
        held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        held.bind(("127.0.0.1", 0))
        held.listen(1)
        port = int(held.getsockname()[1])
        assert main(["dev", "--port", str(port)]) == 1, "port-in-use, never knowledge-invalid"


# ── format 2: the record locates itself, and names what rendered it ────────────────────
#
# Every finding below was measured against a real wheel on 2026-08-15 and every one of
# them is the same shape: a field that reads as provenance while being unable to deliver
# it. `corpus.git` is the field an MCP citation resolves through, so a commit that cannot
# be resolved — or that reproduces a different site — is the one defect this record cannot
# ship with.


def sub_project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    """A repository whose vsor project sits one level BELOW its root — which is exactly
    what `vsor init <name>` inside an existing work tree produces (it writes no nested
    .git and commits nothing; the enclosing repo's owner commits)."""
    parent = tmp_path / "repo"
    project_dir = parent / "sor"
    project_dir.mkdir(parents=True)
    make_project(project_dir)
    monkeypatch.chdir(project_dir)
    monkeypatch.setenv("VSOR_DEV_VERSION", "0.1.0")
    return parent, project_dir


@needs_git
def test_a_project_below_the_repo_root_records_a_resolvable_pair(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`corpus.git` + a `documents[]` path must resolve TOGETHER. Below the repo root the
    rows are project-relative and the commit is the enclosing repository's, so
    `<sha>:knowledge/example.md` is a path no commit contains; `corpus.prefix` is the
    missing half and `<sha>:<prefix><path>` is what a citation fetches."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    parent, project_dir = sub_project(tmp_path, monkeypatch)
    head = commit_project(parent, monkeypatch)

    assert main(["build"]) == 0, capsys.readouterr().err
    corpus = read_record(project_dir)["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["git"] == head
    assert corpus["prefix"] == "sor/"
    for row in corpus["documents"]:
        resolved = git(parent, "cat-file", "-e", f"{head}:{corpus['prefix']}{row['path']}")
        assert resolved.returncode == 0, (
            f"{head}:{corpus['prefix']}{row['path']} does not resolve — the record names a "
            f"commit and a path that cannot be fetched together"
        )


@needs_git
def test_at_the_repository_root_the_prefix_is_empty(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    commit_project(project, monkeypatch)
    assert main(["build"]) == 0
    corpus = read_record(project)["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["prefix"] == ""


@needs_git
def test_a_linked_corpus_root_cannot_name_a_commit(
    project: Path,
    tmp_path_factory: pytest.TempPathFactory,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A linked tree root stays legal — the copy and the walk both follow it, so the site
    and the record agree. The third party that reasoning forgot is `corpus.git`: HEAD
    holds a 120000 symlink blob, so not one recorded document can be fetched from it."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    elsewhere = tmp_path_factory.mktemp("elsewhere")
    (elsewhere / "rate.md").write_text("---\ntitle: Rate\n---\n\n42 percent.\n", encoding="utf-8")
    shutil.rmtree(project / "knowledge")
    (project / "knowledge").symlink_to(elsewhere, target_is_directory=True)
    head = commit_project(project, monkeypatch)
    assert git(project, "status", "--porcelain", "--", "knowledge").stdout == "", "the premise"

    assert main(["build"]) == 0
    record = read_record(project)
    corpus = record["corpus"]
    assert isinstance(corpus, dict)
    assert [d["path"] for d in corpus["documents"]] == ["knowledge/rate.md"], (
        "the premise: the linked corpus IS built and IS recorded"
    )
    assert corpus["git"] is None, f"HEAD {head} holds a link, not these documents"
    err = capsys.readouterr().err
    assert "knowledge/" in err and "symbolic link" in err
    assert "corpus.git" in err


@needs_git
@pytest.mark.parametrize("dirty", ["site/docusaurus.config.ts", "instance.md"])
def test_a_dirty_build_input_outside_the_corpus_costs_the_commit(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], dirty: str
) -> None:
    """`build_id` covers seven inputs; the clean-check used to cover one tree. Editing
    `site/docusaurus.config.ts` is the first thing every project does and it is the
    documented customization surface — so the record named a commit that reproduces a
    different build_id and a different site, with no field saying so."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    commit_project(project, monkeypatch)
    with (project / dirty).open("a", encoding="utf-8") as handle:
        handle.write("\n// an uncommitted edit\n" if dirty.endswith(".ts") else "\nA new line.\n")

    assert main(["build"]) == 0
    corpus = read_record(project)["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["git"] is None, (
        f"{dirty} feeds build_id and is uncommitted — no commit reproduces this build"
    )


def test_the_record_names_the_application_that_rendered_the_site(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    assert main(["build"]) == 0
    site = read_record(project)["site"]
    assert isinstance(site, dict)
    assert site["app"] == FAKE_APP_SHA


def test_the_artifact_carries_the_record_that_describes_it(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`build/` carried no build identity and the record named no artifact, so deploying
    last week's directory beside this week's committed record was undetectable by anything
    — human or machine. One file makes "is this the site the record describes" answerable,
    which is the premise of citing the record at all."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    assert main(["build"]) == 0
    committed = (project / "build.lock.json").read_bytes()
    published = (project / "build" / "build.lock.json").read_bytes()
    assert published == committed, "the artifact's copy and the committed record are one record"


def test_the_site_identity_seam_never_leaks_in_from_the_ambient_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The shell's config reads six `VSOR_*` variables — title, tagline, url, baseUrl,
    favicon, social image. Measured live 2026-08-15: two builds with the SAME build_id
    published at two different origins, differing in every canonical link, og:/twitter:
    URL, JSON-LD @id and sitemap entry, because build_id is taken over the config FILE.
    The file is the only door."""
    leaked = {
        "VSOR_SITE_URL": "https://first.example-real.com",
        "VSOR_BASE_URL": "/elsewhere/",
        "VSOR_SITE_TITLE": "Not This Project",
        "VSOR_SITE_TAGLINE": "nor this",
        "VSOR_FAVICON": "img/other.svg",
        "VSOR_SOCIAL_IMAGE": "img/other.png",
        "VSOR_DEV_VERSION": "9.9.9",
        "PATH": "/usr/bin",
    }
    env = site_runtime.runtime_env(leaked)
    assert [key for key in env if key.startswith("VSOR_")] == [
        "VSOR_KNOWLEDGE_DIR",
        "VSOR_SITE_DIR",
    ], f"a VSOR_* variable reached the build: {sorted(env)}"
    assert env["PATH"] == "/usr/bin", "everything that is not ours is passed through untouched"


# ── the swap survives whatever is at build/ ────────────────────────────────────────────


def test_a_build_path_that_is_not_a_directory_is_replaced_and_named(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`shutil.rmtree` raises on a file and on a link, and the raise landed BETWEEN the
    swap's two renames: `build/` held the new site while `build.lock.json` still described
    the previous one — the deployable artifact publishing a document the record does not
    name — and every later run re-raised the same error before doing any work."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    (project / "build").write_text("oops\n", encoding="utf-8")

    assert main(["build"]) == 0
    assert (project / "build").is_dir()
    assert (project / "build" / "index.html").exists()
    record = read_record(project)
    assert record == json.loads((project / "build" / "build.lock.json").read_text(encoding="utf-8"))
    err = capsys.readouterr().err
    assert "build/" in err and "regular file" in err, err

    # ...and the next run is green: nothing was wedged.
    assert main(["build"]) == 0
    assert capsys.readouterr().err == "", "the replacement is reported once, not forever"


def test_a_symlinked_build_path_loses_the_link_never_its_target(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """vsor owns `build/` and renames a fresh tree into that exact path, so a link there
    cannot survive — but what it points at is somebody else's and is never touched."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    outside = project.parent / "live-site"
    outside.mkdir()
    (outside / "keep.txt").write_text("not ours to delete\n", encoding="utf-8")
    (project / "build").symlink_to(outside, target_is_directory=True)

    assert main(["build"]) == 0
    assert (outside / "keep.txt").exists(), "the link's target must not be touched"
    assert not (project / "build").is_symlink()
    assert (project / "build" / "index.html").exists()
    assert "symbolic link" in capsys.readouterr().err


def test_a_dangling_prev_build_never_wedges_the_next_run(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`Path.exists()` follows links, so a DANGLING one at `.vsor/prev-build` answered
    False and the debris stayed forever, failing every later swap at the rename."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    scratch = project / ".vsor"
    scratch.mkdir(exist_ok=True)
    (scratch / "prev-build").symlink_to(project / "nothing-here")

    assert main(["build"]) == 0
    assert not os.path.lexists(scratch / "prev-build")
    assert (project / "build" / "index.html").exists()


def test_a_cancelled_build_is_a_decided_exit_never_a_traceback(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Ctrl-C used to escape as a raw KeyboardInterrupt traceback and the process died by
    signal 2 — no `error: <slug>` first line and no code from the closed set, which is the
    one contract agents branch on."""
    given_node(monkeypatch, "24.4.1")
    given_built_site(monkeypatch, REAL_LOC)
    assert main(["build"]) == 0
    before = (project / "build.lock.json").read_bytes()
    capsys.readouterr()

    def cancelled(runtime_dir: Path, staging: Path, **_: object) -> None:
        raise KeyboardInterrupt

    monkeypatch.setattr(build_cmd, "_run_docusaurus_build", cancelled)
    assert main(["build"]) == 0, "a cancellation is decided, exactly as vsor dev's Ctrl-C is"
    err = capsys.readouterr().err
    assert "cancelled" in err
    assert "Traceback" not in err
    assert (project / "build.lock.json").read_bytes() == before, "nothing was swapped"


def test_a_two_path_refusal_names_the_end_that_is_wrong() -> None:
    """`os.replace(tmp, dst)` sets `filename` to the SOURCE, so an EISDIR at the
    destination printed the temp file — a path that was fine — and sent the reader
    somewhere else entirely (found live 2026-08-15, with `build.lock.json` a directory).
    In a repo whose rule is that error text carries the remedy, "which end" is exactly the
    question the reader has."""
    exc = OSError(errno.EISDIR, os.strerror(errno.EISDIR), "/p/.build.lock.json.1.tmp")
    exc.filename2 = "/p/build.lock.json"
    prose = str(io_refusal("writing /p/build.lock.json", exc))
    assert "/p/.build.lock.json.1.tmp -> /p/build.lock.json" in prose
