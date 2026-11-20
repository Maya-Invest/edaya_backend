# Plan 05 evidence — Family feedback surveys

Status: **on-going** (implementation landed; feature gate not passed).

Recorded 2026-09-15.

## Architecture delivered

- Frozen `family-feedback.v1` catalog (FR/EN stems, 1–5 + `cannot_assess`, confidentiality copy). Campaigns, slots, responses, snapshots and comment-read audit stay on private repositories, off `CoreEntityMap` / generic `/core/entities` routes.
- Permissions: `FAMILY_FEEDBACK_CAMPAIGN_READ|MANAGE`, `FAMILY_FEEDBACK_MODERATE`, `FAMILY_FEEDBACK_PUBLISH`. Studies-director extras include READ+MANAGE+PUBLISH, not MODERATE. Subject-level conflict denies the evaluated teacher (including owner staff profiles) from moderate/publish/raw comments.
- Lifecycle commands, audience preview (counts + blockers), launch snapshot, guardian submit receipts (`alreadyCompleted` without answers), cron `advanceFamilyFeedbackCampaigns` with `asOf`, complementary suppression (threshold 10 distinct guardian subjects), 90-day purge of raw answers/comment linkage.
- Notifications `family_feedback.opened|reminder|published|purge_reminder` without answer payloads. Guardian routes `/academic/family-feedback`; teacher published `/teaching/family-feedback`.

## Clients

- Staff `/school/family-feedback` list + URL drawer tabs Setup · Audience · Moderation · Results. Mutations stay in modals. Comments load only on the Moderation tab so opening Setup does not audit raw reads.
- Guardian nested `/academic/family-feedback` with student/teacher/subject/class/period context header and already-completed copy.
- Teacher nested `/teaching/family-feedback` published aggregates/themes only.

## Automated coverage

- Domain catalog + aggregation (9, 10, sibling subject, cannot_assess complementary suppression).
- Workflow: open/submit/receipt/already-completed, overlap, moderator conflict, owner-as-evaluated-teacher, cron open/close, threshold, fixture-seed draft, submit-after-close, withdrawn enrollment, retention purge, two-guardian race.
- API registry: no generic family-feedback entity list/one routes.
- OpenAPI export/generate for TypeScript `@maya-invest/edaya-api-client` and Dart `edaya_api_client` bindings.
- Staff drawer tab routing tests and QA matrix coverage for Setup · Audience · Moderation · Results.
- Mobile `parseNotificationDeepLink` for opened/reminder/published.

## Remaining for the feature gate

- End-to-end staff → guardian → moderate → publish → teacher walkthrough on a live demo school.
- Native Postgres isolation-level races and HTTP generic-entity 404 against a running API.
- Do not mark the plan `done` until that gate passes.
