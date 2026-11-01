export type { CloudflareEmailBinding } from "./email/cloudflare";
export { createCloudflareEmailTransport } from "./email/cloudflare";
export { createLogEmailTransport } from "./email/log";
export type { EmailSendInput, EmailTransportPort } from "./email/port";
export type { NotifyEmailTransportKind, NotifyTransportEnv } from "./env";
export { DEFAULT_EMAIL_FROM, parseNotifyFromAddress, resolveEmailFrom } from "./env";
export { isNotifySendError, NotifySendError } from "./errors";
export {
  buildInvitationRecipientId,
  buildNotifyChannelId,
  buildNotifyJobId,
  normalizeEmail,
} from "./ids";
export { createNotifyInvitationDeliveryPort } from "./invitation-delivery";
export { drainPendingSchoolNotifications } from "./jobs/drain-jobs";
export { resolveSendChannels } from "./jobs/route-channels";
export { sendJob } from "./jobs/send-job";
export type { SendJobDependencies } from "./jobs/send-job";
export {
  createNotifyNotificationGateway,
} from "./notification-gateway";
export type { CreateNotifyNotificationGatewayOptions } from "./notification-gateway";
export {
  createFcmHttpV1Transport,
  createLogFcmTransport,
  resolveFcmTransport,
} from "./push/fcm";
export type { FcmTransport } from "./push/fcm";
export {
  createNotifyRuntime,
  createNotifyRuntimeFromDrizzle,
  silentNotifyLog,
} from "./runtime";
export type { CreateNotifyRuntimeOptions, NotifyRuntime } from "./runtime";
export { createLogSmsTransport } from "./sms/log";
export { createUnimplementedSmsTransport } from "./sms/unimplemented";
export {
  createNotifySqlFromDrizzle,
} from "./store/sql";

export type {
  NotifyDeviceRow,
  NotifyJobRecipientRow,
  NotifyJobRow,
  NotifyRecipientRow,
  NotifySql,
} from "./store/types";
