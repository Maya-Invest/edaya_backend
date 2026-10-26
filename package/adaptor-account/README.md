# Account persistence

`src/repository.ts` implements transactional Account storage. `src/security.ts` encrypts authenticator secrets and verifies TOTP with replay prevention. `drizzle/` contains durable identity migrations; these survive auth provider replacement. `src/migrate.ts` applies them to the identity database.

`identity.terms_acceptance` stores the first completed acceptance per account/version. Inserts are idempotent and share the session transaction. Do not purge these durable receipts with expiring credentials.
