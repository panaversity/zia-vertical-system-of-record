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
from vsor.errors import SLUG_EXITS, CommandError

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


FAKE_DOCUSAURUS_VERSION = "3.10.2"
FAKE_SHELL_LOCK = '{"lockfileVersion": 3}\n'


def given_built_site(
    monkeypatch: pytest.MonkeyPatch,
    loc: str,
    *,
    during_build: Callable[[], None] | None = None,
) -> None:
    """Stand in for the whole Node half: a materialized shell carrying the two files
    the record reads, and a build that writes the sitemap Docusaurus would emit.

    The fake shell SNAPSHOTS the authored trees exactly as `ensure_runtime` does
    (`copy_authored`), because that snapshot is what the record has to hash: a fake that
    skipped it would let a test pass over a record measured from a tree the build never
    read. `during_build` runs at the instant Docusaurus would be running — the window an
    agent writing into `knowledge/` actually lands in.
    """

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        core = runtime / "node_modules" / "@docusaurus" / "core"
        core.mkdir(parents=True, exist_ok=True)
        (core / "package.json").write_text(
            f'{{"version": "{FAKE_DOCUSAURUS_VERSION}"}}\n', encoding="utf-8"
        )
        (runtime / "package-lock.json").write_text(FAKE_SHELL_LOCK, encoding="utf-8")
        site_runtime.copy_authored(project_root, runtime)
        return runtime

    def fake_docusaurus_build(runtime_dir: Path, staging: Path) -> None:
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
