# Agent guidance

## UI architecture

When working on `apps/webapp` screens, layouts, drawers, or modals, follow:

**[specs/app-shell-spec.md](specs/app-shell-spec.md)**

Key rules (summary):

- List + URL-backed detail drawer + mutation modals
- Drawer is read-only; edits via action buttons → modals
- Sub-collection tabs: read-only lists; add/edit always modal
- Pragmatic inline toggles only for boolean/single-value fields
- Use `DataState` for loading/empty/error; toast on mutations

Cursor rule: `.cursor/rules/app-shell.mdc` (applies when editing `apps/webapp/**`).
