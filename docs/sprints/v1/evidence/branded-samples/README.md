# Branded official-document samples

Handlebars compiles of every Plan 04 template with École EDaya — Cocody issuing identity and catalog asset slots (logo / crest / stamp / signature / portrait). Gotenberg was not running here; PDFs are Chromium `--print-to-pdf` of the compiled HTML.

| PDF | Assets on this sample |
|---|---|
| [report-card.v1.pdf](report-card.v1.pdf) | logo, crest, stamp, signature, portrait |
| [logbook.v1.pdf](logbook.v1.pdf) | logo |
| [schooling-certificate.v1.pdf](schooling-certificate.v1.pdf) | logo, stamp, signature |
| [enrollment-record.v1.pdf](enrollment-record.v1.pdf) | logo, portrait |
| [student-id-card.v1.pdf](student-id-card.v1.pdf) | logo, portrait |
| [invoice.v1.pdf](invoice.v1.pdf) | logo, stamp |
| [receipt.v1.pdf](receipt.v1.pdf) | logo, stamp |
| [settlement-quittance.v1.pdf](settlement-quittance.v1.pdf) | logo, stamp |
| [account-statement.v1.pdf](account-statement.v1.pdf) | logo |
| [payment-reminder.v1.pdf](payment-reminder.v1.pdf) | logo |
| [withdrawal-certificate.v1.pdf](withdrawal-certificate.v1.pdf) | logo, stamp, signature |
| [annual-transcript.v1.pdf](annual-transcript.v1.pdf) | logo, crest (letterhead has no crest slot yet) |
| [convocation.v1.pdf](convocation.v1.pdf) | logo, stamp |
| [class-timetable.v1.pdf](class-timetable.v1.pdf) | logo |
| [teacher-timetable.v1.pdf](teacher-timetable.v1.pdf) | logo |
| [class-roster.v1.pdf](class-roster.v1.pdf) | logo |
| [attendance-sheet.v1.pdf](attendance-sheet.v1.pdf) | logo |
| [incident-report.v1.pdf](incident-report.v1.pdf) | logo |

Regenerate HTML, then print:

```sh
bun package/adaptor-docs/scripts/write-branded-samples.ts
```
