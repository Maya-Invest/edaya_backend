# Plan 05 — Family feedback surveys

| Field | Value |
|---|---|
| Status | planned |
| Created / updated | 2026-09-13 |
| Target | Existing backend, staff campaign/moderation UI, guardian submission and teacher published-results UI |
| Owner | Assign when implementation starts |
| Common requirements | [Plan 00](00-common-requirements.md) |
| Predecessor | [Plan 04 — Official documents](04-official-documents.md), complete with evidence |
| Next | [Plan 06 — Final release rehearsal](06-final-release-rehearsal.md) |

## Outcome and approved scope

Management runs a confidential family feedback campaign for an evaluated teacher assignment and publishes protected aggregate results and moderated themes. This is a separate feature from academic assessments and grading, labelled “Family feedback” / “Retour des familles.”

Use five-point questions plus “cannot assess.” Ask about family-observable communication, clarity, support and student experience. Do not portray responses as objective classroom observation or implement automatic teacher rankings.

Locked choices: one response per student/evaluated assignment/campaign; any currently eligible guardian may complete the slot; the first successful submission closes it. Optional written comments are included, with raw access limited to a designated moderator other than the evaluated teacher. Teachers receive published themes only.

## Entry prerequisites and source anchors

- [ ] Verify Plans 00–04 are `done`, including current guardian links, teaching/enrollment scope, private data projections, notifications and durable lifecycle jobs.
- [ ] Inventory existing academic “Évaluations” labels and routes so the survey UI cannot be confused with assessments.
- [ ] Establish separate campaign administration, submission, moderation and publication permissions, including a subject-level conflict rule for evaluated teachers with other profiles.

Reuse [portal relationship policy](../../../package/domain-authorization/src/access/portal-policies.ts), [student/guardian workflows](../../../package/domain-service/src/services/workflows/student.ts), [notification delivery architecture](../../architecture/notification-router.md), and the existing command/query registries. Do not add survey behavior to `Assessment`.

## Model and public interfaces

| Capability | Caller / behavior |
|---|---|
| Draft/create/update campaign | Authorized management; school/year/period/class/subject/evaluated assignment, immutable question version and schedule |
| Audience preview | Management; safe eligible counts and launch prerequisites, not raw respondent data |
| Schedule/open/close/cancel | Management or admitted lifecycle job; explicit server-time transitions with durable occurrences |
| Guardian campaign query | Current eligible guardian; question set, student/assignment context and own slot state |
| Submit response | Current eligible guardian; allowed answers and optional comment; atomic slot consumption and completion receipt |
| Moderate comments | Designated non-conflicted moderator; private comment read and theme drafting, with access audit |
| Aggregate review/publish | Management; suppressed fixed breakdowns and approved themes; immutable published snapshot |
| Teacher results | Evaluated teacher subject/assignment; published aggregates/themes only |

Persist `SurveyCampaign`, immutable question versions, eligibility/participation slots, private answers and published aggregate snapshots. Keep participation identity separate from answer storage and expose neither through generic public entity surfaces. Lifecycle: `draft → scheduled/open → closed → published → archived`; drafts/scheduled/open campaigns may be cancelled.

Snapshot eligible student/evaluated-assignment slots on launch. Questions and evaluated assignment cannot change after opening. At submission, require a currently active linked guardian and the student's current qualifying class enrollment. A newly linked guardian can complete an existing eligible student's slot; a withdrawn/transferred student no longer qualifying cannot add a new response. Prior valid submissions remain in the original campaign, and later teacher changes do not retarget them.

## Confidentiality and publication contract

- Describe the system as confidential and aggregated, not guaranteed anonymous. Eligibility enforcement and operational access can associate participation with a person, and free text may identify a family.
- Management and teachers receive no respondent lists, exact response timestamps or raw-answer APIs/exports. Reminder workers may resolve incomplete recipients but cannot read answers.
- Release a scored cohort/question only when it has at least ten distinct submitting guardian subjects with scored answers. Multiple children answered by one guardian do not create extra distinct subjects for this threshold. “Cannot assess” is excluded from the score denominator.
- Apply suppression to management as well as teacher statistics. Use fixed class/subject/period/evaluated-assignment breakdowns; suppress complementary cells or parent totals that would reveal a suppressed child cell through subtraction.
- Publish a frozen post-close snapshot, not live teacher scores after each response. Show distributions, safe response rates/counts and explicit denominators; never silently lower the threshold for a small school.
- Resolve conflicts by authenticated subject across all profiles. The evaluated teacher cannot obtain raw comments/respondent identity through a staff/admin profile or broad grant.
- Moderators are the explicit narrow exception for raw comment access. Omit respondent identity/timestamps from their normal review surface, audit reads, and publish edited themes without quotes or identifying details. Human review is required; automatic redaction is not a confidentiality guarantee.
- Require a configured eligible moderator before opening a campaign that collects comments. If none is available, keep the campaign in draft until a non-conflicted moderator is assigned; do not silently drop the approved comment feature.
- Initial retention: raw answers/comments and participation-to-answer linkage are deleted 90 days after close/cancel; closed campaign state, minimal audit and permitted published aggregates remain under the school record-retention policy. Preserve submitted-slot completion until the closed lifecycle prevents resubmission. Finish moderation/publication within that window; remind operators before purge. Cleanup must not retain raw values in telemetry or backups created specifically for reporting.

