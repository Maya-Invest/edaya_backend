# Plan 01 — Guardian pairing codes and invitation acceptance

| Field | Value |
|---|---|
| Status | planned |
| Created / updated | 2026-09-13 |
| Target | Existing backend, identity integration, staff webapp and guardian/teacher mobile clients |
| Owner | Assign when implementation starts |
| Common requirements / predecessor | [Plan 00](00-common-requirements.md), complete with evidence |
| Next | [Plan 02 — Photos and branding](02-student-photos-and-branding.md) |

## Outcome and boundaries

A staff member pre-authorizes one guardian–student relationship and hands the adult a single-use pairing code. The adult can authenticate and link the intended child without having received an email/SMS invitation or already possessing a school actor.

Existing account invitations remain a distinct capability and gain reliable browser/mobile acceptance. Preserve the current identity service and school-owned guardian/subject model. Do not introduce the rewrite's `SchoolMembership` model or give guardians generic relationship-administration permission.

One code represents one intended guardian–student link. Multiple guardians and siblings require separate grants. Never print a permanently reusable claim credential on a student ID card. The school handover verifies the intended adult; this v1 path has immediate confirmed redemption, not a second approval queue.

## Entry prerequisites and source anchors

- [ ] Verify Plan 00 is `done` and its identity-only admission, transaction/replay, audit/outbox and generated-client handoffs are available.
- [ ] Inspect current account invitation and subject-link invariants, including disabled access and multi-profile callers.
- [ ] Record the configured first-party link host, Android package/signing identities and iOS bundle/team identities from existing configuration. Do not invent a new deployment domain.

Start with the [invitation workflow](../../../package/domain-service/src/services/workflows/account-invitation.ts), [subject linking](../../../package/domain-service/src/services/account-linking/link-subject-to-actor.ts), [public invitation routes](../../../apps/api/src/routes/invitation.routes.ts), [web acceptance page](../../../../edaya_frontend/apps/webapp/src/routes/invite/%5Btoken%5D/+page.svelte), and [guardian router](../../../../edaya_mobile/apps/guardian/lib/app/router.dart).

## Public interfaces and lifecycle

| Capability | Caller and input | Result / authority |
|---|---|---|
| `issueGuardianPairingCode` | Authorized staff; student, optional existing unbound guardian, staff-approved relationship | Grant metadata and one-time code display; authority scoped to the target student/link |
| `revokeGuardianPairingCode` | Authorized staff; grant ID/version | Revoked unredeemed grant; cannot undo a completed relationship |
| Pairing status query | Authorized staff; student/grant filters | Secret-free lifecycle, expiry and permitted redemption metadata |
| Pairing confirmation | Authenticated identity; credential in POST body | Minimal school/child confirmation after proof; no unrestricted student search |
| `redeemGuardianPairingCode` | Authenticated identity; credential and stable request identity | The intended linked guardian/child result; school and endpoints come from the grant |
| Invitation preview/accept | Existing invitation credential in POST body | Existing invitation semantics with safe typed results for admitted actor kinds |

`GuardianPairingGrant` is command-owned and stores school/student references, optional guardian reference, allowed relationship, credential digest/generation, issuer, expiry, lifecycle, redeemed subject and result references. Lifecycle: `issued → redeemed | revoked | expired`.

Use 16 cryptographically random unambiguous Base32 characters, grouped for manual entry, plus QR representation of the same credential. Default expiry is seven days. Normalize entry formatting consistently before purpose-bound digest lookup; a checksum, if added, does not replace random entropy. No raw secret appears in business storage, audit, outbox, metrics or generic replay records.

## Ordered implementation checklist

### 01.1 — Grant model, authorization and staff operations

- [ ] Add grant domain/persistence, lookup indexes, lifecycle constraints and named command registration.
- [ ] Require explicit staff issue/revoke authority scoped to the student and optional existing guardian. Validate every endpoint and allowed relationship in the transaction.
- [ ] Implement single-display issuance and secret-free status history. Same-key issuance retry returns existing grant metadata without issuing another active grant; a lost display uses revoke/regenerate.
- [ ] Regeneration replaces only the selected unredeemed grant generation. It cannot revoke another intended guardian's grant or a completed link.
- [ ] Add expiry handling through the existing scheduler, with request-time expiry enforcement regardless of scheduler delay.

### 01.2 — Atomic identity-bound redemption

