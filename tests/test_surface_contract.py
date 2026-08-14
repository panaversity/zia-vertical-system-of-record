"""Phase A of the sor-site surface contract — specs/sor-site/surface/spec.md.

Source + manifest checks only (spec: "runs the day the package lands"). Boundary
tier: reads files, never imports, never runs Node — `make gate` stays node-free.
The browser tier (Phase B, B5-B13 + B15-B16; B14 retired 2026-08-14) is a
separate suite and a separate make target.

  A1  every direct runtime dep of packages/sor-site is in the committed allowlist;
      the lockfile contains no denylisted name (transitives included)
  A2  zero matches of the committed exclusion list over shipped source
      (.ts/.tsx/.js/.css under packages/sor-site and the templates site shell —
      never markdown, specs, or any corpus); ReadingProgress carved out of any
      progress pattern
  A3  token lint: zero raw color literals outside the designated token files
  A4  exported primitive prop types match the frozen baseline byte-for-byte

Plus two fixture preconditions Phase B's B8/B13 rely on (the spec asserts them of
the fixture corpus; they are pure source checks, so they live in this tier).
"""

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SOR_SITE = REPO / "packages" / "sor-site"
# The templates site shell — the other shipped surface the A2 scan covers.
TEMPLATE_SITE = REPO / "packages" / "vsor" / "src" / "vsor" / "templates" / "scaffold" / "site"
FIXTURE = REPO / "fixtures" / "tiny"
LOCKFILE = SOR_SITE / "package-lock.json"

# A3: the designated token files (spec "Token discipline" — "the designated
# token file(s)"). Every color literal in shipped CSS lives in one of these;
# everything else consumes var(--…).
#   - the scaffold's custom.css: the CONSUMING site's token seam — B12's
#     sentinel builds patch exactly its --ifm-color-primary lines and the
#     scaffold AGENTS.md names it "the design tokens". Designated here
#     2026-08-13: the A3 scan previously covered packages/sor-site only, so a
#     raw literal added to any other scaffold CSS would have passed unseen.
#   - app/src/css/tokens.css: the RUNTIME SHELL's token file. Designated
#     2026-08-14 with the brand-parameterization pass, which moved every colour
#     the forked app carried (246 substitutions across five stylesheets) out of
#     the rule bodies and into this one file, and expressed the brand hues as
#     `R G B` channel triples so a consuming project re-brands by redeclaring
#     one token rather than eight rgba() literals.
# A third entry, packages/sor-site/theme/src/css/tokens.css, was dropped
# 2026-08-14 when that package was deleted: the shell manifest
# (templates/site_runtime/package.json) referenced neither it nor the mdx
# package, so both shipped to nobody while still looking like the file to edit.
TOKEN_FILES = (
    TEMPLATE_SITE / "src" / "css" / "custom.css",
    SOR_SITE / "app" / "src" / "css" / "tokens.css",
)

# A4: the frozen prop baseline. packages/sor-site/app/src/types.ts is the single
# public prop-type module of the SHIPPED surface; changing it means editing this
# baseline in the same reviewed change — and the spec says changing a baseline
# requires touching the spec.
#   Repointed 2026-08-14: it used to name packages/sor-site/mdx/src/types.ts,
#   which the forked app superseded — `make wheel` stopped packing that package,
#   so A4 was pinning a module that ships to nobody while the primitives users
#   actually get (app/src/components/**, reached through the fork's own
#   MDXComponents) were unpinned. The mdx module also still re-exported
#   HighlightTipProps, a type the fork does not export at all. That package was
#   deleted later the same day; this is now the only prop-type module there is.
PROP_MODULE = SOR_SITE / "app" / "src" / "types.ts"
BASELINE = REPO / "tests" / "baselines" / "sor-site-props.ts"

SOURCE_EXTS = {".ts", ".tsx", ".js", ".css"}

