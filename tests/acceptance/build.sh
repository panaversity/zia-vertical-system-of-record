#!/usr/bin/env bash
# The acceptance for specs/vsor/build/spec.md, operationalized.
#
# Pattern follows tests/acceptance/init.sh (init's operationalization rule): REPO is
# resolved absolute from this script's own location, VSOR_DEV_VERSION defaults to the
# pre-publish stamp, all work happens in a mktemp scratch a trap removes, and every
# assertion carries a named fail message so a red run says which clause broke.
#
# No `set -e`: several rows EXPECT a non-zero exit (error: port-in-use, bad-port,
# missing-runtime) and their codes must be captured, not fatal. `set -u` stays on.
#
# Node lane, deliberately: this script needs node + npm on PATH and (first run) the
# network for the shell's `npm ci`. It is wired into `make surface` via the
# build-acceptance target — never into `make gate`, which stays python-only.
#
# Two rows are delegated to the unit tier, recorded here so the delegation is visible:
#   - full JSON-Schema validation of build.lock.json (the committed schema lives in
#     packages/vsor and is unit-asserted there); this script re-asserts the format-1
#     shape structurally with stdlib python — no jsonschema dependency in the lane.
#   - the old-node row (node 18 on PATH -> error: missing-runtime naming the found
#     version): no node 18 exists on this machine or in CI; the version-comparison
#     logic is unit-tested in packages/vsor. The node-ABSENT row runs here for real.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export VSOR_DEV_VERSION="${VSOR_DEV_VERSION:-0.1.0}"

SCRATCH="$(mktemp -d)"

pids=()
cleanup() {
  for p in ${pids[@]+"${pids[@]}"}; do kill "$p" 2>/dev/null || true; done
  rm -rf "$SCRATCH"
}
trap cleanup EXIT INT TERM

fail() {
  echo "build acceptance FAIL: $*" >&2
  exit 1
}

# --- the wheel: stage the site runtime, then build into a unique path ---------------
#
# `make wheel` (packages/sor-site npm ci + workspace builds + npm pack, artifacts
# copied into packages/vsor/src/vsor/_site_runtime/, then uv build) is the settled
# staging step; run it every time so this acceptance never certifies stale tarballs.
# The wheel this script RUNS is then built into the scratch dir — init.sh's found-live
# uvx-cache lesson: a unique wheel path means no cached environment can be reused.

make -C "$REPO" wheel >"$SCRATCH/wheel-stage.log" 2>&1 \
  || { tail -n 40 "$SCRATCH/wheel-stage.log" >&2
       fail "'make wheel' failed — the site-runtime staging step must precede this acceptance"; }

uv build --directory "$REPO" --package vsor --wheel -o "$SCRATCH/wheel" >/dev/null 2>&1 \
  || fail "could not build the vsor wheel"
WHEEL="$(set -- "$SCRATCH"/wheel/vsor-*.whl && echo "$1")"

VSOR() { uvx --from "$WHEEL" vsor "$@"; }

# --- wheel-content row (re-asserted; also unit-tested in packages/vsor) -------------

python3 - "$WHEEL" <<'PY' || fail "wheel content: _site_runtime artifacts missing or mdx tgz lacks lib/theme/MDXComponents.js"
import io, sys, tarfile, zipfile

wheel = zipfile.ZipFile(sys.argv[1])
names = set(wheel.namelist())
needed = [
    "vsor/_site_runtime/sor-site-mdx.tgz",
    "vsor/_site_runtime/sor-site-theme.tgz",
    "vsor/_site_runtime/package.json",
    "vsor/_site_runtime/package-lock.json",
]
missing = [n for n in needed if n not in names]
if missing:
    print(f"missing from wheel: {missing}", file=sys.stderr)
    sys.exit(1)
with tarfile.open(fileobj=io.BytesIO(wheel.read(needed[0])), mode="r:gz") as tgz:
    members = tgz.getnames()
# npm pack prefixes every member with "package/".
if "package/lib/theme/MDXComponents.js" not in members:
    print("mdx tgz does not contain lib/theme/MDXComponents.js (prebuilt lib/ missing)", file=sys.stderr)
    sys.exit(1)
PY

cd "$SCRATCH" || exit 1

# --- server plumbing (run.sh's poll pattern: bounded polls, no bare sleeps) ---------

# serve <dir> <log>; sets SERVED_URL. Ephemeral port: bind 0, parse the port
# http.server reports once it is already listening (race-free).
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

