"""Unit contract for effective dating and supersession at level 0 — `vsor/knowledge.py`.

Written red-first. The design test this serves is AGENTS.md's second one, and it is the
half that had nothing behind it: *provenance is not correctness*. Everything else in this
system proves who said something and when. The case that hurts a regulated vertical is not
an uncited claim — it is a correctly cited rule that stopped being true in 2024, served
with a perfect citation and full confidence. Citation does not touch it; abstention does
not touch it. The level-0 answer is three optional frontmatter keys, a rendering rule, and
this: a supersession pointer that names a document the corpus does not contain is a build
error, not a dead link a reader discovers.

The vocabulary, and it is deliberately three keys rather than a taxonomy:

    effective: 2024-01-01          the day this document's content took effect
    superseded: true               this document is no longer current
    superseded_by: rules/new.md    what replaced it (path under knowledge/; implies the above)

Public surface these tests define:

- `parse_dating(text) -> Dating` — the frontmatter reader. Never raises: a file with no
  frontmatter, or frontmatter that is not YAML, is Docusaurus's error to report, not ours.
- `check_document(path, text, corpus_paths) -> list[str]` — one document's problems, each
  message naming the document, the offending value and the fix.
- `check_corpus(corpus_root, corpus_rows) -> list[str]` — the same over the rows
  `build.lock.json` is about to record, so validation and the record describe one corpus.
"""

import shutil
from datetime import date
from pathlib import Path

import pytest
from vsor import knowledge

REPO = Path(__file__).resolve().parents[3]


def doc(frontmatter: str, body: str = "\nA real body.\n") -> str:
    return f"---\n{frontmatter}---\n{body}"


CORPUS = {
    "knowledge/rules/filing-2026.md",
    "knowledge/rules/filing-2019.md",
    "knowledge/start-here.md",
    "knowledge/notes/deck.yaml",
}


# ------------------------------------------------------------------ parse_dating


def test_parse_dating_reads_the_three_keys() -> None:
    dating = knowledge.parse_dating(
        doc("title: Filing\neffective: 2019-04-01\nsuperseded: true\nsuperseded_by: rules/filing-2026.md\n")
    )
    assert dating.effective == date(2019, 4, 1)
    assert dating.superseded is True
    assert dating.superseded_by == "rules/filing-2026.md"


def test_parse_dating_accepts_a_quoted_date_identically() -> None:
    """YAML parses an unquoted 2019-04-01 as a date and a quoted one as a string; a
    professional writing frontmatter should never have to know which they wrote."""
    unquoted = knowledge.parse_dating(doc("effective: 2019-04-01\n"))
    quoted = knowledge.parse_dating(doc('effective: "2019-04-01"\n'))
    assert unquoted.effective == quoted.effective == date(2019, 4, 1)


def test_parse_dating_is_empty_for_a_document_that_says_nothing() -> None:
    dating = knowledge.parse_dating(doc("title: Start here\n"))
    assert dating.effective is None
    assert dating.superseded is None
    assert dating.superseded_by is None
    assert dating.is_superseded is False


def test_superseded_by_implies_superseded_without_the_boolean() -> None:
    dating = knowledge.parse_dating(doc("superseded_by: rules/filing-2026.md\n"))
    assert dating.is_superseded is True


def test_parse_dating_never_raises_on_a_file_it_does_not_own() -> None:
    """No frontmatter, an unterminated block, and frontmatter that is not YAML at all:
    each is Docusaurus's error to report against the file and the line. Ours must not
    turn a markdown mistake into a supersession error pointing at the wrong thing."""
    for text in ("# Just a heading\n", "---\ntitle: x\n", doc("title: [unclosed\n"), doc("- a\n- b\n")):
        assert knowledge.parse_dating(text) == knowledge.Dating()


# ------------------------------------------------------------------ the pointer must resolve


def test_a_pointer_at_a_document_the_corpus_does_not_contain_is_an_error() -> None:
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md",
        doc("superseded_by: rules/filing-2027.md\n"),
        CORPUS,
    )
    assert len(problems) == 1
    assert "knowledge/rules/filing-2019.md" in problems[0]
    assert "rules/filing-2027.md" in problems[0]  # the value, so the fix is obvious
    assert "superseded_by" in problems[0]