## Ordered implementation checklist

### 05.1 — Campaign domain, contracts and policies

- [ ] Add campaign, question, eligibility, private-response and published-snapshot models with narrow repositories and explicit lifecycle commands.
- [ ] Implement management scope and evaluated-assignment validation against actual year/period/class/subject/teacher relationships.
- [ ] Separate campaign, submission, moderation and publication actions and register safe external interfaces. Generic entity APIs cannot expose raw responses or participation tables.
- [ ] Implement audience preview and launch snapshot, freeze questions/assignment, and define stable invalid-lifecycle/eligibility/already-completed/closed failures.

### 05.2 — Submission, duplicate protection and lifecycle jobs

- [ ] Materialize one response slot per campaign/student/evaluated assignment; multiple guardian accounts do not increase that student's permitted response count.
- [ ] Recheck current guardian access and qualifying enrollment at submission, validate answer options/comment bounds, and atomically consume the slot with answer storage/replay/audit facts.
- [ ] Return a completion receipt on retry, not raw answers. Another guardian sees “already completed,” never the first guardian's answers.
- [ ] Serialize submission versus close/cancel on the campaign state. At the serialization point, accept only while the campaign is open and the server clock is before its cutoff; an earlier client/request timestamp cannot admit a submission after closure.
- [ ] Use existing durable scheduling for open/close/reminders and retention, with idempotent occurrence keys and request-time lifecycle enforcement.
- [ ] Keep drafts local for v1 if needed; final submission is immutable and cannot be edited/reopened through generic writes.

### 05.3 — Aggregation, moderation and publication

- [ ] Compute counts/distributions with purpose-selected access before aggregation; keep respondent identity and raw payloads out of audit/metrics.
- [ ] Enforce distinct-subject threshold per scored question/cohort, N/A denominator rules and complementary suppression across every supported fixed breakdown.
- [ ] Provide safe management review and explicit publication of an immutable post-close aggregate snapshot.
- [ ] Implement assigned non-conflicted comment moderation, access audit, theme draft/review and publication without raw comment release.
- [ ] Enforce teacher conflict rules across profiles and exports; broad staff permission cannot bypass the restriction for the evaluated subject.
- [ ] Implement retention deletion and pre-purge operator reminders; preserve safe aggregates and minimal lifecycle evidence only.

### 05.4 — Clients, delivery and reporting

- [ ] Staff: campaign setup, audience preview, scheduling/open/close/cancel, aggregate review, moderator assignment, theme editing and publication.
- [ ] Guardian: invitation/context, questionnaire, optional comment, submission confirmation/receipt and already-completed/closed/revoked states.
- [ ] Teacher: explicitly published distributions, denominators and themes for permitted assignments, with “insufficient responses” for suppressed results.
- [ ] Notifications: open, bounded reminders for incomplete slots, and publication; stop reminders after completion/close/cancel and reauthorize navigation on open.
- [ ] Regenerate clients, localize separately from academic assessment labels and add deterministic campaign fixtures through admitted commands.

## Fixtures and acceptance tests

- [ ] Fixtures: two schools, multiple guardians per student, one guardian with siblings, teacher changes, new/revoked links, transfer/withdrawal, dual staff/teacher subject and a separate moderator.
- [ ] Privacy fixtures: 9, 10 and more distinct responding subjects; repeated subjects across students; N/A reducing one question below threshold; overlapping parent/child breakdowns and identifying comment examples.
- [ ] Native races: two guardians submit one slot, same request retries, submit versus close/cancel, worker replay and rollback between slot/answer/outbox effects.
- [ ] Authorization tests: revoked relationships, foreign campaigns, teacher/admin profile switching, moderator conflict, generic raw-data endpoints, exports and reminder worker answer access.
- [ ] Reporting tests: exact denominators, unique-subject threshold, suppressed/complementary cells, fixed snapshot publication and no live teacher score disclosure.
- [ ] Client/delivery tests: completed slot seen by another guardian without answer disclosure, expired campaign, reminder cessation and published-results navigation.
- [ ] Retention tests: purge removes raw/linkage data after the retention cutoff, keeps permitted aggregates/minimal lifecycle facts, and cannot reopen a slot or leak raw values in logs.

## Completion evidence and exit gate

Evidence: not collected; implementation has not started. Follow [Plan 00 verification requirements](00-common-requirements.md#fixtures-and-verification), recording exact revisions, cohort fixtures, API/SQL privacy tests, moderator access evidence and client campaign walkthroughs.

- [ ] Management can launch, close, moderate and publish a campaign through real UI/API paths.
- [ ] One-response-per-student enforcement, current eligibility and deterministic closing pass under concurrency.
- [ ] Management/teacher statistics are correctly suppressed and teachers cannot recover respondent identities/raw answers/comments through any profile/export.
- [ ] Optional comments are moderated and only edited themes reach teachers; retention and reminders work.
- [ ] Update this plan and its index row to `done` only after the feature gate passes.

## Handoff to Plan 06

Provide final feature/client revisions, campaign/privacy fixtures, published aggregate/theme samples, retention/reminder evidence and the completed feature gates from Plans 01–05. Start [Plan 06](06-final-release-rehearsal.md) separately. Completion here means feature implementation is finished; it is not a v1 release-readiness declaration.
