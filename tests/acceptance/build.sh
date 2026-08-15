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
#     packages/vsor and is unit-asserted there); this script re-asserts the format-2
#     shape structurally with stdlib python — no jsonschema dependency in the lane.
#   - the old-node row (node 18 on PATH -> error: missing-runtime naming the found
#     version): no node 18 exists on this machine or in CI; the version-comparison
#     logic is unit-tested in packages/vsor. The node-ABSENT row runs here for real.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Same rule as the Makefile: read the package's version rather than restating it, because vsor
# prefers the installed distribution over this knob and a stale literal fails as a lock mismatch.
export VSOR_DEV_VERSION="${VSOR_DEV_VERSION:-$(sed -n 's/^version = "\(.*\)"/\1/p' "$REPO/packages/vsor/pyproject.toml" | head -1)}"

SCRATCH="$(mktemp -d)"

pids=()
cleanup() {
  for p in ${pids[@]+"${pids[@]}"}; do kill "$p" 2>/dev/null || true; done
  # Wait for them to actually go before deleting the tree they are writing into. `kill`
  # only asks; `vsor dev` then forwards the signal to its own process group and unwinds,
  # and node takes a moment over it. Without this the rm below races a live compiler.
  for p in ${pids[@]+"${pids[@]}"}; do wait "$p" 2>/dev/null || true; done
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

python3 - "$WHEEL" <<'PY' || fail "wheel content: _site_runtime artifacts missing, or the app tgz is not a whole site"
import io, json, sys, tarfile, zipfile

wheel = zipfile.ZipFile(sys.argv[1])
names = set(wheel.namelist())
root = "vsor/_site_runtime/"

# The expected set is derived, never restated: the shell manifest's own file: deps say
# which library tarballs exist, and the app tarball is the shell itself.
shell = json.loads(wheel.read(root + "package.json"))
libraries = [
    spec[len("file:./"):]
    for spec in shell["dependencies"].values()
    if isinstance(spec, str) and spec.startswith("file:./") and spec.endswith(".tgz")
]
needed = [root + n for n in ("sor-site-app.tgz", "package.json", "package-lock.json", *libraries)]
missing = [n for n in needed if n not in names]
if missing:
    print(f"missing from wheel: {missing}", file=sys.stderr)
    sys.exit(1)

with tarfile.open(fileobj=io.BytesIO(wheel.read(root + "sor-site-app.tgz")), mode="r:gz") as tgz:
    members = set(tgz.getnames())
# npm pack prefixes every member with "package/". The app is unpacked over the shell and
# BECOMES the siteDir, so the config and the MDX vocabulary have to be inside it.
for required in ("package/docusaurus.config.ts", "package/src/theme/MDXComponents.tsx"):
    if required not in members:
        print(f"app tgz does not contain {required}", file=sys.stderr)
        sys.exit(1)

# A1's denylist, over the lockfile a USER installs. The workspace lockfile is
# scanned in the python gate (tests/test_surface_contract.py); this one is a
# `make wheel` product, regenerated against the registry and never committed, so
# it can only be scanned where the wheel is guaranteed to exist — here. Added
# 2026-08-14: a transitive product dep arriving in the shipped lock was
# unenforced in either direction.
DENYLIST = (
    "better-auth", "@openai/chatkit", "monaco-editor", "@monaco-editor/react",
    "pyodide", "posthog-js", "@vercel/analytics", "ts-fsrs", "recharts",
    "framer-motion", "cmdk", "next-themes", "sonner",
)
lock = json.loads(wheel.read(root + "package-lock.json"))
hits = sorted(
    {name for name in DENYLIST
     for key in lock.get("packages", {})
     if key == f"node_modules/{name}" or key.endswith(f"/node_modules/{name}")}
)
if hits:
    print(f"denylisted packages in the SHIPPED lockfile: {hits}", file=sys.stderr)
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

# --- the record: format-2 shape, clean-tree git sha, requires_satisfied -------------
# (Full JSON-Schema validation is the unit tier's row — see the header note.)

python3 - build.lock.json "$HEAD_SHA" "$VSOR_DEV_VERSION" <<'PY' || fail "build.lock.json violates the format-2 record contract"
import datetime, json, re, sys

lock = json.load(open(sys.argv[1]))
head, dev_version = sys.argv[2], sys.argv[3]
sha256 = re.compile(r"^[0-9a-f]{64}$")

assert set(lock) == {"format", "build_id", "created", "vsor", "requires_satisfied",
                     "corpus", "site", "non_stock"}, f"top-level keys: {sorted(lock)}"
assert lock["format"] == 2
assert sha256.match(lock["build_id"]), "build_id is not a sha256 hex"
created = datetime.datetime.fromisoformat(lock["created"])
assert created.utcoffset() == datetime.timedelta(0), "created is not UTC"
assert lock["vsor"] == dev_version, f"vsor version recorded {lock['vsor']!r}, ran {dev_version!r}"
assert lock["requires_satisfied"] is True
assert set(lock["corpus"]) == {"tree", "git", "prefix", "documents"}
assert sha256.match(lock["corpus"]["tree"])
docs = lock["corpus"]["documents"]
assert [d["path"] for d in docs] == sorted(d["path"] for d in docs), "documents not in walk order"
for d in docs:
    assert set(d) == {"path", "sha256"} and d["path"].startswith("knowledge/") and sha256.match(d["sha256"])
assert any(d["path"] == "knowledge/example.md" for d in docs)
assert lock["corpus"]["git"] == head, (
    f"clean tree: corpus.git must be HEAD ({head}), got {lock['corpus']['git']!r}")
# This project IS the repository root, so the prefix is empty and `<git>:<path>` resolves
# as written. The below-the-root case (which `vsor init` inside an existing work tree
# produces) is the unit tier's row — it needs two repositories.
assert lock["corpus"]["prefix"] == "", f"prefix at the repo root must be empty: {lock['corpus']['prefix']!r}"
assert set(lock["site"]) == {"docusaurus", "node", "lock", "app"}
assert lock["site"]["docusaurus"] and lock["site"]["node"]
assert sha256.match(lock["site"]["lock"])
assert sha256.match(lock["site"]["app"]), "site.app names the forked app that rendered the site"
assert lock["non_stock"] == []
PY

# corpus.git + a documents[] path have to resolve TOGETHER — that pair is what every
# citation resolves through, and it is the one thing no other row measures.
python3 - build.lock.json <<'PY' > "$SCRATCH/cite-paths.txt" || fail "could not read the record's citation pairs"
import json, sys
lock = json.load(open(sys.argv[1]))
for row in lock["corpus"]["documents"]:
    print(f'{lock["corpus"]["git"]}:{lock["corpus"]["prefix"]}{row["path"]}')
PY
while read -r ref; do
  git cat-file -e "$ref" 2>/dev/null || fail "the record names $ref, which no commit contains"
done < "$SCRATCH/cite-paths.txt"

# The artifact carries the record that describes it: "is this site the one the record
# names" must be answerable by anyone holding the deployed directory.
test -f build/build.lock.json || fail "build/ carries no build.lock.json — a record/artifact divergence would be undetectable"
cmp -s build/build.lock.json build.lock.json \
  || fail "build/build.lock.json and the committed record are not the same record"

# --- served build/: homepage and the example doc ------------------------------------

serve "$PWD/build" "$SCRATCH/serve1.log"
curl -fsS "$SERVED_URL/" | grep -q 'sitedemo' \
  || fail "served homepage does not carry the project name"
curl -fsS "$SERVED_URL/docs/example/" | grep -q 'Start here' \
  || fail "served example doc does not render its title"

# --- the design system reached the MATERIALIZED layout ------------------------------
#
# The only tier that can prove this. The shell is the forked app, unpacked under
# `.vsor/site-runtime/` inside the project's OWN git repository — where `.vsor/`
# is gitignored, and Tailwind v4's automatic source detection honours gitignore.
# A design system that compiles in the packages/sor-site workspace can therefore
# emit nothing at all once materialized, and the site arrives unstyled — exactly
# the failure the owner rejected — while gate and surface both stay green.
# Two markers, both absent from a stock Docusaurus build: Tailwind's own custom
# properties, and the arbitrary `min-[997px]` variant, which exists in exactly
# one place — the shell's src/theme/Navbar/index.tsx. The second is the real
# scan proof. It matches the compiled UTILITY, not the media query around it:
# lightningcss (the faster minimizer the shell enables) rewrites
# `min-width:997px` into `width>=997px`, so the old query pattern proved nothing.
STYLES="$(cat build/assets/css/styles.*.css 2>/dev/null)"
test -n "$STYLES" || fail "no built stylesheet at build/assets/css/styles.*.css"
grep -q -- '--tw-' <<<"$STYLES" \
  || fail "the built CSS carries no --tw- properties: Tailwind emitted nothing at all"
grep -qF 'min-\[997px\]\:flex' <<<"$STYLES" \
  || fail "the built CSS carries no min-[997px] utility: Tailwind never scanned the shell's own src/, so the site is unstyled. Check the @source globs in the shell's src/css/custom.css against the MATERIALIZED layout — .vsor/ is gitignored, and automatic detection skips gitignored paths"

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

# --- the corpus refusals that need a REAL build to be worth anything ----------------
#
# Both of these were exit 0 before 2026-08-15, and both left the record claiming
# something the published site does not contain. They run here, on the real path,
# because "the site has no page for it" is a fact only a real Docusaurus build has.

cat > knowledge/notyet.md <<'EOF'
---
title: Not yet
draft: true
---

Docusaurus drops this from a production build; vsor would still record it.
EOF
VSOR build >build-draft.out 2>err
rc=$?
test "$rc" -eq 1 || { cat build-draft.out err >&2; fail "draft: true — expected exit 1, got $rc"; }
head -n 1 err | grep -q '^error: knowledge-invalid' \
  || fail "draft: true — first stderr line is not the knowledge-invalid slug"
grep -q 'knowledge/notyet.md' err || fail "the draft refusal does not name the document"
rm knowledge/notyet.md

cat > knowledge/yes-doc.md <<'EOF'
---
title: Withdrawn By Yes
superseded: yes
---

PyYAML reads `yes` as true; the site's own parser reads it as the string "yes".
EOF
VSOR build >build-yes.out 2>err
rc=$?
test "$rc" -eq 1 || { cat build-yes.out err >&2; fail "superseded: yes — expected exit 1, got $rc"; }
head -n 1 err | grep -q '^error: knowledge-invalid' \
  || fail "superseded: yes — first stderr line is not the knowledge-invalid slug"
rm knowledge/yes-doc.md

# The falsification of both: `superseded: true` on a document with a real successor
# builds, and the page carries the notice the record's claim promises.
cat > knowledge/replacement.md <<'EOF'
---
title: The Replacement
effective: 2026-01-01
---

The current statement.
EOF
cat > knowledge/withdrawn.md <<'EOF'
---
title: The Withdrawn Rule
superseded_by: replacement.md
---

Kept for the record.
EOF
VSOR build >build-superseded.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-superseded.out >&2; fail "a resolving supersession: expected exit 0, got $rc"; }
grep -q 'data-vsor-superseded' build/docs/withdrawn/index.html \
  || fail "a build-accepted supersession must carry the notice on the page"