def test_a_pointer_that_resolves_is_accepted() -> None:
    assert (
        knowledge.check_document(
            "knowledge/rules/filing-2019.md",
            doc("effective: 2019-04-01\nsuperseded_by: rules/filing-2026.md\n"),
            CORPUS,
        )
        == []
    )


def test_the_pointer_is_relative_to_knowledge_and_says_so_when_it_is_not() -> None:
    """The most likely wrong form is the project-relative one; the error names the value
    to write instead rather than only reporting that this one is wrong."""
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md",
        doc("superseded_by: knowledge/rules/filing-2026.md\n"),
        CORPUS,
    )
    assert len(problems) == 1
    assert "rules/filing-2026.md" in problems[0]
    assert "knowledge/" in problems[0]


@pytest.mark.parametrize(
    "value",
    ["/rules/filing-2026.md", "../outside.md", "rules/../../etc/passwd.md", "rules\\filing-2026.md"],
)
def test_a_pointer_that_leaves_the_corpus_is_an_error(value: str) -> None:
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md", doc(f"superseded_by: {value}\n"), CORPUS
    )
    assert len(problems) == 1, f"{value!r} should be refused"


def test_a_pointer_without_a_markdown_extension_names_the_extension() -> None:
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md", doc("superseded_by: rules/filing-2026\n"), CORPUS
    )
    assert len(problems) == 1
    assert ".md" in problems[0]


def test_an_mdx_pointer_resolves() -> None:
    assert (
        knowledge.check_document(
            "knowledge/a.md", doc("superseded_by: b.mdx\n"), {"knowledge/a.md", "knowledge/b.mdx"}
        )
        == []
    )


@pytest.mark.parametrize(
    ("value", "wanted"),
    [
        ("./rules/filing-2026.md", "rules/filing-2026.md"),
        ("rules/filing-2026.md#deadlines", "rules/filing-2026.md"),
    ],
)
def test_a_nearly_right_pointer_names_the_exact_value_to_write(value: str, wanted: str) -> None:
    """Both would otherwise fall through to "this corpus does not contain it", whose message
    would print a path (`knowledge/./rules/…`) that reads like a defect in vsor rather than
    two stray characters in the document."""
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md", doc(f"superseded_by: {value}\n"), CORPUS
    )
    assert len(problems) == 1
    assert f"superseded_by: {wanted}`" in problems[0]


def test_a_url_pointer_says_a_successor_is_a_document_in_this_corpus() -> None:
    """The plausible wrong answer, not a hostile one: the replacement really does live on a
    regulator's website, and the author points at it. The error names the shape that works."""
    problems = knowledge.check_document(
        "knowledge/a.md", doc("superseded_by: https://example.test/new-rule.md\n"), CORPUS
    )
    assert len(problems) == 1
    assert "URL" in problems[0]


def test_frontmatter_is_found_through_crlf_and_a_byte_order_mark() -> None:
    """The site reads these bytes through gray-matter, which strips both. A converted
    Windows document whose frontmatter this module could not see would render the notice
    with nothing having checked that the pointer resolves — the whole failure, restored by
    a line ending."""
    body = "---\ntitle: 2019\nsuperseded_by: nowhere.md\n---\n\nA body.\n"
    bom = "\ufeff"
    for text in (body.replace("\n", "\r\n"), bom + body, bom + body.replace("\n", "\r\n")):
        assert knowledge.parse_dating(text).superseded_by == "nowhere.md"
        assert len(knowledge.check_document("knowledge/a.md", text, CORPUS)) == 1


def test_a_document_cannot_supersede_itself() -> None:
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md", doc("superseded_by: rules/filing-2019.md\n"), CORPUS
    )
    assert len(problems) == 1
    assert "itself" in problems[0]


def test_an_empty_pointer_is_an_error_rather_than_silence() -> None:
    """`superseded_by:` with nothing after it is YAML null — the shape a half-finished
    edit leaves, and the one that would otherwise mark a document superseded by nothing
    while looking like it names a successor."""
    problems = knowledge.check_document("knowledge/a.md", doc("superseded_by:\n"), CORPUS)
    assert len(problems) == 1


# ------------------------------------------------------------------ the two other keys