- [ ] Authenticate using the existing identity service before the school-authority transaction; do not claim distributed atomicity with account signup.
- [ ] Resolve and lock the credential-scoped grant. Validate lifecycle, expiry, active target student and allowed relationship.
- [ ] Create/reuse the school guardian profile, bind the verified subject and create/reuse exactly the intended active relationship. Consume the grant with replay, audit and outbox facts atomically.
- [ ] Reject another-subject profile bindings, disabled guardian access and conflicting relationships. Do not merge profiles by display name or unverified email/phone.
- [ ] Keep the caller's unrelated existing staff/student/teacher profile from becoming either authority or a blanket reason to reject legitimate guardian pairing.
- [ ] Grant no staff, primary, legal, pickup or financial privileges beyond explicit school authorization. A claimant cannot choose another student or expand relationship flags.
- [ ] Ensure concurrent subjects have one winner and the winner can recover the same result after a lost response. A different subject cannot recover private result details.
- [ ] A redeemed grant cannot restore an ended/removed link. Current linkage/access still governs replay disclosure and subsequent reads.
- [ ] Add bounded attempt controls and safe failures for invalid/expired/revoked/used credentials, binding conflicts, disabled access and throttling. Unauthenticated failures disclose no child identity.

### 01.3 — Invitation transport and pending intents

- [ ] Add credential-body POST preview/acceptance interfaces and regenerate clients. Preserve invitation contact matching, single-use acceptance, resend invalidation and supported actor-result types.
- [ ] Generate allowlisted first-party HTTPS links with fragment credentials for invitation and pairing intents. Keep their credential purposes and backend contracts separate.
- [ ] Capture/remove browser fragments immediately; use bounded pending-intent persistence through login, signup, verification and process interruption. Clear on completion/cancellation/expiry and unrelated logout.
- [ ] Bind final confirmation to the currently authenticated account; explicit wrong-account switching returns to confirmation. Never auto-consume a link during preview, GET, notification delivery or scanner access.
- [ ] Disable third-party analytics on credential landing surfaces, apply no-store/no-referrer behavior and redact URLs/credentials from crash reporting.
- [ ] Retain old path-token invitation links only for previously issued invitations until expiry; stop generating them and document their retirement condition.

### 01.4 — Staff, browser and mobile delivery

- [ ] Staff student family-access surface: issue, display/print code and QR, inspect status, revoke and regenerate through mutation modals.
- [ ] Guardian zero-child and add-child surfaces: scan/enter, authenticate, confirm and refresh linked students/school context after success.
- [ ] Support existing authenticated accounts, unbound guardian profiles, multiple children and multiple schools without duplicating profiles incorrectly.
- [ ] Route invitation results to staff, guardian or teacher experiences as appropriate; a portal user does not gain staff-web workspace access by accepting an invitation.
- [ ] Configure iOS associated domains/site-association and Android verified intent filters/assetlinks using actual release signing identities. Use one coordinated Flutter link handler.
- [ ] Verify fragment preservation and pending-intent recovery through supported mail/browser/app journeys. When the app is absent, offer browser completion or installation followed by reopening/manual code entry; do not promise unimplemented deferred app-store continuation.
- [ ] Reuse notification delivery for non-secret lifecycle notices; school handover/printing remains sufficient for code issuance.

## Fixtures and acceptance tests

- [ ] Fixtures: two schools, two intended guardians, siblings, an authenticated subject with zero actors, an existing guardian, an unbound guardian, a disabled guardian and a dual-profile subject.
- [ ] Lifecycle cases: issued/expired/revoked/redeemed codes; regenerated credentials invalidate only the intended generation.
- [ ] Native concurrency: two subjects claim one code, same-subject retries with different request timing, rollback after profile/link writes, and unlink versus replay.
- [ ] Negative access: substituted school/student/guardian, generic grant writes, disabled access, another account's binding and unauthenticated student enumeration.
- [ ] Public API/client contracts: body credentials, minimal confirmation, all supported invitation actor types, legacy links and contact mismatches.
- [ ] Real-device journeys: Android/iOS cold and warm start, signup/verification interruption, account switch, app restart, missing app, offline/uncertain response, and non-consuming previews.
- [ ] Secret audit: logs, metrics, events, replay rows and notifications contain no raw code/token.

## Completion evidence and exit gate

Evidence: not collected; implementation has not started. Follow [Plan 00 verification/evidence requirements](00-common-requirements.md#fixtures-and-verification), recording exact backend/client revisions, migrations, contract changes, fixture IDs, test commands and device/provider limitations.

- [ ] Staff can issue/revoke/regenerate and recover a lost code display.
- [ ] A previously unlinked subject can securely link the intended child without a delivered invitation or existing school actor.
- [ ] Concurrency, replay, contact matching, revoked access and multi-profile tests pass through public interfaces.
- [ ] Browser fallback and real Android/iOS invitation/pairing paths pass; unsupported configurations are not counted as verified.
- [ ] Update this plan and its index row to `done` only after evidence is complete.

## Handoff to Plan 02

Provide verified linked-family and zero-child fixtures, the current relationship enforcement contract, supported incoming-intent routing, generated clients and non-secret notification navigation. [Plan 02](02-student-photos-and-branding.md) reuses these journeys without altering pairing semantics.
