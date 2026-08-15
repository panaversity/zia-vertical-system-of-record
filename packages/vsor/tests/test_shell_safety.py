"""The site-runtime shell's safety contract — the two ways an ordinary workflow corrupts it.

Written red-first (2026-08-15) from the audit that gated the MCP surface. Neither failure is a
corner case; both are what the product's own instructions tell people to do.

**1 · A second vsor in the same project.** `ensure_runtime` rmtree's the whole shell on a stamp
mismatch, and `copy_authored` rmtree-then-copies the authored trees INSIDE the live siteDir on
every invoke. So `vsor build` in a second terminal deletes the corpus out from under a running
`vsor dev` while it is serving it. Two terminals is the ordinary workflow — the site in one, the
agent in the other — and an agent loop re-invokes eagerly. The contract: one lock file at
`.vsor/lock`, taken by both verbs for the window that touches the shell, refusing with
`error: project-busy` (exit 1). Never a hang, never a traceback, and never wedged forever by a
process that was killed — a lock whose pid is gone is debris, taken over.

**2 · A symbolic link in the authored trees.** Three paths disagreed about what a link is:
`copy_authored`'s `copytree(symlinks=True)` recreated it inside the shell, `sync_authored`'s
`shutil.copy2` then opened that destination path `'wb'` — which FOLLOWS the link and overwrote
whatever it pointed at, outside the project entirely — while `lock.walk_tree` (os.lstat +
S_ISREG) dropped it from `build.lock.json`, so a linked document was served by the site and
absent from the record. v0's decided answer, and the one that makes the record's exclusion
honest instead of silent: **the corpus is real files.** A link inside `site/` or `knowledge/` is
refused with `error: symlink-unsupported` (exit 1) before anything is copied or installed. The
tree ROOT may still be a link (`ln -s ~/docs knowledge`) — the walk and the copy both follow the
root, so the record hashes exactly what the site serves, which is the property that matters.

Public surface these tests define:

- `site_runtime.LOCK_NAME` — the lock file's name inside `.vsor/`.
- `site_runtime.project_lock(project_root, *, verb) -> ContextManager[Path]` — takes the lock,
  yields its path, releases it on every exit path; raises `CommandError("project-busy")` when
  another live vsor holds it.
- `site_runtime.authored_symlinks(project_root) -> list[str]` — every link inside the authored
  trees, project-relative and sorted; the dot-prefixed paths the corpus walk already ignores are
  ignored here too.
- `site_runtime.check_authored(project_root) -> None` — raises
  `CommandError("symlink-unsupported")` when that list is non-empty; called first thing in
  `ensure_runtime`, so a refusal costs seconds rather than a ~2-minute npm install.
"""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest
from vsor import build_cmd, site_runtime
from vsor.cli import main
from vsor.errors import CommandError

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
    """The minimal valid slice-1 project. Deliberately local rather than imported from
    test_build_dev: these rows must keep proving the refusal even while that file's
    Node-half fakes are rewritten."""
    (root / "knowledge").mkdir(parents=True, exist_ok=True)
    (root / "knowledge" / "example.md").write_text(
        "---\ntitle: Example\n---\n\nA real body.\n", encoding="utf-8"
    )
    (root / "site" / "src").mkdir(parents=True, exist_ok=True)
    (root / "site" / "docusaurus.config.ts").write_text("export default {};\n", encoding="utf-8")
    (root / "instance.md").write_text(INSTANCE_MD, encoding="utf-8")


@pytest.fixture
def project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "demo"
    make_project(root)
    monkeypatch.chdir(root)
    monkeypatch.setenv("VSOR_DEV_VERSION", "0.1.0")
    return root


def plant_lock(project_root: Path, *, pid: int, verb: str = "dev") -> Path:
    """A lock file as another vsor would have left it."""
    scratch = project_root / ".vsor"
    scratch.mkdir(parents=True, exist_ok=True)
    path = scratch / site_runtime.LOCK_NAME
    path.write_text(
        json.dumps({"pid": pid, "verb": verb, "started": "2026-08-15T09:00:00Z"}) + "\n",
        encoding="utf-8",
    )
    return path


