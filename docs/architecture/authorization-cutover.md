# Coordinated authorization cutover

This procedure deploys one authorization implementation with matching data and clients. It is a deployment procedure, not a request-time migration or feature flag. The implementation plan must be complete and the final acceptance checks must pass before executing it. No live cutover has been performed as part of development.

## Prepare and rehearse

1. Build and retain the exact backend, web, mobile and generated-client versions being deployed, plus the previous application versions. Verify central identity contracts against the merged identity implementation.
2. Rehearse the migrations on a restored copy of the current school database, including its `drizzle` journal and `notify` schema. Run backend, generated-contract, web and mobile checks and the actor/action/resource acceptance cases against the migrated copy.
3. Review migration failures explicitly. Do not infer a recipient profile from a login, convert an unknown scope to school access, delete ambiguous history automatically or mark a failed migration as applied.

## Data changes

| Migration | Authoritative data | Failure handling |
| --- | --- | --- |
| `0009_typed_staff_grants` | Typed manual scopes with original status, validity and provenance; verified assignment-derived grant copies removed | Ambiguous grants abort conversion; resolve them from business records before retrying |
| `0010_guardian_relationship_details` | Guardian report/attendance preferences and legal/contact settings, optional health details | Old rows retain their previous domain defaults; previously discarded settings cannot be reconstructed |
| `0011_notification_delivery_sources` | Source keys and unique school/source/login/profile delivery identity | Unknown generated source, absent recipient profile or duplicate source/profile history aborts migration |
| `0012_notification_contact_authority` | Native school-contact snapshots removed; dispatch reads the exact current business profile | Ambiguous command destinations abort retirement; authentication/invitation destinations, jobs, receipts and devices are retained |

Notification migration recognizes the old generated event ID only in offline SQL, using its stored event key and exact login suffix. Announcements use their stored announcement ID. Manually recorded event deliveries without a generated ID keep no automatic source key. Existing IDs, recipient tuples, title/body, timestamps, read state and provider identifiers remain unchanged. Provider jobs and external push links continue using those same IDs. Lost profile-specific deliveries from the old login-only deduplication are not invented during migration.

## Deploy

1. Pause API writes, scheduled jobs, background dispatch and provider callback processing; let in-flight commands and sends finish. Record any provider events received during the pause for normal replay afterward. Keep old application instances stopped throughout migration and deployment.
2. Take a consistent, restorable snapshot of school data, the migration journal and the notification queue. Record its matching application versions. Retain provider delivery history for reconciling sends that already happened.
3. Run `bun repo db migrate staging` through deployment tooling. For production, use `bun repo db migrate production` after the staging rehearsal succeeds. These commands apply school migrations in journal order and then the notification schema. Disable automatic startup migrations for this coordinated cutover.
4. Deploy the matched backend and web builds and make the matched mobile version available under the release process. Remove old backend instances before resuming traffic; do not keep a compatibility evaluator or route selected clients to old authorization.
5. Smoke-test selected-profile isolation, scoped staff access, subject versus homeroom authority, owner/service boundaries, list/count/single-read consistency, publication and batch/reassignment denial. Retry an existing notification and confirm its delivery/provider ID and read state are retained. Verify provider receipts from the new immediate email workflow carry the persisted delivery ID and login correlation. Change a queued recipient’s contact, then revoke a relationship or publication, and confirm the dispatcher uses the current contact or cancels without sending. Verify shared-login profiles retain separate preferences.
6. When using Novu email, apply the single `transactional.email` workflow. Export and drain or cancel executions of the former EDAYA event/auth/invitation workflows, retire those workflows, and delete their reviewed subscriber IDs with `bun repo novu cleanup apply -- --ids <reviewed-ids> --yes`. Preserve unrelated applications and export delivery history before cleanup. Set `EMAIL_TRANSPORT=novu` and remove `NOTIFICATION_PROVIDER`; configure FCM on the school runtime and have mobile clients re-register push devices.
7. Resume provider callbacks, queue dispatch and scheduled jobs. Monitor failed commands, migration/data errors and delivery reconciliation. No live grants or relationship decisions are shared between requests.

## Roll back

Pause traffic, jobs and callbacks again. Restore the matching pre-cutover school data, migration journal and notification queue together, then restore the corresponding application versions and matching provider workflow/configuration versions. Do not run the previous application against the typed-grant schema or the replacement application against the old schema. Do not add fallback checks or dual writes to enable rollback.

Database restore cannot undo external emails, pushes or provider read events. Reconcile provider history with the restored queue before dispatch resumes, preserving idempotency keys and suppressing already-sent work. If post-cutover business writes occurred, preserve and reconcile them explicitly before restoration; restoring a snapshot silently would discard those writes. Rehearse this recovery with the release snapshot before production cutover.