free_port() {
  python3 - <<'PY'
import socket

s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

# --- the unedited scaffold builds (closes init's "when build lands" clause) ---------

VSOR init sitedemo >/dev/null || fail "'vsor init sitedemo' did not exit 0"
cd sitedemo || exit 1
HEAD_SHA="$(git rev-parse HEAD)" || fail "scaffold repo has no HEAD"

VSOR build >build1.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build1.out >&2; fail "unedited scaffold: 'vsor build' expected exit 0, got $rc"; }

# First-run output: the one owned notice line, then npm's own streamed output.
grep -q 'installing site runtime' build1.out \
  || fail "first run: the 'installing site runtime' notice line is missing"
grep -Eq 'added [0-9]+ packages' build1.out \
  || fail "first run: no npm-originated line ('added N packages') in the streamed output"

test -f build/index.html || fail "build/ has no index.html"
test -f build.lock.json || fail "build.lock.json was not written"
test -f .vsor/site-runtime/.materialized.json || fail ".materialized.json stamp missing after successful install"

# Negative contract: machinery lands under .vsor/ only.
test -z "$(find . -name node_modules -not -path './.vsor/*' -print -quit)" \
  || fail "node_modules exists outside .vsor/"
test ! -e package.json || fail "a package.json appeared at the project root"

# --- the record: format-1 shape, clean-tree git sha, requires_satisfied -------------
# (Full JSON-Schema validation is the unit tier's row — see the header note.)

python3 - build.lock.json "$HEAD_SHA" "$VSOR_DEV_VERSION" <<'PY' || fail "build.lock.json violates the format-1 record contract"
import datetime, json, re, sys

lock = json.load(open(sys.argv[1]))
head, dev_version = sys.argv[2], sys.argv[3]
sha256 = re.compile(r"^[0-9a-f]{64}$")

assert set(lock) == {"format", "build_id", "created", "vsor", "requires_satisfied",
                     "corpus", "site", "non_stock"}, f"top-level keys: {sorted(lock)}"
assert lock["format"] == 1
assert sha256.match(lock["build_id"]), "build_id is not a sha256 hex"
created = datetime.datetime.fromisoformat(lock["created"])
assert created.utcoffset() == datetime.timedelta(0), "created is not UTC"
assert lock["vsor"] == dev_version, f"vsor version recorded {lock['vsor']!r}, ran {dev_version!r}"
assert lock["requires_satisfied"] is True
assert set(lock["corpus"]) == {"tree", "git", "documents"}
assert sha256.match(lock["corpus"]["tree"])
docs = lock["corpus"]["documents"]
assert [d["path"] for d in docs] == sorted(d["path"] for d in docs), "documents not in walk order"
for d in docs:
    assert set(d) == {"path", "sha256"} and d["path"].startswith("knowledge/") and sha256.match(d["sha256"])
assert any(d["path"] == "knowledge/example.md" for d in docs)
assert lock["corpus"]["git"] == head, (
    f"clean tree: corpus.git must be HEAD ({head}), got {lock['corpus']['git']!r}")
assert set(lock["site"]) == {"docusaurus", "node", "lock"}
assert lock["site"]["docusaurus"] and lock["site"]["node"]
assert sha256.match(lock["site"]["lock"])
assert lock["non_stock"] == []
PY

# --- served build/: homepage and the example doc ------------------------------------

serve "$PWD/build" "$SCRATCH/serve1.log"
curl -fsS "$SERVED_URL/" | grep -q 'sitedemo' \
  || fail "served homepage does not carry the project name"
curl -fsS "$SERVED_URL/docs/example/" | grep -q 'Start here' \
  || fail "served example doc does not render its title"

# --- the design system reached the INSTALLED layout ---------------------------------
#
# The only tier that can prove this. `make surface` builds its fixture inside the
# packages/sor-site npm workspace, where @vsor/sor-site-theme is a SYMLINK — a
# layout no user ever has, and the one where the two known traps do not bite:
# Tailwind v4 does not scan node_modules (so a broken `@source` in the theme's
# css entry emits nothing), and Docusaurus's own JS rule skips node_modules (so
# a broken configureWebpack cannot compile the theme's .tsx at all). Here the
# theme is really installed under .vsor/site-runtime/node_modules/, so a
# regression in either shows up as an unstyled site — exactly the failure the
# owner rejected — while gate, build-acceptance and surface all stayed green.
# Two markers, both absent from a stock build: Tailwind's own custom properties,
# and the 997px responsive variant the navbar compiles for its mobile switch.
STYLES="$(cat build/assets/css/styles.*.css 2>/dev/null)"
test -n "$STYLES" || fail "no built stylesheet at build/assets/css/styles.*.css"
grep -q -- '--tw-' <<<"$STYLES" \
  || fail "the built CSS carries no --tw- properties: Tailwind emitted nothing. Tailwind v4 does not scan node_modules — check the @source globs in the theme's src/css/tailwind.css against the INSTALLED layout"
