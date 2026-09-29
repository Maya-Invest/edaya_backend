# Better Auth adapter

`src/index.ts` implements the Account primary-authentication port against pinned Better Auth. It exposes no provider routes or sessions to clients. Successful primary verification produces evidence for Account policy; provider credentials never confer business access.
