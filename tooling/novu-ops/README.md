# Novu operations

`bootstrap/` previews and applies the single immediate email workflow consumed by the Novu email transport. `cleanup/` previews and deletes explicitly selected provider subscriber records. `src/subscriber-cleanup.ts` implements cleanup selection and bounded deletion; tests use synthetic provider records.

School profiles and preferences are not synchronized with Novu. During authorization cutover, export provider history, stop old workflow executions and review subscriber IDs before cleanup. Keep unrelated applications' subscribers and workflows. These tools run outside request handling and never select an authorization model.
