# Authorization clean implementation

Status: in progress. This change replaces the previous operation/capability/resource-policy pipeline. It is not ready to deploy until every item below is verified.

## Required end state

- Identity-only actors; permission identifiers are the sole action vocabulary.
- Explicit action policies use current manual grants and business assignments.
- Typed persisted staff scopes; no derived permission rows or scope-path runtime.
- Mandatory tenant and authorization predicates before reads, pagination, and counts.
- Complete authorization of existing and proposed mutation resources.
- No shared authorization caches, legacy evaluator, dual writes, or compatibility fallback.
- All API, generated client, web, mobile, fixture, and job callers updated.

## Work checklist

- [x] Inspect both implementations and agree on the target with the user.
- [x] Inventory operation declarations, actor state consumers, and grant persistence.
- [ ] Implement typed grants, identity actors, and current relationship facts.
- [ ] Implement action-specific policies and native repository read scopes.
- [ ] Replace all entity, command, query, job, and API authorization callers.
- [ ] Migrate grant storage and remove assignment-derived permission persistence.
- [ ] Update generated contracts and web/mobile consumers.
- [ ] Delete superseded mechanisms and update repository guidance.
- [ ] Verify adversarial authorization, migration, integration, and client checks.

## Business acceptance matrix

Every action is tested against owner/staff, scoped staff, subject teacher, homeroom teacher, guardian, student, and admitted service actors where applicable. Denials cover unlinked and foreign-school resources, mixed action scopes, expired grants, revoked relationships, inactive profiles, academic-year mismatches, unpublished portal content, and partial batches/reassignment. Lists, counts, aggregates, and single reads must share the same access constraints.

## Cutover

Deploy matching backend/client contracts and the one-time data migration. Ambiguous legacy grants abort conversion. Rollback requires restoring matching application/data versions. No runtime chooses between authorization implementations.