grep -q 'docs/replacement' build/docs/withdrawn/index.html \
  || fail "the supersession notice does not link to the successor the build validated"
rm knowledge/withdrawn.md knowledge/replacement.md

# --- the site identity comes from the config file, never the environment ------------
# Measured live 2026-08-15: two builds with the SAME build_id published at two different
# origins, because the shell's config reads VSOR_SITE_URL and build_id is taken over the
# config FILE. The file is the only door.

VSOR_SITE_URL=https://leaked.example-real.com VSOR_SITE_TITLE=LeakedTitle \
  VSOR build >build-env.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-env.out >&2; fail "ambient VSOR_* build: expected exit 0, got $rc"; }
grep -q 'leaked.example-real.com' build/sitemap.xml \
  && fail "VSOR_SITE_URL from the environment reached the published site — build_id cannot see it"
grep -rq 'LeakedTitle' build/index.html \
  && fail "VSOR_SITE_TITLE from the environment reached the published site"

# --- build/ that is not a directory: replaced and named, never a wedge ---------------
# The raise used to land BETWEEN the swap's renames — build/ held the new site while
# build.lock.json still described the previous one, and every later run re-raised it.

rm -rf build && printf 'oops\n' > build
VSOR build >build-file.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-file.out >&2; fail "build/ as a regular file: expected exit 0, got $rc"; }
test -d build || fail "build/ was not replaced with the site directory"
grep -q 'regular file' build-file.out || fail "replacing build/ was silent"
cmp -s build/build.lock.json build.lock.json \
  || fail "after replacing a non-directory build/, the artifact and the record disagree"