def a_live_pid() -> int:
    """A process that is certainly alive and is certainly not this one: our parent."""
    return os.getppid()


def a_dead_pid() -> int:
    """A pid that is certainly gone — spawned, waited on, reaped."""
    child = subprocess.Popen([sys.executable, "-c", ""])
    child.wait()
    return child.pid


def free_port() -> int:
    """An ephemeral port nothing holds, so a dev row measures the lock and not the probe."""
    import socket

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def slug_line(err: str) -> str:
    return err.splitlines()[0]


def forbid_materialization(monkeypatch: pytest.MonkeyPatch) -> None:
    """The shell must not be touched at all on a refused invocation — no rmtree, no
    re-copy, and (this being the unit tier) no npm."""

    def boom(*args: object, **kwargs: object) -> Path:
        raise AssertionError("the shell must not be touched while another vsor holds the project")

    monkeypatch.setattr(site_runtime, "ensure_runtime", boom)


# ─────────────────────────────────────────────────── 1 · the project lock, as a mechanism


def test_the_lock_lives_at_dot_vsor_slash_lock(tmp_path: Path) -> None:
    """The path is contract: the refusal names it, and a user whose pid was reused deletes it."""
    assert site_runtime.LOCK_NAME == "lock"
    with site_runtime.project_lock(tmp_path, verb="build") as held:
        assert held == tmp_path / ".vsor" / "lock"
        assert held.is_file()


def test_the_lock_records_who_holds_it(tmp_path: Path) -> None:
    with site_runtime.project_lock(tmp_path, verb="dev") as held:
        record = json.loads(held.read_text(encoding="utf-8"))
    assert record["pid"] == os.getpid()
    assert record["verb"] == "dev"
    assert record["started"], "the refusal tells the user since when — so it is recorded"


def test_the_lock_is_released_on_a_normal_exit(tmp_path: Path) -> None:
    with site_runtime.project_lock(tmp_path, verb="build") as held:
        assert held.is_file()
    assert not held.exists()


def test_the_lock_is_released_when_the_verb_fails(tmp_path: Path) -> None:
    """A refused build must not leave the project locked — every exit path releases."""
    held = tmp_path / ".vsor" / site_runtime.LOCK_NAME
    with pytest.raises(CommandError), site_runtime.project_lock(tmp_path, verb="build"):
        raise CommandError("build-failed", "docusaurus said no")
    assert not held.exists()


def test_the_lock_is_released_on_an_interrupt(tmp_path: Path) -> None:
    """Ctrl-C during `vsor dev` is the common exit, not an exceptional one."""
    held = tmp_path / ".vsor" / site_runtime.LOCK_NAME
    with pytest.raises(KeyboardInterrupt), site_runtime.project_lock(tmp_path, verb="dev"):
        raise KeyboardInterrupt
    assert not held.exists()


def test_a_live_holder_refuses_the_second_invocation(tmp_path: Path) -> None:
    plant_lock(tmp_path, pid=a_live_pid(), verb="dev")
    with pytest.raises(CommandError) as exc, site_runtime.project_lock(tmp_path, verb="build"):
        raise AssertionError("the lock must not have been granted")
    assert exc.value.slug == "project-busy"
    assert exc.value.exit_code == 1


def test_the_refusal_is_immediate_never_a_wait(tmp_path: Path) -> None:
    """`port-in-use` is the precedent: a held resource is a refusal, never a prompt and
    never a queue. An agent loop that blocked here would hang with no output at all."""
    plant_lock(tmp_path, pid=a_live_pid())
    started = time.monotonic()
    with pytest.raises(CommandError), site_runtime.project_lock(tmp_path, verb="build"):
        pass
    assert time.monotonic() - started < 1.0, "the lock waits for nothing"


