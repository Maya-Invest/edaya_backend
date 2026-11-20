# Shared client acceptance

Owner: Codex. Applies to the existing staff webapp, Guardian/Teacher mobile apps and generated contracts affected by Plan 00. Feature-specific screens remain in their owning plans.

## Authority and contract alignment

Web business fetches remain origin-pinned bearer requests with cookies omitted. `apps/webapp/src/lib/auth/access-token.ts` serializes renewal per origin, invalidates stale tokens and retries GET/HEAD at most once. Mutation responses are returned without a second request. Tests cover logout during exchange, principal replacement, distinct origins and no repeated payment mutation.

Mobile `HttpTransport` retains generated commands and explicit school/actor-kind/actor-ID/year headers from the selected session. Its 401 handling also retries only GET/HEAD once. Existing token tests cover concurrent renewal, origin isolation, logout and server changes. Action-grant parsing rejects unknown or incomplete scopes rather than widening authority. No client synthesizes staff grants for a guardian or teacher.

Attachment generic writes were removed from canonical exposure; TypeScript and Dart bindings were regenerated and drift checks pass. Upload completion purpose remains optional for the existing general default, while response purpose is required. Public upload admission cannot select a privileged purpose. Both web apps resolve the same installed local generated client; its schema and OpenAPI snapshot match the backend. The latest seed and private-delivery changes introduce no additional public DTO.

## Shared state, conflicts and retries

| State | Staff webapp | Guardian/Teacher mobile |
|---|---|---|
| Loading | Existing `PageQuery` loading contract and route-local query state | Existing controller busy/data signals and `DataState` |
| Empty | Localized `DataState`, preserving route shell where requested | Localized `DataState`; no fabricated broader query |
| Read error/retry | Localized error display; explicit page reload refetches current data | Existing explicit reload callback; selected profile remains authoritative |
| Mutation rejected | Optimistic rollback, existing field/domain error conventions, no automatic repeat | Existing draft/rollback behavior and localized feature errors, no automatic repeat |
| HTTP 409 | Shared FR/EN reload-and-review guidance | Shared FR/EN `mutationFailureMessage` used by profile, attendance, marks, evaluation creation and logbook saves |
| Write confirmed, display refresh fails | Retain the result and optimistic state, bump affected versions, show saved-but-refresh-failed guidance | Profile and mark flows retain the saved result; `refreshAfterMutation` reports display failure without repeating the write |

The web's 23 route mutation runners now delegate to a single `executeMutation` implementation through localized feedback, preserving each existing route's default version families and hooks. The older `runMutation` entry point delegates too, retaining its academic-shell refresh option. The normative route-state specification now distinguishes a server rejection from a failed refresh after commit. New tests execute the production shared implementation, checking call order, one request, confirmed-result preservation, 401/409/500 rollback, FR/EN conflicts and existing validation/deletion messages.

Mobile's shared API helper contains no mutation request and cannot replay one. A production account-profile controller test confirms that a guardian save uses the original guardian target exactly once, retains the draft on conflict, and returns success after a failed display callback while clearing its busy state. Shared helper tests cover both locales, preserved non-conflict messages and successful/failed refresh. Existing teacher mark and attendance tests remain in the full suite.

Read retry does not confer mutation replay safety. Multi-command feature workflows retain their own domain completion semantics; future features must adopt the shared backend command contract before introducing automatic mutation retries.

## Verification

Frontend `bun run verify` passes hygiene, quality/build and 782 tests (777 webapp, 2 webadmin, 3 repository). Changed webapp quality/build/test tasks ran uncached; unchanged package results may use Turbo cache. Source behavior and translations are tested without claiming a live browser/provider journey.

Mobile `melos run verify` passes brand/generated checks, analysis and 111 isolated tests, including the new controller cases; exact outputs are recorded in the exit evidence. Existing design-review widget tests cover current production components in FR/EN, phone/tablet, light/dark and enlarged text. These are local widget checks, not physical-device or deployed login evidence.

The [dependency handoff](00-dependency-handoff.md) requires every later feature to supply its own client contract, loading/error/conflict/retry and selected-profile acceptance before completion.
