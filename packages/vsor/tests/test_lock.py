"""Unit contract for `vsor/lock.py` — written red-first from specs/vsor/build/spec.md
("The record, normatively"). Everything here is a pure function over values and tmp_path.

Public surface these tests define:

- `LOCK_FORMAT: int = 1` — pinned; changing the build_id recipe REQUIRES bumping it
  (the golden-recipe test below is the tripwire).
- `SCHEMA_PATH: Path` — the committed JSON Schema for `build.lock.json`, shipped inside
  the package next to lock.py. The schema must require every top-level field, pin
  `format` to the integer 1, and tolerate ANY element shape inside `non_stock`.
- `walk_tree(project_root: Path, subdir: str) -> list[tuple[str, str]]` — rows of
  (`"<subdir>/<posix path>"`, sha256 hex of file bytes): regular files only (symlinks
  and fifos skipped), any path segment starting with `.` excluded, paths NFC-normalized,
  rows sorted by UTF-8 byte order of the full path (LC_ALL=C — never Path-component or
  locale order).
- `tree_hash(rows: Sequence[tuple[str, str]]) -> str` — sha256 over the sorted rows.
- `compute_build_id(*, corpus_tree, site_tree, instance_sha256, vsor_version,
  docusaurus_version, node_version, lock_sha256) -> str` — sha256 over the NUL-separated
  preimage pinned by the golden test; `created` is NOT an input, by design.
- `requires_satisfied(requires: str, running: str) -> bool` —
  `SpecifierSet(requires).contains(running, prereleases=True)`.
- `resolve_corpus_git(head, head_knowledge_tree, hashed_tree) -> str | None` — HEAD only
  when HEAD's knowledge tree equals the hashed tree, else None (the record never names a
  commit that lacks the corpus it built).
- `assemble_record(*, corpus_rows, site_tree, instance_sha256, requires, vsor_version,
  docusaurus_version, node_version, lock_sha256, git_head, created) -> dict[str, object]`
  — the format-1 record; `created` varies without moving `build_id`.
"""

import hashlib
import inspect
import json
import os
import unicodedata
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from vsor import lock


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ------------------------------------------------------------------ the corpus/site walk


def test_walk_hashes_file_bytes(tmp_path: Path) -> None:
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir()
    (knowledge / "a.md").write_bytes(b"alpha\n")
    rows = lock.walk_tree(tmp_path, "knowledge")
    assert rows == [("knowledge/a.md", sha(b"alpha\n"))]


def test_walk_excludes_any_dot_segment(tmp_path: Path) -> None:
    """A Finder-dropped .DS_Store never moves a build — at any depth, and dot-directories
    are pruned whole."""
    knowledge = tmp_path / "knowledge"
    (knowledge / "sub").mkdir(parents=True)
    (knowledge / ".obsidian").mkdir()
    (knowledge / "a.md").write_bytes(b"a")
    (knowledge / ".DS_Store").write_bytes(b"junk")
    (knowledge / "sub" / "ok.md").write_bytes(b"ok")
    (knowledge / "sub" / ".DS_Store").write_bytes(b"junk")
    (knowledge / ".obsidian" / "cache.md").write_bytes(b"hidden")
    assert [path for path, _ in lock.walk_tree(tmp_path, "knowledge")] == [
        "knowledge/a.md",
        "knowledge/sub/ok.md",
    ]


def test_walk_orders_by_utf8_bytes_not_path_components(tmp_path: Path) -> None:
    """LC_ALL=C over the full path string: `-` (0x2D) < `.` (0x2E) < `/` (0x2F).
    A naive sorted(Path...) component sort would yield a/b.md, a-x/c.md, a.md — wrong."""
    knowledge = tmp_path / "knowledge"
    (knowledge / "a").mkdir(parents=True)
    (knowledge / "a-x").mkdir()
    (knowledge / "a.md").write_bytes(b"1")
    (knowledge / "a" / "b.md").write_bytes(b"2")
    (knowledge / "a-x" / "c.md").write_bytes(b"3")
    assert [path for path, _ in lock.walk_tree(tmp_path, "knowledge")] == [
        "knowledge/a-x/c.md",
        "knowledge/a.md",
        "knowledge/a/b.md",
    ]