def test_the_refusal_carries_the_whole_remedy(tmp_path: Path) -> None:
    """Detail is the product: who holds it, since when, how to stop it, and the escape
    hatch for the one case vsor cannot see through (a reused pid)."""
    pid = a_live_pid()
    held = plant_lock(tmp_path, pid=pid, verb="dev")
    with pytest.raises(CommandError) as exc, site_runtime.project_lock(tmp_path, verb="build"):
        pass
    prose = str(exc.value)
    assert "vsor dev" in prose  # which verb holds it
    assert str(pid) in prose  # which process
    assert "2026-08-15T09:00:00Z" in prose  # since when
    assert str(held) in prose  # the file to delete when the pid was reused
    assert "rerun" in prose


def test_a_killed_holder_never_wedges_the_project(tmp_path: Path) -> None:
    """The whole reason the lock records a pid: `kill -9` on a dev server must cost the
    next run nothing. A lock whose holder is gone is debris."""
    held = plant_lock(tmp_path, pid=a_dead_pid(), verb="dev")
    with site_runtime.project_lock(tmp_path, verb="build"):
        assert json.loads(held.read_text(encoding="utf-8"))["pid"] == os.getpid()
    assert not held.exists()


@pytest.mark.parametrize("debris", ["", "not json at all {", "[]", '{"verb": "dev"}'])
def test_an_unreadable_lock_is_debris_never_a_wedge(tmp_path: Path, debris: str) -> None:
    """A process killed between creating the lock file and writing its payload leaves an
    empty one. Refusing forever on bytes nobody can read would wedge the project for
    exactly the failure the pid check exists to survive."""
    scratch = tmp_path / ".vsor"
    scratch.mkdir()
    (scratch / site_runtime.LOCK_NAME).write_text(debris, encoding="utf-8")
    with site_runtime.project_lock(tmp_path, verb="build") as held:
        assert json.loads(held.read_text(encoding="utf-8"))["pid"] == os.getpid()


def test_our_own_stale_lock_is_not_a_deadlock(tmp_path: Path) -> None:
    """A lock naming THIS process is not another vsor — it is our own debris."""
    plant_lock(tmp_path, pid=os.getpid(), verb="build")
    with site_runtime.project_lock(tmp_path, verb="build") as held:
        assert held.is_file()


def test_the_lock_creates_the_scratch_directory_when_it_is_missing(tmp_path: Path) -> None:
    """First run of the first verb: `.vsor/` does not exist yet."""
    assert not (tmp_path / ".vsor").exists()
    with site_runtime.project_lock(tmp_path, verb="build") as held:
        assert held.is_file()


# ────────────────────────────────────── 1b · the verbs refuse rather than destroy the shell


def a_serving_shell(project_root: Path) -> Path:
    """The shell as a running `vsor dev` holds it: the corpus copied inside the siteDir —
    exactly what a second invocation deletes today."""
    served = project_root / ".vsor" / "site-runtime" / "knowledge" / "example.md"
    served.parent.mkdir(parents=True, exist_ok=True)
    served.write_text("served by the dev server right now\n", encoding="utf-8")
    return served


SERVED = "served by the dev server right now\n"


