# Integration refresh validation

This records the integration-test refresh across backend, frontend, and mobile. The earlier `auth-refactor-validation-2026-09-28.md` describes the failures that motivated this work; it is historical evidence, not the current result.

## Implemented coverage and execution controls

- Frontend feature/scenario IDs are checked against the route, sidebar, and modal catalogs. Mobile inventories walk the registered GoRouter trees and validate explicitly registered actions and overlays.
- Results come from executable scenarios. Coverage validation rejects missing/duplicate/removed IDs, unmapped routes, zero tests, failed fixtures, blocked or skipped required tests, unsuccessful machine outcomes, and stale source fingerprints.
- CI runs frontend and mobile separately. Mobile API, guardian, and teacher jobs have independent disposable services and aggregate their outcomes without fail-fast cancellation. JSON outcomes and masked failure artifacts are retained; spreadsheet export is optional.
- Authentication uses the real identity application and UI with OTP delivery captured at a test-only transport boundary. The private mailbox is excluded from uploaded artifacts.
- Mutating workflows verify saved data and applicable access boundaries. Required grading, report-card, child, document, payment, inbox, assignment, and feedback fixtures are explicit.

## Confirmed defects repaired

- Teacher and guardian invitation completion retains the successful linked-account destination. Creating a person now opens the new profile without a modal-close history traversal racing over that navigation.
- Guardian fees, child switching, and grade-detail tests wait for the actual loaded data and preserve meaningful assertions. Related product fixes cover the narrow fee layout, encoded routes, and report-card period lookup.
- Teacher live workflows dispose Levit state between tests and avoid late controller updates after disposal.
- Frontend fixes cover modal state/lifecycle, document-form remounts, encoded daily-attendance routes, import IDs and timetable date fields, and authenticated file/portrait reads.
- Removing unused curriculum definitions also removes their scoped mirrors transactionally; recorded progress still prevents deletion. Bulk command arrays now serialize their public entity shape correctly.
- The backend native/seed runner rejects reported failures even when the child process exits zero.

## Verification

| Suite | Result |
|---|---|
| Backend unit/check graph | 39 tasks passed |
| Backend API / HTTP integration | 21 / 32 passed; repeat passed |
| Backend native PostgreSQL integration | 60 passed; repeat passed |
| Backend seed integration | 8 passed; repeat passed |
| Frontend unit tests | 891 passed |
| Frontend type checks / lint | Passed; Svelte check: 0 errors and 0 warnings |
| Frontend authentication / onboarding | 28 passed in two clean runs |
| Webadmin navigation / placeholders | 4 passed in two clean runs |
| Frontend execution/coverage validator | Passed after both clean runs and after restoring the fault-injection probes |
| Frontend feature matrix | 398 passed in two clean runs; 0 failures / 0 N/A |
| Mobile unit/widget suites | All six packages passed: 132 tests |
| Mobile API / guardian / teacher integration | 47 / 42 / 27 passed in two clean runs |
| Mobile analyzer / coverage validator | Passed |
| Mobile runner negative tests | 16 passed |

All required suites passed. The final frontend repeat used newly created disposable databases. The mobile API and both live-widget suites also passed twice; backend API/HTTP, native PostgreSQL, and seed suites passed their repeat runs.

The public frontend coverage command was exercised with a temporary unmapped production route and then a removed required scenario: both exited nonzero. Original sources were restored byte-for-byte, and coverage validated again. A separate broken-fixture process failed, blocked its dependent scenario, and still executed an independent scenario. A real synthetic mobile child emitted all 47 required IDs and exited zero while reporting one failed test; the integration runner correctly returned failure.

Frontend unit tests include negative coverage-gate cases and the modal-to-profile navigation regression. Mobile negative tests reject removed scenarios, new unmapped routes, missing fixtures, unexpected skips, incomplete streams, stale artifacts, and failure events paired with exit code zero.

The native backend suite explicitly excludes three opt-in performance benchmarks. The onboarding catalog explicitly excludes two development-only demo-login actions. These exclusions do not count as successful required workflows.

## Commands and evidence

Public frontend commands: `bun run test:integration:onboarding`, `bun run test:integration:provisioned`, `bun run test:integration:webadmin`, and `bun run test:integration:coverage`.

Public mobile commands: `dart run melos run test:integration` and `dart run melos run test:integration:coverage`. The underlying runner also supports `python3 scripts/integration-runner.py --suite api`, `--suite guardian`, or `--suite teacher`.

Backend commands: `bun run test --concurrency=2`, `bun run test:integration`, `bun run test:integration:native`, and `bun run test:integration:seed`.

Local machine-readable results are in frontend `apps/webapp/.integration-run`, `.onboarding-run`, and `.webadmin-run`, and mobile `.integration-results`. Detailed validation logs and clean-run snapshots are under `/private/tmp/edaya-integration-refresh`; temporary evidence is not guaranteed to survive machine cleanup. No remote CI run, commit, push, or deployment was performed.

## Coverage limits

Real email/Telegram/WhatsApp delivery, push delivery, device/emulator and native-platform behavior, and future support-assisted recovery remain outside this change. Webadmin covers only its current navigation and placeholder routes. Structural inventory checks detect drift; reviewers must still verify that assertions express the intended feature behavior.
