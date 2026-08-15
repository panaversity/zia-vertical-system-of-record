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
scratch="$here/.scratch"

# Preflight — this script installs nothing; errors carry the remedy.
if [ ! -x "$site_ws/node_modules/.bin/docusaurus" ]; then
  echo "error: workspace not installed — run: (cd packages/sor-site && npm ci && npx playwright install chromium)" >&2
  exit 1
fi
if [ ! -x "$site_ws/node_modules/.bin/playwright" ]; then
  echo "error: @playwright/test not installed — run: (cd packages/sor-site && npm ci && npx playwright install chromium)" >&2
  exit 1
fi
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found — it serves the built sites (python3 -m http.server)" >&2; exit 1; }

builds=(site site-sentinel)

rm -rf "$scratch"
node "$here/scripts/assemble.mjs" --out "$scratch/site"
node "$here/scripts/assemble.mjs" --sentinel --out "$scratch/site-sentinel"

# The two env seams site_runtime.runtime_env() sets for `vsor build`, set here for
# the same reason: the shell defaults to SIBLING ../site and ../knowledge (what it
# has in its own workspace) and the materialized layout puts both INSIDE it.
for b in "${builds[@]}"; do
  echo "surface: building $b"
  (cd "$scratch/$b/site-runtime" \
     && VSOR_SITE_DIR=./site VSOR_KNOWLEDGE_DIR=./knowledge \
        "$site_ws/node_modules/.bin/docusaurus" build)
done

pids=()
cleanup() {
  for p in ${pids[@]+"${pids[@]}"}; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

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