VSOR build >build-file2.out 2>&1
rc=$?
test "$rc" -eq 0 || { cat build-file2.out >&2; fail "the run after replacing build/ is wedged (exit $rc)"; }

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
# NO_COLOR: take the colour decision away from the child. `runtime_env()` strips only
# `VSOR_*`, so this reaches Docusaurus and rspack, and colorette short-circuits on it
# (index.cjs:33) — which also keeps the dev.log this row dumps on failure readable.
# The count below is ANSI-insensitive anyway; belt and braces, because either one alone
# would have been enough and the row must not depend on which.
NO_COLOR=1 uvx --from "$WHEEL" vsor dev --port "$DEV_PORT" >dev.log 2>&1 &
DEV_PID=$!
# found live 2026-08-15 (ubuntu-latest, the first CI run this job ever reached): every
# `fail` below exits straight to the EXIT trap, and DEV_PID was never in `pids` — so
# cleanup's `rm -rf` raced a dev server that was still writing into the shell it was
# deleting (`rm: cannot remove '.../.vsor/site-runtime/node_modules': Directory not
# empty`), and GitHub reaped the leftovers itself ("Terminate orphan process ... (uv)").
# The noise landed on top of the real failure and made it read like a second defect.
pids+=("$DEV_PID")

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
#
# found live 2026-08-15, on the first CI run that ever reached this row: the literal
# `grep -c 'compiled successfully'` returns 0 on GitHub Actions, and the whole row fails
# for that reason alone. The child writes straight into dev.log (dev_cmd.py inherits
# stdout rather than piping), so its stdout is a FILE and never a tty — and that is not
# enough to get plain text. Docusaurus prints stats through webpack-dev-middleware, which
# takes its colour setting from `colorette.isColorSupported` because @rspack/core exposes
# no `webpack.cli`, and colorette turns colour ON for CI *regardless of tty*:
# `"CI" in env && "GITHUB_ACTIONS" in env`. rspack then emits
# `compiled ${green('successfully')}` — so the bytes are
#   client (Rspack 1.7.12) compiled \033[1m\033[32msuccessfully\033[39m\033[22m
# with the escape landing BETWEEN the two words the pattern joins. GitHub renders that
# back as plain text in the web log, so the run looked like a hot-reload defect while the
# mirror and the watcher had both worked perfectly. Counting past the escapes is the fix;
# NO_COLOR on the spawn above is the second, independent one.
ESC=$(printf '\033')
compiles() { LC_ALL=C grep -acE "compiled ($ESC\[[0-9;]*m)*successfully" dev.log; }
BASE_COMPILES="$(compiles)"
stable=0
for i in $(seq 1 120); do
  sleep 0.5
  now="$(compiles)"
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
  if [ "$(compiles)" -gt "$BASE_COMPILES" ]; then recompiled=1; break; fi
  sleep 0.5
