# adaptor-sms

SMS provider adapters. `src/index.ts` contains Africa's Talking form-POST delivery and a log provider. The legacy `/version1/messaging` adapter omits `from` for absent or blank sender IDs, allowing the provider default; configured sender IDs are trimmed. It normalizes acceptance, definitive rejection and uncertainty without retries. `tests/` uses injected HTTP responses; it never contacts the provider.
