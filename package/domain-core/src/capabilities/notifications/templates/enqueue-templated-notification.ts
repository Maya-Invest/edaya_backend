import type { BaseSchoolService } from '../../../application/base-school-service'
import type { NotificationEnqueueInput } from '../../../ports/gateways/notification-gateway'
import type { NotificationTemplateKey } from './keys'
import { deliverNotificationFromEnqueueInput } from '../delivery/deliver-notification'
import { renderNotificationEnqueueContent } from './render-enqueue-content'

export type EnqueueTemplatedNotificationInput
  = Omit<NotificationEnqueueInput, 'title' | 'body' | 'emailSubject' | 'emailBody'>
    & {
      templateKey: NotificationTemplateKey
      variables: Record<string, string>
    }

export async function enqueueTemplatedNotification(
  baseService: Pick<BaseSchoolService, 'notificationGateway' | 'templateService' | 'repositories'>,
  input: EnqueueTemplatedNotificationInput,
): Promise<void> {
  const { templateKey, variables, ...enqueueInput } = input
  const content = await renderNotificationEnqueueContent(baseService.templateService, {
    schoolId: input.schoolId,
    templateKey,
    variables,
  })

  await deliverNotificationFromEnqueueInput({
    notificationGateway: baseService.notificationGateway,
    repositories: baseService.repositories,
  }, {
    ...enqueueInput,
    ...content,
  })
}
