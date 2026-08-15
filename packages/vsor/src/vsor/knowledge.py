"""Effective dating and supersession — the level-0 answer to "provenance is not correctness".

AGENTS.md's second design test says it plainly: everything else in this system proves *who
said something and when*, and nothing yet expresses that a source is superseded. The case
that hurts a regulated vertical is not an uncited claim — it is a correctly cited rule that
stopped being true in 2024, served with a perfect citation and full confidence. A citation
does not touch it. Abstention does not touch it, because the corpus *does* cover the
question; it covers it with an answer that has expired.

Level 0 is three optional frontmatter keys, and it is deliberately three keys rather than a
status taxonomy — this is the version that has to survive being extended, so it records
facts a professional already writes down and invents no vocabulary of its own:

    effective: 2024-01-01           the day this document's content took effect
    superseded: true                this document is no longer current
    superseded_by: rules/new.md     what replaced it — a path under `knowledge/`

`superseded_by` implies `superseded`, so the boolean is only written when a document was
withdrawn with nothing named to replace it. That case is real (a rule repealed rather than
rewritten), and without the boolean an author would either fake a successor or leave the
document unmarked — the second being exactly the failure this exists to stop.

**What this module refuses, and why it is a refusal rather than a warning.** A pointer that
names a document the corpus does not contain is an error at build time. The page it would
produce tells a reader "this was replaced" and then leads nowhere; the record would carry
the same false promise. That is worse than an unmarked document, because it is a governance
claim that cannot be checked — so `vsor build` stops and names every one of them at once,
which is how a bulk conversion gets fixed in one pass instead of twenty.

**What it deliberately does not own.** A file with no frontmatter, an unterminated block, or
frontmatter that is not a YAML mapping is Docusaurus's error to report — it names the file
and the line, and a second opinion here would only compete with it. Chains (A superseded by
B superseded by C), dates that disagree with a successor's, and any query over time belong
to a later slice; this module answers one question per document.

The rendering half is `packages/sor-site/app/src/theme/DocItem/Content` — the keys are read
off the same frontmatter by the site, never through a second parser here.
"""

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from types import MappingProxyType

import yaml

#: The corpus directory name, as `lock.walk_tree` prefixes its rows.
CORPUS_DIR = "knowledge"

#: What carries frontmatter. A co-located YAML deck or a text file is corpus the record
#: names and not a page anything renders, so nothing here reads it.
DOCUMENT_SUFFIXES = (".md", ".mdx")

EFFECTIVE = "effective"
SUPERSEDED = "superseded"
SUPERSEDED_BY = "superseded_by"
#: Docusaurus's own key for "do not publish this in a production build". vsor refuses it
#: under `knowledge/` — see `_check_draft`.
DRAFT = "draft"

#: The only scalars that mean true and false HERE. js-yaml's core schema — what
#: gray-matter reads the same bytes with, on the site — resolves exactly these six and
#: leaves `yes`/`no`/`on`/`off`/`y`/`n` as strings, while PyYAML (YAML 1.1) resolves all
#: of them to booleans. That gap is a governance hole: `superseded: yes` passed vsor's
#: validator as a genuine supersession and rendered NO notice on the page, so a withdrawn
#: rule was served as current and recorded as validly superseded (found live 2026-08-15).
#: One vocabulary, decided from the scalar's own characters, exactly as `_as_day` decides
#: what a date is.
_TRUE_TOKENS = frozenset({"true", "True", "TRUE"})
_FALSE_TOKENS = frozenset({"false", "False", "FALSE"})

_ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DAY_FORM = "YYYY-MM-DD"

#: Distinguishes "the key is not there" from "the key is there with no value" — the second
#: is what a half-finished edit leaves behind, and it must not read as silence.
_ABSENT = object()


