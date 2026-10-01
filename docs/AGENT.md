# AGENT.md — `docs/` (Knowledge Base)

## 1. Purpose
Human-readable truth for architecture, API, contract, and event ops. If it's not in `docs/`, it doesn't exist for new members.

## 2. Inputs
- Decisions from `contracts/`, `backend/`, frontends; expo logistics.

## 3. Outputs
- `architecture.md` — diagram + data flow + trust boundaries.
- `api.md` — REST + WS reference with examples (mirrors backend routes).
- `contract.md` — address per network, ABI link, gas notes, verify steps.
- `demo-script.md` — 90-sec volunteer script.
- `booth-checklist.md` — boot/failure-drill/nightly checklists.

## 4. Responsibilities
Keep docs in sync with code. Any `contract-change` PR must update the relevant doc in the same PR. No code in `docs/`.

## 5. Done
- [ ] New member can run e2e from `docs/` alone. Checklists printable on one page each.