grep -q 'min-width:997px' <<<"$STYLES" \
  || fail "the built CSS carries no 997px media query: the navbar's min-[997px] variants did not compile, so the theme's own source was not scanned (same @source trap)"

# --- second build with package networking disabled: reuse, identical build_id -------
# No install may run, so a dead registry + offline npm + offline uv turn any
# attempted fetch into a hard failure instead of a silent pass (init's precedent).

cp build.lock.json "$SCRATCH/lock1.json"
npm_config_offline=true npm_config_registry=http://127.0.0.1:9 UV_OFFLINE=1 \
  VSOR build >build2.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build2.out >&2; fail "offline second build: expected exit 0, got $rc"; }
grep -q 'installing site runtime' build2.out \
  && fail "second run printed the install notice — the shell was not reused"
grep -Eq 'added [0-9]+ packages' build2.out \
  && fail "second run streamed npm output — an install ran"
cp build.lock.json "$SCRATCH/lock2.json"

python3 - "$SCRATCH/lock1.json" "$SCRATCH/lock2.json" <<'PY' || fail "no-change rebuild: build_id must be identical and created must vary"
import json, sys

a, b = (json.load(open(p)) for p in sys.argv[1:3])
assert a["build_id"] == b["build_id"], f"build_id changed on a no-change rebuild: {a['build_id']} -> {b['build_id']}"
assert a["created"] != b["created"], "created did not vary between rebuilds"
PY

# --- the <Quiz /> fixture doc: written by the script, rebuilt, asserted in HTML -----

cat > knowledge/quiz-check.md <<'EOF'
---
title: Acceptance quiz check
---

# Acceptance quiz check

One question proves the MDX vocabulary resolves in the emitted build.

<Quiz
  title="Acceptance quiz check"
  questions={[
    {
      question: "Where does the site runtime live?",
      options: [
        "Under .vsor/",
        "In site/node_modules",
        "At the project root",
        "In the uv cache",
      ],
      correctOption: 0,
      explanation: "Everything installed in the project lands under .vsor/.",
    },
  ]}
/>
EOF

VSOR build >build3.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build3.out >&2; fail "build with the quiz doc: expected exit 0, got $rc"; }
test -f build/docs/quiz-check/index.html || fail "quiz doc was not built to build/docs/quiz-check/"
grep -q 'Acceptance quiz check' build/docs/quiz-check/index.html \
  || fail "built quiz page lacks the quiz title"
grep -q 'Under .vsor/' build/docs/quiz-check/index.html \
  || fail "built quiz page lacks the quiz option markup (the <Quiz /> component did not render)"
grep -qi 'quiz' build/docs/quiz-check/index.html \
  || fail "built quiz page carries no quiz component markup"
cp build.lock.json "$SCRATCH/lock3.json"

# The record over the changed corpus: new build_id, a new row, others untouched —
# and knowledge/ is now dirty against HEAD, so corpus.git must be null.
python3 - "$SCRATCH/lock2.json" "$SCRATCH/lock3.json" <<'PY' || fail "quiz-doc build: record rows or corpus.git wrong"
import json, sys

before, after = (json.load(open(p)) for p in sys.argv[1:3])
assert after["build_id"] != before["build_id"], "adding a document did not change build_id"
assert after["corpus"]["git"] is None, "knowledge/ is dirty against HEAD — corpus.git must be null"
rows_b = {d["path"]: d["sha256"] for d in before["corpus"]["documents"]}
rows_a = {d["path"]: d["sha256"] for d in after["corpus"]["documents"]}
assert "knowledge/quiz-check.md" in rows_a, "no documents row for the new doc"
assert set(rows_a) - set(rows_b) == {"knowledge/quiz-check.md"}
for path, sha in rows_b.items():
    assert rows_a[path] == sha, f"untouched document row changed: {path}"
