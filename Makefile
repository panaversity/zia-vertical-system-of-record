# The one command vocabulary. AGENTS.md quotes these targets, CI calls these targets,
# humans and agents type these targets — so the three can never drift.
# Contributor-facing only: users see the vsor verbs, never this file.

.PHONY: lock lint fmt typecheck test boundary gate

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

gate: lint typecheck test boundary
	@echo "gate: green"
