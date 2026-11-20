# Plan 02 — Student photos and school branding evidence

Owner: Codex. 02.1–02.3 recorded 2026-09-15. 02.4 branding recorded 2026-09-15.

Plan 00 is `done`. Plan 01 remains `on-going` and did not block portraits or branding. Plan 04 already consumed issuance-asset slots from migration `0024`; this close adds public allowlisting, settings UX, fixtures, and reference-aware cleanup.

## 02.4 branding delivered

- School issuing identity: `issuingName`, postal address, phone, email, school code. Staff persist them from the school settings edit modal. Generic `updateSchoolConfiguration` cannot rewrite logo/crest/stamp/signature slots.
- `School.publicBrandingPurposes` allowlists only `school.logo` and `school.crest`. Stamps and signatures stay restricted. Family and teacher reads of a guessed attachment ID fail; allowlisted current logo/crest become readable.
- Named commands: `createSchoolIssuanceAssetUpload`, `completeSchoolIssuanceAssetUpload`, `clearSchoolIssuanceAsset`. Clear strips the purpose from the allowlist.
- Assembler hydrate prefers issuance snapshot attachment IDs, embeds bounded data URIs, and does not treat stamp/signature bitmaps as cryptographic signing.
- Replaced branding bytes referenced by `document_issuances.snapshot` are retained. Unreferenced replacements are reserved for 30 days (`SCHOOL_ISSUANCE_ASSET_TERMINAL_RETAIN_MS`). SQL `private_file_object_is_referenced` includes current school slots and issuance snapshot IDs (migration `0025_school_branding.sql`).
- Demo/demo-ci fixtures seed issuing identity plus JPEG logo, crest, stamp and signature. Seed allowlists logo and crest only.
- Staff webapp: issuing fields in the edit modal; authorized preview/replace/optional clear; public checkbox for logo/crest only. App chrome uses the current logo when present.

## Visual document evidence

Gotenberg and Docker were not running on this machine. Official templates were compiled with fixture branding bytes as data URIs (catalog slots only), then printed through headless Chrome.

| File | Role |
|---|---|
| [02-branded-schooling-certificate.html](02-branded-schooling-certificate.html) | Handlebars compile, issuing identity + logo + stamp + signature |
| [02-branded-schooling-certificate.pdf](02-branded-schooling-certificate.pdf) | Chromium print of that HTML (not Gotenberg/Browser Run) |
| [02-branded-schooling-certificate.png](02-branded-schooling-certificate.png) | Visual check of letterhead and footer marks |
| [branded-samples/](branded-samples/) | All 18 official templates (`report-card`, `receipt`, ID card, invoices, certificates, operational sheets) |

Plan 06 should still inspect Gotenberg / Browser Run pagination. Stamp bitmaps are not cryptographic signatures.

## Tests

- `package/domain-core/tests/unit/domain/school/school.test.ts` — allowlist rejects stamp purposes.
- `package/domain-service/tests/capabilities/issuance-assets.test.ts` — identity persist/clear, upload/replace/clear, family/teacher isolation, snapshot retain, command-owned slots, 30-day reserve.
- `tooling/seeding/src/domains/school-branding/port-workflow.test.ts` — seed uploads then allowlists logo and crest.
- `package/adaptor-docs/tests/official-templates.test.ts` — letterhead embeds logo and issuing identity.
- Frontend `tests/lib/api/school-data.test.ts` — issuing identity and public branding map into configuration patches.

## Deferred / out of scope for `done`

- 02.2 server EXIF strip, orientation normalize, decoded dimension/pixel limits.
- Live seed HTTP photo residual when identity `:9900` is down.
- Interactive browser/emulator confirmation of guardian/staff portrait flows.
