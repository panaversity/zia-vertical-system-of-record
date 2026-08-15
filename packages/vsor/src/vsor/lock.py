"""`build.lock.json` — pure functions for the committed record (specs/vsor/build,
"The record, normatively").

Everything here is a pure function over values and paths: the corpus/site walk, the tree
hash, the build_id recipe, `requires_satisfied`, the corpus.git honesty rule, and the
record assembly. Nothing touches git, npm, or the network — the command layer feeds in
what it measured. The committed JSON Schema beside this module is the record's shape
contract; changing the build_id preimage REQUIRES bumping LOCK_FORMAT (the unit tier's
golden-recipe test is the tripwire).
"""

import hashlib
import os
import stat
import unicodedata
from collections.abc import Iterable, Sequence
from pathlib import Path

from packaging.specifiers import InvalidSpecifier, SpecifierSet
from packaging.version import InvalidVersion

LOCK_FORMAT = 1

SCHEMA_PATH = Path(__file__).with_name("build_lock_schema.json")


def _byte_order(row: tuple[str, str]) -> bytes:
    return row[0].encode("utf-8")


def walk_tree(project_root: Path, subdir: str) -> list[tuple[str, str]]:
    """Rows of (`"<subdir>/<posix path>"`, sha256 of file bytes), per the normative walk:
    regular files only (symlinks and fifos skipped), any path segment starting with `.`
    excluded (a Finder-dropped .DS_Store never moves a build), paths NFC-normalized so
    macOS and Linux hash the same corpus, rows in LC_ALL=C byte order of the full path."""
    base = project_root / subdir
    rows: list[tuple[str, str]] = []
    if not base.is_dir():
        return rows
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(name for name in dirnames if not name.startswith("."))
        for name in filenames:
            if name.startswith("."):
                continue
            file_path = Path(dirpath) / name
            if not stat.S_ISREG(os.lstat(file_path).st_mode):
                continue
            rel = file_path.relative_to(base).as_posix()
            row_path = unicodedata.normalize("NFC", f"{subdir}/{rel}")
            rows.append((row_path, hashlib.sha256(file_path.read_bytes()).hexdigest()))
    rows.sort(key=_byte_order)
    return rows


def tree_hash(rows: Sequence[tuple[str, str]]) -> str:
    """sha256 over the byte-sorted (path, sha256) rows — the corpus/site `tree` value."""
    digest = hashlib.sha256()
    for row_path, row_sha in sorted(rows, key=_byte_order):
        digest.update(row_path.encode("utf-8"))
        digest.update(b"\x00")
        digest.update(row_sha.encode("ascii"))
        digest.update(b"\x00")
    return digest.hexdigest()


def compute_build_id(
    *,
    corpus_tree: str,
    site_tree: str,
    instance_sha256: str,
    vsor_version: str,
    docusaurus_version: str,
    node_version: str,
    lock_sha256: str,
) -> str:
    """The build_id recipe: sha256 over the NUL-separated preimage `"1"` (format) ·
    corpus.tree · site tree · sha256(instance.md) · vsor ∥ docusaurus ∥ node ∥ site.lock.
    `created` is not an input, by design — a no-change rebuild keeps its build_id.
    Changing this preimage requires bumping LOCK_FORMAT."""
    preimage = b"\x00".join(
        [
            str(LOCK_FORMAT).encode("ascii"),
            corpus_tree.encode("utf-8"),
            site_tree.encode("utf-8"),
            instance_sha256.encode("utf-8"),
            vsor_version.encode("utf-8"),
            docusaurus_version.encode("utf-8"),
            node_version.encode("utf-8"),
            lock_sha256.encode("utf-8"),
        ]
    )
    return hashlib.sha256(preimage).hexdigest()


def requires_satisfied(requires: str, running: str) -> bool:
    """`SpecifierSet.contains(running, prereleases=True)` — mismatch warns and records,
    never blocks; an unparsable input records False rather than crashing a build."""
    try:
        return SpecifierSet(requires).contains(running, prereleases=True)
    except (InvalidSpecifier, InvalidVersion):
        return False


def ignored_corpus_documents(
    ignored_paths: Iterable[str], corpus_rows: Sequence[tuple[str, str]]
) -> list[str]:
    """The documents THIS RECORD describes that git is ignoring — the intersection.

    Why it exists (found in review 2026-08-15): `git status --porcelain` does not report
    ignored files, while `walk_tree` above hashes every non-dot regular file whether git
    tracks it or not. One `.gitignore` line for a drafts directory was therefore enough to
    leave the tree reading clean while HEAD demonstrably lacked part of what was built —
    a record naming a commit that reproduces a *different* site, which is the same class
    of lie `git rev-parse HEAD:knowledge` was rejected for.

    The intersection is the whole point, and it is what keeps this from crying wolf: the
    scaffold's own `.gitignore` names `.DS_Store` and `build/`, and git reports both as
    ignored — but the walk excludes every dot segment and never leaves `knowledge/`, so
    neither is a document this record claims anything about. Paths are NFC-normalized
    because git reports the filesystem's bytes (NFD on macOS) while the rows are NFC;
    without that the intersection is empty on exactly the platform this is likeliest on.
    """
    hashed = {row_path for row_path, _ in corpus_rows}
    return sorted(
        {
            normalized
            for raw in ignored_paths
            if (normalized := unicodedata.normalize("NFC", raw)) in hashed
        }
    )


def resolve_corpus_git(
    head: str | None, head_knowledge_tree: str | None, hashed_tree: str
) -> str | None:
    """`corpus.git` is HEAD only when HEAD's knowledge/ tree equals the hashed tree, else
    None — the record never names a commit that lacks the corpus it built."""
    if head is not None and head_knowledge_tree == hashed_tree:
        return head
    return None


def assemble_record(
    *,
    corpus_rows: Sequence[tuple[str, str]],
    site_tree: str,
    instance_sha256: str,
    requires: str,
    vsor_version: str,
    docusaurus_version: str,
    node_version: str,
    lock_sha256: str,
    git_head: str | None,
    created: str,
) -> dict[str, object]:
    """The format-1 record, exactly the committed schema's shape. `created` varies on
    every rebuild by design and never moves `build_id`."""
    corpus_tree = tree_hash(corpus_rows)
    return {
        "format": LOCK_FORMAT,
        "build_id": compute_build_id(
            corpus_tree=corpus_tree,
            site_tree=site_tree,
            instance_sha256=instance_sha256,
            vsor_version=vsor_version,
            docusaurus_version=docusaurus_version,
            node_version=node_version,
            lock_sha256=lock_sha256,
        ),
        "created": created,
        "vsor": vsor_version,
        "requires_satisfied": requires_satisfied(requires, vsor_version),
        "corpus": {
            "tree": corpus_tree,
            "git": git_head,
            "documents": [{"path": row_path, "sha256": row_sha} for row_path, row_sha in corpus_rows],
        },
        "site": {"docusaurus": docusaurus_version, "node": node_version, "lock": lock_sha256},
        "non_stock": [],
    }
