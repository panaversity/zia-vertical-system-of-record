"""`vsor build` — specs/vsor/build. Reads `instance.md` (strict), builds the site into
`.vsor/staging/`, swaps atomically at the project root, and writes the committed
`build.lock.json` record only after the swap completes.

Ordering is part of the contract: node precondition → instance validation → runtime
materialization → build. Validation failure costs seconds, never a ~2-minute npm install.

Docusaurus runs with `siteDir = .vsor/site-runtime` — the shell itself, because the shell
IS the forked app (see site_runtime). The authored `site/` and `knowledge/` are
copy-on-invoke mirrors inside it (found live: Docusaurus realpaths siteDir and webpack
realpaths md resources, so the spec's symlink experiment failed and its recorded fallback
applies — see site_runtime.copy_authored), and `site_runtime.runtime_env` points the app's
own seams at them. The project's `site/docusaurus.config.ts` is loaded by the shell's
config and merged over it, so an edit there is what the next build renders.
"""

import contextlib
import hashlib
import ipaddress
import json
import os
import shutil
import signal
import stat
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

from vsor import knowledge, lock, site_runtime
from vsor.errors import CommandError, io_refusal
from vsor.instance import Instance, InstanceError, decode_instance, parse_instance


def _read_instance(project_root: Path) -> tuple[Instance, str]:
    """The instance this run validated, and the sha256 of the exact bytes it validated.

    One read, and the record's hash comes out of it. `instance.md` is the one record input
    the runtime shell keeps no copy of, so unlike the corpus there is no snapshot to
    measure it against later — found in review 2026-08-15, it was read a SECOND time in
    `_measure_built_inputs`, which sits after materialization: on a first run that is the
    whole npm install, one to two minutes by the verb's own notice. A rewrite inside that
    window put two versions of one file into a single record — `build_id` naming bytes
    vsor never validated, beside a `requires_satisfied` computed from the bytes it did.
    """
    instance_path = project_root / "instance.md"
    try:
        raw = instance_path.read_bytes()
    except FileNotFoundError:
        raise CommandError(
            "instance-invalid",
            f"{instance_path} does not exist — every vsor project has one at the root "
            "(frontmatter: format, name, vsor.requires). Restore it from version control, or "
            "scaffold a fresh project with `vsor init` and copy its instance.md.",
        ) from None
    try:
        instance = parse_instance(instance_path, text=decode_instance(instance_path, raw))
    except InstanceError as exc:
        raise CommandError("instance-invalid", str(exc)) from exc
    return instance, hashlib.sha256(raw).hexdigest()


def _git(project_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(project_root), *args], capture_output=True, text=True, check=False
    )


def _git_head(project_root: Path) -> str | None:
    if shutil.which("git") is None:
        return None
    proc = _git(project_root, "rev-parse", "HEAD")
    return proc.stdout.strip() if proc.returncode == 0 else None


# Every tree the `build_id` preimage is taken over. `corpus.git` may name HEAD only when
# ALL of them are bit-clean against it, not just the corpus: `site/docusaurus.config.ts`
# is the documented customization surface and `instance.md` is hashed straight into the
# preimage, so a record pairing a whole-build `build_id` with a corpus-only commit check
# named a commit that reproduces a different build_id and a different site (found in
# review 2026-08-15, measured: one appended comment in the config and one paragraph in
# instance.md, both uncommitted, both invisible to the old check).
_BUILD_INPUTS = ("knowledge", "site", "instance.md")


def _ignored_inputs(project_root: Path, input_rows: list[tuple[str, str]]) -> list[str]:
    """Which of the hashed build inputs git is ignoring (see `lock.ignored_corpus_documents`
    for why that question decides whether a commit may be named).

    `ls-files --others --ignored --exclude-standard` is the only git command that answers
    it: `status --porcelain` is silent about ignored paths by design. Paths come back
    relative to `-C`'s directory and NUL-separated, so no quoting rule of git's can turn a
    filename with a space or a quote in it into a path we fail to recognize."""
    if shutil.which("git") is None:
        return []
    proc = _git(
        project_root,
        "ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", *_BUILD_INPUTS,
    )
    if proc.returncode != 0:
        return []
    return lock.ignored_corpus_documents(proc.stdout.split("\0"), input_rows)


