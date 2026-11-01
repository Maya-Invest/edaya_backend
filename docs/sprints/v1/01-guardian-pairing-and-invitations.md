# Plan 01 — Guardian invitation deep linking

| Field | Value |
|---|---|
| Status | on-going |
| Created / updated | 2026-09-13 / 2026-09-14 |
| Target | Existing invitation URLs, identity native sign-up, staff webapp `/invite`, guardian Android/iOS |
| Owner | Implementation started |
| Common requirements / predecessor | [Plan 00](00-common-requirements.md), complete with evidence |
| Next | [Plan 02 — Photos and branding](02-student-photos-and-branding.md) |

## Outcome and boundaries

A guardian who receives the **existing** `{WEBAPP_ORIGIN}/invite/{token}` mail/SMS link can open the guardian app (if installed), create or sign in to an account, confirm, and accept. If the app is missing, the web invite page remains the fallback: Get the app, then tap the **same** link again, or finish linking in the browser.

This slice does **not** rewrite invitation minting, email/SMS copy, send/resend/revoke, or accept semantics. Contact matching, 7-day single-use tokens, and identity-only admission stay as they are. A 16-character typed pairing code (`GuardianPairingGrant`) is a later addition, not a prerequisite for deep links.

Do not introduce the rewrite's `SchoolMembership` model or give guardians generic relationship-administration permission. A portal guardian does not gain staff-web workspace access by accepting an invitation.

## Keep as-is

- [sendAccountInvitation / resend / revoke / accept](../../../package/domain-service/src/services/workflows/account-invitation.ts)
- Token: 32-byte base64url, SHA-256 `token_hash`, 7-day single-use, contact match
- URL: `{WEBAPP_ORIGIN}/invite/{token}` from [buildInvitationUrl](../../../package/domain-service/src/capabilities/invitations/invitation-token.ts)
- Public `GET /public/invitations/{token}` and `POST .../accept` via [admitIdentityOnlyEntry](../../../apps/api/src/lib/school-api/identity-only-entry.ts)
- Staff send UI; family links still `linkGuardianToStudent`

## Entry prerequisites and source anchors

- [x] Verify Plan 00 is `done` and its identity-only admission, transaction/replay, audit/outbox and generated-client handoffs are available.
- [x] Inspect current account invitation and subject-link invariants, including disabled access and multi-profile callers.
- [x] Record the configured first-party link hosts, Android package, and iOS bundle/team from existing configuration. Do not invent a new deployment domain or App Store numeric ID.

Hosts: `https://app.edayaplus.com` and `https://staging.app.edayaplus.com` (legacy `app.school.edayaplus.com` and `staging.app.school.edayaplus.com` remain accepted so leftover invite URLs still open the app). Guardian package `ca.mayainvest.edaya.guardian`, iOS team `ZZRPX6RMZ7`. Android SHA-256 fingerprints are the upload/`guardian` alias (same value as Play Store signing) plus the local debug cert. Do not invent fingerprints or commit keystore passwords.

Start with the [invitation workflow](../../../package/domain-service/src/services/workflows/account-invitation.ts), [public invitation routes](../../../apps/api/src/routes/invitation.routes.ts), [web acceptance page](../../../../edaya_frontend/apps/webapp/src/routes/invite/%5Btoken%5D/+page.svelte), and [guardian router](../../../../edaya_mobile/apps/guardian/lib/app/router.dart).

## Public interfaces and lifecycle

| Capability | Caller and input | Result / authority |
|---|---|---|
| Association files | Unsigned HTTPS on `WEBAPP_ORIGIN` | iOS Universal Links and Android App Links for `/invite/*` only |
| Invitation preview | Public GET `{token}` in path | Existing preview payload; guardian app accepts **guardian** kind only |
| Invitation accept | Authenticated identity; existing POST accept | Existing invitation semantics; JWT email/phone must match the invitation |
| Native sign-up | Guardian app → identity `/auth/edaya/native/sign-up/email` | Same bearer `renewalCredential` as native sign-in, or `requiresEmailVerification` without failing closed |
| Pending invite | In-app store, TTL = invitation lifetime | Survives login, sign-up, email OTP, and process restart; cleared on success, expiry, cancel, unrelated logout |

Never auto-accept on open or preview. Bind confirmation to the currently authenticated account. Wrong-account switching returns to confirmation without consuming the invitation.

## Ordered implementation checklist

### 01.1 — Association on the real app origin

- [x] Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from the webapp static origin for `/invite`.
- [x] Set `Content-Type: application/json` and a short cache in [`_headers`](../../../../edaya_frontend/apps/webapp/static/_headers). Cloudflare SPA fallback must not swallow the files (static copies take precedence over `200.html`).
- [x] iOS associated-domains entitlement for prod and staging (`applinks:app.edayaplus.com`, `applinks:staging.app.edayaplus.com`, plus leftover `applinks:app.school.edayaplus.com` / `applinks:staging.app.school.edayaplus.com`); `FlutterDeepLinkingEnabled`; `CODE_SIGN_ENTITLEMENTS` on Debug/Release/Profile.
- [x] Android `autoVerify` VIEW/BROWSABLE intent filters for both hosts, `pathPrefix=/invite`, `flutter_deeplinking_enabled`.
- [x] Fill `sha256_cert_fingerprints` from the upload key (`guardian` alias) and the local debug keystore. Passwords were not committed.
- [x] Play Store signing SHA-256 is the same as the upload `guardian` alias (`C7:EF:EF:…:0D:52`). Do not duplicate it in `assetlinks.json`.

Do not add `localhost` to associated domains. Universal Links and App Links do not verify on localhost.