@pytest.mark.parametrize(
    "value", ["1 April 2019", "2019/04/01", "2019-13-40", "2019", "2019-04-01 09:00:00", "true"]
)
def test_an_effective_value_that_is_not_a_day_is_an_error(value: str) -> None:
    problems = knowledge.check_document("knowledge/a.md", doc(f"effective: {value}\n"), CORPUS)
    assert len(problems) == 1
    assert "effective" in problems[0]
    assert "YYYY-MM-DD" in problems[0]


def test_superseded_must_be_a_boolean() -> None:
    problems = knowledge.check_document("knowledge/a.md", doc("superseded: yesterday\n"), CORPUS)
    assert len(problems) == 1
    assert "superseded" in problems[0]


def test_superseded_false_is_a_document_that_is_current() -> None:
    assert knowledge.check_document("knowledge/a.md", doc("superseded: false\n"), CORPUS) == []
    assert knowledge.parse_dating(doc("superseded: false\n")).is_superseded is False


def test_superseded_true_with_no_successor_is_legal() -> None:
    """A withdrawn rule that nothing replaced is a real thing to record; the pointer is
    optional and the page says so rather than inventing a successor."""
    assert knowledge.check_document("knowledge/a.md", doc("superseded: true\n"), CORPUS) == []


def test_saying_not_superseded_while_naming_a_successor_is_a_contradiction() -> None:
    problems = knowledge.check_document(
        "knowledge/rules/filing-2019.md",
        doc("superseded: false\nsuperseded_by: rules/filing-2026.md\n"),
        CORPUS,
    )
    assert len(problems) == 1
    assert "superseded: false" in problems[0]


def test_every_problem_in_one_document_is_reported_at_once() -> None:
    """A bulk conversion is fixed in one pass or in twenty; reporting one problem per
    build makes it twenty."""
    problems = knowledge.check_document(
        "knowledge/a.md", doc("effective: soon\nsuperseded_by: nowhere.md\n"), CORPUS
    )
    assert len(problems) == 2


# ------------------------------------------------------------------ check_corpus


def _rows(paths: list[str]) -> list[tuple[str, str]]:
    return [(p, "0" * 64) for p in paths]


def test_check_corpus_reads_the_rows_the_record_is_about_to_name(tmp_path: Path) -> None:
    corpus = tmp_path / "knowledge"
    (corpus / "rules").mkdir(parents=True)
    (corpus / "rules" / "filing-2026.md").write_text(doc("title: 2026\n"), encoding="utf-8")
    (corpus / "rules" / "filing-2019.md").write_text(
        doc("title: 2019\nsuperseded_by: rules/filing-2026.md\n"), encoding="utf-8"
    )
    rows = _rows(["knowledge/rules/filing-2019.md", "knowledge/rules/filing-2026.md"])
    assert knowledge.check_corpus(tmp_path, rows) == []

    (corpus / "rules" / "filing-2019.md").write_text(
        doc("title: 2019\nsuperseded_by: rules/filing-2030.md\n"), encoding="utf-8"
    )
    problems = knowledge.check_corpus(tmp_path, rows)
    assert len(problems) == 1
    assert "filing-2030.md" in problems[0]


def test_check_corpus_ignores_what_is_not_a_document(tmp_path: Path) -> None:
    """Only markdown carries frontmatter. A co-located YAML deck or a stray text file is
    corpus the record names and not a page anything renders."""
    corpus = tmp_path / "knowledge"
    corpus.mkdir()
    (corpus / "deck.yaml").write_text("superseded_by: nowhere.md\n", encoding="utf-8")
    assert knowledge.check_corpus(tmp_path, _rows(["knowledge/deck.yaml"])) == []


def test_check_corpus_skips_bytes_it_cannot_read(tmp_path: Path) -> None:
    """Undecodable bytes are Docusaurus's error against the file, and a validator that
    crashed here would replace a precise error with a traceback."""
    corpus = tmp_path / "knowledge"
    corpus.mkdir()
    (corpus / "broken.md").write_bytes(b"---\ntitle: \xff\xfe\n---\n")
    assert knowledge.check_corpus(tmp_path, _rows(["knowledge/broken.md"])) == []


def test_check_corpus_reports_in_path_order(tmp_path: Path) -> None:
    corpus = tmp_path / "knowledge"
    corpus.mkdir()
    for name in ("c.md", "a.md", "b.md"):
        (corpus / name).write_text(doc("superseded_by: gone.md\n"), encoding="utf-8")
    problems = knowledge.check_corpus(tmp_path, _rows(["knowledge/c.md", "knowledge/a.md", "knowledge/b.md"]))
    assert [p.split(":", 1)[0] for p in problems] == [
        "knowledge/a.md",
        "knowledge/b.md",
        "knowledge/c.md",
    ]


