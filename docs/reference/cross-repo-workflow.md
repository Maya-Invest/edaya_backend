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