class _DatingLoader(yaml.SafeLoader):
    """`SafeLoader` with YAML's implicit timestamp construction turned off.

    Two reasons, both measured. **It crashes:** `yaml.safe_load("effective: 2019-13-40")`
    raises `ValueError: month must be in 1..12` out of PyYAML's own timestamp constructor,
    not a `YAMLError` — so a single typo in one document's frontmatter would take down a
    build with a traceback instead of a message naming the file. **And the two ends
    disagree:** js-yaml, which is what Docusaurus reads the same bytes with, resolves that
    scalar by rolling the month over — `2019-13-40` becomes a real date in February 2020
    and the page renders it, silently. Reading every date-shaped scalar as the string it
    was written as leaves one validator (`_as_day`) deciding what a day is, and it decides
    the same way for a quoted value and an unquoted one.
    """


def _scalar_as_written(loader: _DatingLoader, node: yaml.Node) -> str:
    """The scalar's own characters, never a constructed value. See `_DatingLoader`."""
    return str(loader.construct_scalar(node)) if isinstance(node, yaml.ScalarNode) else ""


_DatingLoader.add_constructor("tag:yaml.org,2002:timestamp", _scalar_as_written)
# Booleans go the same way as dates, and for the same measured reason: PyYAML resolves
# ten spellings of true, js-yaml resolves three, and the two ends of this system must
# agree about what a governance key SAYS before they can agree about what it means.
# `_as_bool` is then the one place that decides, for a quoted value and an unquoted one
# alike.
_DatingLoader.add_constructor("tag:yaml.org,2002:bool", _scalar_as_written)


class FrontmatterError(Exception):
    """Frontmatter is present and PyYAML cannot read it — see `_load_frontmatter`."""


def _load_frontmatter(text: str) -> dict[str, object] | None:
    """The frontmatter as a mapping, None when there is nothing here to judge, or
    `FrontmatterError` when there is a block and this parser cannot read it.

    None covers: no frontmatter, an unclosed block, and YAML that is not a mapping. Each
    of those is Docusaurus's error against the file and the line, and a second opinion
    here would only compete with a better message.

    A block that PyYAML REFUSES is different, and it used to be folded in with them. The
    assumption was that both parsers fail together — but where they diverge nobody
    validates and nobody complains, so the whole effective-dating gate switched off for
    that document, silently. Measured 2026-08-15: a literal tab after the colon
    (`superseded_by:\\tmissing.md`) raises `ScannerError` in PyYAML and returns a clean
    mapping from gray-matter, so a pointer naming no document shipped to readers as
    "Superseded — no replacement is named". A duplicated message is far cheaper than an
    unchecked governance claim.
    """
    block = _frontmatter_block(text)
    if block is None:
        return None
    try:
        loaded = yaml.load(block, Loader=_DatingLoader)
    except (yaml.YAMLError, ValueError) as exc:
        raise FrontmatterError(str(exc).replace("\n", " ").strip()) from exc
    if not isinstance(loaded, dict):
        return None
    return {str(key): value for key, value in loaded.items()}


@dataclass(frozen=True)
class Dating:
    """One document's effective-dating facts, exactly as its frontmatter states them.

    Values are the *authored* ones: `effective` is a real day, `superseded_by` is the raw
    string, unresolved. Validation is `check_document`'s job — a reader that only wants to
    know what a document says should not have to handle a refusal.
    """

    effective: date | None = None
    superseded: bool | None = None
    superseded_by: str | None = None

    @property
    def is_superseded(self) -> bool:
        """Whether this document is no longer current — naming a successor is enough."""
        return bool(self.superseded) or bool(self.superseded_by)


def _frontmatter_block(text: str) -> str | None:
    """The YAML between the opening `---` line and the next one, or None.

    None every time this module is not the right one to complain: no frontmatter at all,
    or a block nobody closed. Same split as `instance.parse_instance`, without the
    refusals — an `instance.md` is vsor's own file and a corpus document is the user's.

    A BOM and CRLF line endings are normalized away first, and that is not tidiness: the
    site reads these same bytes through gray-matter, which strips both, so a document
    converted on Windows or exported by an office tool would have its frontmatter honoured
    by the page and skipped here — a `superseded_by` rendering as a notice with nothing
    validating that it resolves, which is precisely the failure this module exists to
    prevent. The two ends must agree about where the frontmatter is before they can agree
    about what it says.
    """
    text = text.removeprefix("\ufeff").replace("\r\n", "\n")
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 3)
    if end >= 0:
        return text[4 : end + 1]
    if text.endswith("\n---"):
        return text[4 : len(text) - 3]
    return None