# ---------------------------------------------------- the fixture the browser tier renders


def test_the_fixture_corpus_is_a_corpus_this_validator_blesses(tmp_path: Path) -> None:
    """One corpus, two tiers. `tests/fixtures/tiny` carries the dated document and the
    superseded one that `packages/sor-site/e2e/tests/effective-dating.spec.ts` renders in
    a browser; if this validator would refuse it, the browser tier is certifying a corpus
    `vsor build` rejects.

    Copied under a `knowledge/` name because that is the shape a build presents: the rows
    the record names are `knowledge/…`, and checking the fixture in place would be
    checking a path no build ever produces.
    """
    fixture = REPO / "tests" / "fixtures" / "tiny"
    shutil.copytree(fixture, tmp_path / "knowledge")
    rows = _rows(
        sorted(f"knowledge/{p.relative_to(fixture).as_posix()}" for p in fixture.rglob("*") if p.is_file())
    )
    assert rows, f"no fixture corpus at {fixture}"
    assert knowledge.check_corpus(tmp_path, rows) == []


def test_the_fixture_corpus_carries_one_dated_and_one_superseded_document() -> None:
    """The precondition of the browser tier's B17, asserted where it is cheap: a fixture
    that quietly lost these keys would leave those assertions passing against nothing."""
    fixture = REPO / "tests" / "fixtures" / "tiny"
    dated, superseded = [], []
    for path in sorted(fixture.rglob("*.md")):
        dating = knowledge.parse_dating(path.read_text(encoding="utf-8"))
        if dating.effective is not None:
            dated.append(path.name)
        if dating.is_superseded:
            superseded.append(path.name)
    assert len(dated) >= 2, f"expected the dated document and the superseded one to carry effective: {dated}"
    assert len(superseded) == 1, f"exactly one superseded fixture document, found {superseded}"


# ── the two parsers must agree, and the site must have a page ──────────────────────────
#
# Added 2026-08-15 from the adversarial safety review. Everything below is a defect the
# build passed and a reader saw: vsor validated a governance claim that the page then
# contradicted, or did not validate at all.


@pytest.mark.parametrize("token", ["yes", "no", "on", "off", "y", "n", "Yes", "OFF"])
def test_yaml_1_1_booleans_are_refused_because_the_page_cannot_read_them(token: str) -> None:
    """PyYAML resolves ten spellings of true; js-yaml — what gray-matter reads the same
    bytes with on the site — resolves three. `superseded: yes` therefore passed this
    validator as a genuine supersession and rendered NO notice at all: a withdrawn rule
    served as current, recorded as validly superseded (measured live 2026-08-15)."""
    problems = knowledge.check_document("knowledge/a.md", doc(f"superseded: {token}\n"), CORPUS)
    assert len(problems) == 1
    assert "superseded" in problems[0]
    assert knowledge.parse_dating(doc(f"superseded: {token}\n")).is_superseded is False


@pytest.mark.parametrize("token", ["true", "True", "TRUE"])
def test_the_three_spellings_both_parsers_share_are_accepted(token: str) -> None:
    assert knowledge.check_document("knowledge/a.md", doc(f"superseded: {token}\n"), CORPUS) == []
    assert knowledge.parse_dating(doc(f"superseded: {token}\n")).superseded is True


def test_a_quoted_boolean_reads_the_same_as_an_unquoted_one() -> None:
    """Same rule as dates: a professional writing frontmatter never has to know which
    they wrote."""
    assert knowledge.parse_dating(doc('superseded: "true"\n')).superseded is True
    assert knowledge.check_document("knowledge/a.md", doc('superseded: "false"\n'), CORPUS) == []


@pytest.mark.parametrize("value", ["true", "yes", "True"])
def test_a_draft_document_is_refused_because_it_would_have_no_page(value: str) -> None:
    """`draft: true` is a documented Docusaurus key and it drops the document from a
    production build — no route, not even in the search index — but DOWNSTREAM of
    everything vsor measures. The file is in the shell, so it is hashed, moves build_id
    and gets a documents[] row: a citation resolving to a record row and a 404."""
    problems = knowledge.check_document("knowledge/a.md", doc(f"draft: {value}\n"), CORPUS)
    assert len(problems) == 1
    assert "draft" in problems[0]
    assert "knowledge/" in problems[0]  # the remedy names where it should live instead


