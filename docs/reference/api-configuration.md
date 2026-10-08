# API configuration and secrets

Application settings are tracked separately from credentials. All files below live in `apps/api`.

| Runtime | Tracked settings | Private credentials |
| --- | --- | --- |
| Local API, files and cron | `config.local.jsonc` | `.env` |
| Wrangler staging smoke | `config.staging.jsonc` | `.dev.vars` |
| Deployed staging | `config.staging.jsonc` (explicit upload) | `secrets.staging.json` |
| Deployed production | `config.production.jsonc` (explicit upload) | `secrets.prod.json` |

Wrangler contains infrastructure, routes, bindings and schedules, with `keep_vars: true` and no `vars` sections. Deploying code preserves deployed variables. Editing a config file does not change a running Worker.

## Local setup

Copy `.env.example` to `.env` and edit settings in `config.local.jsonc`. `bun dev`, local cron, the file service, database tooling and seeding share this configuration. Precedence is explicit process environment, then private secrets, then tracked settings, except SMS routes: the selected file always owns them. The loader validates private files even when a parent process already loaded their values. Bun dotenv autoload is disabled; the repository CLI explicitly loads the root `.env` for tooling credentials.

`EDAYA_LOCAL_ENV_FILE` selects a different **secrets-only** file (relative paths resolve against `apps/api`). Test launchers must pass their non-secret overrides as process environment variables. The internal CI testing entry keeps its isolated identity database, keys and origins; it imports only email settings from normal local configuration. Secret values are literal and do not interpolate `$VARIABLE` expressions.

`bun --filter @edaya/api dev:worker` reads staging settings and passes them to Wrangler while `.dev.vars` supplies secrets. Hyperdrive local connection strings remain in `.dev.vars`. It does not upload anything. Use process/command overrides for local experiments; do not put settings back in private credential files.

JSONC values are strings, including booleans and numbers, except `sms_routes`, which is a native array of `{ "prefix": "+225", "provider": "africas_talking" }` entries. `WHATSAPP_AUTH_TEMPLATES` remains a JSON-encoded string. The loader validates source settings and serializes `sms_routes` to the internal `SMS_ROUTES` string binding for processes and Worker-variable publication. Inherited `SMS_ROUTES` cannot override the file; `PHONE_SMS_ROUTES` is rejected. Runtime-variable validation is separate from source-file validation. Unknown keys, duplicate config keys, secret keys in config, and non-secret keys in secrets are rejected. PGlite paths belong in local config; credential-bearing Postgres URLs belong in private files used by the relevant tooling.

## Update deployed variables

Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Workers Scripts Write) in the shell or repository-root `.env`. From the repository root:

```sh
bun repo vars push staging --dry-run
bun repo vars push staging
bun repo vars push production
bun repo vars delete staging OBSOLETE_SETTING
```

Push merges the selected config file into deployed variables. Omitted variables remain present; use `delete` to remove one explicitly. Empty strings are values, not deletions. Dry-run reads remote state and reports key-level changes without writing. The command never prints secret values or uploads Worker code.

The updater preserves other variables, secrets, and resource bindings by inheritance from the active Worker version. It requires a single version at 100% traffic and rejects pending versions or detected concurrent deployments. Run configuration updates and releases serially; Cloudflare does not provide an atomic compare-and-swap across this read/modify/write sequence. The command verifies settings after applying them. A settings change may create a Worker version even though no application code is uploaded.

## Secrets and optional integrations

Copy `secrets.json.example` into the environment's private JSON file. Preserve existing authentication and encryption credentials. Remove unused optional provider entries rather than leaving placeholders or empty strings. `ACCOUNT_SECURITY_KEYS` contains an encoded JSON keyring; each key is base64-encoded 32-byte material. The selected `ACCOUNT_SECURITY_KEY_VERSION` is non-secret configuration.

```sh
# From the repository root:
bun repo secrets push staging --dry-run
bun repo secrets push staging
bun repo secrets push production
bun repo secrets list staging
```

Secret previews validate the private file locally and print names only; they do not read remote state. Uploads validate binding types and verify secret names after writing. Secret values are passed to Wrangler through standard input.

FCM is optional at runtime but required by coordinated staging-release validation. Phone-provider keys/tokens are secrets; provider usernames, sender IDs, WhatsApp IDs, templates and mode are configuration. See [phone verification](phone-verification.md). Upload credentials before enabling an integration with `vars push`.

## Migration and first deployment

The local migration backs up existing private files in `.data/config-backups/` with private permissions. Keep these backups out of version control. Review moved settings before applying them remotely.

Legacy deployments may store non-secret settings as secret bindings. Conversion requires explicit opt-in and uses the value supplied in the config file; it does not reveal or copy a stored secret:

```sh
bun repo vars push staging --dry-run --replace-secret R2_ENDPOINT --replace-secret ACCOUNT_SECURITY_KEY_VERSION
bun repo vars push staging --replace-secret R2_ENDPOINT --replace-secret ACCOUNT_SECURITY_KEY_VERSION
```

Use additional `--replace-secret NAME` flags only for known non-secret keys being moved, such as provider usernames or sender IDs. Credential keys cannot be converted. There is no automatic remote migration during code deployment.

For GitHub releases, remove `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `ACCOUNT_SECURITY_KEY_VERSION`, notification allowlists, and provider non-secret settings from `STAGING_API_SECRETS` / `STAGING_IDENTITY_SECRETS`; retain their actual secret fields. The release validates the new payload contract and does not apply the tracked config file. Existing GitHub secret values cannot be downloaded; prepare replacement payloads from the authoritative private credentials before updating those secrets.

For an existing Worker, apply and verify variables before the first code deployment under this layout. For a new Worker, deploy it without a public route first, upload secrets, apply variables, verify configuration, then attach its intended route. `vars push` fails if the Worker does not yet exist.

## Operational controls shared by staging and production

| Setting | Effect when true |
| --- | --- |
| `PAUSE_API` | Return HTTP 503 before constructing application services; retry after 60 seconds, without caching. |
| `PAUSE_SCHEDULER` | Skip scheduled jobs, including identity cleanup and notification draining. |
| `PAUSE_JOBS` | Retry queue messages after 60 seconds without acknowledging them. |

Each control is independent and defaults to `"false"` in both Worker profiles. Boolean strings accept `true`/`false` and `1`/`0` (case and whitespace normalized). No control depends on a hostname. Use narrowly scoped settings updates for temporary operational changes:

```sh
bun repo status staging
bun repo pause all staging --dry-run
bun repo pause all staging
bun repo resume api staging
bun repo resume all staging
```

These commands preserve unrelated variables and secrets without changing the tracked config files or redeploying code. `vars push` applies the control values from the chosen file as part of its configuration update. Local API and cron share dynamic pause state with the seed coordinator. See [repository commands](repo-cli.md) for recovery.

The staging coordinator sets all three flags before its single API code deployment, verifies HTTP 503, pauses queue delivery, and drains existing requests before database mutations. It enables HTTP for seeding/smoke tests while background handlers remain paused, then resumes jobs after verification. Later transitions and failure recovery update settings only. Production keeps its separate deployment/migration workflow. Neither workflow changes phone mode or automatically applies config files.

### One-time operational-control migration

For staging, use the updated release coordinator: it uploads all three new controls as `true`, deploys code, and requires HTTP 503 before touching database state. If deploying manually, temporarily set all three new flags to `"true"`, explicitly push staging configuration, deploy the new code, verify HTTP 503, then follow the same queue-pause/drain sequence. Older code ignores the new names until deployment; do not begin database work before verification. Do not overlap a manual config push with a release.

Before production deployment, explicitly upload the new controls with values matching its intended state (normally all false). After the new code is verified in each environment, remove obsolete variables:

```sh
bun repo vars delete staging STAGING_MAINTENANCE
bun repo vars delete staging STAGING_PAUSE_JOBS
bun repo vars delete staging STAGING_NOTIFICATION_EMAILS
# Repeat for production if those bindings exist.
```

If an obsolete binding is a secret, use `bun repo secrets delete staging NAME` (or select `production`) instead. Remove obsolete fields from authoritative private/GitHub secret payloads as well. The new runtime does not support legacy aliases. Before rolling back to older code, restore its former variables using that revision's configuration tooling, including its staging maintenance/job-pause settings. A rollback does not restore database state.

The school-notification recipient allowlist has been removed entirely. Staging now sends school email and push through normal recipient resolution, just like production. Use designated test accounts/devices for live verification; the old empty allowlist no longer blocks deliveries.

## SMS delivery

Each environment config contains its own native `sms_routes` array. Local defaults to the Africa's Talking sandbox; staging and production require live SMS. Both `PHONE_AUTH_MODE` and `SMS_TRANSPORT=router` use the same provider settings and routes, with independent enablement. Set the username and optional sender ID in config and the API key in secrets. Enabled legacy delivery requires nonempty routes, username and API key; disabled delivery does not. An absent or blank sender ID omits `from` and uses the provider default; a configured sender ID is trimmed and must be registered. Qualify the default sender with the provider and a controlled handset test before live activation. Sender approval does not automatically change API versions. See [phone verification](phone-verification.md#router-rollout-and-rollback) for the required legacy-binding migration and safe rollback order.