def parse_dating(text: str) -> Dating:
    """Read the three keys off a document's frontmatter. Never raises.

    A non-mapping frontmatter, unparsable YAML, or a value of the wrong type all read as
    absent here and are reported by `check_document`, which is the half that owns the
    remedy. Keeping them apart is what lets the site render what a document *says* while
    the build refuses what it cannot act on.
    """
    try:
        loaded = _load_frontmatter(text)
    except FrontmatterError:
        return Dating()
    if loaded is None:
        return Dating()
    superseded_by = loaded.get(SUPERSEDED_BY)
    return Dating(
        effective=_as_day(loaded.get(EFFECTIVE)),
        superseded=_as_bool(loaded.get(SUPERSEDED)),
        superseded_by=superseded_by.strip()
        if isinstance(superseded_by, str) and superseded_by.strip()
        else None,
    )


def _as_bool(value: object) -> bool | None:
    """True, False, or None if that scalar is neither in the vocabulary both ends share.

    Every boolean-shaped scalar reaches here as the string it was written as (see
    `_DatingLoader`), so this is the one decision point — and it decides the same way for
    `superseded: true` and `superseded: "true"`. `yes`, `on` and `y` are deliberately NOT
    accepted: the site's parser reads them as ordinary strings, so accepting them here
    would validate a claim the page cannot render."""
    if isinstance(value, bool):
        return value  # a caller passing a real bool (never YAML's doing — see the loader)
    if isinstance(value, str):
        if value in _TRUE_TOKENS:
            return True
        if value in _FALSE_TOKENS:
            return False
    return None


def _as_day(value: object) -> date | None:
    """A day, or None if that value is not one.

    Every date-shaped scalar reaches here as the string it was written as (see
    `_DatingLoader`), so a quoted `"2024-01-01"` and an unquoted `2024-01-01` are the same
    input and a professional writing frontmatter never has to know which they wrote. The
    exact-length regex is what refuses a timestamp: an effective date is a day, and
    accepting `2024-01-01 09:00:00` would silently pick a timezone nobody wrote down.
    `date.fromisoformat` then refuses `2024-13-40` — shaped like a day, not one.
    """
    if isinstance(value, date) and not isinstance(value, datetime):
        return value  # a caller passing a real date (never YAML's doing — see the loader)
    if isinstance(value, str) and _ISO_DAY.match(value.strip()):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            return None
    return None


def _check_effective(path: str, raw: object) -> list[str]:
    if raw is _ABSENT or _as_day(raw) is not None:
        return []
    return [
        f"{path}: `{EFFECTIVE}: {raw!r}` is not a day — write it as {_DAY_FORM} "
        f"(`{EFFECTIVE}: 2024-01-01`), the one form that reads the same in every country. "
        f"A timestamp is refused too: an effective date is a day, and a time would carry a "
        f"timezone nobody wrote down."
    ]


def _check_superseded(path: str, raw: object) -> list[str]:
    """`superseded` is true or false, in the three spellings of each that BOTH parsers
    read as a boolean.

    `yes` is the one that hurt: PyYAML resolves it to True and js-yaml — which is what the
    page reads the same bytes with — leaves it the string `"yes"`, so the document passed
    this validator as validly superseded and rendered no notice at all. A reader saw a
    withdrawn rule as current. Refusing it is the only answer that keeps the two ends
    saying the same thing."""
    if raw is _ABSENT or _as_bool(raw) is not None:
        return []
    return [
        f"{path}: `{SUPERSEDED}: {raw!r}` is not true or false — `{SUPERSEDED}: true` means this "
        f"document is no longer current. Write the word `true` (or `false`): `yes`, `on` and `y` "
        f"are read as plain text by the site's own YAML parser, so the notice would never appear. "
        f"To name what replaced it, use `{SUPERSEDED_BY}: <path under {CORPUS_DIR}/>`, which says "
        f"the same thing and says it with a successor."
    ]


