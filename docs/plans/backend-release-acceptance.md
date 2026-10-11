# Coordinated release acceptance

Use this checklist after the separately managed reset and coordinated deployment. Local automated evidence is recorded in [backend-remediation.md](backend-remediation.md); passing local tests does not mark these environment checks complete.

## Prerequisites

- Release each repository from its independently qualified source and checksummed artifacts. Backend compatibility gates protect released clients; consumers record their acquired backend commit. See the current independent CI setup guide.
- Install forward migrations into the empty database. Seed an explicit finance currency and distinct teacher/reviewer identity subjects, with Draft and Submitted evaluations, pending/approved/rejected corrections, and published reports with locked source marks.
- Retire old sessions, school caches and pending mobile mutations before reopening. Reset target selection and Identity/storage deletion are outside this implementation.
- Record the deployed revisions, environment, reviewer and execution time with each result below. Never put access tokens, passwords or private student records into evidence.

## Interactive acceptance

| Journey | Steps and required result | Environment result |
|---|---|---|
| Teacher → staff → guardian | Teacher saves fractional marks plus absence/exemption; blank roster blocks submission. Flush pending edits and submit online. Verify locked marks/configuration. Guardian immediately sees official submitted marks and receives a notification. Request a batch correction; values stay unchanged until a distinct scoped staff reviewer approves it. Only changed students receive correction notifications. | Pending deployment |
| Corrections and conflicts | Propose score/designation/comment changes with a reason. Reject with a reason or withdraw as author; official marks stay unchanged. The correction author cannot review through another profile, including as owner; the original submitter may review another author’s request. A delayed Draft outbox edit remains an actionable conflict and never overwrites Submitted values. Retry uncertain commands with the same ID. | Pending deployment |
| Report generation | Generate a draft with missing submissions and pending corrections and verify publication is blocked. Submit all sources and resolve relevant corrections, write root/nested subject/group comments, regenerate, and publish. Verify decimals and no-score em dashes in the actual rendered PDF. Removing a commented section must produce a reconciliation conflict. | Pending deployment |
| Transfers and publication | Use a period transfer and matching curriculum subject IDs in two classes. Verify period-end placement, carried submitted marks and destination weights. Retry publication with another proposed result ID; verify one logical publication, issuance and notification. Attempt a correction to a published source mark and verify permanent denial; other students’ marks in that evaluation remain correctable. | Pending deployment |
| Finance | Set the school's currency before creating a catalog. Perform two distinct catalog edits and repeat one request ID unchanged/changed. Verify retry/conflict behavior. Record partial installments, reverse allocations/payments, compare statement, student summary, aging and dashboard on the same date. Reject mismatched currency and currency changes after records exist. | Pending deployment |
| Multiple installations | Register two devices and teacher/guardian apps for an eligible subject. Rotate one token; log out one installation. Verify the other registrations survive. Force one installation delivery to fail and verify retry does not resend successful installations. | Pending provider/device access |
| Files, photos and documents | Upload/download authorized files and photos; deny another family. Render a document with delayed external work while the initiating request closes. Verify cron recovery, authorized download and attachment ownership after completion. | Pending deployment/provider access |
| Family feedback | Teacher publishes feedback for the intended family; guardian reads/responds; staff sees only authorized class/year records. Switch profile/year and verify scoped results and foreign-school denial. | Pending deployment |
| Pagination | Exercise 51 and 501 records in consumer lists; verify every permitted row is reachable once and counts exclude Draft or unauthorized records. | Automated consumer cases; deployment smoke pending |

Submission, correction review, offline conflict handling, currency and installation identity are implemented contracts. Teacher aggregate proposals, SMS, payment providers, subscriptions, pairing codes and published-report correction/reissue remain deferred.
