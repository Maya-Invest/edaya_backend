# Submitted marks and staff-approved corrections

This replaces the initial approval lifecycle described in the earlier remediation ledger. The current contract is **Draft → Submitted**: initial submission makes marks official; subsequent corrections require independent staff review. Deployment and the operational database reset remain separate.

## Implementation

- Migration `0034_marks_corrections.sql` introduces immutable correction proposals, one pending request per evaluation, result revisions, and exact report source-mark dependencies. Historical migrations are retained; installation assumes the agreed empty database, with no legacy-state conversion.
- `services/workflows/marks-review.ts` handles submission. `marks-corrections.ts` owns request/approve/reject/withdraw, optimistic concurrency, authorized command replay, whole-batch validation/application, and the shared academic transaction lock.
- Generic writes cannot bypass submission or modify correction-owned fields. Review uses class-scoped `GRADE_VALIDATE` and denies the author across identity profiles, including owners. The original submitter can review another author's proposal.
- Family reads and notifications use Submitted official values. Notifications and draft invalidation use individual result revisions. Pending/rejected/withdrawn proposals never alter official values.
- Reports retain only source marks for applicable curriculum subjects, including transferred marks, absence/exemption, and multi-period sources. Pending proposals block only affected students. Published source marks are permanently locked; unrelated students and omitted subjects remain correctable.
- Web grading provides a batch proposal editor, before/after history, withdrawal and staff decisions; the staff queue is paginated. Report screens explain pending correction blockers and restrict review links by permission.
- Mobile retains offline Draft edits, flushes before submission, keeps frozen/stale edits as visible conflicts, and never overlays them on Submitted official marks. Online correction request IDs persist across uncertain retries and controller recreation.
- OpenAPI, TypeScript, Dart, the installed web dependency, and all three release manifests are synchronized. Seeds include Draft/Submitted sheets, pending/approved/rejected corrections, and published reports with locked source marks.

Paths above are relative to `package/domain-service/src` unless a migration or application is specified. Existing unrelated integration-test changes in all three working trees are preserved.

## Verification

All required local gates passed. Command results and log digests are recorded in [the verification evidence](submitted-marks-corrections-verification.json): backend full verification (765 service tests, 286 API tests, 195 PostgreSQL adapter tests, 18 service integration tests and 34 authentication/HTTP tests), native PostgreSQL (61 passed; three optional benchmarks skipped), native seeds (8 passed), web verification (931 webapp tests), mobile verification (six clean analyzer packages and all tests passed), and all three contract comparisons.

The initial sandboxed backend run hit a Chrome PDF timeout. The unchanged renderer test passed outside the sandbox in under one second, and the complete backend run then passed with Chrome execution permitted. No timeout was increased.

Key regressions are:

| Boundary | Evidence |
|---|---|
| Submission, correction validation, replay, visibility, comments and precision | Service `tests/services/workflows/marks-review.test.ts` |
| Per-student and omitted-subject locks; transfers and multi-period reports | Service marks-review regressions |
| Independent review, owner/profile separation and publication races | Native `src/native/marks-approval.test.ts` |
| Generated HTTP contract and ISO decision timestamps | `src/routes/test-marks-corrections.integration.test.ts` |
| All-or-nothing approval and scoped queue counts | Service marks-review regressions |
| 51/501-row consumer paging | Service queue and existing app pagination regressions |
| Offline conflict visibility and retry identity persistence | Teacher `test/marks_corrections_test.dart` |
| Fresh seed states and correction examples | Native seed `src/seed/contract.test.ts` plus HTTP seed checks |

The deployed teacher → family → correction → staff review → report publication journey remains in [the coordinated release acceptance checklist](backend-release-acceptance.md). Local tests do not certify provider delivery or physical-device acceptance. No timeout increase, remote reset, deployment, or published-report correction/reissue is part of this change.
