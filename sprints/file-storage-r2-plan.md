# File Storage (R2) — Sprint Plan

> **Status:** Phase 1 **foundation implemented** — port, adapter, migration, API routes; client UI + generated PDFs pending  
> **Created:** 2026-06-27  
> **Last updated:** 2026-06-27  
> **Scope:** R2-backed object storage for user uploads and server-generated documents (signed report cards, incident reports)  
> **Related domain:** `package/domain-core/src/domains/school/attachment.ts` (`Attachment`, `AttachmentOwnerKind`)

Separate **R2 buckets per environment** (dev local uses in-memory adapter; staging and production each get a dedicated bucket).

---

## 1. Outcomes

| # | Outcome | Phase | Status |
|---|---------|-------|--------|
| 1 | `FileStoragePort` in `@edaya/core` | 1 | Done |
| 2 | In-memory adapter for tests / local dev without R2 | 1 | Done |
| 3 | `@edaya/adaptor-r2` (S3-compatible R2 client) | 1 | Done |
| 4 | Attachment schema: `storageKey`, `status`, `checksum`; nullable `fileUrl` | 1 | Done |
| 5 | Gateway wired through `ServiceArgs` → `BaseSchoolService` | 1 | Done |
| 6 | `POST /core/files/upload-intents` (presigned PUT) | 1 | Done |
| 7 | `GET /core/files/{attachmentId}/download-url` (presigned GET) | 1 | Done |
| 8 | `registerAttachment` verifies object exists; `removeAttachment` deletes object | 1 | Done |
| 9 | R2 bindings in `wrangler.toml` (per env bucket) | 1 | Done |
| 10 | Webapp upload UI (presigned flow) | 2 | Pending |
| 11 | Mobile guardian upload UI | 2 | Pending |
| 12 | Generated PDF: report card on publish | 3 | Pending |
| 13 | Generated PDF: incident report | 3 | Pending |
| 14 | Orphan `pending_upload` cleanup cron | 4 | Pending |

---

## 2. Architecture

### 2.1 Module layout

```text
package/domain-core/src/
  ports/file-storage.ts              # Port interface
  storage/
    build-storage-key.ts             # Key layout helper
    in-memory-file-storage.ts        # Test / dev fallback
    no-op-file-storage.ts
    sanitize-file-name.ts
    upload-policy.ts                 # MIME + size limits per owner kind

package/adaptor-r2/
  src/r2-file-storage.ts             # S3-compatible R2 implementation
  src/create-r2-file-storage.ts

apps/api/src/
  runtime/shared/resolve-file-storage.ts
  routes/file-storage.routes.ts
  wrangler.toml                      # [[r2_buckets]] per env
```

### 2.2 Object key layout

```
{schoolId}/{purpose}/{ownerKind}/{ownerId}/{attachmentId}/{safeFileName}
```

| Purpose | Prefix | Examples |
|---------|--------|----------|
| User upload | `uploads` | Profile photo, incident evidence |
| Generated report card | `generated/report-card` | Signed PDF after publish |
| Generated incident report | `generated/incident-report` | Signed PDF |

### 2.3 Upload flow (user files)

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant R2

  Client->>API: POST /core/files/upload-intents
  API->>API: Auth + owner validation
  API-->>Client: attachmentId, storageKey, presigned PUT URL
  Client->>R2: PUT object (direct)
  Client->>API: POST /core/commands/register-attachment
  API->>R2: HEAD object (verify)
  API-->>Client: Attachment (status=ready)
```

### 2.4 Download flow

1. Client requests `GET /core/files/{attachmentId}/download-url`
2. API checks `ATTACHMENT_READ` + owner access
3. API returns short-lived presigned GET URL

### 2.5 Generated documents (Phase 3)

Server workflow generates PDF bytes → `fileStorage.putObject()` → `registerAttachment` with `ownerKind: report_card | incident`.

---

## 3. R2 infrastructure (per env)

| Environment | Bucket name (suggested) | Binding |
|-------------|----------------------|---------|
| Local worker dev | `edaya-files-dev` | `FILES` |
| Staging | `edaya-files-staging` | `FILES` |
| Production | `edaya-files-production` | `FILES` |

**Secrets** (Worker dashboard + `.dev.vars`):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

`R2_BUCKET_NAME` can be a `[vars]` entry per env (non-secret).

**Node local dev:** same env vars, or in-memory adapter when unset.

Create buckets:

```sh
cd apps/api
bunx wrangler r2 bucket create edaya-files-dev
bunx wrangler r2 bucket create edaya-files-staging
bunx wrangler r2 bucket create edaya-files-production
```

---

## 4. Guardrails

- Private buckets only — no public URLs stored in Postgres
- Server builds all `storageKey` values; clients never choose paths
- Presigned PUT enforces `Content-Type` and declared `sizeBytes`
- `registerAttachment` rejects external `fileUrl` when R2 is configured
- `removeAttachment` deletes the R2 object when `storageKey` is set
- Ports-and-adapters: `@edaya/core` never imports `@edaya/adaptor-r2`

---

## 5. Attachment schema evolution

| Field | Type | Notes |
|-------|------|-------|
| `storageKey` | `text` nullable | Canonical R2 object path |
| `status` | `text` not null default `ready` | `pending_upload` \| `ready` \| `failed` |
| `checksum` | `text` nullable | SHA-256 (Phase 3+) |
| `fileUrl` | `text` nullable | Legacy / resolved at read time only |

Validation: at least one of `storageKey` or `fileUrl` must be non-blank.

---

## 6. Phase checklist

### Phase 1 — Foundation (current)

- [x] Plan document
- [x] Port + adapters
- [x] Schema migration (`0021_attachment_storage.sql`)
- [x] API routes + workflow updates
- [x] Wrangler R2 bindings + env schema
- [x] Core tests green (531 pass)

### Phase 2 — Client upload

- [ ] Webapp presigned upload component
- [ ] Mobile guardian upload
- [ ] OpenAPI client regen

### Phase 3 — Generated documents

- [ ] PDF generation service (report card)
- [ ] Hook into `publishReportCardResult`
- [ ] Incident report PDF + attachment

### Phase 4 — Ops

- [ ] Lifecycle rule / cron for stale `pending_upload` keys
- [ ] Staging deploy runbook update (`docs/deploy-staging.md`)

---

## 7. Test plan

| Area | Test |
|------|------|
| Core | `buildStorageKey`, in-memory adapter, attachment validation |
| Adaptor | Presign + put/head/delete against in-memory or mocked S3 |
| API | Upload intent auth gate, download URL permission |
| Integration | Register attachment after in-memory put |

---

## 8. Related docs

- [integrations-restructure.md](../docs/integrations-restructure.md) — package boundaries
- [api-runtimes.md](../docs/api-runtimes.md) — Worker env / secrets
- [deploy-staging.md](../docs/deploy-staging.md) — staging infra