PY

# --- touch one existing doc: its row changes, the others don't ----------------------

printf '\nOne appended acceptance line.\n' >> knowledge/example.md
VSOR build >build4.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build4.out >&2; fail "build after touching example.md: expected exit 0, got $rc"; }
cp build.lock.json "$SCRATCH/lock4.json"

python3 - "$SCRATCH/lock3.json" "$SCRATCH/lock4.json" <<'PY' || fail "touched-doc build: build_id or document rows wrong"
import json, sys

before, after = (json.load(open(p)) for p in sys.argv[1:3])
assert after["build_id"] != before["build_id"], "touching a document did not change build_id"
rows_b = {d["path"]: d["sha256"] for d in before["corpus"]["documents"]}
rows_a = {d["path"]: d["sha256"] for d in after["corpus"]["documents"]}
assert set(rows_a) == set(rows_b), "document set changed on a touch"
assert rows_a["knowledge/example.md"] != rows_b["knowledge/example.md"], "touched row did not change"
changed = [p for p in rows_a if rows_a[p] != rows_b[p]]
assert changed == ["knowledge/example.md"], f"rows changed beyond the touched doc: {changed}"
PY

# --- config-edit pickup: the symlink mechanism's live proof -------------------------

python3 - <<'PY' || fail "could not edit site/docusaurus.config.ts"
from pathlib import Path

p = Path("site/docusaurus.config.ts")
text = p.read_text(encoding="utf-8")
# Whole-line match, not substring: the navbar's own `title:` is indented deeper
# and a substring count found it too the moment the scaffold gained navbar items
# (2026-08-14). The top-level title is the one seam this edit is proving.
lines = text.splitlines(keepends=True)
hits = [i for i, line in enumerate(lines) if line.rstrip("\r\n") == '  title: "sitedemo",']
assert len(hits) == 1, f"expected exactly one top-level title line, found {len(hits)}"
lines[hits[0]] = '  title: "cfgproof-77",\n'
p.write_text("".join(lines), encoding="utf-8")
PY
VSOR build >build5.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build5.out >&2; fail "build after config edit: expected exit 0, got $rc"; }
grep -q 'cfgproof-77' build/index.html \
  || fail "config edit not picked up — the authored site/ is not what the build reads"

# --- interrupted install: stamp absent => wipe, re-materialize, succeed -------------

rm .vsor/site-runtime/.materialized.json || fail "no stamp to delete"
VSOR build >build6.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build6.out >&2; fail "re-materialization build: expected exit 0, got $rc"; }
test -f .vsor/site-runtime/.materialized.json \
  || fail "stamp not rewritten after re-materialization"
test -z "$(find . -name node_modules -not -path './.vsor/*' -print -quit)" \
  || fail "re-materialization leaked node_modules outside .vsor/"

# --- vsor dev on an ephemeral port --------------------------------------------------

DEV_PORT="$(free_port)"
# found live 2026-08-13: `VSOR dev ... &` backgrounds the function-wrapper SUBSHELL,
# and non-interactive bash defers SIGINT while waiting on its foreground child — the
# signal never reached vsor dev and `wait` deadlocked forever. The dev child is
# spawned via uvx directly so $! IS the process this row signals.
uvx --from "$WHEEL" vsor dev --port "$DEV_PORT" >dev.log 2>&1 &
DEV_PID=$!

up=""
for i in $(seq 1 360); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$DEV_PORT/"; then up=1; break; fi
  kill -0 "$DEV_PID" 2>/dev/null || break
  sleep 0.5
done
test -n "$up" || { cat dev.log >&2; fail "vsor dev never answered GET / with 200 on port $DEV_PORT"; }

# Touch a doc; bounded poll of the child's streamed output for the recompile line.
# found live (2026-08-13, docusaurus 3.10.2 piped, this repo's e2e workspace): each
# compile — initial and recompile — prints "client (webpack x.y.z) compiled
# successfully", so the recompile is the count of that line increasing.
# found live 2026-08-13: startup can compile more than once (initial compile, then a
# docs-regen recompile moments later). Wait for the compile count to hold still for
# 3s before taking the baseline, so this row asserts the TOUCH's recompile — never a
# late startup compile masquerading as one.
BASE_COMPILES="$(grep -c 'compiled successfully' dev.log)"
stable=0
for i in $(seq 1 120); do
  sleep 0.5
  now="$(grep -c 'compiled successfully' dev.log)"
  if [ "$now" -eq "$BASE_COMPILES" ]; then
    stable=$((stable + 1))
    [ "$stable" -ge 6 ] && break
  else
    stable=0
    BASE_COMPILES="$now"
  fi