# Generated output (gitignored per packages/sor-site/.gitignore) — the scan
# covers shipped source; built-bundle scanning is Phase B's B7, in the node tier.
# Repointed 2026-08-14 with the deletion of the mdx/theme packages, whose
# compiled `lib/` dirs this used to name: the only generated trees left inside
# packages/sor-site are the forked shell's own, which appear the moment anyone
# runs a local `docusaurus build` in app/ and would otherwise put a whole
# bundled Docusaurus under the A2/A3 scanners.
_GENERATED = (SOR_SITE / "app" / "build", SOR_SITE / "app" / ".docusaurus")

# Out of A2/A3 scope by the spec's own words — the scan covers "the package's
# shipped source (src/, theme/, css) and the templates/ site shell", and the e2e
# acceptance harness is neither: B6 requires it to NAME the forbidden route words
# (profile, onboarding, …) to assert their absence, and e2e/.scratch/ is
# gitignored assembly/build output whose bundles B7 scans at runtime in the
# browser tier. (Recorded 2026-08-13, green phase: the scan originally covered
# e2e/ and failed on the harness's own B6 word list — a misread of A2's scope.)
_OUT_OF_SCOPE = (SOR_SITE / "e2e",)


def _is_scannable(path: Path) -> bool:
    if not path.is_file() or path.suffix not in SOURCE_EXTS:
        return False
    if "node_modules" in path.parts:
        return False
    if any(root in path.parents for root in _OUT_OF_SCOPE):
        return False
    return all(gen not in path.parents for gen in _GENERATED)


def _source_files(root: Path) -> list[Path]:
    return [p for p in sorted(root.rglob("*")) if _is_scannable(p)]


# --------------------------------------------------------------------------- A1
# Allowlist gates, denylist backstops (spec "Dependency allowlist").
# Direct runtime deps = dependencies + peerDependencies of every workspace
# package.json. Growth edits this set in the same reviewed commit.

ALLOWLIST_PREFIXES = (
    "@docusaurus/",  # peers — the host framework
    "@vsor/",  # workspace-internal packages
)
ALLOWLIST_EXACT = {
    # Initial allowlist, verbatim from the spec:
    "react",
    "react-dom",
    "@mdx-js/react",
    "clsx",
    "prism-react-renderer",
    "@easyops-cn/docusaurus-search-local",
    # Growth — each entry justified by an extraction report (2026-08-13).
    # The "which package needs it" notes read `app:` throughout since 2026-08-14:
    # they used to say mdx/theme, and those two packages are deleted — the forked
    # shell (packages/sor-site/app) is the one thing that ships.
    "react-markdown",  # app: renders quiz/flashcard markdown and the summary tab, as upstream did
    "photoswipe",  # app: ImageZoom engine; self-contained, no network
    "turndown",  # app: client-side Copy-Markdown — a spec-kept DocPageActions action
    "lunr",  # app: bundled search index — replaces upstream's runtime CDN load (would fail B8)
    "unist-util-visit",  # lib: remark plugins' tree walker, upstream pin
    "yaml",  # lib/shared: flashcard/gallery deck loaders
    "glob",  # lib: chapter-manifest + summaries corpus walks
    "gray-matter",  # lib: chapter-manifest frontmatter parsing
    "satori",  # lib/plugin-og-image: SVG card renderer (build-time only)
    "sharp",  # lib/plugin-og-image: SVG→PNG (build-time only)
    # The design system (spec amendment 2026-08-13, "added 2026-08-13 with the
    # design system") — landed 2026-08-14. The spec names each of these; the
    # radix primitives are listed individually, never as a wildcard, and the set
    # is exactly what the kept chrome imports (app/src/components/ui holds
    # button, dialog and sheet).
    "tailwindcss",  # app: the design system's engine — v4, no config file
    "@tailwindcss/postcss",  # app: the site's postcss pipeline (app/postcss.config.js)
    "postcss",  # app: peer of the two above; pinned so the shell resolves one copy
    "autoprefixer",  # app: last plugin in the same pipeline
    "tailwindcss-animate",  # app: the enter/exit utilities the sheet uses (no framer-motion)
    "lucide-react",  # app: the icon set the chrome renders (navbar, footer, landing)
    "class-variance-authority",  # app: shadcn variant tables (button, sheet)
    "tailwind-merge",  # app: the other half of cn() — conflicting-class resolution
    "@radix-ui/react-slot",  # app: ui/button's asChild
    "@radix-ui/react-dialog",  # app: ui/sheet (the navbar's mobile menu) is built on it
    # The fork (2026-08-14). The runtime shell is now a workspace package of its
    # own (app/), so its direct deps face this gate for the first time. Every
    # other name it declares was already allowlisted above; this is the one
    # addition, and it is load-bearing rather than inherited: the collapsed tabs
    # plugin matches on `containerDirective`/`leafDirective` nodes
    # (lib/remark-tabs/index.js:108,121), which exist in the tree only because
    # this parser put them there. Build-time only, no network, no product surface.
    "remark-directive",  # app: parses the `:::` syntax @vsor/lib-remark-tabs consumes
}

