# Durable school imports

The staff workspace submits one typed CSV/XLSX table per file. A batch owns the academic year, optional enrollment effective date and `defaultOnExisting` (`M` by default). Files have no conflict setting. A row's `on_existing` accepts trimmed, case-insensitive `S`, `M` or `O`; blank inherits the batch setting. Settings changes invalidate confirmation.

## Ports and dependency direction

`@edaya/service` depends on `@edaya/authorization`, which depends on `@edaya/core`. Core defines versioned templates, cells, update rules, import states, persistence and format ports. Authorization constrains admission, candidate visibility and current target access. The service stages, matches, previews, plans dependencies and invokes named school workflows. `@edaya/adaptor-postgres` persists batches, immutable file revisions, crosswalks, rows and immutable outcomes in the caller transaction. `@edaya/adaptor-import-format` owns ExcelJS and bounded CSV/XLSX decoding and serialization. It never calls a workflow. API composition supplies adapters; HTTP and scheduled dispatch use the same service.

The repository boundary checker rejects infrastructure, spreadsheet, HTTP, application and tooling imports in domain source and workflow imports in the format adapter. Application port tests run without SQL, HTTP or spreadsheet libraries; Postgres-backed workflow tests separately exercise atomic persistence and replay.

## Execution and correction

Validation freezes current and proposed business projections. Confirmation binds the revision, digest and effective modes and journals reference-only durable work. Each bounded page renews its lease, re-resolves the initiating human profile and current permissions, and invokes domain writes under the shared transaction locks. Row outcomes, identity mappings and requested enrollment/annual/relationship writes commit together. Stable operation receipts protect retries and lost responses. Capacity checks consider the complete net-new cohort and block every affected placement when over capacity.

Prerequisites run before their dependents. Unrelated ready rows proceed. Cancellation stops pending work and preserves completed records. Scheduled recovery resumes unfinished pages. Exhausted durable work is reported as failed and requires revalidation and confirmation. No tokens are stored. Original files are retained by the private-file lifecycle; logs and work payloads contain safe codes and references.

Corrections retain `row_id`, optional explicit `target_id`, source provenance and `on_existing`. Replacing a file creates an immutable revision. Successful unchanged logical operations retain their outcomes. Changing an already bound identity is a review conflict. Names, shared phone numbers and national matricules never silently merge people.

`M` applies nonblank scalar values (including false and zero) and merges collections. `O` clears blank nullable mapped fields but preserves absent columns. A partial contact/link file never deletes unmentioned members. Complete replacement requires an explicit owner-level `complete_collection` declaration and executes the entire owner group atomically. Posted payments and accepted billing terms require financial correction workflows for conflicts.

## Formats and release

Version 1 supports the ten former types plus academic disciplines, placement statuses, guardian contacts, guardian relationships and class offerings. Annual student/teacher values belong to the selected year. Teacher declarations do not create assignments. Imports do not activate accounts or send invitations.

Limits: 5 MiB per file, 10,000 rows per batch, 128 columns, 32,768 characters per cell, one populated workbook sheet, 32 MiB expanded workbook, 8 MiB per ZIP entry, 500 ZIP entries. Formulas, encrypted workbooks, malformed dates, duplicate normalized headers and unsupported nonblank columns fail validation. `.xls` and irregular workbook preparation remain outside the application.

Apply additive migration `0047_durable_school_imports.sql` after the updated school model, regenerate web/mobile clients from the same backend candidate, qualify and run preview-only checks on externally prepared school files before approving a live batch. This change does not run the live intake.

The synthetic submission fixture accounts for 1,144 students, 27 classes, 34 teachers, 231 repeating/913 non-repeating values, 32 numeric workloads totaling 649 hours and two unknown workloads. All 156 coefficient cells and 12 totals have explicit pending-review dispositions, including three inconsistent totals. Pending evidence is never counted as an operational import.

Birth dates must be valid, unambiguous ISO dates and cannot be in the future. Ages below three or above eighty receive a nonblocking `IMPORT_BIRTH_DATE_REVIEW` warning for external review. Guardian telephone/email shorthand adds supplied contacts; clearing a collection requires `contact_methods` and an explicit `complete_contacts` declaration so additional contacts survive unrelated edits.

Confirmation drains bounded pages through the durable dispatcher (20 seconds on Workers; five minutes locally). The deployed heartbeat runs every minute and recovers remaining or interrupted work. Local operators should invoke the existing `cron-local` entry every minute for recovery after a process restart. Page/elapsed limits stop between row transactions and leave persisted continuations; they never depend on browser polling.

Phone imports accept a leading `#` as an Excel-friendly alternative to `+`. The service normalizes scalar phone fields and phone-valued guardian contacts (including JSON contact collections), while preserving raw cells and other fields. Existing plus prefixes and internal hash characters are unchanged. Matching never uses the phone alone.

Guardians may have an empty first name with a required nonblank last name. No name components are inferred. For existing records, blank first names preserve in M and clear to the empty string in O; omitted columns preserve in every mode. Student and teacher first names remain required.
