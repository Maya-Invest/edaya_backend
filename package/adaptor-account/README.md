# Account persistence

`src/repository.ts` implements transactional Account storage. `src/security.ts` encrypts authenticator secrets and verifies TOTP with replay prevention. `drizzle/` contains durable identity migrations; these survive auth provider replacement. `src/migrate.ts` applies them to the identity database.