def test_draft_false_and_unlisted_are_left_alone() -> None:
    """`draft: false` says nothing; `unlisted: true` still publishes a page (measured:
    the route is emitted, only the sidebar and index skip it), so it is not ours."""
    assert knowledge.check_document("knowledge/a.md", doc("draft: false\n"), CORPUS) == []
    assert knowledge.check_document("knowledge/a.md", doc("unlisted: true\n"), CORPUS) == []


TAB_FRONTMATTER = "title: Old\nsuperseded_by:\tmissing-target.md\n"


def test_frontmatter_this_parser_cannot_read_is_refused_not_ignored() -> None:
    """Where the two parsers DISAGREE, silence turned the whole gate off for a document.

    A literal tab after the colon raises ScannerError in PyYAML and returns a clean
    mapping from gray-matter, so `superseded_by: missing-target.md` — naming nothing —
    shipped to readers as "Superseded. No replacement is named" with no build error at
    all (measured live 2026-08-15). A duplicated message is far cheaper than an unchecked
    governance claim.
    """
    problems = knowledge.check_document("knowledge/old.md", doc(TAB_FRONTMATTER), CORPUS)
    assert len(problems) == 1
    assert "knowledge/old.md" in problems[0]
    assert "frontmatter" in problems[0]
    assert "tab" in problems[0].lower()  # the usual cause, named


def test_frontmatter_neither_parser_can_read_is_still_docusaurus_to_report() -> None:
    """The boundary holds: no frontmatter, an unclosed block and a non-mapping stay
    Docusaurus's error against the file and the line."""
    assert knowledge.check_document("knowledge/a.md", "no frontmatter here\n", CORPUS) == []
    assert knowledge.check_document("knowledge/a.md", "---\ntitle: Unclosed\n", CORPUS) == []
    assert knowledge.check_document("knowledge/a.md", doc("- just\n- a list\n"), CORPUS) == []


def test_a_pointer_is_compared_the_way_the_walk_normalizes_paths() -> None:
    """On macOS a filename is stored as it was typed, so the successor's row is NFC (the
    walk normalizes) while tab-completion hands the author the NFD form. Both spellings
    of one name must resolve, or the build refuses a corpus that is perfectly correct
    with a message nobody can falsify on screen — the two strings render identically."""
    nfc = "knowledge/café.md"
    nfd_pointer = "café.md"
    assert knowledge.check_document(
        "knowledge/old.md", doc(f"superseded_by: {nfd_pointer}\n"), {nfc, "knowledge/old.md"}
    ) == []


def test_a_successor_that_overrides_its_own_id_is_refused() -> None:
    """The successor exists and the page still cannot link to it: the site resolves a
    successor through the docs plugin's data, keyed by document id, and an `id:` in the
    target's frontmatter replaces the path-derived one. Measured live: the build passed
    and the page rendered "No replacement is named" — the same observable outcome as the
    dangling pointer this module refuses outright."""
    problems = knowledge.check_document(
        "knowledge/old.md",
        doc("superseded_by: new.md\n"),
        {"knowledge/old.md", "knowledge/new.md"},
        {"knowledge/new.md": "renamed"},
    )
    assert len(problems) == 1
    assert "id: renamed" in problems[0]
    assert "knowledge/new.md" in problems[0]


def test_check_corpus_collects_declared_ids_before_it_judges_pointers(tmp_path: Path) -> None:
    """The two-pass shape, end to end: the id is declared in a document sorted AFTER the
    one pointing at it, so a single pass in path order would miss it."""
    corpus = tmp_path / "knowledge"
    corpus.mkdir()
    (corpus / "a-old.md").write_text(doc("superseded_by: z-new.md\n"), encoding="utf-8")
    (corpus / "z-new.md").write_text(doc("title: New\nid: renamed\n"), encoding="utf-8")
    rows = [("knowledge/a-old.md", "0" * 64), ("knowledge/z-new.md", "1" * 64)]
    problems = knowledge.check_corpus(tmp_path, rows)
    assert len(problems) == 1
    assert "id: renamed" in problems[0]
