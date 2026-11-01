# domain-messaging

SMS Router Service. `src/index.ts` selects the longest matching international prefix and dispatches one attempt through injected `SmsProviderPort` implementations. `tests/` verifies provider selection, input rejection and uncertainty without network access.
