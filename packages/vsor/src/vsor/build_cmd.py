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
import ipaddress
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

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
