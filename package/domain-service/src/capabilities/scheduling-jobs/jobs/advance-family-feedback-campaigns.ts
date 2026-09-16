import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'

export async function advanceFamilyFeedbackCampaigns(
  context: SchoolCronJobContext,
): Promise<CronJobResult> {
  return context.service.familyFeedbackWorkflow.advanceFamilyFeedbackCampaigns(context.asOf)
}