# Known-bad names: product deps that must never appear, even transitively.
DENYLIST = (
    "better-auth",
    "@openai/chatkit-react",
    "@chatscope",
    "@monaco-editor/react",
    "@xterm",
    "ts-fsrs",
    "recharts",
    # The four the design-system amendment holds out at v0 ("`framer-motion`,
    # `cmdk`, `next-themes` and `sonner` stay out at v0"). The allowlist above
    # already catches them as direct deps; the spec pairs every allowlist with
    # this backstop, and only the backstop sees a transitive arrival — e.g. a
    # future radix primitive that pulls framer-motion in. Added 2026-08-14;
    # verified zero occurrences in the lockfile at the time.
    "framer-motion",
    "cmdk",
    "next-themes",
    "sonner",
)


# The manifest a user actually INSTALLS. `make wheel` copies it verbatim into
# the wheel as _site_runtime/package.json and `vsor build` runs `npm ci` against
# it — so it, not the workspace manifests, is the dependency set that reaches a
# project. Added to A1's scan 2026-08-14: it promotes six of the fork's
# devDependencies to runtime deps, and until now sat outside the allowlist
# entirely, so a dep added there bypassed the gate.
SHELL_MANIFEST = (
    REPO / "packages" / "vsor" / "src" / "vsor" / "templates" / "site_runtime" / "package.json"
)


def _manifests() -> list[Path]:
    workspace = [
        p
        for p in sorted(SOR_SITE.rglob("package.json"))
        if "node_modules" not in p.parts and all(gen not in p.parents for gen in _GENERATED)
    ]
    return workspace + ([SHELL_MANIFEST] if SHELL_MANIFEST.exists() else [])


def test_a1_direct_runtime_deps_are_allowlisted() -> None:
    manifests = _manifests()
    assert manifests, f"no package.json found under {SOR_SITE} — did the workspace move?"
    violations: list[str] = []
    for manifest in manifests:
        data = json.loads(manifest.read_text())
        runtime = {**data.get("dependencies", {}), **data.get("peerDependencies", {})}
        for name in sorted(runtime):
            if name in ALLOWLIST_EXACT or name.startswith(ALLOWLIST_PREFIXES):
                continue
            violations.append(f"{manifest.relative_to(REPO)}: {name}")
    assert not violations, (
        "direct runtime deps outside the committed allowlist (specs/sor-site/surface/spec.md) — "
        "either the dep leaves or the allowlist grows in the same reviewed commit:\n"
        + "\n".join(violations)
    )


def test_a1_lockfile_contains_no_denylisted_name() -> None:
    assert LOCKFILE.exists(), (
        f"{LOCKFILE.relative_to(REPO)} is missing — the workspace lockfile is committed "
        "(settled lead decision); the denylist backstop scans it for transitive product deps"
    )
    text = LOCKFILE.read_text()
    hits = [name for name in DENYLIST if name in text]
    assert not hits, (
        f"denylisted names present in {LOCKFILE.relative_to(REPO)} (transitives included): {hits}"
    )


