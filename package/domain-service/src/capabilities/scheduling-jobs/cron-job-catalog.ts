export type CronJobKey = 'processDueNotifications' | 'reconcilePendingDeliveries' | 'expireAccountInvitations' | 'preparePrivateFileCleanup' | 'advanceFamilyFeedbackCampaigns'

function defineCronJobKeys<const Keys extends readonly CronJobKey[]>(
  keys: Keys & (
    Exclude<CronJobKey, Keys[number]> extends never
      ? unknown
      : `Missing cron job keys: ${Exclude<CronJobKey, Keys[number]>}`
  ),
): Keys {
  return keys
}

export const CRON_JOB_KEYS = defineCronJobKeys([
  'processDueNotifications',
  'reconcilePendingDeliveries',
  'expireAccountInvitations',
  'preparePrivateFileCleanup',
  'advanceFamilyFeedbackCampaigns',
] as const)
