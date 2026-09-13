# Novu email workflow bootstrap

The catalog defines exactly one `transactional.email` workflow with one immediate email step. Business templates are rendered in the school application. Authorization, contacts, preferences, scheduling, inbox and push remain in the school dispatcher.

Use `bun repo novu bootstrap` to preview and `bun repo novu bootstrap apply` to apply the catalog with the configured `NOVU_SECRET_KEY` and optional `NOVU_API_URL`. Review the CLI help for environment selection. Applying the catalog does not delete other provider workflows. Retire former EDAYA event, auth and invitation workflows separately during the paused coordinated cutover, after exporting and draining their history.