# --------------------------------------------------------------------------- A2
# The committed exclusion list — ONE file, packages/sor-site/e2e/tests/
# exclusions.json, consumed here (tier "source") and by the browser tier's B7
# bundle scan (tier "bundle") so the two scans can never drift again (they had —
# found 2026-08-13: B7's hand-maintained copy omitted a dozen A2 patterns and
# used case-exact brand strings). Row names mirror the spec's table; patterns
# are word-boundary and case-sensitive unless an entry says otherwise; dir rows
# (`progress/` …) match as path segments — in imports and in file paths.

EXCLUSIONS_FILE = SOR_SITE / "e2e" / "tests" / "exclusions.json"
_EXCLUSIONS_DATA = json.loads(EXCLUSIONS_FILE.read_text())


def _tier_patterns(tier: str) -> list[tuple[str, re.Pattern[str]]]:
    """(row label, compiled pattern) for every exclusion entry active in `tier`."""
    out: list[tuple[str, re.Pattern[str]]] = []
    for row in _EXCLUSIONS_DATA["rows"]:
        for entry in row["patterns"]:
            if isinstance(entry, str):
                pattern, tiers, flags = entry, ("source", "bundle"), ""
            else:
                pattern = entry["pattern"]
                tiers = tuple(entry.get("tiers", ("source", "bundle")))
                flags = entry.get("flags", "")
            if tier in tiers:
                out.append((row["row"], re.compile(pattern, re.IGNORECASE if "i" in flags else 0)))
    return out


# Spec A2: "ReadingProgress carved out of any progress pattern". The local scroll
# indicator is a kept content primitive; its name (and its stable data-attribute /
# token spelling) is removed from the text before any pattern runs.
_CARVE_OUTS: tuple[str, ...] = tuple(_EXCLUSIONS_DATA["carveOuts"]["tokens"])

# Directory/file names that must not exist in the shipped tree at all — catches
# excluded material arriving as files the content scan's extension filter skips.
EXCLUDED_PATH_NAMES = {
    "progress",
    "Feedback",
    "AdminFeedback",
    "admin",
    "explorers",
    "cheatsheets",
    "certifications",
    "onboarding",
    "profile",
    "DESIGN_SYSTEM.md",
}


def _a2_files() -> list[Path]:
    return _source_files(SOR_SITE) + _source_files(TEMPLATE_SITE)


def test_a2_exclusion_list_returns_zero_matches() -> None:
    patterns = _tier_patterns("source")
    assert patterns, f"no source-tier patterns in {EXCLUSIONS_FILE.relative_to(REPO)}"
    files = _a2_files()
    assert files, "A2 found no source files to scan — did packages/sor-site or the templates shell move?"
    violations: list[str] = []
    for path in files:
        text = path.read_text()
        for token in _CARVE_OUTS:
            text = text.replace(token, "")
        for line_no, line in enumerate(text.splitlines(), start=1):
            for row, pattern in patterns:
                if pattern.search(line):
                    violations.append(
                        f"{path.relative_to(REPO)}:{line_no} [{row}: {pattern.pattern}] {line.strip()[:80]}"
                    )
    assert not violations, (
        "excluded identifiers in shipped source (specs/sor-site/surface/spec.md, negative contract "
        "— the scan covers comments too; scrub or reword, never carry the name across the seam):\n"
        + "\n".join(violations)
    )


def test_a2_excluded_names_absent_from_paths() -> None:
    violations: list[str] = []
    for path in sorted(SOR_SITE.rglob("*")):
        if "node_modules" in path.parts or any(gen in path.parents or gen == path for gen in _GENERATED):
            continue
        if any(root in path.parents or root == path for root in _OUT_OF_SCOPE):
            continue
        if path.name in EXCLUDED_PATH_NAMES or path.name.startswith("docs-"):
            violations.append(str(path.relative_to(REPO)))
    assert not violations, (
        "excluded directory/file names present in the shipped tree:\n" + "\n".join(violations)
    )