def test_walk_normalizes_paths_to_nfc(tmp_path: Path) -> None:
    """A decomposed filename (as macOS filesystems store them) comes back NFC —
    the same corpus hashes the same on macOS and Linux."""
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir()
    nfd_name = "cafe\u0301.md"  # NFD: e + combining acute
    assert not unicodedata.is_normalized("NFC", nfd_name)
    (knowledge / nfd_name).write_bytes(b"decomposed name")
    paths = [path for path, _ in lock.walk_tree(tmp_path, "knowledge")]
    assert paths == ["knowledge/caf\u00e9.md"]  # NFC: precomposed \u00e9
    assert all(unicodedata.is_normalized("NFC", path) for path in paths)


def test_walk_skips_symlinks_and_irregular_files(tmp_path: Path) -> None:
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir()
    (knowledge / "real.md").write_bytes(b"real")
    (knowledge / "link.md").symlink_to(knowledge / "real.md")
    os.mkfifo(knowledge / "pipe.md")
    assert [path for path, _ in lock.walk_tree(tmp_path, "knowledge")] == ["knowledge/real.md"]


def test_walk_empty_tree_is_empty(tmp_path: Path) -> None:
    (tmp_path / "knowledge").mkdir()
    assert lock.walk_tree(tmp_path, "knowledge") == []


def test_walk_site_uses_the_same_rules(tmp_path: Path) -> None:
    site = tmp_path / "site"
    site.mkdir()
    (site / "docusaurus.config.ts").write_bytes(b"export default {};\n")
    (site / ".DS_Store").write_bytes(b"junk")
    assert lock.walk_tree(tmp_path, "site") == [("site/docusaurus.config.ts", sha(b"export default {};\n"))]


def test_tree_hash_is_deterministic_and_input_sensitive(tmp_path: Path) -> None:
    rows = [("knowledge/a.md", sha(b"a")), ("knowledge/b.md", sha(b"b"))]
    assert lock.tree_hash(rows) == lock.tree_hash(list(rows))
    assert lock.tree_hash(rows) != lock.tree_hash([("knowledge/a.md", sha(b"a"))])
    assert lock.tree_hash(rows) != lock.tree_hash([("knowledge/a.md", sha(b"x")), rows[1]])
    assert lock.tree_hash(rows) != lock.tree_hash([("knowledge/z.md", sha(b"a")), rows[1]])
    empty = lock.tree_hash([])
    assert isinstance(empty, str) and len(empty) == 64


# ------------------------------------------------------------------ the build_id recipe

BASE_ID_INPUTS: dict[str, str] = {
    "corpus_tree": sha(b"corpus"),
    "site_tree": sha(b"site"),
    "instance_sha256": sha(b"instance"),
    "vsor_version": "0.1.0",
    "docusaurus_version": "3.9.1",
    "node_version": "24.4.1",
    "lock_sha256": sha(b"lock"),
}


def test_build_id_golden_recipe() -> None:
    """The recipe, pinned byte-for-byte: sha256 over the NUL-separated preimage
    `"1" · corpus.tree · site tree · sha256(instance.md) · vsor · docusaurus · node ·
    site.lock`. Changing this preimage REQUIRES bumping LOCK_FORMAT — this test is the
    tripwire that makes a silent recipe change impossible."""
    preimage = b"\x00".join(
        [
            b"1",
            BASE_ID_INPUTS["corpus_tree"].encode(),
            BASE_ID_INPUTS["site_tree"].encode(),
            BASE_ID_INPUTS["instance_sha256"].encode(),
            BASE_ID_INPUTS["vsor_version"].encode(),
            BASE_ID_INPUTS["docusaurus_version"].encode(),
            BASE_ID_INPUTS["node_version"].encode(),
            BASE_ID_INPUTS["lock_sha256"].encode(),
        ]
    )
    assert lock.compute_build_id(**BASE_ID_INPUTS) == hashlib.sha256(preimage).hexdigest()


def test_build_id_format_is_pinned_to_1() -> None:
    assert lock.LOCK_FORMAT == 1


def test_build_id_nul_separation_moved_boundary_moves_the_hash() -> None:
    """Concatenation without separators would make ("ab","c") collide with ("a","bc");
    NUL separation must not."""
    a = lock.compute_build_id(**{**BASE_ID_INPUTS, "corpus_tree": "ab", "site_tree": "c"})
    b = lock.compute_build_id(**{**BASE_ID_INPUTS, "corpus_tree": "a", "site_tree": "bc"})
    assert a != b
    # the same holds inside the version tuple
    c = lock.compute_build_id(**{**BASE_ID_INPUTS, "vsor_version": "0.1", "docusaurus_version": "23.9.0"})
    d = lock.compute_build_id(**{**BASE_ID_INPUTS, "vsor_version": "0.12", "docusaurus_version": "3.9.0"})
    assert c != d


