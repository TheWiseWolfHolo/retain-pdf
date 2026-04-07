# RetainPDF Open Model Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the browser Docker build configure model API key, model base URL, fetch model IDs, and submit the selected model cleanly while preserving the existing visual language.

**Architecture:** Add a small Rust proxy endpoint for `/models`, add a focused frontend helper for model list normalization, then wire the browser credential dialog to persist and submit `base_url` / `model` / `api_key`. Keep desktop-specific persistence out of scope.

**Tech Stack:** Axum, Reqwest, vanilla ES modules, Tailwind CSS, Docker

---

### Task 1: Add failing tests for model catalog normalization

**Files:**
- Create: `frontend/tests/model-catalog.test.js`
- Modify: `frontend/package.json`

- [ ] Add Node test coverage for model list normalization, dedupe, and stored-config fallback handling.
- [ ] Run `node --test frontend/tests/model-catalog.test.js` and confirm it fails before implementation.

### Task 2: Implement backend model catalog proxy

**Files:**
- Modify: `backend/rust_api/src/routes/providers.rs`
- Modify: `backend/rust_api/src/lib.rs`

- [ ] Add a POST endpoint that accepts `base_url` + `api_key`, fetches `/models` server-side, and returns normalized model IDs.
- [ ] Add Rust unit tests for response normalization/status mapping.
- [ ] Run targeted cargo tests and confirm green.

### Task 3: Wire browser dialog and persisted config

**Files:**
- Create: `frontend/src/js/model-catalog.js`
- Modify: `frontend/src/js/config.js`
- Modify: `frontend/src/js/main.js`
- Modify: `frontend/src/js/state.js`
- Modify: `frontend/src/js/network.js`
- Modify: `frontend/src/partials/dialogs.html`
- Modify: `frontend/src/partials/main-content.html`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/runtime-config.local.example.js`

- [ ] Add inputs for model Base URL / Model ID and a fetch-models interaction.
- [ ] Persist browser-side mineru token, model key, model base URL, and model ID.
- [ ] Submit the effective model/base_url/api_key into job payload.
- [ ] Keep styling restrained and visually consistent with the current Apple-like dialog language.

### Task 4: Update docs and package Docker build

**Files:**
- Modify: `README.md`
- Modify: `docker/delivery/README.md`
- Optionally modify: `docker/delivery/docker/web.env`

- [ ] Add fork attribution and thanks to the original project.
- [ ] Document the new browser-side baseUrl/model selection behavior.
- [ ] Rebuild frontend CSS and local Docker images.
- [ ] Re-run local container deployment and verify health + page rendering.

### Task 5: Publish to GitHub

**Files:**
- Git remotes / GitHub repo state

- [ ] Fork or create the destination repo under `TheWiseWolfHolo`.
- [ ] Point local git remote to the user-owned repo without losing upstream reference.
- [ ] Commit the changes and push the updated branch.
