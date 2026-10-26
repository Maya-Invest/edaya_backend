# Account domain

`src/model.ts` defines stable Account identities and authentication evidence. `src/ports.ts` defines mandatory email/phone OTP and separate delivery, persistence, cryptography and privileged-policy contracts. `src/service.ts` owns linking, session assurance, authenticator enrollment, recovery and revocation. No framework or transport dependencies.

`src/terms.ts` defines versioned terms documents, policy and acceptance evidence. The service validates acceptance at login start and saves it only with a completed session. Linking, authenticated enrollment and existing session renewal do not acquire acceptance.
