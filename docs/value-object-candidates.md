Strong candidates (worth considering)
1. TimeOfDay / TimeRange
Duplicated in period-definition.ts and schedule.ts:

Same HH:mm regex on startTime / endTime
Same rule: endTime must be after startTime
PeriodDefinition.durationMinutes parses "08:00" strings manually
A shared timeOfDaySchema + TimeRange (with durationMinutes()) would remove real duplication. High value, low risk.

2. DateRange (or DateTimeRange)
Same pattern in several places:

AcademicYear, AcademicPeriod, CalendarEvent — startDate / endDate
Session — startsAt / endsAt
StaffRoleAssignment — startsAt / endsAt
A small VO with contains(date), overlaps(other), isValid() would centralize chronology rules. Session.durationMinutes already belongs here conceptually.

3. StudentFeeSummary → proper VO
Already behaves like one: built from StudentFee[], holds multiple Money fields, computes balanceDue. Moving it to value_object/ (with a schema in Phase 7c style) would match AttendanceSummary and clarify it’s not an entity.

4. ScopeGrant
Today it’s split:

TypeScript interface in authorization/role-types.ts
Zod schema in staff-role-assignment.ts
Unifying as a Zod-backed VO used by both auth and persistence would reduce drift as grants evolve.

5. moneyInputSchema (schema primitive, optional class)
Payment, Fee, and StudentFee all parse { amount: number, currency: string } then wrap Money. A shared:

export const moneyInputSchema = z.object({ amount: ..., currency: ... })
…doesn’t need a class, but pairs naturally with the existing Money VO.

Medium candidates (useful if behavior grows)
6. Score / WeightedScore
Repeated roundTo2, non-negative finite numbers across:

AssessmentResult.score
Assessment.maxScore
GradeScaleRange
ReportCardResultSection.average / weight
Worth it if you add normalization (e.g. score vs maxScore → percentage, letter lookup). Otherwise a shared Zod helper (zodScore(), zodPercentage()) in utils.ts may be enough.

7. Percentage (0–100)
Used in class progress (completedPercentage) and fee installments (must total 100%). Cross-field rule on installments is VO-worthy; single 0–100 fields are probably just a schema helper.

8. StoredFile / FileMetadata
Attachment bundles fileName, fileUrl, mimeType, sizeBytes. If attachments get embedded elsewhere (messages, report cards), extracting a StoredFile embed makes sense. If Attachment stays the only owner, keep it inline.

9. OwnerRef (ownerKind + ownerId)
Same polymorphic pattern as attachments. Only worth a VO if you add more owner-linked types beyond Attachment.

Probably not value objects
Concept	Why keep as entity embed
GuardianContactMethod
Owned by Guardian; no independent lifecycle
ReportCardResultSection
Tree structure tied to report cards; already a rich embed
FeeInstallmentTemplate / StudentFeeInstallment
Part of fee definitions / assignments
GradeScaleRange
Part of GradeScale; promote only if reused outside grade scales
Phone/email on Student / StaffMember / Guardian
Too thin unless you add validation/formatting behavior (E.164, etc.)
EffectiveGrants
Runtime authorization snapshot, not domain input
Suggested priority
Phase 7c (planned)     Money + AttendanceSummary → Zod
Next low-hanging fruit TimeOfDay / TimeRange schema + helper
Then                   DateRange / DateTimeRange
Then                   StudentFeeSummary + ScopeGrant unification
Only if needed         Score/Percentage schema helpers (not full classes)
Rule of thumb: extract a value object when you have (a) repeated validation, (b) behavior on the composite, or (c) a concept used across multiple aggregates — not when it’s a single-field primitive or a 1:1 part of one entity.

If you want to continue the migration, I’d do 7c first, then TimeRange as 7c½ — it’s the clearest win after Money.