### 01.2 — Guardian app handler, pending token, signup and accept

- [x] Shared parser for first-party `{origin}/invite/{token}` (prod, staging, and local/emulator hosts for tests only).
- [x] Bounded pending-token persistence (7-day TTL). Remember before login bounce; hydrate before session restore.
- [x] Guardian `GoRouter` allows `/invite/:token` and `/login` while logged out; after auth, return to confirmation. Other kinds stay on web.
- [x] Sign-up / sign-in / email-OTP in the guardian login UI. Pending token survives verification.
- [x] Identity-only session when grants 401 and a pending invite exists (do not register push until the school session exists).
- [x] Preview then explicit accept. Refresh grants, register push, load academic years and linked students, then open calendar.
- [x] Wrong account: do not consume; sign out; re-save pending token; return to login/confirmation.
- [x] Clear pending on success, expiry, revoke, not-found, wrong kind, and unrelated logout. Offer a way off a dead invite screen.

### 01.3 — Clients and web fallback

- [x] Generate Dart `previewInvitation` / `acceptInvitation` from `client-bindings.json` (`basePath: root` → `/public/invitations/{token}`). Do not hand-edit generated output as the source of truth.
- [x] Native HTTP GET preview may omit a bearer token. Accept still sends the identity JWT.
- [x] Web `/invite` Get-the-app copy (Play Store package `ca.mayainvest.edaya.guardian`; no invented Apple numeric ID — search App Store, then reopen the link).
- [x] Guardian accept stays on the invite page (`guardianLinked`); do not dump a newly linked guardian into `/school/students`.
- [x] Staff-web post-auth gate: linked guardians go to `/login` with the guardian portal banner, matching teachers.

### 01.4 — Pairing codes (later, not this slice)

- [ ] `GuardianPairingGrant` model, staff issue/revoke/regenerate, 16-character Crockford Base32, QR of the same credential.
- [ ] Authenticated redeem that creates/reuses the intended guardian–student link without a delivered invitation.
- [ ] Human-enterable code in mail/SMS and an in-app entry surface for phones that never see the mailbox.

### 01.5 — Session list and accept (follow-on)

Verified guardian Email OTP sessions can list pending **email-channel guardian** invitations and accept one by id from the waiting screen (no linked students). Token preview/accept stays for mail and deep links. Staff, teacher, student, and phone-channel invites stay on the token path. Never auto-accept. Pairing codes remain later.

- [x] `GET /public/me/invitations` and `POST /public/me/invitations/{invitationId}/accept` via identity-only admission; `kind=guardian`, verified email, contact match.
- [x] Waiting screen lists pending invites and requires an explicit Accept tap.
- [x] Token routes unchanged.

## Local testing (OS will not verify localhost)

1. **App logic** — unit tests feed `https://staging.app.edayaplus.com/invite/{token}` into the parser, pending store, and router.
2. **Android emulator/device** — debug APK still receives an explicit VIEW intent when Digital Asset Links are not verified:
   `adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://staging.app.edayaplus.com/invite/TOKEN" ca.mayainvest.edaya.guardian`
   Point the app at local identity/API via `--dart-define`. The host need not be reachable.
3. **iOS simulator** — `xcrun simctl openurl` usually opens Safari. Inject the URI in debug, or long-press in Notes on a team-signed device after staging AASA is deployed.
4. **Real association** — deploy well-known files to staging, install a team-signed guardian build, tap a staging-issued invite in Mail/Notes.

Will not claim: tap link → App Store → automatic resume. After install, tap the same mail link or finish on the web page.

## Fixtures and acceptance tests

- [x] Parser/router/pending-store unit tests; Dart public invitation paths; native sign-up client tests; web post-auth guardian gate; association file contents.
- [x] Identity: native sign-up returns a renewal credential when verification is off; without a session it returns `requiresEmailVerification` instead of failing closed.
- [ ] Widget/integration journeys: cold and warm start from `/invite/{token}`, signup/OTP interruption, already-authenticated accept, contact mismatch, missing-app browser landing.
- [ ] Real-device Android/iOS Universal Link / App Link after fingerprints and staging deploy. Plan 06 owns store qualification.
- [x] Invitation secrets stay out of association files, crash-report URLs, and pairing-grant storage (no pairing grant in this slice).

## Completion evidence and exit gate

Evidence: automated association, identity native sign-up, Dart public methods, guardian handler/signup/accept, and web Get-the-app / portal gate are in source. Android fingerprints (Play/upload + debug) are recorded; real-device Universal Link / App Link after staging deploy is still open. Follow [Plan 00 verification/evidence requirements](00-common-requirements.md#fixtures-and-verification).

- [x] Existing invitation preview/accept still require authenticated contact match and remain single-use.
- [x] Browser fallback tells a guardian to install the app and reopen the same link, and does not send them into the staff workspace.
- [ ] Android App Links verify on staging/prod after well-known files are deployed (`assetlinks.json` already has Play/upload + debug fingerprints).
- [ ] iOS Universal Links verify on a team-signed build against staging/prod AASA.
- [ ] Update this plan and its index row to `done` only after device evidence is recorded.

## Handoff to Plan 02

Provide verified linked-family and zero-child fixtures, current relationship enforcement, incoming `/invite/{token}` routing, generated public invitation methods, and non-secret notification navigation. Pairing-code issuance remains deferred and must not block portrait review. [Plan 02](02-student-photos-and-branding.md) reuses these journeys without altering invitation accept semantics.

## Out of scope

Rewriting invitation minting/delivery, `GuardianPairingGrant`, deferred App Store continuation, Plan 02 photos, unrelated notification-template WIP.