def test_build_is_refused_while_another_vsor_holds_the_project(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The auditor's row: the second invocation is REFUSED, not destructive. The shell the
    dev server is serving from is still there afterwards, byte for byte."""
    monkeypatch.setattr(site_runtime, "probe_node_version", lambda: "24.4.1")
    forbid_materialization(monkeypatch)
    served = a_serving_shell(project)
    plant_lock(project, pid=a_live_pid(), verb="dev")

    assert main(["build"]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: project-busy")
    assert served.read_text(encoding="utf-8") == SERVED


def test_dev_is_refused_while_another_vsor_holds_the_project(
    project: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A second `vsor dev` on a DIFFERENT port is the same corruption as a build: both
    mirror the corpus into one shell. The port probe cannot see it — the lock can."""
    monkeypatch.setattr(site_runtime, "probe_node_version", lambda: "24.4.1")
    forbid_materialization(monkeypatch)
    served = a_serving_shell(project)
    plant_lock(project, pid=a_live_pid(), verb="dev")

    assert main(["dev", "--port", str(free_port())]) == 1
    err = capsys.readouterr().err
    assert slug_line(err).startswith("error: project-busy")
    assert served.read_text(encoding="utf-8") == SERVED


def test_a_normal_build_leaves_no_lock_behind(project: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """The next `vsor build` must not meet its own leftovers."""
    monkeypatch.setattr(site_runtime, "probe_node_version", lambda: "24.4.1")

    def fake_runtime(project_root: Path, *args: object, **kwargs: object) -> Path:
        runtime = project_root / ".vsor" / "site-runtime"
        core = runtime / "node_modules" / "@docusaurus" / "core"
        core.mkdir(parents=True, exist_ok=True)
        (core / "package.json").write_text('{"version": "3.10.2"}\n', encoding="utf-8")
        (runtime / "package-lock.json").write_text('{"lockfileVersion": 3}\n', encoding="utf-8")
        return runtime

    def fake_build(runtime_dir: Path, staging: Path) -> None:
        staging.mkdir(parents=True)
        (staging / "index.html").write_text("<html></html>", encoding="utf-8")

    monkeypatch.setattr(site_runtime, "ensure_runtime", fake_runtime)
    monkeypatch.setattr(build_cmd, "_run_docusaurus_build", fake_build)

    assert main(["build"]) == 0
    assert not (project / ".vsor" / site_runtime.LOCK_NAME).exists()


# ─────────────────────────────────────────── 2 · a symbolic link is not a document


def outside_corpus(tmp_path: Path) -> Path:
    """A file the corpus owner keeps somewhere else entirely."""
    outside = tmp_path / "elsewhere"
    outside.mkdir(exist_ok=True)
    victim = outside / "handbook.md"
    victim.write_text(OUTSIDE_BODY, encoding="utf-8")
    return victim


OUTSIDE_BODY = "ORIGINAL — outside the project\n"


def test_a_linked_document_is_refused_before_anything_is_installed(tmp_path: Path) -> None:
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / "handbook.md").symlink_to(outside_corpus(tmp_path))

    with pytest.raises(CommandError) as exc:
        site_runtime.check_authored(root)
    assert exc.value.slug == "symlink-unsupported"
    assert exc.value.exit_code == 1
    prose = str(exc.value)
    assert "knowledge/handbook.md" in prose  # which link
    assert "build.lock.json" in prose  # why it cannot be served
    assert "rerun" in prose  # and the way out


def test_a_linked_directory_is_refused_too(tmp_path: Path) -> None:
    """`ln -s ~/docs knowledge/handbook` imports the same ungoverned bytes as a linked
    file, one level up — and today it is not even copied, only recreated as a link."""
    root = tmp_path / "demo"
    make_project(root)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    (elsewhere / "a.md").write_text("---\ntitle: A\n---\n", encoding="utf-8")
    (root / "knowledge" / "handbook").symlink_to(elsewhere, target_is_directory=True)

    with pytest.raises(CommandError) as exc:
        site_runtime.check_authored(root)
    assert exc.value.slug == "symlink-unsupported"
    assert "knowledge/handbook" in str(exc.value)


def test_a_link_in_the_site_tree_is_refused(tmp_path: Path) -> None:
    """`site/` is hashed into build_id by the same walk — same rule, same refusal."""
    root = tmp_path / "demo"
    make_project(root)
    (root / "site" / "logo.svg").symlink_to(outside_corpus(tmp_path))

    with pytest.raises(CommandError) as exc:
        site_runtime.check_authored(root)
    assert exc.value.slug == "symlink-unsupported"
    assert "site/logo.svg" in str(exc.value)


def test_the_refusal_names_the_first_links_and_counts_the_rest(tmp_path: Path) -> None:
    """init's blocked-target error is the precedent: name the first five, count the rest."""
    root = tmp_path / "demo"
    make_project(root)
    victim = outside_corpus(tmp_path)
    for i in range(8):
        (root / "knowledge" / f"link-{i}.md").symlink_to(victim)

    with pytest.raises(CommandError) as exc:
        site_runtime.check_authored(root)
    prose = str(exc.value)
    assert "knowledge/link-0.md" in prose
    assert "3 more" in prose, "five named, three counted"


def test_a_corpus_of_real_files_is_accepted(tmp_path: Path) -> None:
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / "section").mkdir()
    (root / "knowledge" / "section" / "a.md").write_text("---\ntitle: A\n---\n", encoding="utf-8")
    assert site_runtime.authored_symlinks(root) == []
    site_runtime.check_authored(root)  # must not raise


