# The one command vocabulary. AGENTS.md quotes these targets, CI calls these targets,
# humans and agents type these targets — so the three can never drift.
# Contributor-facing only: users see the vsor verbs, never this file.

# The dev/CI stamp for `vsor init` (specs/vsor/init): the workspace package version is a
# 0.0.0 placeholder until publish, and init refuses placeholders unless the harness names
# the version to pin. Exported so test/acceptance/gate inherit it; `?=` lets a caller win.
export VSOR_DEV_VERSION ?= 0.1.0

.PHONY: lock lint fmt typecheck test boundary acceptance gate

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

boundary:
	uv run --package vsor pytest tests -q

acceptance:
	bash tests/acceptance/init.sh

gate: lint typecheck test boundary acceptance
	@echo "gate: green"
