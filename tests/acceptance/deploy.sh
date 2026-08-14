#!/usr/bin/env bash
# The HOSTING-LAYOUT acceptance: the two shapes a static host has, proved end to
# end through the real `vsor build` and a real browser.
#
# A built site is uploaded somewhere, and "somewhere" has exactly two shapes:
#
#   root     Vercel, Netlify, S3+CloudFront, nginx — the build IS the document
#            root and the site is served at "/". baseUrl "/".
#   subpath  a GitHub Pages project site, or any internal path — the build sits
#            at <docroot>/<name>/ and is reached at "/<name>/". Docusaurus
#            prefixes every asset, route and router link with `baseUrl`, so a
#            baseUrl that does not match the path 404s the whole site.
#
# They fail differently, which is why both are here. The root shape fails
# QUIETLY, in the machine-readable half: `url` is baked into sitemap.xml, every
# canonical link, og:url and the JSON-LD, so a build made with the scaffold's
# placeholder renders perfectly while telling crawlers it lives on the machine
# that built it. The subpath shape fails LOUDLY: nothing loads at all.
#
# What this script owns and what it delegates:
#   - here: the user's actual sequence — `vsor init`, edit two lines of
#     site/docusaurus.config.ts, `vsor build` — run twice through the real wheel;
#     staging each output in the shape its host would have; and the two rows that
#     need both builds at once (the record distinguishes them; the published
#     route set is the same modulo prefix).
#   - Playwright (packages/sor-site/e2e/deploy, config playwright.deploy.config.ts):
#     everything about one shape — the file tier (S1, S2), the browser tier
#     (D1–D5), the metadata tier (D6, D7) and the host's own view (D8, D9).
#
# The subpath server serves the PARENT directory. That is the whole point: the
# site genuinely lives under the prefix instead of being pretend-nested by a
# rewrite, and D9 proves the harness is honest about it.
#
# Pattern follows tests/acceptance/build.sh: REPO resolved absolute from this
# script's own location, VSOR_DEV_VERSION defaulted to the pre-publish stamp, all
# work in a mktemp scratch a trap removes, every assertion carrying a named fail
# message. No `set -e` for the same reason build.sh gives — rows capture exit
# codes rather than dying on them. `set -u` stays on.
#
# Node lane: needs node + npm on PATH, the network for the first `npm ci`, and
# the Playwright workspace already installed. It stages the same shared paths
# `make wheel` always stages (packages/vsor/src/vsor/_site_runtime, and npm ci in
# packages/sor-site), so it is not safe to run concurrently with `make surface`
# or `make build-acceptance` on the same checkout.
#
#   VSOR_WHEEL=<path>   reuse an already-built wheel instead of running
#                       `make wheel` + `uv build` (the wheel is copied to a
#                       unique scratch path either way — init.sh's found-live
#                       uvx-cache lesson: a stable wheel path can install a
#                       previous run's bytes and certify code that is gone).

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
E2E="$REPO/packages/sor-site/e2e"
SITE_WS="$REPO/packages/sor-site"

export VSOR_DEV_VERSION="${VSOR_DEV_VERSION:-0.1.0}"

# The two shapes, decided once. Both hosts are https origins that are NOT the
# machine serving them — which is what makes "the metadata names the real host"
# a claim with content rather than a tautology. One organisation, two hosting
# choices, so the pair reads as one story.
#
# Deliberately NOT example.com or a reserved TLD: `vsor build` warns when the
# url it just baked in is a placeholder, and an acceptance whose whole subject
# is a correctly configured deploy should not be tripping that warning. The
# GitHub Pages origin is the canonical subpath case — a project site is served
# at /<repo>/ and nowhere else.
PROJECT="deploydemo"
ROOT_HOST="https://sor.acme-legal.com"
ROOT_BASE="/"
SUB_HOST="https://acme-legal.github.io"
SUB_BASE="/$PROJECT/"
PARENT_MARKER="PARENT-ROOT.txt"