def test_a_linked_tree_root_is_still_a_corpus(tmp_path: Path) -> None:
    """The line, drawn deliberately: `ln -s ~/docs knowledge` is supported — the copy and
    the record's walk both follow the ROOT, so the record hashes exactly what is served.
    It is links INSIDE the tree that split those two apart."""
    root = tmp_path / "demo"
    make_project(root)
    real = tmp_path / "elsewhere"
    real.mkdir()
    (real / "a.md").write_text("---\ntitle: A\n---\n", encoding="utf-8")
    shutil.rmtree(root / "knowledge")
    (root / "knowledge").symlink_to(real, target_is_directory=True)

    assert site_runtime.authored_symlinks(root) == []
    site_runtime.check_authored(root)  # must not raise


def test_dot_prefixed_paths_are_ignored_as_the_corpus_walk_ignores_them(tmp_path: Path) -> None:
    """The record's walk excludes any dot-prefixed segment, so nothing under one can be
    served — and a rule that refused there would fire on generated state nobody authored."""
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / ".drafts").mkdir()
    (root / "knowledge" / ".drafts" / "wip.md").symlink_to(outside_corpus(tmp_path))
    (root / "site" / ".cache").symlink_to(tmp_path / "elsewhere", target_is_directory=True)

    assert site_runtime.authored_symlinks(root) == []
    site_runtime.check_authored(root)  # must not raise