def _check_draft(path: str, raw: object) -> list[str]:
    """`draft: true` under `knowledge/` is refused: it would leave a row with no page.

    Docusaurus drops a draft from a production build — no route, not in the search index —
    but it does it DOWNSTREAM of everything vsor measures: the file is in the shell, so it
    is hashed into `corpus.tree`, moves `build_id`, and gets a `documents[]` row. A
    citation at that path then resolves to a record row and a 404. This is the exact
    inverse of the defect the "hash the shell, not the authored tree" fix closed, and it
    survived that fix for the same reason: the disagreement is between the record and the
    PUBLISHED site, not between the record and the bytes that were read."""
    if raw is _ABSENT or _as_bool(raw) is False:
        return []
    return [
        f"{path}: `{DRAFT}: {raw!r}` — vsor publishes every document in {CORPUS_DIR}/, so a draft "
        f"would leave a row in build.lock.json with no page behind it: a citation at this path "
        f"would resolve to the record and 404 on the site. Keep the file outside {CORPUS_DIR}/ "
        f"until it is ready, or delete the `{DRAFT}` key."
    ]


def _check_pointer(
    path: str,
    raw: object,
    corpus_paths: frozenset[str],
    declared_ids: Mapping[str, str] = MappingProxyType({}),
) -> list[str]:
    """The pointer must resolve to a document this build is publishing.

    Every branch names the value to write instead, because the whole cost of this refusal
    is paid at the moment somebody has to guess what shape was wanted.

    The path comparison is case-SENSITIVE on every platform, deliberately. `Filing-2026.md`
    against a file named `filing-2026.md` resolves on a Mac and 404s on the Linux host the
    site is deployed to, so the case that refuses here is the case that would otherwise
    ship a dead link to readers and be green on the author's machine.
    """
    if raw is _ABSENT:
        return []
    if not isinstance(raw, str) or not raw.strip():
        return [
            f"{path}: `{SUPERSEDED_BY}` has no value — write the successor's path under "
            f"{CORPUS_DIR}/ (`{SUPERSEDED_BY}: rules/filing-2026.md`), or, if nothing replaced "
            f"this document, `{SUPERSEDED}: true` on its own."
        ]

    value = raw.strip()
    if "://" in value:
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` is a URL — a successor is a document in this "
            f"corpus, so that both surfaces can follow it and build.lock.json can name it. If the "
            f"replacement lives somewhere else, add a document under {CORPUS_DIR}/ that says so "
            f"and links to it in its body, then point at that."
        ]
    if "\\" in value:
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` uses backslashes — corpus paths are written with "
            f"forward slashes on every platform: `{SUPERSEDED_BY}: {value.replace(chr(92), '/')}`."
        ]
    if value.startswith("/"):
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` starts at the filesystem root — the path is "
            f"relative to {CORPUS_DIR}/, so write `{SUPERSEDED_BY}: {value.lstrip('/')}`."
        ]
    if ".." in value.split("/"):
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` leaves the corpus — a successor is another "
            f"document under {CORPUS_DIR}/, and nothing outside it is published or hashed into "
            f"build.lock.json."
        ]
    if value.startswith(f"{CORPUS_DIR}/"):
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` is relative to the project — it is relative to "
            f"{CORPUS_DIR}/, so drop the prefix: "
            f"`{SUPERSEDED_BY}: {value[len(CORPUS_DIR) + 1 :]}`."
        ]
    if value.startswith("./"):
        # Named rather than left to the "does not contain" branch below, which would
        # otherwise report `looked for knowledge/./filing-2026.md` — a path that reads like
        # a defect in vsor rather than a stray two characters in the document.
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` is written relative to this file — the path is "
            f"relative to {CORPUS_DIR}/ wherever the document sits, so drop the `./`: "
            f"`{SUPERSEDED_BY}: {value[2:]}`."
        ]
    if "#" in value or "?" in value:
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` points into a document rather than at one — a "
            f"successor is a whole document, so drop everything from the "
            f"`{'#' if '#' in value else '?'}`: "
            f"`{SUPERSEDED_BY}: {value.split('#')[0].split('?')[0]}`."
        ]
    if not value.lower().endswith(DOCUMENT_SUFFIXES):
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` names no file — a successor is a document, so "
            f"write its filename including the extension: `{SUPERSEDED_BY}: {value}.md`."
        ]

    # NFC, exactly as `lock.walk_tree` normalizes the rows this is compared against. On a
    # Mac the filename is stored as it was written, so an NFD `café.md` gives a pointer
    # that tab-completion and copy-from-`ls` both produce and that this check refused with
    # a message nobody could falsify on screen — the two strings render identically. The
    # same normalization is what makes the site's own lookup find it (found live
    # 2026-08-15: NFC pointer + NFD file built green and rendered "no replacement is
    # named"; NFD pointer + NFD file was refused outright).
    target = f"{CORPUS_DIR}/" + unicodedata.normalize("NFC", value)
    if target == path:
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` names itself — a document cannot replace itself. "
            f"Point at the document that did, or use `{SUPERSEDED}: true` if nothing replaced it."
        ]
    if target not in corpus_paths:
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` names a document this corpus does not contain "
            f"(looked for {target}). Add the successor to {CORPUS_DIR}/ before marking this one "
            f"superseded, or correct the path. A reader is told this document was replaced; the "
            f"replacement has to be reachable."
        ]
    declared = declared_ids.get(target)
    if declared is not None:
        # The successor exists, and the page still cannot link to it: the site resolves a
        # successor through the docs plugin's own data, keyed by document id, and an `id:`
        # in the target's frontmatter REPLACES the path-derived one. Found live
        # 2026-08-15: the build passed and the page rendered "This document is no longer
        # current. No replacement is named" — the same observable outcome as the dangling
        # pointer this check refuses outright, so the gate would otherwise be inconsistent
        # about one defect. (AGENTS.md's own rule 7: derive names from paths.)
        return [
            f"{path}: `{SUPERSEDED_BY}: {value}` names a document that overrides its own identity "
            f"(`id: {declared}` in {target}), so the site would look the successor up under "
            f"`{declared}` and find nothing — the page would say a replacement exists and name "
            f"none. Remove the `id:` line from {target}: under {CORPUS_DIR}/ a document is "
            f"identified by its path."
        ]
    return []