# De-brand (settled lead decision, 2026-08-13): no upstream brand strings in
# shipped source — branding comes from the consuming site's config. The pattern
# lives in exclusions.json so the B7 bundle scan runs the identical one.
_BRAND_RE = re.compile(
    _EXCLUSIONS_DATA["brand"]["pattern"],
    re.IGNORECASE if "i" in _EXCLUSIONS_DATA["brand"].get("flags", "") else 0,
)


def test_a2_no_brand_strings_in_shipped_source() -> None:
    violations: list[str] = []
    for path in _a2_files():
        for line_no, line in enumerate(path.read_text().splitlines(), start=1):
            if _BRAND_RE.search(line):
                violations.append(f"{path.relative_to(REPO)}:{line_no} {line.strip()[:80]}")
    assert not violations, (
        "brand strings in shipped source (de-brand is part of the negative contract):\n"
        + "\n".join(violations)
    )


# ------------------------------------------------- A2, markdown tier (scaffold)
# The scans above read .ts/.tsx/.js/.css and never a word of prose — which was
# fine while the scaffold held one hand-written SKILL.md, and stopped being fine
# on 2026-08-14, when 12 more SKILL.md files and 4 .claude/rules crossed from an
# ~80-skill CURRICULUM repo. Prose is exactly where a brand name or a
# lesson/chapter vocabulary survives a copy, and nothing in CI could see it.
# Patterns live in the same committed exclusions.json as every other tier.

SCAFFOLD = REPO / "packages" / "vsor" / "src" / "vsor" / "templates" / "scaffold"
_SCAFFOLD_MD = _EXCLUSIONS_DATA["scaffoldMarkdown"]
_CURRICULUM_RE = re.compile(_SCAFFOLD_MD["curriculumPattern"], re.IGNORECASE)
_BRAND_CARVE_OUTS = _SCAFFOLD_MD["brandCarveOuts"]


def _scaffold_prose_files() -> list[Path]:
    files = [p for p in sorted(SCAFFOLD.rglob("*")) if p.is_file() and p.suffix in {".md", ".json"}]
    # The shell's own markdown, added 2026-08-14. The .ts/.tsx/.js/.css tier
    # cannot see a README, so packages/sor-site/app/README.md — which ships
    # inside the tarball unpacked into every user's .vsor/site-runtime — was
    # the one shipped file no scan of any tier read.
    # `knowledge/` is excluded for the reason the spec gives A2 generally: it is
    # a CORPUS (a gitignored local one, placed beside the shell for a hand
    # build), and the scan never reads a corpus.
    corpus = SOR_SITE / "knowledge"
    files += [
        p
        for p in sorted(SOR_SITE.rglob("*.md"))
        if "node_modules" not in p.parts
        and corpus not in p.parents
        and all(root not in p.parents for root in _OUT_OF_SCOPE)
        and all(gen not in p.parents for gen in _GENERATED)
    ]
    return files


def _brand_carved_out(path: Path, line: str) -> bool:
    """True when this exact line is a recorded exception for this exact file."""
    return any(
        path.name == entry["file"] and entry["contains"] in line for entry in _BRAND_CARVE_OUTS
    )


def test_a2_scaffold_prose_carries_no_brand_strings() -> None:
    files = _scaffold_prose_files()
    assert files, f"no scaffold prose found under {SCAFFOLD.relative_to(REPO)} — did it move?"
    violations: list[str] = []
    for path in files:
        for line_no, line in enumerate(path.read_text().splitlines(), start=1):
            if _BRAND_RE.search(line) and not _brand_carved_out(path, line):
                violations.append(f"{path.relative_to(REPO)}:{line_no} {line.strip()[:80]}")
    assert not violations, (
        "brand strings in the scaffolded project — a vsor project belongs to its owner and names "
        "nobody else; the one recorded exception is the framework's own repo URL "
        "(exclusions.json scaffoldMarkdown.brandCarveOuts):\n" + "\n".join(violations)
    )


