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

import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from vsor import lock, site_runtime
from vsor.errors import CommandError
from vsor.instance import Instance, InstanceError, parse_instance


def _read_instance(project_root: Path) -> Instance:
    instance_path = project_root / "instance.md"
    try:
        return parse_instance(instance_path)
    except FileNotFoundError:
        raise CommandError(
            "instance-invalid",
            f"{instance_path} does not exist — every vsor project has one at the root "
            "(frontmatter: format, name, vsor.requires). Restore it from version control, or "
            "scaffold a fresh project with `vsor init` and copy its instance.md.",
        ) from None
    except InstanceError as exc:
        raise CommandError("instance-invalid", str(exc)) from exc


def _git(project_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(project_root), *args], capture_output=True, text=True, check=False
    )


def _git_head(project_root: Path) -> str | None:
    if shutil.which("git") is None:
        return None
    proc = _git(project_root, "rev-parse", "HEAD")
    return proc.stdout.strip() if proc.returncode == 0 else None


def _head_knowledge_tree(project_root: Path, hashed_tree: str) -> str | None:
    """HEAD's knowledge/ tree, expressed in the walk's own hash: when git reports
    knowledge/ bit-clean against HEAD (no modification, no untracked file), HEAD's tree
    IS the hashed working tree; anything else is unknowable-here, so None — and
    `resolve_corpus_git` then records null, never a commit that lacks the corpus."""
    status = _git(project_root, "status", "--porcelain", "--", "knowledge")
    if status.returncode != 0 or status.stdout.strip():
        return None
    ls = _git(project_root, "ls-tree", "HEAD", "knowledge")
    if ls.returncode != 0 or not ls.stdout.strip():
        return None
    return hashed_tree


def _recover_interrupted_swap(project_root: Path) -> None:
    """A crash between the swap's renames is recoverable: prev-build without build/ means
    the first rename happened — restore it; prev-build beside a build/ means the second
    rename happened — the leftover old tree is deleted."""
    prev = project_root / ".vsor" / "prev-build"
    build_dir = project_root / "build"
    if not prev.exists():
        return
    if build_dir.exists():
        shutil.rmtree(prev)
    else:
        os.rename(prev, build_dir)


def _run_docusaurus_build(runtime_dir: Path, staging: Path) -> None:
    """Build via the shell's docusaurus binary, siteDir = the shell itself (the forked
    app, with this invoke's fresh copies of the authored trees inside it); output
    streams unmodified."""
    binary = runtime_dir / "node_modules" / ".bin" / "docusaurus"
    proc = subprocess.run(
        [str(binary), "build", ".", "--out-dir", str(staging)],
        cwd=runtime_dir,
        env=site_runtime.runtime_env(),
        stdin=subprocess.DEVNULL,
        check=False,
    )
    if proc.returncode == 0:
        return
    if proc.returncode < 0:
        raise CommandError(
            "build-crashed",
            f"the site build died by signal {-proc.returncode} — usually the machine, not your "
            "content: check available memory, and raise the Node heap with "
            'NODE_OPTIONS="--max-old-space-size=4096" if it was the OOM killer.',
        )
    raise CommandError(
        "build-failed",
        f"docusaurus build exited {proc.returncode} — its own error above names the file and "
        "line; fix that and rerun vsor build.",
    )


def _swap_in(project_root: Path, staging: Path) -> None:
    """rename build/ -> .vsor/prev-build (when present) · rename staging -> build/ ·
    delete prev-build. `build.lock.json` is written only after this completes."""
    prev = project_root / ".vsor" / "prev-build"
    build_dir = project_root / "build"
    if build_dir.exists():
        os.rename(build_dir, prev)
    os.rename(staging, build_dir)
    if prev.exists():
        shutil.rmtree(prev)


def run_build(project_root: Path | None = None) -> int:
    root = project_root if project_root is not None else Path.cwd()

    node_version = site_runtime.probe_node_version()
    site_runtime.check_node(node_version)
    assert node_version is not None  # check_node raised otherwise

    instance = _read_instance(root)
    runtime_dir = site_runtime.ensure_runtime(root)

    _recover_interrupted_swap(root)
    staging = root / ".vsor" / "staging"
    if staging.exists():
        shutil.rmtree(staging)
    _run_docusaurus_build(runtime_dir, staging)
    _swap_in(root, staging)

    corpus_rows = lock.walk_tree(root, "knowledge")
    site_rows = lock.walk_tree(root, "site")
    hashed_tree = lock.tree_hash(corpus_rows)
    vsor_version = site_runtime.running_vsor_version()
    record = lock.assemble_record(
        corpus_rows=corpus_rows,
        site_tree=lock.tree_hash(site_rows),
        instance_sha256=hashlib.sha256((root / "instance.md").read_bytes()).hexdigest(),
        requires=instance.requires,
        vsor_version=vsor_version,
        docusaurus_version=site_runtime.docusaurus_version(runtime_dir),
        node_version=node_version,
        lock_sha256=hashlib.sha256((runtime_dir / "package-lock.json").read_bytes()).hexdigest(),
        git_head=lock.resolve_corpus_git(
            _git_head(root), _head_knowledge_tree(root, hashed_tree), hashed_tree
        ),
        created=datetime.now(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z"),
    )
    (root / "build.lock.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    if record["requires_satisfied"] is not True:
        sys.stderr.write(
            f"warning: instance.md pins vsor.requires {instance.requires!r} but vsor "
            f"{vsor_version} ran — recorded in build.lock.json (requires_satisfied: false).\n"
        )
    print("build/ written — the deployable static site (serve it from any static host)")
    print(f"build.lock.json written — build_id {record['build_id']}")
    return 0
