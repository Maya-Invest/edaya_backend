# Novu email transport

`src/email-transport.ts` implements `EmailTransportPort` using the single `transactional.email` workflow. The school dispatcher owns authorization, scheduling, channel preferences and retries. Each attempt provides the current destination with an email override and `replaceToRecipient: true`; the synthetic per-message subscriber stores no business profile or email address.

`src/delivery-webhook.ts` verifies provider signatures and normalizes email receipts using explicit delivery/subject correlation. Authentication and invitation emails have no school-delivery correlation. `src/errors.ts` supports offline subscriber cleanup tooling.

Configure `EMAIL_TRANSPORT=novu`, `NOVU_SECRET_KEY` and optionally `NOVU_API_URL`. The API runtime injects this email transport into the shared notification runtime; it never selects a separate notification gateway. Deploy the single-step workflow with the Novu bootstrap tooling. Email destination overrides follow the [Novu email integration contract](https://docs.novu.co/platform/integrations/email).

School subscriber clients, recipient/preference synchronization, separate invitation/auth gateways, push credentials and event-to-workflow translations do not exist in this adapter.
