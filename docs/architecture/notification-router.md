# Notification delivery

All school messages use the durable school queue and the same authorization policy before every channel attempt. The API owns templates, scheduling, recipient identity, preferences, retries and inbox state. Providers only deliver the authorized channel payload.

## Runtime and transports

`@edaya/adaptor-notify` implements `NotificationGatewayPort`, `InvitationDeliveryPort` and `AuthEmailDeliveryPort`. Local and Worker runtimes require an initialized dispatcher; missing runtime configuration fails rather than silently logging or switching gateways. The in-memory test runtime uses the no-op port.

`EMAIL_TRANSPORT` selects `log`, `cloudflare` or `novu`. Novu additionally requires `NOVU_SECRET_KEY`; `NOVU_API_URL` is optional. SMTP is not implemented and fails explicitly. FCM uses `FCM_SERVICE_ACCOUNT_JSON`. Provider selection never changes the school queue, policy, profile resolution or push transport.

Authentication and invitation commands await their email attempt and reject when delivery cannot be attempted. School commands enqueue in their transaction; background dispatch sends after commit. Cron owns delays. The provider receives immediate channel attempts.

## Authorization and facts

`access.notifications.recipient` admits the school-bound `notify-adapter` system actor and binds it to the persisted delivery's school, source, subject and recipient profile. It then checks current source visibility. Unknown sources, revoked links, inactive profiles, corrected attendance, changed calendar scope and unpublished academic content deny dispatch. Guardian report and attendance preferences are checked on the exact student relationship. Academic sources use the same native student/year/publication predicates as reads.

Contacts and preferences come from the exact current profile, enriched with current central-identity contacts. There is no subscriber upsert, removal or session backfill. Native `notify.recipients` holds only explicit authentication/invitation destinations. `notify.devices` associates push credentials with the login; it confers no access. Each channel attempt re-resolves the delivery. Denials cancel terminally; missing resolvers and infrastructure failures fail closed and use bounded retries. Successful channel receipts survive retries.

Generated deliveries have one source key and a unique school/source/subject/profile identity. IDs remain opaque provider correlation keys. Retries reuse the persisted ID; cancellation finds persisted deliveries even after account unlinking or enrollment removal. Announcement dispatch reloads the persisted publication and audience.

## Novu email

Novu runs one immediate email step, `transactional.email`. There are no business-event workflows, delay steps, provider inboxes, push steps or copied profile preferences. A synthetic per-message subscriber contains no business contact; each trigger uses the current email override with `replaceToRecipient: true`, following the [Novu email integration contract](https://docs.novu.co/platform/integrations/email). The transport carries explicit delivery/subject correlation for signed email receipts, without parsing legacy delivery IDs.

## Deployment

Run school migrations in journal order, followed by notification schema installation, using deployment tooling. Migration `0011_notification_delivery_sources` preserves delivery/provider IDs and rejects ambiguous source history. Migration `0012_notification_contact_authority` removes native school-contact snapshots while retaining command destinations, jobs and receipts.

For Novu, bootstrap the `transactional.email` workflow, retire the old event/auth/invitation workflows and delete their reviewed subscriber records during the paused cutover. Export provider history before cleanup; drain or cancel outstanding old workflow executions before resuming. Configure `EMAIL_TRANSPORT=novu` instead of the removed `NOTIFICATION_PROVIDER` setting. Mobile clients re-register push tokens into the school device store. Follow the [coordinated cutover procedure](authorization-cutover.md). No runtime compatibility gateway or subscriber synchronization remains.