# The second document. The scaffold ships one, and one document cannot prove a
# sidebar navigation or a search result — so this acceptance writes the second
# itself and owns its heading and its phrase.
DOC_A="docs/example"
DOC_B="docs/deploy-shapes"
DOC_B_H1="Deployment shapes"
PHRASE="cutover rehearsal"

SCRATCH="$(mktemp -d)"

pids=()
cleanup() {
  for p in ${pids[@]+"${pids[@]}"}; do kill "$p" 2>/dev/null || true; done
  rm -rf "$SCRATCH"
}
trap cleanup EXIT INT TERM

# Two kinds of red, because they mean different things here.
#
# `fail` is structural — a build did not happen, a server did not start, the
# harness is not what it claims. Nothing after it is worth measuring, so it exits.
#
# `note` is an independent assertion. The rows in this script are cross-shape and
# the Playwright tiers are per-shape; one failing tells you nothing about the
# others, and a driver that stopped at the first one would hide the rest of the
# picture on exactly the run where the whole picture is what you need. They
# accumulate and the script exits 1 at the end, listing every one.
#
# A counter plus a string rather than an array: bash 3.2 (what macOS ships as
# /bin/bash) treats an EMPTY array as unset under `set -u`, so the happy path —
# nothing recorded — would be the one that dies.
failure_count=0
failures=""
note() {
  failure_count=$((failure_count + 1))
  failures="${failures}  - $*
"
  echo "deploy acceptance RED: $*" >&2
}

fail() {
  echo "deploy acceptance FAIL: $*" >&2
  exit 1
}

# --- preflight: the browser tier's workspace, before anything expensive --------

[ -x "$SITE_WS/node_modules/.bin/playwright" ] \
  || fail "@playwright/test not installed — run: (cd packages/sor-site && npm ci && npx playwright install chromium)"
command -v python3 >/dev/null 2>&1 \
  || fail "python3 not found — it serves the built sites (python3 -m http.server)"

# --- the wheel ----------------------------------------------------------------

mkdir -p "$SCRATCH/wheel"
if [ -n "${VSOR_WHEEL:-}" ]; then
  [ -f "$VSOR_WHEEL" ] || fail "VSOR_WHEEL=$VSOR_WHEEL does not exist"
  cp "$VSOR_WHEEL" "$SCRATCH/wheel/" || fail "could not stage VSOR_WHEEL"
else
  make -C "$REPO" wheel >"$SCRATCH/wheel-stage.log" 2>&1 \
    || { tail -n 40 "$SCRATCH/wheel-stage.log" >&2
         fail "'make wheel' failed — the site-runtime staging step must precede this acceptance"; }
  uv build --directory "$REPO" --package vsor --wheel -o "$SCRATCH/wheel" >/dev/null 2>&1 \
    || fail "could not build the vsor wheel"
fi
WHEEL="$(set -- "$SCRATCH"/wheel/vsor-*.whl && echo "$1")"
[ -f "$WHEEL" ] || fail "no wheel at $SCRATCH/wheel"

VSOR() { uvx --from "$WHEEL" vsor "$@"; }

# --- server plumbing (build.sh's poll pattern: bounded polls, no bare sleeps) --

serve() {
  local dir="$1" log="$2" port="" i
  python3 -u -m http.server 0 --bind 127.0.0.1 --directory "$dir" >"$log" 2>&1 &
  pids+=($!)
  for i in $(seq 1 200); do
    port="$(sed -n 's/.*port \([0-9]\{1,\}\).*/\1/p' "$log" | head -n 1)"
    [ -n "$port" ] && break
    sleep 0.05
  done
  [ -n "$port" ] || fail "static server for $dir never reported its port"
  SERVED_URL="http://127.0.0.1:$port"
}

