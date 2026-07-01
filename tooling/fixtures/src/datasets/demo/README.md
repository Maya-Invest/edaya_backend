# Demo dataset

Data-only fixtures typed with `@edaya/core` `*Input` types. Import `demoDataset` from `@edaya/fixtures`.

```text
demo/
├── index.ts      # demoDataset assembly
├── school.ts     # school shell + core curriculum
├── people.ts     # students, staff, guardians, staff assignments (typed arrays)
└── domains/      # domain entity arrays (assessments, attendance, …)
```

- **No narrative adapters** — students use `firstName` / `lastName` directly, like `integration`.
- **Staff assignments** — `demoClassSubjectStaffAssignments` in `people.ts` (`StaffAssignmentInput[]`).
- **Generators** — only `datasets/bulk` uses procedural utilities.

`@edaya/seeding` owns orchestration; presentation metadata stays in `meta/`.
