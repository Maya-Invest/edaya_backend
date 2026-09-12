# @edaya/adaptor-notify

In-process email and push adapters for school notifications (`NotificationGatewayPort`).

Local default is `EMAIL_TRANSPORT=log`. Cloudflare Email is used on the Worker. If `NOVU_SECRET_KEY` is set, `@edaya/adaptor-novu` takes over instead.

Identity OTP / signup mail is owned by `edaya_identity`, not this package.

```sh
bun --filter @edaya/adaptor-notify test
```