def test_a2_scaffold_prose_carries_no_curriculum_vocabulary() -> None:
    """The skills crossed from a curriculum repo; a tax-law SoR must not find
    lesson/chapter/learner language in the kit it was scaffolded with."""
    violations: list[str] = []
    for path in _scaffold_prose_files():
        for line_no, line in enumerate(path.read_text().splitlines(), start=1):
            match = _CURRICULUM_RE.search(line)
            if match:
                violations.append(
                    f"{path.relative_to(REPO)}:{line_no} [{match.group(0)}] {line.strip()[:80]}"
                )
    assert not violations, (
        "curriculum vocabulary in the scaffolded project (settled lead decision 2026-08-13: the "
        "corpus-generic skills cross de-branded AND de-curriculum'd — a governed corpus is "
        "documents, not lessons):\n" + "\n".join(violations)
    )


# --------------------------------------------------------------------------- A3

_COLOR_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(")


def test_a3_zero_color_literals_outside_token_files() -> None:
    for token_file in TOKEN_FILES:
        assert token_file.exists(), f"designated token file missing: {token_file.relative_to(REPO)}"
    violations: list[str] = []
    for path in _source_files(SOR_SITE) + _source_files(TEMPLATE_SITE):
        if path.suffix != ".css" or path in TOKEN_FILES:
            continue
        for line_no, line in enumerate(path.read_text().splitlines(), start=1):
            if _COLOR_RE.search(line):
                violations.append(f"{path.relative_to(REPO)}:{line_no} {line.strip()[:80]}")
    names = ", ".join(str(f.relative_to(REPO)) for f in TOKEN_FILES)
    assert not violations, (
        f"raw color literals outside the designated token files ({names}) — every color becomes a "
        "named token there and the site consumes var(--…) (spec: token discipline, baseline zero):\n"
        + "\n".join(violations)
    )


# --------------------------------------------------------------------------- A4


def test_a4_prop_types_match_frozen_baseline() -> None:
    assert PROP_MODULE.exists(), f"prop-type module missing: {PROP_MODULE.relative_to(REPO)}"
    assert BASELINE.exists(), f"frozen baseline missing: {BASELINE.relative_to(REPO)}"
    assert PROP_MODULE.read_bytes() == BASELINE.read_bytes(), (
        f"{PROP_MODULE.relative_to(REPO)} differs from the frozen baseline "
        f"{BASELINE.relative_to(REPO)} — the primitive prop contract is pinned; changing it means "
        "updating the baseline in the same reviewed change AND touching specs/sor-site/surface/spec.md"
    )


# ------------------------------------------------------- fixture preconditions
# The spec's Phase B builds against fixtures/tiny and relies on two properties
# of the corpus itself; both are pure source assertions, so they gate here.

_EXTERNAL_RE = re.compile(r"https?://|\bwww\.")
_SEARCH_PHRASE = "abstention floor"  # B13 types this into SearchBar; unique to one doc


def test_fixture_corpus_contains_no_external_references() -> None:
    hits: list[str] = []
    for path in sorted(FIXTURE.rglob("*")):
        if not path.is_file():
            continue
        for line_no, line in enumerate(path.read_text().splitlines(), start=1):
            if _EXTERNAL_RE.search(line):
                hits.append(f"{path.relative_to(REPO)}:{line_no} {line.strip()[:80]}")
    assert not hits, (
        "external references in the fixture corpus — B8's 'anything found is theme-introduced' "
        "argument requires the corpus itself to be external-reference-free:\n" + "\n".join(hits)
    )


def test_fixture_unique_search_phrase_appears_exactly_once() -> None:
    occurrences = [
        path.relative_to(REPO)
        for path in sorted(FIXTURE.rglob("*.md"))
        for _ in range(path.read_text().count(_SEARCH_PHRASE))
    ]
    assert len(occurrences) == 1, (
        f"the unique search phrase {_SEARCH_PHRASE!r} must appear exactly once in fixtures/tiny "
        f"(B13 asserts one search hit linking to that doc); found {len(occurrences)}: {occurrences}"
    )