def _unreadable_frontmatter(path: str, reason: str) -> str:
    return (
        f"{path}: vsor cannot read this document's frontmatter — {reason}. Every governance key "
        f"in it goes unchecked while the site's own parser may still act on it, which is how a "
        f"`{SUPERSEDED_BY}` naming nothing reached readers as \"no replacement is named\". A tab "
        f"after the colon is the usual cause; use spaces, and quote any value containing `:` or "
        f"`#`."
    )


def check_document(
    path: str,
    text: str,
    corpus_paths: frozenset[str] | set[str],
    declared_ids: Mapping[str, str] = MappingProxyType({}),
) -> list[str]:
    """Every problem with one document's frontmatter that vsor owns, in one pass.

    ``path`` is the row path as `build.lock.json` names it (`knowledge/…`),
    ``corpus_paths`` is every row path in this build — so "the corpus contains it" means
    exactly "the record about to be written names it", never "some file exists on disk" —
    and ``declared_ids`` maps those rows to any `id:` they override their identity with.
    """
    try:
        loaded = _load_frontmatter(text)
    except FrontmatterError as exc:
        return [_unreadable_frontmatter(path, str(exc))]
    if loaded is None:
        return []

    frozen = frozenset(corpus_paths)
    problems = [
        *_check_effective(path, loaded.get(EFFECTIVE, _ABSENT)),
        *_check_superseded(path, loaded.get(SUPERSEDED, _ABSENT)),
        *_check_draft(path, loaded.get(DRAFT, _ABSENT)),
        *_check_pointer(path, loaded.get(SUPERSEDED_BY, _ABSENT), frozen, declared_ids),
    ]
    if _as_bool(loaded.get(SUPERSEDED)) is False and isinstance(loaded.get(SUPERSEDED_BY), str):
        problems.append(
            f"{path}: `{SUPERSEDED}: false` contradicts `{SUPERSEDED_BY}` — naming a successor "
            f"already means this document is no longer current. Remove the `{SUPERSEDED}` line, or "
            f"remove the successor."
        )
    return problems