# set_host <url> <baseUrl> — the user's actual edit, as a counted whole-line
# replacement. Whole-line and counted for the reason build.sh's config-edit row
# learned live: a substring match on `url:`/`baseUrl:` finds nested keys too, and
# a scaffold that changes shape must fail this loudly rather than silently
# editing nothing and leaving the row certifying the placeholder.
set_host() {
  python3 - "$1" "$2" <<'PY' || fail "could not set url/baseUrl in site/docusaurus.config.ts"
import pathlib, sys

url, base = sys.argv[1], sys.argv[2]
path = pathlib.Path("site/docusaurus.config.ts")
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)


def one(prefix: str) -> int:
    hits = [i for i, line in enumerate(lines) if line.startswith(prefix)]
    assert len(hits) == 1, f"expected exactly one line starting {prefix!r}, found {len(hits)}"
    return hits[0]


lines[one("  url: ")] = f'  url: "{url}",\n'
lines[one("  baseUrl: ")] = f'  baseUrl: "{base}",\n'
path.write_text("".join(lines), encoding="utf-8")
PY
}

# --- the user's sequence: init, write a document, edit two lines, build --------

cd "$SCRATCH" || exit 1
VSOR init "$PROJECT" >init.out 2>&1 || { cat init.out >&2; fail "'vsor init $PROJECT' did not exit 0"; }
cd "$PROJECT" || exit 1

cat > knowledge/deploy-shapes.md <<EOF
---
title: $DOC_B_H1
description: The two shapes a static host has, and what each one needs.
---

# $DOC_B_H1

A built site is uploaded somewhere, and somewhere has two shapes. At a root host
the site is the document root. At a subpath host it lives under a prefix, and
every asset and link has to carry that prefix.

Rehearse the move before it is real: a $PHRASE against the actual host catches
the half of a deploy that a local preview cannot show — the sitemap, the
canonical links and the link-preview tags, which name a host rather than a path.
EOF

# Layout A — a root host.
set_host "$ROOT_HOST" "$ROOT_BASE"
VSOR build >build-root.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-root.out >&2; fail "root-host build: expected exit 0, got $rc"; }
test -f build/index.html || fail "root-host build produced no build/index.html"
mkdir -p "$SCRATCH/hosts"
cp -R build "$SCRATCH/hosts/root" || fail "could not stage the root-host build"
cp build.lock.json "$SCRATCH/lock-root.json" || fail "root-host build wrote no build.lock.json"

# Layout B — a subpath host. Staged UNDER a parent directory, which is what the
# static server will hand out as "/", so the site really is reached at the prefix.
set_host "$SUB_HOST" "$SUB_BASE"
VSOR build >build-sub.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-sub.out >&2; fail "subpath-host build: expected exit 0, got $rc"; }
test -f build/index.html || fail "subpath-host build produced no build/index.html"
mkdir -p "$SCRATCH/hosts/subpath"
cp -R build "$SCRATCH/hosts/subpath/$PROJECT" || fail "could not stage the subpath-host build"
printf 'The document root. The site lives under /%s/.\n' "$PROJECT" > "$SCRATCH/hosts/subpath/$PARENT_MARKER"
cp build.lock.json "$SCRATCH/lock-sub.json" || fail "subpath-host build wrote no build.lock.json"

# --- the two rows that need both builds at once -------------------------------

# The record distinguishes them. `build_id` hashes the site tree among its
# inputs, so changing where the site is deployed to is a different build — if it
# were not, a lock file could not tell a localhost build from a published one.
python3 - "$SCRATCH/lock-root.json" "$SCRATCH/lock-sub.json" <<'PY' || note "build.lock.json does not distinguish the two deploy targets"
import json, sys

root, sub = (json.load(open(p)) for p in sys.argv[1:3])
assert root["build_id"] != sub["build_id"], (
    "the two builds share a build_id — a change to site/docusaurus.config.ts "
    "(url and baseUrl) must be part of the build's identity"
)
assert root["corpus"]["tree"] == sub["corpus"]["tree"], (
    "the corpus did not change between the two builds; only the site config did"
)
PY

