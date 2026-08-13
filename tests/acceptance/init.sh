#!/usr/bin/env bash
# The acceptance for specs/vsor/init/spec.md, operationalized.
#
# The spec's script is verbatim-relative ("uvx --from packages/vsor", run from the repo
# root, artifacts dropped in the cwd). This file keeps every assertion, in order, in
# spirit, and makes it runnable from anywhere: REPO is resolved from this script's own
# location, the vsor entry point is wrapped once in VSOR(), and all work happens in a
# throwaway scratch directory that a trap removes. Each assertion carries a named fail
# message so a red run says which clause broke, not just "diff failed".
#
# No `set -e`: several spec lines EXPECT a non-zero exit (error: exists, error: bad-name)
# and their codes must be captured, not fatal. Every command's outcome is asserted
# explicitly instead. `set -u` stays on.
#
# CI runs this with networking disabled (UV_OFFLINE=1, cache warmed first) — the spec
# requires it, because init itself must perform no network I/O.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The dev/CI stamp: the packaged version is a placeholder (0.0.0) until publish, and the
# spec refuses placeholder versions unless the harness supplies one. Same default as the
# Makefile export; an explicit caller value wins.
export VSOR_DEV_VERSION="${VSOR_DEV_VERSION:-0.1.0}"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

# found live: `uvx --from "$REPO/packages/vsor" vsor` can serve a STALE cached environment —
# uv keys directory builds on pyproject.toml's mtime (not source contents) and the uvx
# environment cache does not revalidate them (--refresh-package, --isolated and a touched
# pyproject.toml all still served the pre-implementation wheel; --no-cache works but breaks
# under UV_OFFLINE). So the harness builds the current tree's wheel into the scratch dir —
# local work, offline-safe once caches are warm — and runs vsor from that wheel: the path is
# unique per run, so no cached environment can ever be reused. This also proves the wheel
# itself ships the templates the scaffold copies from.
uv build --directory "$REPO" --package vsor --wheel -o "$SCRATCH/wheel" >/dev/null 2>&1 \
  || { echo "acceptance FAIL: could not build the vsor wheel" >&2; exit 1; }
WHEEL="$(set -- "$SCRATCH"/wheel/vsor-*.whl && echo "$1")"

VSOR() { uvx --from "$WHEEL" vsor "$@"; }

cd "$SCRATCH" || exit 1

fail() {
  echo "acceptance FAIL: $*" >&2
  exit 1
}

# --- the happy path: vsor init demo ------------------------------------------------

VSOR init demo > out.txt || fail "'vsor init demo' did not exit 0"

grep -q 'AGENTS.md' out.txt || fail "handoff: success stdout does not mention AGENTS.md"
grep -q 'vsor dev' out.txt || fail "handoff: success stdout does not mention 'vsor dev'"

# The scaffold tree, exactly — nothing missing, nothing extra (`.git/` pruned).
diff <(find demo -path demo/.git -prune -o -type f -print | LC_ALL=C sort) - <<'EOF' \
  || fail "scaffold tree differs from the contract's exact file list"
demo/.agents/skills/add-sources/SKILL.md
demo/.env
demo/.gitignore
demo/AGENTS.md
demo/CLAUDE.md
demo/instance.md
demo/knowledge/example.md
demo/site/docusaurus.config.ts
demo/site/src/css/custom.css
demo/site/src/pages/index.tsx
EOF

test -z "$(find demo -not -path 'demo/.git*' -type d -empty)" \
  || fail "empty directory exists outside .git/"

# wc -l pads with leading spaces; the numeric -eq comparison absorbs them.
test "$(git -C demo log --oneline | wc -l)" -eq 1 || fail "fresh repo does not hold exactly one commit"
test "$(git -C demo symbolic-ref --short HEAD)" = "main" || fail "fresh repo branch is not main"
git -C demo check-ignore -q .env || fail ".env is not ignored in the fresh repo"
test -z "$(git -C demo status --porcelain)" || fail "working tree not clean — something uncommitted or untracked"

# --- refusals ----------------------------------------------------------------------

VSOR init demo >/dev/null 2>err
rc=$?
test "$rc" -eq 1 || fail "re-init of an existing project: expected exit 1, got $rc"
grep -q '^error: exists' err || fail "re-init: stderr first line is not the 'error: exists' slug"

VSOR init 'My SoR' >/dev/null 2>err
rc=$?
test "$rc" -eq 1 || fail "bad name 'My SoR': expected exit 1, got $rc"
grep -q '^error: bad-name' err || fail "bad name: stderr first line is not the 'error: bad-name' slug"

# --- an empty named target is accepted ---------------------------------------------

mkdir blank || fail "mkdir blank"
VSOR init blank >/dev/null || fail "empty named target 'blank' was refused"

# --- inside an existing work tree: no nested repo, nothing committed ---------------

git init -q -b main parent || fail "git init parent"
(cd parent && VSOR init notes >/dev/null) || fail "init inside an existing repo did not exit 0"
test ! -e parent/notes/.git || fail "nested .git created inside the enclosing repo"
test "$(git -C parent log --oneline 2>/dev/null | wc -l)" -eq 0 \
  || fail "a commit was made into the enclosing (parent) repo"

# --- the fresh-GitHub-clone path: in-place, allowlisted files, .gitignore merge ----

mkdir gh && touch gh/README.md gh/.DS_Store || fail "gh fixture setup"
printf 'node_modules/\n' > gh/.gitignore || fail "gh .gitignore fixture"
git init -q gh || fail "git init gh"
(cd gh && VSOR init . >/dev/null) || fail "in-place init on a fresh clone did not exit 0"
grep -q 'node_modules/' gh/.gitignore || fail ".gitignore merge dropped the existing ignore lines"
git -C gh check-ignore -q .env || fail ".env is not ignored after the .gitignore merge"

# --- determinism: same name + same version => byte-identical trees -----------------

mkdir A B || fail "mkdir A B"
(cd A && VSOR init demo >/dev/null) || fail "determinism run A failed"
(cd B && VSOR init demo >/dev/null) || fail "determinism run B failed"
diff -r --exclude=.git A/demo B/demo || fail "two inits of the same name produced different bytes"

# --- the bare form: instructional screen, exit 0, never scaffolds ------------------

mkdir bare || fail "mkdir bare"
(cd bare && VSOR init > ../bare.txt)
rc=$?
test "$rc" -eq 0 || fail "bare 'vsor init': expected exit 0, got $rc"
test -s bare.txt || fail "bare 'vsor init' printed nothing (one instructional screen expected)"
test -z "$(ls -A bare)" || fail "bare 'vsor init' scaffolded files"

echo "acceptance: green"
