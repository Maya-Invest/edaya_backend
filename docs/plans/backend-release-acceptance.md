# Coordinated release acceptance

Use this checklist after the separately managed reset and coordinated deployment. Local automated evidence is recorded in [backend-remediation.md](backend-remediation.md); passing local tests does not mark these environment checks complete.

## Prerequisites

- Deploy the backend and web/mobile artifacts identified by the same `release-contract.json` release ID. Compare the schema fingerprint and generated artifacts before enabling users.
- Install forward migrations into the empty database. Seed an explicit finance currency and distinct teacher/reviewer identity subjects, with Draft, Submitted and Approved evaluations.
- Retire old sessions, school caches and pending mobile mutations before reopening. Reset target selection and Identity/storage deletion are outside this implementation.
- Record the deployed revisions, environment, reviewer and execution time with each result below. Never put access tokens, passwords or private student records into evidence.

## Interactive acceptance

| Journey | Steps and required result | Environment result |
|---|---|---|
| Teacher → staff → guardian | Teacher saves fractional marks plus absence/exemption; blank roster blocks submission. Flush pending edits and submit online. Verify locked marks/configuration. A distinct scoped staff reviewer approves the inspected revision. Guardian sees marks and receives notification only after approval. | Pending deployment |
| Return and conflicts | Return a Submitted/Approved sheet with a reason. Teacher sees the reason and reconciles the effective roster. A delayed pre-return edit remains a visible conflict. The submitter or current mark editor cannot approve through another profile. | Pending deployment |
| Report generation | Generate a draft with outstanding approvals and verify publication is blocked. Approve all sources, write root/nested subject/group comments, regenerate, and publish. Verify decimals and no-score em dashes in the actual rendered PDF. Removing a commented section must produce a reconciliation conflict. | Pending deployment |
| Transfers and publication | Use a period transfer and matching curriculum subject IDs in two classes. Verify period-end placement, carried approved marks and destination weights. Retry publication with another proposed result ID; verify one logical publication, issuance and notification. Attempt returning a dependent sheet and verify denial. | Pending deployment |
| Finance | Set the school's currency before creating a catalog. Perform two distinct catalog edits and repeat one request ID unchanged/changed. Verify retry/conflict behavior. Record partial installments, reverse allocations/payments, compare statement, student summary, aging and dashboard on the same date. Reject mismatched currency and currency changes after records exist. | Pending deployment |
| Multiple installations | Register two devices and teacher/guardian apps for an eligible subject. Rotate one token; log out one installation. Verify the other registrations survive. Force one installation delivery to fail and verify retry does not resend successful installations. | Pending provider/device access |
| Files, photos and documents | Upload/download authorized files and photos; deny another family. Render a document with delayed external work while the initiating request closes. Verify cron recovery, authorized download and attachment ownership after completion. | Pending deployment/provider access |
| Family feedback | Teacher publishes feedback for the intended family; guardian reads/responds; staff sees only authorized class/year records. Switch profile/year and verify scoped results and foreign-school denial. | Pending deployment |
| Pagination | Exercise 51 and 501 records in consumer lists; verify every permitted row is reachable once and counts exclude unapproved or unauthorized records. | Automated consumer cases; deployment smoke pending |

Approval, offline conflict handling, currency and installation identity are implemented contracts. Teacher aggregate proposals, SMS, payment providers, subscriptions, pairing codes and published-report correction/reissue remain deferred.
