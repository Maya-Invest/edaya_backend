# Account domain

`src/model.ts` defines stable Account identities and authentication evidence. `src/ports.ts` defines mandatory email/phone OTP and separate delivery, persistence, cryptography and privileged-policy contracts. `src/service.ts` owns linking, session assurance, authenticator enrollment, recovery and revocation. No framework or transport dependencies.