def _git_prefix(project_root: Path) -> str:
    """The project root's path inside its repository — `""` at the top level, `"sor/"` one
    level below it. `corpus.prefix`, and the half of the record without which `corpus.git`
    is unusable.

    `documents[]` rows are project-relative (`knowledge/x.md`) while `corpus.git` names
    HEAD of the ENCLOSING repository — and `vsor init` explicitly supports being run
    inside an existing work tree, where it scaffolds a subdirectory and commits nothing.
    In that (documented, instructed) layout `<sha>:knowledge/x.md` is a path no commit
    contains; `<sha>:<prefix>knowledge/x.md` is the one that resolves. Found in review
    2026-08-15: no field of format 1 carried the prefix, and every MCP citation resolves
    through exactly this pair."""
    if shutil.which("git") is None:
        return ""
    proc = _git(project_root, "rev-parse", "--show-prefix")
    return proc.stdout.strip() if proc.returncode == 0 else ""


def _app_sha256(runtime_dir: Path) -> str:
    """The forked site application's own bytes, as the materialization stamp recorded them.

    Read from `.materialized.json` rather than re-hashed from the wheel: the stamp is
    written only after a successful `npm ci`, so it names the app that is actually
    installed in the shell this build is about to run. `""` when there is no stamp to
    read — a shell nothing installed, which the unit tier's fakes are."""
    try:
        stamp = json.loads((runtime_dir / ".materialized.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    if not isinstance(stamp, dict):
        return ""
    value = stamp.get("app_sha256")
    return value if isinstance(value, str) else ""


def _linked_input_roots(project_root: Path) -> list[str]:
    """Which of the authored tree roots are themselves symbolic links.

    `check_authored` deliberately permits this — `ln -s ~/docs knowledge` keeps the site
    and the record in agreement, because the copy and the walk both follow the root. What
    that reasoning forgot is the third party: HEAD then holds a 120000 symlink blob where
    the corpus should be, so `corpus.git` named a commit containing NONE of the documents
    it listed (found live 2026-08-15). The link stays legal; the commit claim does not."""
    return [name for name in ("knowledge", "site") if (project_root / name).is_symlink()]


def _head_input_tree(
    project_root: Path, hashed_tree: str, ignored_inputs: list[str], linked_roots: list[str]
) -> str | None:
    """HEAD's copy of the build inputs, expressed in the corpus walk's own hash: when git
    reports every tree in the `build_id` preimage bit-clean against HEAD (no modification,
    no untracked file), HEAD's corpus tree IS the hashed working tree; anything else is
    unknowable-here, so None — and `resolve_corpus_git` then records null, never a commit
    that lacks what it built.

    Three ways the inference breaks, each found live and each returning None:

    - an **ignored** input — `status --porcelain` reports nothing at all for ignored paths,
      so the tree reads clean while HEAD is missing part of what was built (one
      `.gitignore` line for a drafts directory was enough);
    - a **linked** tree root — HEAD holds the link, not the corpus;
    - a dirty `site/` or `instance.md` — both are `build_id` inputs, and the old check
      looked only at `knowledge/`.

    The caller says every one of them out loud."""
    if ignored_inputs or linked_roots:
        return None
    status = _git(project_root, "status", "--porcelain", "--", *_BUILD_INPUTS)
    if status.returncode != 0 or status.stdout.strip():
        return None
    ls = _git(project_root, "ls-tree", "HEAD", "knowledge")
    if ls.returncode != 0 or not ls.stdout.strip():
        return None
    return hashed_tree


def _remove_path(path: Path) -> None:
    """Remove whatever sits at `path`, in every shape it can have.

    `shutil.rmtree` raises on a symlink and on a regular file, and both shapes are
    reachable at `build/` — a stray `printf > build`, or a `ln -s /var/www/site build`.
    Found live 2026-08-15: the raise landed BETWEEN the swap's renames, so `build/` held
    the new site while `build.lock.json` still described the previous one, and every later
    run re-raised the same error before doing any work. A link is unlinked, never walked:
    whatever it points at is somebody else's."""
    if not os.path.lexists(path):
        return
    if path.is_symlink() or not stat.S_ISDIR(os.lstat(path).st_mode):
        path.unlink()
    else:
        shutil.rmtree(path)


def _recover_interrupted_swap(project_root: Path) -> None:
    """A crash between the swap's renames is recoverable: prev-build without build/ means
    the first rename happened — restore it; prev-build beside a build/ means the second
    rename happened — the leftover old tree is deleted.

    `os.path.lexists`, never `Path.exists()`: a DANGLING symlink at either path answers
    False to `exists()` and would leave the debris in place forever, wedging every
    subsequent run at the rename."""
    prev = project_root / ".vsor" / "prev-build"
    build_dir = project_root / "build"
    if not os.path.lexists(prev):
        return
    if os.path.lexists(build_dir):
        _remove_path(prev)
    else:
        os.rename(prev, build_dir)


# Cancellation, and the child that must not outlive it. The build child gets its own
# process group (as `vsor dev`'s does) so a sweep can reach the whole webpack fan-out;
# these three signals are forwarded into it and end the run as a decided cancellation.
# Found live 2026-08-15: without the group and the sweep, `kill -9` on a running
# `vsor build` left node writing into `.vsor/staging` while the stale lock's dead pid let
# the very next `vsor build` start a second build in the same directory — which then
# failed with `build-failed`, a message that blames the user's content for it.
_CANCEL_SIGNALS = (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)


def _run_docusaurus_build(
    runtime_dir: Path, staging: Path, *, lock_path: Path | None = None
) -> None:
    """Build via the shell's docusaurus binary, siteDir = the shell itself (the forked
    app, with this invoke's fresh copies of the authored trees inside it); output
    streams unmodified. No descendant survives this call — see `_CANCEL_SIGNALS`."""
    binary = runtime_dir / "node_modules" / ".bin" / "docusaurus"
    child = subprocess.Popen(
        [str(binary), "build", ".", "--out-dir", str(staging)],
        cwd=runtime_dir,
        env=site_runtime.runtime_env(),
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    # The lock names the child while it runs: `kill -9` on this vsor leaves node writing
    # into `.vsor/staging`, and the next `vsor build` must refuse rather than take the
    # lock over and start a second build in the same directory (which then failed with
    # `build-failed`, blaming the user's content for it).
    if lock_path is not None:
        site_runtime.record_child(lock_path, child.pid)

    cancelled: list[int] = []

    def _forward(signum: int, _frame: object) -> None:
        cancelled.append(signum)
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(child.pid, signum)

    previous = {number: signal.signal(number, _forward) for number in _CANCEL_SIGNALS}
    try:
        returncode = child.wait()
    finally:
        for number, handler in previous.items():
            signal.signal(number, handler)
        # Nothing survives: a final sweep of the (now leaderless) group.
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(child.pid, signal.SIGKILL)

    if cancelled:
        raise KeyboardInterrupt
    if returncode == 0:
        return
    if returncode < 0:
        raise CommandError(
            "build-crashed",
            f"the site build died by signal {-returncode} — usually the machine, not your "
            "content: check available memory, and raise the Node heap with "
            'NODE_OPTIONS="--max-old-space-size=4096" if it was the OOM killer.',
        )
    raise CommandError(
        "build-failed",
        f"docusaurus build exited {returncode} — its own error above names the file and "
        "line; fix that and rerun vsor build.",
    )


def _swap_in(project_root: Path, staging: Path) -> None:
    """rename build/ -> .vsor/prev-build (when present) · rename staging -> build/ ·
    delete prev-build.

    The last step is cosmetic and is treated as such: once staging has been renamed into
    place the deployable site is the new one, so a failure removing the old tree must not
    propagate and skip the record write — that is exactly how `build/` came to publish a
    document `build.lock.json` did not name. Everything before the second rename may still
    raise, because before it nothing has changed."""
    prev = project_root / ".vsor" / "prev-build"
    build_dir = project_root / "build"
    _remove_path(prev)  # debris a previous run could not clear
    if os.path.lexists(build_dir):
        os.rename(build_dir, prev)
    os.rename(staging, build_dir)
    with contextlib.suppress(OSError):
        _remove_path(prev)


@dataclass(frozen=True)
class _BuiltInputs:
    """Everything `build.lock.json` says about this build's INPUTS, measured at one
    instant — see `_measure_built_inputs`."""

    corpus_rows: list[tuple[str, str]]
    corpus_tree: str
    site_tree: str
    instance_sha256: str
    docusaurus_version: str
    lock_sha256: str
    app_sha256: str
    git_head: str | None
    git_prefix: str
    ignored_inputs: list[str]
    linked_roots: list[str]


def _measure_built_inputs(
    project_root: Path, runtime_dir: Path, instance_sha256: str
) -> _BuiltInputs:
    """Measure the record's inputs from the runtime shell, at the instant the build starts.

    **Hash what was built.** `ensure_runtime` snapshots the authored `knowledge/` and
    `site/` into the shell (`copy_authored`) and Docusaurus reads *only* that snapshot.
    Found in review 2026-08-15: this measurement used to run over the AUTHORED trees
    *after* the build, leaving the entire Docusaurus run between the bytes that were built
    and the bytes that were recorded — 231 seconds at 2,000 documents. An agent writing
    into `knowledge/` inside that window (which is exactly what the add-sources skill
    does) produced a record describing documents no page of the site contains, and the
    whole MCP claim is that a citation points at a generation. Reading the shell's copies
    closes the window to zero: `walk_tree` composes every row path as f"{subdir}/{rel}"
    from its ARGUMENT, so the rows are byte-identical — what changed is which bytes get
    hashed, never the record's shape.

    The git facts are measured here for the same reason, not as a tidiness: the inference
    "status reports knowledge/ clean, therefore HEAD's tree IS the hashed tree" is only
    sound while the working tree still holds what was hashed. Measured after a five-minute
    build, a `git checkout` landing mid-build would make it name the wrong commit.

    `instance.md` is not measured here at all: it is the one input the shell has no copy
    of, so `_read_instance` hashes the bytes it validated at the top of the verb and hands
    the digest down. Re-reading it here — which is what this function used to do — put the
    whole npm install between the file vsor validated and the file it recorded.

    found live 2026-08-15 (real wheel, real scaffold, docusaurus 3.10.2): a document
    written into `knowledge/` six seconds into a build is absent from `build/` — there is
    no page for it — and is now absent from the record too, where the authored tree at
    that same moment held it. The record and the site say the same thing, which is the
    only property that makes a citation mean anything.
    """
    corpus_rows = lock.walk_tree(runtime_dir, "knowledge")
    site_rows = lock.walk_tree(runtime_dir, "site")
    corpus_tree = lock.tree_hash(corpus_rows)
    # Every tree in the preimage, plus `instance.md` — the input the shell keeps no copy
    # of, carried here as a row so one intersection answers for all of them.
    ignored_inputs = _ignored_inputs(
        project_root, [*corpus_rows, *site_rows, ("instance.md", instance_sha256)]
    )
    linked_roots = _linked_input_roots(project_root)
    return _BuiltInputs(
        corpus_rows=corpus_rows,
        corpus_tree=corpus_tree,
        site_tree=lock.tree_hash(site_rows),
        instance_sha256=instance_sha256,
        docusaurus_version=site_runtime.docusaurus_version(runtime_dir),
        lock_sha256=hashlib.sha256((runtime_dir / "package-lock.json").read_bytes()).hexdigest(),
        app_sha256=_app_sha256(runtime_dir),
        git_head=lock.resolve_corpus_git(
            _git_head(project_root),
            _head_input_tree(project_root, corpus_tree, ignored_inputs, linked_roots),
            corpus_tree,
        ),
        git_prefix=_git_prefix(project_root),
        ignored_inputs=ignored_inputs,
        linked_roots=linked_roots,
    )


def _write_record(path: Path, record: dict[str, object], *, note: str) -> None:
    """Stage in a sibling temp file, fsync, rename — the previous valid record is never
    truncated to write the next one. ``note`` is what is still true if this write fails:
    only the call site knows, and it differs between the artifact's copy (written before
    the swap, when nothing has changed yet) and the committed one.

    `Path.write_text` opens with O_TRUNC, so any failure during the write (the disk
    filling is the measured one — it happened on this machine on 2026-08-15) left a
    zero-byte `build.lock.json` where a valid record had been. That is the one artifact
    nothing downstream can repair: it is what a citation resolves through, and its
    previous copy is a committed file the user may not have pushed yet. Same shape, and
    the same reason, as `scaffold._scaffold_staged`.

    `os.open` with 0o666 rather than `tempfile.mkstemp`, so the process umask decides the
    final permissions exactly as a normal create would; mkstemp's 0600 would ship a
    committed record only its author can read.

    The temp name carries the pid: two builds racing in one project then stage separately
    and each rename is whole, so the loser costs a stale record and never a corrupt one.
    The cost of that choice is that a build killed in the millisecond between open and
    rename leaves one dot-file behind — inert, unread by anything, and cheaper than the
    failure a shared temp name would allow."""
    text = json.dumps(record, indent=2, ensure_ascii=False) + "\n"
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o666)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except OSError as exc:
        with contextlib.suppress(OSError):
            tmp.unlink()
        raise io_refusal(f"writing {path}", exc, note=note) from exc


_RECORD_NOTE_STAGED = (
    "Nothing at the project root has changed: build/ and build.lock.json still describe "
    "the previous build, and this one was discarded. Fix the cause and rerun vsor build."
)

_RECORD_NOTE_COMMITTED = (
    "The site itself built: build/ holds it. Only the record failed to write, so "
    "build.lock.json still describes the PREVIOUS build — rerun vsor build once the cause "
    "is fixed, and the pair matches again. build/build.lock.json inside the artifact is "
    "this build's record, so the two can be compared."
)


def _check_corpus_dating(runtime_dir: Path, corpus_rows: list[tuple[str, str]]) -> None:
    """Refuse a corpus whose effective-dating keys the site could not honestly render.

    Read from the SHELL and from `corpus_rows`, deliberately: those are the exact
    documents this build publishes and the exact paths `build.lock.json` is about to name,
    so "the corpus contains the successor" means the same thing here, on the page, and in
    the record. A second walk of the authored tree could disagree with all three.

    It runs after materialization, which costs a first-time user the npm install before
    they hear about a typo — the trade the other way (validate the authored tree first)
    buys a faster refusal by validating bytes that are not the ones being built, and this
    is the one check whose whole value is that it describes the published corpus.

    `vsor dev` deliberately does not run it: dev is the editing loop, where a pointer at a
    document that is not written yet is an ordinary intermediate state, and the notice
    degrades to a banner with no link rather than to something broken. `build` is the gate.
    """
    problems = knowledge.check_corpus(runtime_dir, corpus_rows)
    if problems:
        raise CommandError("knowledge-invalid", knowledge.refusal_prose(problems))


def run_build(project_root: Path | None = None) -> int:
    root = project_root if project_root is not None else Path.cwd()

    node_version = site_runtime.probe_node_version()
    site_runtime.check_node(node_version)
    assert node_version is not None  # check_node raised otherwise

    instance, instance_sha256 = _read_instance(root)
    # Everything below writes inside `.vsor/` — the shell is rewritten on every invoke, the
    # staging tree is deleted and rebuilt, and Docusaurus runs with the shell as its siteDir.
    # A `vsor dev` serving from that same shell in another terminal would have the site
    # pulled out from under it, so the two verbs take turns (site_runtime.project_lock).
    # Taken AFTER validation: a bad instance.md is refused in seconds, and refusing it must
    # not depend on whether someone else is building.
    with site_runtime.project_lock(root, verb="build") as lock_path:
        runtime_dir = site_runtime.ensure_runtime(root)
        built = _measure_built_inputs(root, runtime_dir, instance_sha256)
        _check_corpus_dating(runtime_dir, built.corpus_rows)

        _recover_interrupted_swap(root)
        staging = root / ".vsor" / "staging"
        _remove_path(staging)
        replaced = _describe_replaced_build(root)
        _run_docusaurus_build(runtime_dir, staging, lock_path=lock_path)

        vsor_version = site_runtime.running_vsor_version()
        record = lock.assemble_record(
            corpus_rows=built.corpus_rows,
            site_tree=built.site_tree,
            instance_sha256=built.instance_sha256,
            requires=instance.requires,
            vsor_version=vsor_version,
            docusaurus_version=built.docusaurus_version,
            node_version=node_version,
            lock_sha256=built.lock_sha256,
            app_sha256=built.app_sha256,
            git_head=built.git_head,
            corpus_prefix=built.git_prefix,
            created=datetime.now(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z"),
        )
        # The artifact carries its own identity, written into the staging tree before the
        # swap so the deployed site and the committed record can be compared by anyone —
        # `grep build_id build/build.lock.json` against the committed file answers "is
        # this the site the record describes", which is the premise of citing the record.
        # Found in review 2026-08-15: nothing in `build/` named the build at all, so
        # deploying last week's directory beside this week's record was undetectable, and
        # so was any interruption between the swap and the record write.
        _write_record(staging / "build.lock.json", record, note=_RECORD_NOTE_STAGED)
        _swap_in(root, staging)
        _write_record(root / "build.lock.json", record, note=_RECORD_NOTE_COMMITTED)

    _warn_replaced_build(replaced)
    _warn_linked_input_roots(built.linked_roots)
    _warn_ignored_inputs(built.ignored_inputs)
    if record["requires_satisfied"] is not True:
        sys.stderr.write(
            f"warning: instance.md pins vsor.requires {instance.requires!r} but vsor "
            f"{vsor_version} ran — recorded in build.lock.json (requires_satisfied: false).\n"
        )
    corpus_block = record["corpus"]
    if isinstance(corpus_block, dict):
        documents = corpus_block.get("documents")
        if isinstance(documents, list):
            _warn_flat_corpus(documents)
    print("build/ written — the deployable static site (serve it from any static host)")
    print(f"build.lock.json written — build_id {record['build_id']}")
    # Last, and after an explicit flush: on a terminal the warning is then the line the eye
    # lands on, directly under the handoff it qualifies ("serve it from any static host" —
    # yes, but the host it *claims* to be is wrong). Ordering across the two streams only
    # holds on a tty; a redirect buffers stdout independently, which costs nothing here
    # because a redirected build is read whole.
    sys.stdout.flush()
    _warn_placeholder_url(root / "build")
    return 0

# ── the ignored-corpus warning ──────────────────────────────────────────────────────────
#
# A null `corpus.git` is the record being honest, but on its own it is a null field in a
# JSON file nobody reads until a citation fails to resolve. The cause here is invisible by
# construction — `git status` says nothing about ignored paths, which is exactly why the
# check exists — so the build says it out loud, once, naming the documents. A warning and
# not a refusal, deliberately: ignoring drafts is a legitimate thing to do, and a record
# that admits it cannot name a commit is a correct record, not a broken build.
_IGNORED_SHOWN = 5


def _warn_ignored_inputs(paths: list[str]) -> None:
    """Say why `corpus.git` is null when git is ignoring inputs that were built."""
    if not paths:
        return
    shown = ", ".join(paths[:_IGNORED_SHOWN])
    more = f" and {len(paths) - _IGNORED_SHOWN} more" if len(paths) > _IGNORED_SHOWN else ""
    sys.stderr.write(
        f"warning: git ignores {len(paths)} file(s) that this build read, so\n"
        f"  corpus.git is null in build.lock.json — no commit contains what was built.\n"
        f"  which: {shown}{more}\n"
        f"  why it matters: the record's job is to let a citation resolve back to bytes someone\n"
        f"    else can fetch. Naming a commit that lacks these files would resolve to a\n"
        f"    different site, which is worse than naming none.\n"
        f"  the fix: these are build inputs, not build output — remove their pattern from\n"
        f"    .gitignore and commit them, then rerun vsor build. Or keep them ignored and accept\n"
        f"    a null corpus.git: the build, the site and every other field are unaffected.\n"
    )


def _warn_linked_input_roots(names: list[str]) -> None:
    """Say why `corpus.git` is null when an authored tree root is a symbolic link.

    The link itself stays legal — the corpus may live wherever its owner keeps it, and the
    copy and the walk both follow the root, so the site and the record still agree. What
    cannot be claimed is a commit: HEAD holds a link, and none of the documents this record
    names can be fetched from it (found live 2026-08-15, `git ls-tree HEAD knowledge` ->
    `120000 blob`)."""
    if not names:
        return
    which = " and ".join(f"{name}/" for name in names)
    plural = "roots are" if len(names) > 1 else "root is"
    sys.stderr.write(
        f"warning: {which} is a symbolic link, so corpus.git is null in build.lock.json.\n"
        f"  why: the commit would hold the link, not the files — `git ls-tree HEAD` shows one\n"
        f"    120000 blob where the tree should be, so not one recorded document can be fetched\n"
        f"    from it. The build, the site and every other field are unaffected.\n"
        f"  the fix, if you want the commit: keep the authored {plural} real files inside the\n"
        f"    project (`cp -RL` reads through the link), commit them, then rerun vsor build.\n"
    )


def _describe_replaced_build(project_root: Path) -> str | None:
    """What is at `build/` if it is not a directory — `None` on every ordinary run.

    Measured before the swap, because the swap is what removes it. vsor owns `build/` and
    replaces it wholesale, so a file or a link there is replaced rather than refused; the
    one thing it must not be is silent, which is what it was until 2026-08-15 (a relative
    symlink at `build/` was replaced by a real directory and the run reported success)."""
    build_dir = project_root / "build"
    if not os.path.lexists(build_dir):
        return None
    if build_dir.is_symlink():
        return f"a symbolic link (to {os.readlink(build_dir)})"
    if not stat.S_ISDIR(os.lstat(build_dir).st_mode):
        return "a regular file"
    return None


def _warn_replaced_build(replaced: str | None) -> None:
    if replaced is None:
        return
    sys.stderr.write(
        f"warning: build/ was {replaced}, and this build replaced it with the site directory.\n"
        f"  why: `vsor build` owns build/ — it renames a fresh tree into that exact path on every\n"
        f"    run, so nothing else can live there. Whatever the link pointed at was not touched.\n"
        f"  if you deploy from somewhere else, point your host at build/ (or copy it there after\n"
        f"    the build) rather than putting a link in its place.\n"
    )


# Measured 2026-08-14 on synthetic corpora (Node 24, Apple Silicon). Docusaurus renders the whole
# sidebar into every page, so a FLAT corpus costs O(n^2) output: 2,000 flat documents built to
# 806 MB with 378 KB of HTML per page, while the same 2,000 in twenty folders built to 155 MB with
# 47 KB per page — and in half the time. Folder structure is not cosmetic here, which is why this
# says so at the moment it starts to matter rather than in a document nobody opens.
_FLAT_CORPUS_WARNING_THRESHOLD = 300


def _warn_flat_corpus(documents: list[object]) -> None:
    """Warn when a large corpus is flat — the layout that makes output size quadratic."""
    if len(documents) < _FLAT_CORPUS_WARNING_THRESHOLD:
        return
    # "knowledge/a.md" is flat; "knowledge/section/a.md" is not.
    flat = [
        d
        for d in documents
        if isinstance(d, dict) and str(d.get("path", "")).count("/") <= 1
    ]
    if len(flat) < _FLAT_CORPUS_WARNING_THRESHOLD:
        return
    sys.stderr.write(
        f"warning: {len(flat)} documents sit directly in knowledge/ with no folders. Docusaurus\n"
        f"  writes the whole sidebar into every page, so a flat corpus grows the site quadratically\n"
        f"  (measured: 2,000 flat documents build to 806 MB; the same 2,000 in folders, 155 MB).\n"
        f"  Group them into subdirectories of knowledge/ — the sidebar collapses per folder.\n"
    )


# ── the placeholder-url warning ─────────────────────────────────────────────────────────
#
# `url` is not cosmetic and its cost is invisible in a browser. Docusaurus resolves it once
# and bakes it into build/sitemap.xml, every page's <link rel="canonical"> and
# <link rel="alternate">, the og:/twitter: image URLs, and the JSON-LD @id/url pairs in each
# page's <head>. Measured 2026-08-14 on the fixture build (docusaurus 3.10.2, five routes,
# seven emitted HTML files): 83 occurrences of the placeholder host — twelve in the homepage
# alone, five in sitemap.xml. Every page renders correctly from any host, so nothing else in
# the system — not the build, not the browser tier — can see it: the half that is wrong is
# the half only machines read.
#
# It is measured from the ARTIFACT, never from the config text, and that is the decision:
# the shell merges a project's site/docusaurus.config.ts over its own default, whose SITE_URL
# is the same placeholder (packages/sor-site/app/docusaurus.config.ts), so a project that
# DELETES the url key — or feeds it from an unset env var — ships localhost while a scan of
# its config file finds nothing to report. Docusaurus already performed that merge; sitemap.xml
# is where it wrote the answer down. Reading it means no second parser exists to drift from the
# one that decides.
#
# `vsor dev` deliberately does NOT warn: see the note in dev_cmd.


def built_site_origin(build_dir: Path) -> str | None:
    """The origin this build baked in — `scheme://host[:port]` from the first `<loc>` of the
    emitted sitemap. None when there is no sitemap to read or it carries no absolute URL: a
    warning never crashes a build that succeeded. (The sitemap is the shell's, configured
    under the shell-owned `presets` key a project cannot replace, so absence is a corner —
    an empty site, a future shell — and not the normal path.)"""
    try:
        with (build_dir / "sitemap.xml").open("rb") as handle:
            # Streamed and stopped at the first <loc>: one origin serves the whole file,
            # and a corpus of 100k documents must not cost a 100k-element tree in memory
            # for a one-line warning. The handle is ours so the early exit closes it.
            for _event, element in ElementTree.iterparse(handle, events=("end",)):
                text = element.text
                if element.tag.rsplit("}", 1)[-1] != "loc" or not text:
                    continue
                parts = urlsplit(text.strip())
                if parts.scheme and parts.netloc:
                    return f"{parts.scheme}://{parts.netloc}"
    except (OSError, ElementTree.ParseError):
        return None
    return None


# RFC 6761 special-use names and RFC 2606 reserved TLDs: none of them can resolve on the
# public internet, so a site published under one is published nowhere. `.example` earns its
# place because create-docusaurus itself scaffolds `https://your-docusaurus-site.example.com`,
# and a corpus author following a Docusaurus tutorial arrives with exactly that string.
_RESERVED_TLDS = frozenset({"localhost", "test", "invalid", "example"})
_RESERVED_SECOND_LEVEL = frozenset({"example.com", "example.net", "example.org"})


def placeholder_kind(host: str) -> str | None:
    """Which KIND of stand-in a host is, or None when it is a destination.

    Two kinds, because they are wrong in different ways and the remedy reads differently:
    `"this-machine"` for a loopback or unspecified IP literal — the address genuinely names the
    machine that ran the build — and `"resolves-nowhere"` for a name reserved by standard, which
    names no machine at all. (Found live 2026-08-14: one message covering both told a user who
    had just set `https://mysite.example.com` that their site "lives on this machine", which is
    two falsehoods in a sentence they had already acted on.)

    A private LAN address (10.x, 192.168.x) and a bare intranet hostname are deliberately NOT
    placeholders — an internal deployment is a real deployment, and a warning that fires on
    one is the cry-wolf this warning exists to avoid. Same reasoning excludes `.local`
    (RFC 6762 mDNS): it names a machine somebody can actually reach."""
    name = host.strip(".").lower()
    if not name:
        return None
    try:
        address = ipaddress.ip_address(name)
    except ValueError:
        pass
    else:
        return "this-machine" if address.is_loopback or address.is_unspecified else None
    labels = name.split(".")
    if labels[-1] in _RESERVED_TLDS or ".".join(labels[-2:]) in _RESERVED_SECOND_LEVEL:
        return "this-machine" if name == "localhost" else "resolves-nowhere"
    return None


def is_placeholder_host(host: str) -> bool:
    """Whether a host is a stand-in rather than a destination — either kind."""
    return placeholder_kind(host) is not None


def _warn_placeholder_url(build_dir: Path) -> None:
    """Warn — never fail — when the site just built carries a placeholder origin.

    Not an error, by contract: building against localhost is legitimate (it is what every
    local preview does), and refusing would break the five-minute promise for the user who
    has not decided on a domain yet."""
    origin = built_site_origin(build_dir)
    if origin is None:
        return
    host = urlsplit(origin).hostname
    kind = placeholder_kind(host) if host is not None else None
    if kind is None:
        return
    where = (
        "the site lives on this machine"
        if kind == "this-machine"
        else "the site lives at a name reserved for documentation, which resolves nowhere"
    )
    sys.stderr.write(
        f"warning: this build's public URLs point at {origin} — a placeholder, not a domain.\n"
        f"  where it comes from: the `url` key in site/docusaurus.config.ts\n"
        f"  what carries it: build/sitemap.xml, every page's <link rel=\"canonical\">, the og:\n"
        f"    and twitter: image URLs, and the JSON-LD block in each page's <head>\n"
        f"  why it matters: the pages render from any host, but that metadata tells search\n"
        f"    engines and link previews {where} — upload it as it is\n"
        f"    and the wrong address ships with it\n"
        f"  the fix: set url to the origin you deploy to (scheme + host, no path), then rerun\n"
        f"    vsor build. Leave it while you are previewing locally — vsor dev emits none of\n"
        f"    this metadata, and never warns.\n"
    )
