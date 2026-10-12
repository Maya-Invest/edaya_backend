# Repository integration

See [independent CI and releases](ci-setup.md) for destination-branch acquisition, compatibility gates, artifact handoff and rollout requirements.

The backend preserves tracked OpenAPI drift checks and verifies compatibility without checking out consumers.

## Coordinated timetable publication removal

The timetable change is an intentional breaking release. Deploy the school database migration `0039_timetable_generation_final.sql`, backend and regenerated first-party clients together. Do not run old backend instances against the migrated boolean column. Stop academic writes while replacing the old instances, apply the migration, and start the matching backend and clients before reopening writes.

Both legacy timetable states become `timetableGenerated: true`; absent states become false. IDs, teacher snapshots and previously issued documents remain unchanged. The migration deletes `TIMETABLE_PUBLISH` grants and profile entries without adding replacement authority. Generation still requires scoped `TIMETABLE_CREATE`. Publication and republication routes are removed, so old clients must upgrade.

Generation now runs replacement, protection checks, conflict validation and persistence under the school academic transaction lock. Only pending generated lessons without exceptions, notes, attendance (including saved drafts), curriculum progress, validation/correction history, assessments or explicit session references are replaceable. Active preserved lessons count toward workload and occupancy; cancelled lessons block their class interval without consuming workload. Class and teacher PDFs use the current noncancelled generated lessons in the selected academic year; printing neither protects lessons nor mutates earlier document snapshots.

The historical OpenAPI compatibility baseline intentionally remains unchanged. Its normal additive-only compatibility gate will report the removed endpoints, permission and changed field type. Release approval must explicitly account for this coordinated breaking change; do not bypass the gate by overwriting the historical baseline. Regenerate the frontend client from the committed backend release before qualification.
