# The one command vocabulary. AGENTS.md quotes these targets, CI calls these targets,
# humans and agents type these targets — so the three can never drift.
# Contributor-facing only: users see the vsor verbs, never this file.

# The dev/CI stamp for `vsor init` (specs/vsor/init): the workspace package version is a
# 0.0.0 placeholder until publish, and init refuses placeholders unless the harness names
# the version to pin. Exported so test/acceptance/gate inherit it; `?=` lets a caller win.
export VSOR_DEV_VERSION ?= 0.1.0

.PHONY: lock lint fmt typecheck test boundary acceptance gate surface

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

# Browser tier of specs/sor-site/surface (B5–B14): builds the fixture site from
# the init scaffold + fixtures/tiny in stock and themed configs and runs the
# Playwright acceptance against both. Node lives only here — `gate` stays
# node-free. Installs nothing; one-time prereq:
#   (cd packages/sor-site && npm ci && npx playwright install chromium)
surface:
	bash packages/sor-site/e2e/run.sh
