# Released API compatibility

`bootstrap.json` captures the tracked OpenAPI contract when independent releases were introduced. Preserve this historical snapshot; client regeneration must not rewrite it.

Clients are expected to upgrade to the current backend contract. Historical wire compatibility is not a release requirement. PRs compare against their target branch commit; deployments compare against the latest successful `edaya-release` GitHub deployment source commit for their environment. The bootstrap is used only when no successful deployment has been recorded. The checksum-pinned oasdiff comparison records required client upgrades in `.ci-evidence/contract-changes.json` without blocking on reported changes. Invalid schemas, failed comparisons and failed history lookups still block qualification.

`tooling/integration-tests/src/compatibility` holds handwritten HTTP requests and stable response expectations. Qualification also runs actor-assurance and tenant-scope regressions. These remain mandatory independently of schema generation and the historical comparison. A behavioral failure still blocks release. Prepare and qualify web and mobile clients against the same backend revision before rolling out a contract change.
