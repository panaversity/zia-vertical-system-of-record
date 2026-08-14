# The one command vocabulary. AGENTS.md quotes these targets, CI calls these targets,
# humans and agents type these targets — so the three can never drift.
# Contributor-facing only: users see the vsor verbs, never this file.

# The dev/CI stamp for `vsor init` (specs/vsor/init): init refuses a version that is
# missing, `0.0.0`, or dev/pre-release, unless the harness names the version to pin.
# Exported so test/acceptance/gate inherit it; `?=` lets a caller win.
# Since the 0.1.0 release, packages/vsor/pyproject.toml carries a real version and
# importlib.metadata answers with it, so this stamp is a belt-and-braces default rather
# than the only thing standing between the suite and `error: unstamped` — it still matters
# for the pre-release of the NEXT version, and for any run against an uninstalled tree.
# Derived from the package, never written twice: vsor prefers the INSTALLED version over this
# knob, so a literal here silently disagrees with reality the moment the version is bumped
# (found live at 0.1.0 -> 0.1.1: four unit tests and the build acceptance failed on the stale
# default). The knob still matters when the workspace carries the 0.0.0 placeholder.
export VSOR_DEV_VERSION ?= $(shell sed -n 's/^version = "\(.*\)"/\1/p' packages/vsor/pyproject.toml | head -1)

.PHONY: lock lint fmt typecheck test boundary acceptance build-acceptance deploy-acceptance gate surface wheel

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

# The hosting-layout acceptance (tests/acceptance/deploy.sh): the two shapes a
# static host actually has — the build AS the document root, and the build under
# a `/<name>/` subpath — proved through the real `vsor build` and a real browser,
# because they fail differently. The root shape fails QUIETLY (the placeholder
# `url` ships in sitemap.xml, the canonical links and og:url while every page
# still renders); the subpath shape fails LOUDLY (a wrong baseUrl 404s every
# asset).
#
# Its own target, deliberately NOT chained into `surface`: it stages the same
# shared paths those targets stage ($(runtime_dir) and packages/sor-site's
# node_modules), so the two cannot run concurrently, and it costs the node lane
# again in full — measured 2026-08-14 (Node 22.15, Apple Silicon, warm npm cache):
# 2m56s including its own `make wheel`, against `make surface` 4m34s and
# `make build-acceptance` 4m13s. Run it when the deploy story, the scaffold's host
# configs, or `url`/`baseUrl` handling changes — and before a release.
# It accepts VSOR_WHEEL=<path> to reuse an already-built wheel.
#
# Its first honest run against a real `vsor build` was RED on three defects that no
# other tier could see (the surface tier builds an assembled fixture, not the shipped
# output, and it only ever serves at "/"): an unclickable first sidebar link in every
# build, a favicon 404 on every page of a subpath deploy, and a sitemap whose route set
# changed with the deploy shape. All three were fixed in the product, not in the test,
# and it has been green since 2026-08-14. It runs in CI (`hosting` job) and again on the
# release path, against the very wheel about to be uploaded.
deploy-acceptance:
	bash tests/acceptance/deploy.sh

# The packages `make wheel` packs into the shell. The FIRST is the forked app — the
# runtime shell itself, unpacked over .vsor/site-runtime rather than installed into
# node_modules. The rest are the workspace libraries it depends on, shipped as
# tarballs because the versions they declare (0.1.0) exist on no registry;
# lib/shared is here even though the app never imports it directly — three of the
# libraries do, and a nested `@vsor/lib-shared@0.1.0` is satisfied by the hoisted
# tarball. lib/plugin-og-image is deliberately absent: nothing depends on it, and it
# would drag satori + sharp into every user's install.
packed := ./app \
  ./lib/section-manifest-plugin \
  ./lib/plugin-structured-data \
  ./lib/remark-content-enhancements \
  ./lib/remark-flashcards \
  ./lib/remark-gallery \
  ./lib/remark-normalize-relative-links \
  ./lib/remark-tabs \
  ./lib/shared \
  ./lib/summaries-plugin

# The wheel transport (specs/vsor/build): pack the forked app and the workspace
# libraries and stage them + the shell package.json + a freshly generated shell
# package-lock.json into $(runtime_dir), then `uv build`. MUST precede `uv build`
# anywhere; the wheel-content test (packages/vsor/tests/test_wheel_contents.py)
# gates the ordering — it enumerates what to expect from the template's own
# `file:` deps, so adding a library needs no edit there.
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
	cd packages/sor-site && npm ci
	# The mdx and theme packages are gone (deleted 2026-08-14). The forked app
	# superseded both, the shell manifest referenced neither, so they shipped to
	# nobody while still looking like the files to edit; Phase A's last two
	# pointers at them (A3's token file, A4's prop baseline) were repointed at
	# app/src in the same change.
	rm -rf $(runtime_dir)
	mkdir -p $(runtime_dir)
	cd packages/sor-site && npm pack $(packed) --pack-destination "$(CURDIR)/$(runtime_dir)"
	# npm pack names a tarball <scope>-<name>-<version>.tgz; the shell references
	# stable names, so strip the scope prefix and the version suffix.
	cd $(runtime_dir) && for f in vsor-*.tgz; do \
	  mv "$$f" "$$(printf '%s' "$$f" | sed -E 's/^vsor-(.*)-[0-9]+\.[0-9]+\.[0-9]+\.tgz$$/\1.tgz/')"; \
	done
	cp packages/vsor/src/vsor/templates/site_runtime/package.json $(runtime_dir)/package.json
	# --prefer-online, found live 2026-08-14: this is a FRESH resolution against
	# the registry, and npm answers it from its cached packuments unless told
	# otherwise. On a machine whose cache predates a recent publish the two
	# disagree — a package resolves to a new version whose peer range names a
	# sibling version the stale packument does not list, and the step dies with
	# `ETARGET ... No matching version found for X@^N` for a version that exists
	# and that `npm view` prints happily. It failed twice in a row and passed on
	# the third run only because `npm view` had refreshed the metadata in
	# between. Revalidating makes the failure impossible instead of intermittent.
	cd $(runtime_dir) && npm install --package-lock-only --prefer-online
	uv build --package vsor

# Browser tier of specs/sor-site/surface (B5–B13, B15, B16; B14 retired
# 2026-08-14): builds the fixture site from the forked shell + the init scaffold
# + fixtures/tiny, twice — normally and with B12's sentinels — and runs the
# Playwright acceptance against both. There is no stock/themed axis any more:
# the design system is inside the shell and a project cannot opt out. Node lives
# only here — `gate` stays node-free. Installs nothing; one-time prereq:
#   (cd packages/sor-site && npm ci && npx playwright install chromium)
# build-acceptance runs first (before playwright): the browser assertions then
# certify the same config `vsor build` just proved it emits — one enforcement.
surface: build-acceptance
	bash packages/sor-site/e2e/run.sh
