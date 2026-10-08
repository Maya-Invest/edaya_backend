# adaptor-sms

SMS provider adapters. `src/index.ts` contains Africa's Talking form-POST delivery and a log provider. It normalizes acceptance, definitive rejection and uncertainty without retries. `tests/` uses injected HTTP responses; it never contacts the provider.