done
if [ -z "$recompiled" ]; then
  # The failure has three possible causes and they need different fixes, so measure which
  # one it is rather than reading the tea leaves in dev.log. `vsor dev` serves COPIES: the
  # authored save is mirrored into .vsor/site-runtime/knowledge by sync_authored (dev_cmd.py,
  # every 0.5s) and Docusaurus watches the copy. So either the mirror did not carry the edit
  # across, or it did and the watcher ignored it — or, the one that actually happened on
  # 2026-08-15, both halves worked and this row's own counter could not see the compile
  # because the marker arrived wrapped in ANSI colour (see the long note above the counter).
  # The raw byte count is printed for exactly that reason: a plain-vs-coloured mismatch is
  # invisible in GitHub's rendered log, which strips the escapes before you read it.
  echo "--- compile-line accounting ---" >&2
  printf 'ANSI-insensitive count: %s | literal-string count: %s | baseline: %s\n' \
    "$(compiles)" \
    "$(LC_ALL=C grep -c 'compiled successfully' dev.log 2>/dev/null || echo 0)" \
    "$BASE_COMPILES" >&2
  echo "  (the two counts differing means the marker is coloured, not that hot reload broke)" >&2
  echo "--- dev.log ---" >&2
  cat dev.log >&2
  echo "--- mirror state (did sync_authored carry the edit into the shell?) ---" >&2
  for f in knowledge/example.md .vsor/site-runtime/knowledge/example.md; do
    if [ -e "$f" ]; then
      printf '%s: %s bytes, mtime %s, probe line present: %s\n' \
        "$f" \
        "$(wc -c <"$f" | tr -d ' ')" \
        "$(date -r "$f" '+%H:%M:%S' 2>/dev/null || stat -c %y "$f" 2>/dev/null || echo '?')" \
        "$(grep -c 'A dev hot-reload probe line' "$f" 2>/dev/null || echo 0)" >&2
    else
      echo "$f: MISSING" >&2
    fi
  done
  echo "--- (probe present in the shell copy => the mirror works and the watcher ignored it;" >&2
  echo "     absent => sync_authored is the half that did not fire) ---" >&2
  fail "no recompile line appeared after touching a knowledge doc"
fi

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
