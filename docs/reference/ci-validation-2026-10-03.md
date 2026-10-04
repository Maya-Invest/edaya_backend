# Unified-stack CI validation — 2026-10-03

The CI changes have passed local verification across backend, frontend and mobile. This report covers the tested working trees, not a fresh GitHub run or a live staging release.

| Repository | Unit and tooling tests | Integration scenarios | Failures / skips |
| --- | ---: | ---: | ---: |
| Backend | 2,079 | 128 | 0 / 0 |
| Frontend | 940 | 520 | 0 / 0 |
| Mobile | 194 | 118 | 0 / 0 |

Backend integration includes 57 service/HTTP cases, 8 seed HTTP cases and 63 native PostgreSQL cases, with all three optional benchmarks enabled. Frontend browser qualification includes availability (6), onboarding (29), provisioned school workflows (398), webadmin (4) and demo journeys (83). Mobile covers API (47), guardian (42) and teacher (29).

All 26 workflow/action YAML files parse, actionlint 1.7.12 and shell syntax checks pass, and committed dependency locks remain unchanged. Disposable bootstrap/reset/retry, API/webapp/webadmin staging deployment dry runs, both signed staging APK checks and the seeded development-image build/smoke checks pass. Image smoke verifies API, files and JWKS, rejects private OTP/internal routes and confirms temporary OTP capture removal.

CI now verifies every branch push and fully qualifies every PR/release. Consumer integrations share one resolved backend SHA and compare source/client contracts. The final **Full validation** check rejects unsuccessful or incomplete dependencies. Publication/deployment waits for qualification, and the frontend deployment consumes an immutable client version matching that backend. Qualification uses committed vendored contracts and pinned Bun, without branch publication or an unlocked TypeScript runner. Evidence uploads use explicit sanitized allowlists.

The [sanitized validation record](ci-validation-2026-10-03.json) records base commits, tested working-tree hashes, counts, toolchains, checksums and blockers. [Saved evidence](../../../release-validation/ci-unified-2026-10-03/validation.json) also includes the schema-4 manifest, schema-3 APK information, sanitized suite summaries and early preflight failure evidence. No fixture identities, OTP captures, session credentials, raw browser traces or signing secrets are copied into that evidence.

Staging readiness remains **blocked**. Ownership/project/staging branch for `ep-holy-mouse-awj7ghpf.c-12.us-east-1.aws.neon.tech` and the dedicated `edaya_identity` database/role still require verification. Release credentials were not loaded for local preflight, so its blocked result does not establish which secrets exist in GitHub. GitHub's current plan prevents verifying/enabling private merge protection.

These changes remain uncommitted. No fresh GitHub success is claimed. No deployment, publication, live reset, rollout dispatch, billing/visibility change or Git-hook implementation occurred. Manifest schema 4, APK provenance schema 3, `validate_only` protections and email-only staging remain in place. Later rollout retains the first-bootstrap `reset_data=true`, then successful retries use `false`.