def test_ensure_runtime_refuses_a_linked_corpus_before_it_reads_the_shell(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Wired where both verbs pass through it, ahead of the stamp check and `npm ci`."""
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / "handbook.md").symlink_to(outside_corpus(tmp_path))

    def boom(*args: object, **kwargs: object) -> bool:
        raise AssertionError("the shell must not be inspected before the corpus is checked")

    monkeypatch.setattr(site_runtime, "stamp_is_current", boom)
    monkeypatch.setattr(site_runtime, "runtime_file", boom)
    with pytest.raises(CommandError) as exc:
        site_runtime.ensure_runtime(root)
    assert exc.value.slug == "symlink-unsupported"


# ─────────────────────────────── 2b · nothing under the shell is ever a link, either direction


def test_copy_authored_never_carries_a_link_into_the_shell(tmp_path: Path) -> None:
    """`copytree(symlinks=True)` recreated the link inside `.vsor/`, which is what let
    `sync_authored` write through it. This is the structural guarantee behind
    `check_authored`'s promise: nothing under the shell is a link, so nothing in the
    shell can be written through."""
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / "handbook.md").symlink_to(outside_corpus(tmp_path))
    runtime = root / ".vsor" / "site-runtime"
    runtime.mkdir(parents=True)

    site_runtime.copy_authored(root, runtime)

    links = [p for p in runtime.rglob("*") if p.is_symlink()]
    assert links == [], f"the shell holds symbolic links: {links}"
    assert (runtime / "knowledge" / "example.md").is_file(), "the real documents still copy"


def test_sync_never_writes_through_a_link_in_the_shell(tmp_path: Path) -> None:
    """The auditor's end-to-end reproduction, as the data loss it is:

    a corpus owner links a document in, starts `vsor dev`, then decides to inline it —
    `rm knowledge/handbook.md && cp ~/docs/handbook.md knowledge/`. The shell still holds
    the link; `shutil.copy2` opens that path 'wb', the link is followed, and the file
    OUTSIDE the project is truncated and overwritten.
    """
    root = tmp_path / "demo"
    make_project(root)
    victim = outside_corpus(tmp_path)
    linked = root / "knowledge" / "handbook.md"
    linked.symlink_to(victim)
    runtime = root / ".vsor" / "site-runtime"
    runtime.mkdir(parents=True)
    site_runtime.copy_authored(root, runtime)

    linked.unlink()
    linked.write_text("REPLACED — the user inlined the document\n", encoding="utf-8")
    site_runtime.sync_authored(root, runtime)

    assert victim.read_text(encoding="utf-8") == OUTSIDE_BODY, (
        "vsor wrote through a symbolic link and destroyed a file outside the project"
    )


def test_sync_never_mirrors_a_link_from_the_corpus(tmp_path: Path) -> None:
    root = tmp_path / "demo"
    make_project(root)
    (root / "knowledge" / "handbook.md").symlink_to(outside_corpus(tmp_path))
    runtime = root / ".vsor" / "site-runtime"
    (runtime / "knowledge").mkdir(parents=True)

    site_runtime.sync_authored(root, runtime)

    mirrored = runtime / "knowledge" / "handbook.md"
    assert not mirrored.exists()
    assert not mirrored.is_symlink()


def test_sync_removes_a_shell_link_even_when_the_corpus_has_one_too(tmp_path: Path) -> None:
    """The pair that hides from a set difference: the same relative path is a link on both
    sides, so it is neither "gone from the corpus" nor a document to copy. A link in the
    shell is removed for what it IS, never for what the corpus no longer has."""
    root = tmp_path / "demo"
    make_project(root)
    victim = outside_corpus(tmp_path)
    (root / "knowledge" / "handbook.md").symlink_to(victim)
    runtime = root / ".vsor" / "site-runtime"
    (runtime / "knowledge").mkdir(parents=True)
    debris = runtime / "knowledge" / "handbook.md"
    debris.symlink_to(victim)

    site_runtime.sync_authored(root, runtime)

    assert not debris.is_symlink()
    assert victim.read_text(encoding="utf-8") == OUTSIDE_BODY, "the target was touched"


def test_sync_removes_a_link_left_in_the_shell(tmp_path: Path) -> None:
    """A link inside the shell is debris whatever put it there — an older vsor, a hand
    edit — and the mirror's job is to make the shell equal the corpus."""
    root = tmp_path / "demo"
    make_project(root)
    runtime = root / ".vsor" / "site-runtime"
    (runtime / "knowledge").mkdir(parents=True)
    debris = runtime / "knowledge" / "handbook.md"
    debris.symlink_to(tmp_path / "elsewhere" / "gone.md")  # dangling, as a stale link is

    site_runtime.sync_authored(root, runtime)

    assert not debris.is_symlink()
    assert not debris.exists()


def test_sync_still_mirrors_ordinary_edits(tmp_path: Path) -> None:
    """The guard must not cost the hot path: an authored save still lands in the shell."""
    root = tmp_path / "demo"
    make_project(root)
    runtime = root / ".vsor" / "site-runtime"
    runtime.mkdir(parents=True)
    site_runtime.copy_authored(root, runtime)

    doc = root / "knowledge" / "example.md"
    doc.write_text("---\ntitle: Example\n---\n\nAn edit made while dev serves.\n", encoding="utf-8")

    assert site_runtime.sync_authored(root, runtime) is True
    mirrored = (runtime / "knowledge" / "example.md").read_text(encoding="utf-8")
    assert "An edit made while dev serves." in mirrored
