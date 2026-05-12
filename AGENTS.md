# Agent Instructions

This file applies to the entire repository.

Before making any code changes, read `./MAINTENANCE.md`.

Follow these rules for every maintenance task or new feature:

1. Inspect the relevant files before planning or editing.
2. Follow the architecture and change rules in `./MAINTENANCE.md`.
3. Keep changes small, focused, and consistent with the existing module boundaries.
4. Do not recreate large monolithic files or duplicate logic that already has an owner module.
5. Preserve public exports, persisted storage keys, and persisted state shapes unless the user explicitly asks for a breaking change.
6. Run the relevant diagnostics, lint/build checks, and manual smoke checks described in `./MAINTENANCE.md` before handing off.

If the ownership or structure for a change is unclear, stop and ask before editing.