def test_build_id_every_component_moves_the_hash() -> None:
    ids = {lock.compute_build_id(**BASE_ID_INPUTS)}
    for key in BASE_ID_INPUTS:
        ids.add(lock.compute_build_id(**{**BASE_ID_INPUTS, key: BASE_ID_INPUTS[key] + "x"}))
    assert len(ids) == len(BASE_ID_INPUTS) + 1


def test_build_id_created_is_not_an_input() -> None:
    """`created` varies on every rebuild by design; it must be structurally impossible
    to feed it into the preimage."""
    assert "created" not in inspect.signature(lock.compute_build_id).parameters


# ------------------------------------------------------------- requires_satisfied


@pytest.mark.parametrize(
    ("requires", "running", "ok"),
    [
        (">=0.1.0,<0.2", "0.1.0", True),
        (">=0.1.0,<0.2", "0.1.5", True),
        (">=0.1.0,<0.2", "0.2.0", False),
        (">=0.1.0,<0.2", "0.0.9", False),
        (">=0.1.5,<0.2", "0.1.4", False),  # the exact-floor pin catching an older patch
        (">=0.1.0,<0.2", "0.1.5rc1", True),  # prereleases=True, per the spec
    ],
)
def test_requires_satisfied(requires: str, running: str, ok: bool) -> None:
    assert lock.requires_satisfied(requires, running) is ok


# ------------------------------------------------------------- corpus.git honesty


def test_corpus_git_is_head_only_when_trees_match() -> None:
    tree = sha(b"the corpus tree")
    head = "a" * 40
    assert lock.resolve_corpus_git(head, tree, tree) == head


def test_corpus_git_is_null_when_dirty() -> None:
    tree = sha(b"the corpus tree")
    assert lock.resolve_corpus_git("a" * 40, sha(b"an older tree"), tree) is None


def test_corpus_git_is_null_without_head() -> None:
    tree = sha(b"the corpus tree")
    assert lock.resolve_corpus_git(None, None, tree) is None
    # HEAD exists but knowledge/ is absent from it: still null
    assert lock.resolve_corpus_git("a" * 40, None, tree) is None


# --- the ignored-document intersection
#
# `git status --porcelain` does not report ignored files; the walk hashes every non-dot
# regular file whether git tracks it or not. The intersection is what separates "git is
# ignoring part of the corpus this record describes" (the commit cannot be claimed) from
# "git is ignoring something the walk never hashed" (nothing to say).

IGNORED_ROWS = [
    ("knowledge/a.md", sha(b"a")),
    ("knowledge/drafts/secret.md", sha(b"secret")),
]


def test_ignored_documents_are_the_hashed_ones_git_ignores() -> None:
    assert lock.ignored_corpus_documents(
        ["knowledge/drafts/secret.md"], IGNORED_ROWS
    ) == ["knowledge/drafts/secret.md"]


def test_ignored_paths_the_walk_never_hashed_are_not_documents() -> None:
    """A Finder-dropped `.DS_Store` and the `build/` output are both ignored by the
    scaffold's own .gitignore and both excluded from the record — reporting them would
    make the warning cry wolf on every project."""
    assert (
        lock.ignored_corpus_documents(
            ["knowledge/.DS_Store", "knowledge/.obsidian/cache.md", "build/index.html"],
            IGNORED_ROWS,
        )
        == []
    )


def test_ignored_documents_are_deduplicated_and_byte_sorted() -> None:
    rows = [*IGNORED_ROWS, ("knowledge/b.md", sha(b"b"))]
    assert lock.ignored_corpus_documents(
        ["knowledge/b.md", "knowledge/drafts/secret.md", "knowledge/b.md"], rows
    ) == ["knowledge/b.md", "knowledge/drafts/secret.md"]


def test_ignored_documents_normalize_like_the_walk() -> None:
    """git reports the filesystem's own bytes — NFD on macOS — while the walk's rows are
    NFC. Without normalizing, the intersection is empty on exactly the platform this is
    most likely to happen on."""
    nfd = "knowledge/cafe\u0301.md"  # e + combining acute, as macOS stores it
    nfc = "knowledge/caf\u00e9.md"  # precomposed, as walk_tree emits it
    assert not unicodedata.is_normalized("NFC", nfd)
    assert lock.ignored_corpus_documents([nfd], [(nfc, sha(b"x"))]) == [nfc]