#: The keys `check_document` can have anything to say about. A document carrying none of
#: them needs no second look, which is what keeps `check_corpus` to one read per file.
_OWNED_KEYS = (EFFECTIVE, SUPERSEDED, SUPERSEDED_BY, DRAFT)


def check_corpus(corpus_root: Path, corpus_rows: Sequence[tuple[str, str]]) -> list[str]:
    """Check every document the record is about to name, in path order.

    ``corpus_root`` is the directory the rows are relative to — the runtime shell during a
    build, because the shell's copy is what Docusaurus reads and what the record hashes.
    Validating the authored tree instead would leave a window in which the two disagree,
    which is the window `_measure_built_inputs` was moved to close.

    Two passes over one read: a `superseded_by` cannot be judged until every document's
    declared identity is known (a successor carrying `id:` is unreachable from the page),
    so the first pass collects those and the text of the few documents that carry a key
    this module owns, and the second pass judges exactly those.
    """
    paths = frozenset(row_path for row_path, _ in corpus_rows)
    found: dict[str, list[str]] = {}
    declared_ids: dict[str, str] = {}
    pending: list[tuple[str, str]] = []
    for row_path in sorted(paths):
        if not row_path.lower().endswith(DOCUMENT_SUFFIXES):
            continue
        try:
            text = (corpus_root / row_path).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            # Unreadable or undecodable bytes are Docusaurus's error against the file and
            # the line; a traceback here would replace a precise message with a worse one.
            continue
        try:
            loaded = _load_frontmatter(text)
        except FrontmatterError as exc:
            found[row_path] = [_unreadable_frontmatter(row_path, str(exc))]
            continue
        if loaded is None:
            continue
        identity = loaded.get("id")
        if isinstance(identity, str) and identity.strip():
            declared_ids[row_path] = identity.strip()
        if any(key in loaded for key in _OWNED_KEYS):
            pending.append((row_path, text))
    for row_path, text in pending:
        found[row_path] = check_document(row_path, text, paths, declared_ids)
    return [problem for row_path in sorted(found) for problem in found[row_path]]


# ── the refusal ─────────────────────────────────────────────────────────────────────────
#
# Shown in full below five documents and summarized past it, the same shape as the symlink
# and ignored-document refusals. Five is enough to see the pattern in a bulk conversion;
# five hundred is a wall of text somebody scrolls past.
_PROBLEMS_SHOWN = 5


def refusal_prose(problems: Sequence[str]) -> str:
    """The `knowledge-invalid` message: what is wrong, why it is refused, how to proceed."""
    shown = "\n".join(f"  {problem}" for problem in problems[:_PROBLEMS_SHOWN])
    more = (
        f"\n  ...and {len(problems) - _PROBLEMS_SHOWN} more.\n"
        if len(problems) > _PROBLEMS_SHOWN
        else "\n"
    )
    return (
        f"{len(problems)} problem(s) with effective-dating keys in {CORPUS_DIR}/:\n"
        f"{shown}{more}"
        f"why it stops the build instead of warning: a document marked superseded tells its reader\n"
        f"  the rule changed, and a pointer that resolves to nothing makes that a claim nobody can\n"
        f"  check — on the page, and in build.lock.json, which is what a citation resolves through.\n"
        f"  An unmarked document is merely stale; this one would be confidently wrong.\n"
        f"the keys, all three optional: `{EFFECTIVE}: {_DAY_FORM}` · `{SUPERSEDED}: true` ·\n"
        f"  `{SUPERSEDED_BY}: <path under {CORPUS_DIR}/>`. Fix the lines above and rerun vsor build.\n"
        f"  `vsor dev` does not refuse them — writing the successor second is a normal way to work."
    )
