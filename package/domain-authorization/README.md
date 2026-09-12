# @edaya/authorization

Grants, operations, and resource policy for school actors (staff, teacher, guardian, student).

The school API verifies identity JWTs, then this package decides what that actor may do. No Better Auth dependency.

```sh
bun --filter @edaya/authorization test
```

Model and pipeline: [src/README.md](src/README.md).
