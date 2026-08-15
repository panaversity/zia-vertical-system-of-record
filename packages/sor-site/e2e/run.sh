#!/usr/bin/env bash
# Browser-tier driver for specs/sor-site/surface/spec.md (B5–B15).
# Invoked by `make surface`; CI runs it after `npm ci` + `npx playwright install chromium`.
#
# Flow: assemble two fixture sites (normal + sentinel) in the MATERIALIZED shape —
# the forked shell as siteDir, the init scaffold as its `site/`, tests/fixtures/tiny as
# its `knowledge/` → `docusaurus build` each with the shell's own env seams pointed
# at those trees → serve each build with `python3 -m http.server` on an ephemeral
# 127.0.0.1 port → run the single Playwright suite.
#
# Two builds, not four: the stock/themed axis died with the fork. "Stock
# preset-classic" meant a scaffold that deleted the separate design-system theme
# package from its own `themes` array; `themes` is now a key the shell owns and
# drops from a project's config, the design system lives inside the shell itself,
# and that theme package was deleted on 2026-08-14. There is no configuration a
# vsor project can produce that lacks it, so there is none to build here. B14 is
# retired in the spec; B15's control probe replaced what it was standing in for.
#
# Determinism notes:
#   - ports are ephemeral (http.server binds port 0 and reports what it got; we
#     parse the bound port from its log — race-free, no pre-picked ports)
#   - the only wait outside Playwright's DOM auto-wait is a bounded poll for the
#     server's "port NNNN" log line at startup; the browser tests themselves use
#     no timing sleeps
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"     # packages/sor-site/e2e
site_ws="$(dirname "$here")"                             # packages/sor-site
repo_root="$(cd "$site_ws/../.." && pwd)"                # the repository

# OUTSIDE the repository, and that is the point. This used to be `$here/.scratch` —
# under packages/sor-site — so Node's resolution walked up from the fixture into
# packages/sor-site/node_modules for anything the fixture lacked. Installing the shipped
# tree (below) fixes what the fixture HAS; it does not stop a missing module resolving
# silently from the workspace, which is the same "the tier sees something the artifact
# cannot" failure in its quietest form. A real `vsor build` runs under the user's project
# with no such ancestor, and `tests/acceptance/build.sh` has always used mktemp for the
# same reason. Set VSOR_E2E_KEEP=1 to leave the tree behind for a post-mortem.
scratch="$(mktemp -d)"

# Preflight. Playwright is a WORKSPACE tool — it drives the browser and is no part of
# what ships — while the site under test is built by the shipped tree, installed below.
if [ ! -f "$repo_root/packages/vsor/src/vsor/_site_runtime/package-lock.json" ]; then
  echo "error: no staged site runtime — run: make wheel" >&2
  echo "  (\`make surface\` does this for you via build-acceptance; a bare run.sh does not)" >&2
  exit 1
fi
if [ ! -x "$site_ws/node_modules/.bin/playwright" ]; then
  echo "error: @playwright/test not installed — run: (cd packages/sor-site && npm ci && npx playwright install chromium)" >&2
  exit 1
fi
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found — it serves the built sites (python3 -m http.server)" >&2; exit 1; }

builds=(site site-sentinel)

pids=()
cleanup() {
  for p in ${pids[@]+"${pids[@]}"}; do kill "$p" 2>/dev/null || true; done
  if [ -n "${VSOR_E2E_KEEP:-}" ]; then
    echo "surface: fixture kept at $scratch (VSOR_E2E_KEEP)" >&2
  else
    rm -rf "$scratch"
  fi
}
# Armed before anything is assembled, so a failure in the assemble or install steps
# does not leave a ~1300-package tree in the system temp directory.
trap cleanup EXIT INT TERM

echo "surface: fixture root $scratch"
node "$here/scripts/assemble.mjs" --out "$scratch/site"
node "$here/scripts/assemble.mjs" --sentinel --out "$scratch/site-sentinel"

# Environment parity with site_runtime.runtime_env(), which strips every VSOR_* before
# handing the environment to Docusaurus. Six of them decide a site's published identity
# (title, tagline, url, baseUrl, favicon, social image), so an ambient export in a
# developer's shell or a CI job could steer this fixture in a way it can never steer a
# real build — the tier would be measuring something no user can produce. The two seams
# the materialized layout genuinely needs are set per-command below, as runtime_env sets
# them, and VSOR_E2E_* are exported later for the harness rather than read by any build.
while IFS= read -r stray; do unset "$stray"; done < <(
  env | sed -n 's/^\(VSOR_[A-Za-z0-9_]*\)=.*/\1/p'
)

# The shipped tree, installed the way `vsor build` installs it: `npm ci` against the
# lockfile the wheel carries, in the directory being built. Before 2026-08-15 this ran
# the WORKSPACE's docusaurus against packages/sor-site/node_modules, and the two trees
# disagreed on 65 packages — including lightningcss (the CSS minimizer) and @swc/core
# (the JS loader and minifier). A tier that compiles with a different compiler than the
# artifact cannot see a compiler defect, which is exactly how 0.1.2 shipped a flattened
# design system through 42 green checks.
#
# It costs an npm ci per build. That is the price of the tier testing the artifact, and
# the repo already pays it in build-acceptance; `npm ci` is offline once the cache is warm.
for b in "${builds[@]}"; do
  echo "surface: installing the shipped runtime for $b"
  (cd "$scratch/$b/site-runtime" && npm ci --no-audit --no-fund)
done

# The two env seams site_runtime.runtime_env() sets for `vsor build`, set here for
# the same reason: the shell defaults to SIBLING ../site and ../knowledge (what it
# has in its own workspace) and the materialized layout puts both INSIDE it.
for b in "${builds[@]}"; do
  echo "surface: building $b"
  (cd "$scratch/$b/site-runtime" \
     && VSOR_SITE_DIR=./site VSOR_KNOWLEDGE_DIR=./knowledge \
        ./node_modules/.bin/docusaurus build)
done

# serve <build-dir> <log-file>; sets SERVED_URL. Ephemeral port: bind 0, parse
# the port http.server reports once it is already listening.
serve() {
  local dir="$1" log="$2" port="" i
  # -u: unbuffered stdout, so the "port NNNN" line reaches the log immediately
  python3 -u -m http.server 0 --bind 127.0.0.1 --directory "$dir" >"$log" 2>&1 &
  pids+=($!)
  for i in $(seq 1 200); do
    port="$(sed -n 's/.*port \([0-9]\{1,\}\).*/\1/p' "$log" | head -n 1)"
    [ -n "$port" ] && break
    sleep 0.05
  done
  if [ -z "$port" ]; then
    echo "error: static server for $dir never reported its port; log follows" >&2
    cat "$log" >&2
    exit 1
  fi
  SERVED_URL="http://127.0.0.1:$port"
}

for b in "${builds[@]}"; do
  build_dir="$scratch/$b/site-runtime/build"
  [ -f "$build_dir/index.html" ] || { echo "error: $build_dir has no index.html — docusaurus build produced nothing" >&2; exit 1; }
  serve "$build_dir" "$scratch/$b.server.log"
  echo "surface: serving $b at $SERVED_URL"
  case "$b" in
    site)           export VSOR_E2E_SITE_URL="$SERVED_URL"          VSOR_E2E_SITE_DIR="$scratch/$b" ;;
    site-sentinel)  export VSOR_E2E_SITE_SENTINEL_URL="$SERVED_URL" VSOR_E2E_SITE_SENTINEL_DIR="$scratch/$b" ;;
  esac
done

cd "$here"
"$site_ws/node_modules/.bin/playwright" test "$@"
