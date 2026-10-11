# Released API compatibility

`bootstrap.json` captures the existing tracked OpenAPI contract when independent releases were introduced. It is an initial candidate baseline, not evidence of human approval. Review it against the deployed API before enabling `ENABLE_INDEPENDENT_RELEASES`.

PRs compare against their target branch commit. Deployments compare against the latest successful `edaya-release` GitHub deployment source commit for their environment. The bootstrap is used only when no successful deployment has been recorded. A failed history lookup blocks qualification.

`tooling/integration-tests/src/compatibility` holds handwritten HTTP requests and stable response expectations. Qualification also runs actor-assurance and tenant-scope regressions. These run independently of generated-client contract tests. Client regeneration must not rewrite the compatibility baseline or behavioral expectations. Intentionally changing a released contract requires an explicit migration/versioning decision.
