# @edaya/service

`SchoolApplication` / `SchoolService`: workflows, entity configs, notifications, and cron orchestration.

No I/O implementations here — Postgres and HTTP live in adaptors and `apps/api`.

```sh
bun --filter @edaya/service test
```

Layout: [src/services/README.md](src/services/README.md).