# The published route set is the same in both shapes, modulo the public root.
# This is the shape-invariance row: anything whose INCLUSION depends on baseUrl —
# a sitemap ignore pattern written as an absolute path, a route emitted only at
# "/" — shows up here as a set difference, and nowhere else.
python3 - "$SCRATCH/hosts/root/sitemap.xml" "$SCRATCH/hosts/subpath/$PROJECT/sitemap.xml" \
         "$ROOT_HOST$ROOT_BASE" "$SUB_HOST$SUB_BASE" <<'PY' || note "the two shapes publish different route sets"
import re, sys

def routes(path, public_root):
    text = open(path, encoding="utf-8").read()
    locs = re.findall(r"<loc>([^<]+)</loc>", text)
    assert locs, f"{path} has no <loc> entries"
    outside = [loc for loc in locs if not loc.startswith(public_root)]
    assert not outside, f"{path}: {outside} not under {public_root}"
    return {loc[len(public_root):] for loc in locs}

a = routes(sys.argv[1], sys.argv[3])
b = routes(sys.argv[2], sys.argv[4])
assert a == b, (
    f"root-only routes: {sorted(a - b)}; subpath-only routes: {sorted(b - a)} — "
    "a route's presence in the sitemap must not depend on where the site is deployed"
)
PY

# --- serve each shape the way its host would ----------------------------------

serve "$SCRATCH/hosts/root" "$SCRATCH/root.server.log"
ROOT_URL="$SERVED_URL"
serve "$SCRATCH/hosts/subpath" "$SCRATCH/subpath.server.log"
SUB_URL="$SERVED_URL"

# Two cheap smoke rows before handing over to Playwright, so a harness mistake
# (serving the wrong directory) is named here rather than as twelve browser
# failures.
curl -fsS "$ROOT_URL/" >/dev/null || fail "root shape: GET / did not answer 200"
curl -fsS "$SUB_URL$SUB_BASE" >/dev/null || fail "subpath shape: GET $SUB_BASE did not answer 200"
curl -fsS "$SUB_URL/$PARENT_MARKER" >/dev/null \
  || fail "subpath shape: the served document root is not the site's PARENT directory"

# --- the browser, file and metadata tiers -------------------------------------

export VSOR_DEPLOY_ROOT_URL="$ROOT_URL"
export VSOR_DEPLOY_ROOT_BASE="$ROOT_BASE"
export VSOR_DEPLOY_ROOT_HOST="$ROOT_HOST"
export VSOR_DEPLOY_ROOT_DIR="$SCRATCH/hosts/root"

export VSOR_DEPLOY_SUBPATH_URL="$SUB_URL"
export VSOR_DEPLOY_SUBPATH_BASE="$SUB_BASE"
export VSOR_DEPLOY_SUBPATH_HOST="$SUB_HOST"
export VSOR_DEPLOY_SUBPATH_DIR="$SCRATCH/hosts/subpath/$PROJECT"
export VSOR_DEPLOY_PARENT_MARKER="$PARENT_MARKER"

export VSOR_DEPLOY_TITLE="$PROJECT"
export VSOR_DEPLOY_DOC_A="$DOC_A"
export VSOR_DEPLOY_DOC_B="$DOC_B"
export VSOR_DEPLOY_DOC_B_H1="$DOC_B_H1"
export VSOR_DEPLOY_PHRASE="$PHRASE"

cd "$E2E" || exit 1
"$SITE_WS/node_modules/.bin/playwright" test --config playwright.deploy.config.ts "$@" \
  || note "the file/browser/metadata tiers failed — see the Playwright output above"

if [ "$failure_count" -gt 0 ]; then
  printf '\ndeploy acceptance: %d red:\n%s' "$failure_count" "$failures" >&2
  exit 1
fi

echo "deploy acceptance: green"