done
printf '\nA dev hot-reload probe line.\n' >> knowledge/example.md
recompiled=""
for i in $(seq 1 120); do
  if [ "$(grep -c 'compiled successfully' dev.log)" -gt "$BASE_COMPILES" ]; then recompiled=1; break; fi
  sleep 0.5
done
test -n "$recompiled" || { cat dev.log >&2; fail "no recompile line appeared after touching a knowledge doc"; }

kill -INT "$DEV_PID"
wait "$DEV_PID"
rc=$?
test "$rc" -eq 0 || { cat dev.log >&2; fail "SIGINT: vsor dev exited $rc, the contract is a decided exit 0"; }

# No orphaned child: the port accepts a fresh bind.
python3 - "$DEV_PORT" <<'PY' || fail "port not rebindable after vsor dev exit — a descendant survived"
import socket, sys, time

port = int(sys.argv[1])
deadline = time.monotonic() + 10
while True:
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("127.0.0.1", port))
        s.close()
        break
    except OSError:
        s.close()
        if time.monotonic() > deadline:
            sys.exit(1)
        time.sleep(0.2)
PY

# --- occupied port and bad port -----------------------------------------------------

BUSY_PORT="$(free_port)"
python3 - "$BUSY_PORT" <<'PY' &
import socket, sys, time

s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", int(sys.argv[1])))
s.listen(1)
time.sleep(120)
PY
HOLDER_PID=$!
pids+=("$HOLDER_PID")
# Wait until the holder actually listens before asserting the refusal.
for i in $(seq 1 100); do
  if ! python3 -c "import socket,sys; s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('127.0.0.1', int(sys.argv[1])))" "$BUSY_PORT" 2>/dev/null; then break; fi
  sleep 0.05
done

VSOR dev --port "$BUSY_PORT" >/dev/null 2>err
rc=$?
test "$rc" -eq 1 || fail "occupied port: expected exit 1, got $rc"
head -n 1 err | grep -q '^error: port-in-use' || fail "occupied port: first stderr line is not the port-in-use slug"
grep -q "$BUSY_PORT" err || fail "port-in-use error does not name the port"
grep -q -- '--port' err || fail "port-in-use error does not name the --port remedy"
kill "$HOLDER_PID" 2>/dev/null

VSOR dev --port 99999 >/dev/null 2>err
rc=$?
test "$rc" -eq 1 || fail "--port 99999: expected exit 1, got $rc"
head -n 1 err | grep -q '^error: bad-port' || fail "--port 99999: first stderr line is not the bad-port slug"

# --- node absent: exit 3, error: missing-runtime ------------------------------------
# PATH scrub: a bin dir holding only uv/uvx (uvx runs its interpreter by absolute
# path, so vsor itself still runs; its `node` lookup fails). The node-18 variant of
# this row is unit-tier — see the header note.

SCRUB_BIN="$SCRATCH/scrub-bin"
mkdir -p "$SCRUB_BIN"
ln -s "$(command -v uv)" "$SCRUB_BIN/uv" || fail "could not stage uv into the scrubbed PATH"
ln -s "$(command -v uvx)" "$SCRUB_BIN/uvx" || fail "could not stage uvx into the scrubbed PATH"
# found live 2026-08-13: uv's generated console-script launcher is a shell script that
# calls realpath and dirname before exec'ing python — without them the launcher dies
# with 126 and the row measures uv's plumbing, not vsor's node probe. Stage exactly
# those two; neither provides node, so the row still proves the missing-runtime path.
ln -s "$(command -v realpath)" "$SCRUB_BIN/realpath" || fail "could not stage realpath"
ln -s "$(command -v dirname)" "$SCRUB_BIN/dirname" || fail "could not stage dirname"
env PATH="$SCRUB_BIN" "$SCRUB_BIN/uvx" --from "$WHEEL" vsor build >/dev/null 2>err
rc=$?
test "$rc" -eq 3 || fail "node absent: expected exit 3, got $rc"
head -n 1 err | grep -q '^error: missing-runtime' \
  || fail "node absent: first stderr line is not the missing-runtime slug"
grep -qi 'node' err || fail "missing-runtime remedy does not name node"

echo "build acceptance: green"
