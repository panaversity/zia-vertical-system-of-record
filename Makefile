# The one command vocabulary. AGENTS.md quotes these targets, CI calls these targets,
# humans and agents type these targets — so the three can never drift.
# Contributor-facing only: users see the vsor verbs, never this file.

# The dev/CI stamp for `vsor init` (specs/vsor/init): the workspace package version is a
# 0.0.0 placeholder until publish, and init refuses placeholders unless the harness names
# the version to pin. Exported so test/acceptance/gate inherit it; `?=` lets a caller win.
export VSOR_DEV_VERSION ?= 0.1.0

.PHONY: lock lint fmt typecheck test boundary acceptance build-acceptance gate surface wheel

# Where `make wheel` stages the four site-runtime artifacts (specs/vsor/build).
# Gitignored — generated, never committed; hatchling ships them via its artifacts field.
runtime_dir := packages/vsor/src/vsor/_site_runtime

lock:
	uv lock

lint:
	uv run --package vsor ruff check packages tests

fmt:
	uv run --package vsor ruff format packages tests
	uv run --package vsor ruff check --fix packages tests

typecheck:
	uv run --package vsor mypy packages/vsor/src tests

test:
	uv run --package vsor pytest packages/vsor/tests -q

# boundary carries the sor-site surface Phase A contract too (tests/test_surface_contract.py,
# specs/sor-site/surface: allowlist/denylist, exclusion scan, token lint, prop baseline) —
# source+manifest checks only, so the gate stays node-free. The browser tier (Phase B) will
# arrive as its own `surface` target with a separate node-equipped CI job.
boundary:
	uv run --package vsor pytest tests -q

acceptance:
	bash tests/acceptance/init.sh

gate: lint typecheck test boundary acceptance
	@echo "gate: green"

# The build/dev acceptance (specs/vsor/build) lives in the NODE lane: it stages the
# site runtime (`make wheel`), builds the wheel, and drives `vsor build`/`vsor dev`
# for real — npm ci included on first run. Wired into `surface` (below), NEVER into
# `gate`: the python gate stays node-free (settled 2026-08-13).
build-acceptance:
	bash tests/acceptance/build.sh

# The wheel transport (specs/vsor/build): pack the prebuilt mdx/theme packages and
# stage them + the shell package.json + a freshly generated shell package-lock.json
# into $(runtime_dir), then `uv build`. MUST precede `uv build` anywhere; the
# wheel-content test (packages/vsor/tests/test_wheel_contents.py) gates the ordering.
#
# found live 2026-08-13 (npm 11.16.0, node 24.18.0): the shell package-lock.json
# records sha512 integrity for the file: tarballs, so it is regenerated here
# UNCONDITIONALLY whenever the tarballs are repacked — against a stale lockfile a
# changed tgz fails `npm ci` with EINTEGRITY on a cold cache, and on a warm cache
# `npm ci` exits 0 and silently installs the OLD cached bytes (cacache resolves by
# the lockfile's integrity, never re-reading the file). Regeneration itself must run
# in a pristine dir (no node_modules, no prior lockfile): with a node_modules
# present npm trusts the hidden node_modules/.package-lock.json and writes the
# stale hash back even after the top-level lockfile is deleted.
# found live 2026-08-13: the e2e harness lockfile pins docusaurus 3.10.2 (react
# 19.2.8, search-local 0.55.3) and carries NO webpack override — webpack resolves
# transitively (5.109.2 today). The shell template pins the same direct-dep set;
# its one home is packages/vsor/src/vsor/templates/site_runtime/package.json.
wheel:
	cd packages/sor-site && npm ci && npm run build
	rm -rf $(runtime_dir)
	mkdir -p $(runtime_dir)
	cd packages/sor-site && npm pack ./mdx ./theme --pack-destination "$(CURDIR)/$(runtime_dir)"
	cd $(runtime_dir) && mv vsor-sor-site-mdx-*.tgz sor-site-mdx.tgz && mv vsor-sor-site-theme-*.tgz sor-site-theme.tgz
	cp packages/vsor/src/vsor/templates/site_runtime/package.json $(runtime_dir)/package.json
	cd $(runtime_dir) && npm install --package-lock-only
	uv build --package vsor

# Browser tier of specs/sor-site/surface (B5–B14): builds the fixture site from
# the init scaffold + fixtures/tiny in stock and themed configs and runs the
# Playwright acceptance against both. Node lives only here — `gate` stays
# node-free. Installs nothing; one-time prereq:
#   (cd packages/sor-site && npm ci && npx playwright install chromium)
# build-acceptance runs first (before playwright): the browser assertions then
# certify the same config `vsor build` just proved it emits — one enforcement.
surface: build-acceptance
	bash packages/sor-site/e2e/run.sh
