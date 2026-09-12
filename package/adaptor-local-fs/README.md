# @edaya/adaptor-local-fs

Local-dev `FileStoragePort`: files on disk under `.data/files`, signed upload/download tokens.

The HTTP process that serves those URLs is `@edaya/local-files-server` (started by `bun repo dev` on port 9200).

```sh
bun --filter @edaya/adaptor-local-fs test
```
