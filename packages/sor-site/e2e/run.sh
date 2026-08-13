#!/usr/bin/env bash
# Browser-tier driver for specs/sor-site/surface/spec.md (B5–B14).
# Invoked by `make surface`; CI runs it after `npm ci` + `npx playwright install chromium`.
#
# Flow: assemble four fixture sites (stock/themed × normal/sentinel) from the
# vsor init scaffold + fixtures/tiny → `docusaurus build` each → serve each build
# with `python3 -m http.server` on an ephemeral 127.0.0.1 port → run the single
# Playwright suite once, with a project per variant (B14: identical suite, both
# configs; each project also gets its sentinel server for B12).
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

builds=(stock stock-sentinel themed themed-sentinel)

rm -rf "$scratch"
node "$here/scripts/assemble.mjs" --variant stock  --out "$scratch/stock"
node "$here/scripts/assemble.mjs" --variant stock  --sentinel --out "$scratch/stock-sentinel"
node "$here/scripts/assemble.mjs" --variant themed --out "$scratch/themed"
node "$here/scripts/assemble.mjs" --variant themed --sentinel --out "$scratch/themed-sentinel"

for b in "${builds[@]}"; do
  echo "surface: building $b"
  (cd "$scratch/$b/site" && "$site_ws/node_modules/.bin/docusaurus" build)
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
  build_dir="$scratch/$b/site/build"
  [ -f "$build_dir/index.html" ] || { echo "error: $build_dir has no index.html — docusaurus build produced nothing" >&2; exit 1; }
  serve "$build_dir" "$scratch/$b.server.log"
  echo "surface: serving $b at $SERVED_URL"
  case "$b" in
    stock)            export VSOR_E2E_STOCK_URL="$SERVED_URL"           VSOR_E2E_STOCK_DIR="$scratch/$b" ;;
    stock-sentinel)   export VSOR_E2E_STOCK_SENTINEL_URL="$SERVED_URL"  VSOR_E2E_STOCK_SENTINEL_DIR="$scratch/$b" ;;
    themed)           export VSOR_E2E_THEMED_URL="$SERVED_URL"          VSOR_E2E_THEMED_DIR="$scratch/$b" ;;
    themed-sentinel)  export VSOR_E2E_THEMED_SENTINEL_URL="$SERVED_URL" VSOR_E2E_THEMED_SENTINEL_DIR="$scratch/$b" ;;
  esac
done

cd "$here"
"$site_ws/node_modules/.bin/playwright" test "$@"
