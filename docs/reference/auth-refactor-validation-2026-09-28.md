# Auth refactor validation — 2026-09-28

The implementation does **not** yet have an all-green validation result. All three repositories' unit suites pass, and backend integration passes. Web invitation landing and guardian mobile UI integration failures remain; the teacher app has no tests matching its configured live integration command.

## Scope and environment

Tested the current uncommitted implementation over backend `406d4977`, frontend `4d7694c`, and mobile `531d8e7`. These results describe those working trees, not just the commits.

Runs used fresh, disposable local Postgres databases, the real local identity and school applications, a local files service, Chromium, and Flutter's widget-test runtime. Frontend browser tests used Vite. Notification transports were local logs; the test-only OTP lookup supplied codes. No production or staging database was changed, and no real email, Telegram, or WhatsApp delivery was exercised. The shared stack was seeded with `bun repo seed --skip-profile-photos --skip-attachments`.

The shared stack used `REQUIRE_PRIVILEGED_TOTP=false`; these browser and mobile journeys therefore do not establish production owner MFA enforcement. This run is automated local-suite validation, not deployed-environment or real-provider acceptance testing.

## Results

| Repository / suite | Result |
| --- | --- |
| Backend units, forced Turbo run | 1,994 passed; 0 failed |
| Backend API and HTTP integration | 18 + 32 passed; 0 failed |
| Backend native Postgres integration | 60 passed; 0 failed; 3 optional performance benchmarks skipped |
| Backend seed integration, final run | 8 passed; 0 failed |
| Frontend units, forced Turbo run | 880 passed; 0 failed |
| Frontend onboarding, including supplemental scenes | 20 scenes passed; 2 failed |
| Frontend provisioned workflow matrix | 374 OK; 0 NOT OK; 1 N/A across 375 rows |
| Frontend seeded demo walkthrough | 82 passed; 0 failed; 0 skipped |
| Mobile units and widgets | 133 passed across 6 packages/apps |
| Mobile shared live API integration | 45 passed; 2 skipped because no published report cards were seeded |
| Mobile guardian live UI integration | 16 passed; 4 failed; all 4 failures reproduced in a targeted rerun |
| Mobile teacher live UI integration | No matching `integration` tests; command exited 79 |

Frontend `svelte-check` and test TypeScript checking passed with zero errors and warnings. All three repositories passed `git diff --check`.

The provisioned matrix excludes Auth, Onboarding, and Tools/imports by its existing policy; onboarding was exercised separately. Its N/A row is grade entry: no grade-entry control was found, and evaluation submission returned `409 MARKS_ROSTER_EMPTY`. Treat this as an uncovered workflow, not a passing grading test. The optional XLSX export failed because `openpyxl` is unavailable; JSON and CSV results were generated successfully.

## Failures and coverage gaps

### Web teacher and guardian invitations

Both `invited-teacher` and `invited-guardian` fail their post-acceptance landing assertion. The invitee's second tab displays “Cette invitation a déjà été utilisée” and asks the user to sign in, instead of the linked-account confirmation or the appropriate portal gate. Both failures reproduced independently. This is an invitation completion defect to investigate before release; passing ordinary staff invitations does not cover it.

The canonical onboarding runner stops at the first failure: 19 scenes passed before the teacher scene failed. A supplemental runner executed the remaining guardian invitation and owner relogin scenes. Owner relogin passed; guardian invitation failed. Thus every one of the 22 existing scenes was exercised, but the canonical command remains failing. Failure screenshots from the canonical runner show the owner page; supplemental diagnostics captured the actual invitee tab.

Relevant source: `edaya_frontend/apps/webapp/src/routes/invite/[token]/+page.svelte`, `src/lib/auth/accept-pending-invite.ts`, and `tests/integration/onboarding/support/invite.ts`.

### Guardian mobile UI

The full suite and a four-test rerun both failed these assertions:

- Fees navigation: expected `Résumé` text was absent (`guardian_screens_integration_test.dart:80`).
- Two-child guardian context switching: alternate student text was absent; the finder threw `Bad state: No element` (`support/pump_guardian_page.dart:299`).
- Grade details: expected the assessment title containing `Reading`, but it was absent (`guardian_screens_integration_test.dart:193`).
- Multi-child guardian context switching: the same alternate-student finder failed.

These are reproducible UI-test failures. Their underlying causes and whether each is product behavior or stale/asynchronous test expectations are not established by this run. Authentication and the shared teacher/guardian API journeys passed.

### Teacher mobile live UI coverage

The repository's configured command is `flutter test test/integration --tags integration`. The teacher directory contains a design-review test tagged `design-review`, but no matching `integration` test. That design-review test already ran in the unit/widget suite. Shared teacher API integration passing does not establish teacher UI integration coverage.

### Seed timeout and false-success status

The first seed run overlapped the expensive unit suites and timed out in full-fixture setup at 180 and 120 seconds. Its output reported 3 passes and 2 failures, yet the command exited 0. A subsequent complete run after the unit suites finished passed all 8 tests in 191.73 seconds. Resource contention is a plausible explanation for the initial timeouts, not a proven root cause. The zero exit status despite reported hook failures is a separate CI reliability gap to fix.

### Slow frontend readiness helper

`scripts/qa-harness-ui.ts:87` waits for the global `edaya:yearId` session-storage key. The app's `src/lib/academic/context.svelte.ts` persists `edaya:yearId:<schoolId>` once school context is set. This makes repeated readiness checks exhaust their 20-second wait before using a visible-label fallback. The suite was allowed to finish unchanged; align that helper with school-scoped state in a later test-maintenance change.

## Test-only adjustments

Four frontend harness files were adjusted during validation:

- `tests/integration/support/passwordless.ts`
- `tests/integration/demo-dry-run/support/auth.ts`
- `tests/integration/onboarding/scenes/login-signup-ui.ts`
- `tests/integration/onboarding/support/invite.ts`

The OTP controls now target visible elements because login mounts both sign-in and sign-up panels with the same test IDs. The wrong-account assertion recognizes the actual localized contact-mismatch message. Acceptance rejection assertions remain intact. Initial duplicate-selector failures were harness failures, not hundreds of independent product defects. No product source was changed during this validation request. Generated mobile design-review timestamps were restored to their pre-run contents.

## Commands and evidence

Backend commands, from `edaya_backend`:

```sh
bunx turbo run test --force --concurrency=2 -- --dots
bun run test:integration
bun run test:integration:native
bun run test:integration:seed
```

Frontend commands, from `edaya_frontend`, with the disposable stack's local URL environment:

```sh
bunx turbo run test --force -- --dots
bun run test:integration:onboarding
bun run test:integration:provisioned
bun --filter @edaya/webapp demo:e2e
bun --filter @edaya/webapp check
```

Mobile commands, from `edaya_mobile`, with the seeded stack's local URL environment:

```sh
melos run test
melos run test:integration
# Run separately because the combined command stops after guardian failures:
cd apps/teacher
EDAYA_INTEGRATION_TESTS=1 flutter test test/integration --tags integration
```

Local run logs, the disposable-stack launcher, supplemental runners' results, and invitee screenshots are in `/private/tmp/edaya-full-validation-20260928`. Browser suite summaries are also in `edaya_frontend/apps/webapp/.onboarding-run`, `.integration-run`, and `.demo-dry-run`. These local generated artifacts are not committed and temporary-directory retention is not guaranteed.