def test_no_ignored_paths_is_no_documents() -> None:
    assert lock.ignored_corpus_documents([], IGNORED_ROWS) == []
    assert lock.ignored_corpus_documents([""], IGNORED_ROWS) == []


# ------------------------------------------------------------- record assembly + schema

CORPUS_ROWS = [
    ("knowledge/a.md", sha(b"alpha")),
    ("knowledge/b.md", sha(b"beta")),
]


def record(created: str = "2026-08-13T00:00:00Z", git_head: str | None = None) -> dict[str, object]:
    rec: dict[str, object] = lock.assemble_record(
        corpus_rows=CORPUS_ROWS,
        site_tree=sha(b"site"),
        instance_sha256=sha(b"instance"),
        requires=">=0.1.0,<0.2",
        vsor_version="0.1.0",
        docusaurus_version="3.9.1",
        node_version="24.4.1",
        lock_sha256=sha(b"lock"),
        git_head=git_head,
        created=created,
    )
    return rec


def test_record_shape() -> None:
    rec = record(git_head="b" * 40)
    assert rec["format"] == 1
    assert isinstance(rec["format"], int)
    assert rec["vsor"] == "0.1.0"
    assert rec["requires_satisfied"] is True
    assert rec["non_stock"] == []
    corpus = rec["corpus"]
    assert isinstance(corpus, dict)
    assert corpus["tree"] == lock.tree_hash(CORPUS_ROWS)
    assert corpus["git"] == "b" * 40
    assert corpus["documents"] == [{"path": path, "sha256": digest} for path, digest in CORPUS_ROWS]
    site = rec["site"]
    assert isinstance(site, dict)
    assert site == {"docusaurus": "3.9.1", "node": "24.4.1", "lock": sha(b"lock")}


def test_record_build_id_matches_the_recipe() -> None:
    rec = record()
    assert rec["build_id"] == lock.compute_build_id(
        corpus_tree=lock.tree_hash(CORPUS_ROWS),
        site_tree=sha(b"site"),
        instance_sha256=sha(b"instance"),
        vsor_version="0.1.0",
        docusaurus_version="3.9.1",
        node_version="24.4.1",
        lock_sha256=sha(b"lock"),
    )


def test_created_varies_without_moving_build_id() -> None:
    """A no-change rebuild is a known one-line diff: created moves, nothing else does."""
    first = record("2026-08-13T00:00:00Z")
    second = record("2026-08-13T00:00:01Z")
    assert first["created"] != second["created"]
    assert first["build_id"] == second["build_id"]
    assert {k: v for k, v in first.items() if k != "created"} == {
        k: v for k, v in second.items() if k != "created"
    }


def test_requires_mismatch_is_recorded_never_raised() -> None:
    rec = lock.assemble_record(
        corpus_rows=CORPUS_ROWS,
        site_tree=sha(b"site"),
        instance_sha256=sha(b"instance"),
        requires=">=9.0",
        vsor_version="0.1.0",
        docusaurus_version="3.9.1",
        node_version="24.4.1",
        lock_sha256=sha(b"lock"),
        git_head=None,
        created="2026-08-13T00:00:00Z",
    )
    assert rec["requires_satisfied"] is False


# --- the committed schema


def schema() -> dict[str, object]:
    loaded = json.loads(lock.SCHEMA_PATH.read_text(encoding="utf-8"))
    assert isinstance(loaded, dict)
    return loaded


def test_schema_is_committed_and_valid() -> None:
    Draft202012Validator.check_schema(schema())


def test_golden_record_validates_against_the_schema() -> None:
    validator = Draft202012Validator(schema())
    validator.validate(record())  # corpus.git null
    validator.validate(record(git_head="c" * 40))  # corpus.git a sha
    validator.validate(json.loads(json.dumps(record())))  # survives a JSON round-trip


def test_schema_tolerates_any_non_stock_element_shape() -> None:
    """Format-1 readers must tolerate any non_stock element shape — reserved forward
    for `vsor eject`."""
    rec = record()
    rec["non_stock"] = [{"weird": {"nested": True}}, "a-string", 3]
    Draft202012Validator(schema()).validate(rec)


def test_schema_rejects_a_record_missing_build_id() -> None:
    rec = record()
    del rec["build_id"]
    with pytest.raises(ValidationError):
        Draft202012Validator(schema()).validate(rec)


def test_schema_rejects_a_string_format() -> None:
    rec = record()
    rec["format"] = "1"
    with pytest.raises(ValidationError):
        Draft202012Validator(schema()).validate(rec)
