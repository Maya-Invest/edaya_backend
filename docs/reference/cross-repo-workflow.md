# Repository integration

See [independent CI and releases](ci-setup.md) for destination-branch acquisition, compatibility gates, artifact handoff and rollout requirements.

The backend preserves tracked OpenAPI drift checks and mandatory API regression tests without checking out consumers. Clients must upgrade to the current backend contract; historical wire compatibility is informational, not a release requirement.

## Coordinated timetable publication removal

The timetable change is an intentional breaking release. Deploy the school database migration `0039_timetable_generation_final.sql`, backend and regenerated first-party clients together. Do not run old backend instances against the migrated boolean column. Stop academic writes while replacing the old instances, apply the migration, and start the matching backend and clients before reopening writes.

Both legacy timetable states become `timetableGenerated: true`; absent states become false. IDs, teacher snapshots and previously issued documents remain unchanged. The migration deletes `TIMETABLE_PUBLISH` grants and profile entries without adding replacement authority. Generation still requires scoped `TIMETABLE_CREATE`. Publication and republication routes are removed, so old clients must upgrade.

Generation now runs replacement, protection checks, conflict validation and persistence under the school academic transaction lock. Only pending generated lessons without exceptions, notes, attendance (including saved drafts), curriculum progress, validation/correction history, assessments or explicit session references are replaceable. Active preserved lessons count toward workload and occupancy; cancelled lessons block their class interval without consuming workload. Class and teacher PDFs use the current noncancelled generated lessons in the selected academic year; printing neither protects lessons nor mutates earlier document snapshots.

The historical OpenAPI compatibility baseline intentionally remains unchanged. Qualification records the removed endpoints, permission and changed field type in `.ci-evidence/contract-changes.json` as client upgrade information. These historical differences do not block release; current-contract, authentication, authorization and persistence regressions still do. Regenerate and qualify both frontend and mobile clients from the same committed backend candidate before rollout.

## Durable school intake

Apply additive school migration `0047_durable_school_imports.sql` after the academic-discipline/placement-profile model. Upgrade web and mobile clients from the same backend candidate. The staff import UI uses the new typed `imports` namespace; former browser execution loops are removed. The mode is session-wide `S | M | O`, defaults to `M`, and optional `on_existing` rows override it. File metadata has no conflict option. See [durable school imports](../architecture/school-imports.md) for transaction, recovery, correction and format contracts. Rollout requires preview-only validation of prepared files before a separately approved live import.

## Automatic fee billing

Apply school migration `0049_auto_billing.sql` with the matching backend and regenerated first-party clients. It replaces the fee enrollment mode with `autoBilling`; every existing fee starts Off and the migration creates neither charges nor background work. Enabling All students or Matching students explicitly schedules missing assignments for active class placements in that fee's academic year. Existing charge snapshots and cancellations are preserved.

The transactional command outbox drives resumable automatic-billing runs. Request completion nudges the dispatcher, and the existing cron heartbeat recovers pending work. Fee details expose pending/running/completed/failed status and a retry command for unfinished work. Configuration and retry require catalog management plus assignment authority covering all students, classes, or grade levels in the fee's year; academic enrolment/profile writers need no added finance permission.

## Flat guardian contacts

Migration `0051_flat_guardian_contacts.sql` is a fresh-database breaking cutover and refuses populated guardian tables. Coordinate the backend with regenerated web and mobile clients. `updateGuardianProfile` replaces the contact-collection command and atomically saves supplied existing-child notification preferences. Guardian contacts are scalar import fields; the separate contact import is retired. Back up before resetting local school and identity databases; this cutover does not authorize resetting remote environments.

## Year-level dashboard

`getSchoolOverview` requires a school and academic year; its academic period is optional. A year-only response returns `academicPeriodId: null`, null period-dependent grading/report-card metrics, and no period-dependent action items. Other authorized summaries retain their existing year/date scopes. Supplied periods still require authorization and membership in the selected year. Regenerate first-party clients for the nullable response fields; no database migration or reset is needed.

## Flat report modules

Migration `0052_flat_report_modules.sql` is a clean-school-database cutover. It refuses populated report definitions, sections or results; it does not convert historical reports. Back up any local school data before resetting or reseeding it. The account/identity database is outside this cutover. Hosted resets and deployments require a separate rollout authorization.

Deploy the matching backend, web and mobile contracts together, generated from one immutable backend candidate. Report templates and their commands/resources are retired. Modules, membership and report settings are scoped to grade level/year; subjects retain categories and coefficients. The new configuration query supports report administrators independently of chapter access. No mobile module administration is added.

Run migration guard tests, both weighting modes, permission isolation, explicit generation/review/publication, annual source-version validation, report PDF rendering and mobile comment draft tests before reopening academic writes. Published results keep captured module/subject labels and weights. Draft regeneration uses the current configuration revision. Old offline template-section comments are not restored into the new report contract.

Deleting a module leaves its feedback on earlier publications. Regeneration carries forward comments for retained subjects by stable subject identity, including when they become ungrouped; it does not transfer a removed module's comment to another result group. Removed subject comments still require explicit reconciliation.

## Chapter coverage cutover

1. Restore a target backup into a disposable database. Run `tooling/repo/db/school/logbook-inventory.sql` and save its output by school. Resolve reported IDs against the original lessons. In particular, a summary by itself cannot establish when a teacher finished a chapter.
2. Apply migration 0057 on the copy. Run `tooling/repo/db/school/logbook-reconciliation.sql`. Verify that both discrepancy queries return zero rows. Compare counts of entries, notes, authors, inferred completions, pending corrections and locks to the inventory. Compare the percentage distributions to quantify the change schools will see. Run the migration again on that copy and compare both reports.
3. Deliver the matching web and mobile clients and communicate the required teacher app upgrade. Pause lesson writes, validation, correction decisions and curriculum changes. Drain in-flight transactions, take a recoverable backup, rerun inventory, migrate and reconcile. Reopen writes only after the upgraded clients can save and read the same lesson. Keep original percentage rows, workflow snapshots, receipts and queued PDF payloads through recovery.
4. Monitor upgrade responses, failed saves, correction conflicts, recovered drafts and document failures by school and client version. Before accepting new saves, the captured state can restore the old release. After accepting new saves, preserve the current database and command receipts, including approved corrections. Repair forward or restore a post-cutover recovery point and replay subsequent acknowledged work. Reconcile again before reopening writes.
