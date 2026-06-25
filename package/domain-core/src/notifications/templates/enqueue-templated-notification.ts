import type { NotificationEnqueueInput } from '../../ports/notification-gateway'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { NotificationTemplateKey } from './keys'
import { renderNotificationEnqueueContent } from './render-enqueue-content'

export type EnqueueTemplatedNotificationInput
  = Omit<NotificationEnqueueInput, 'title' | 'body' | 'emailSubject' | 'emailBody'>
    & {
      templateKey: NotificationTemplateKey
      variables: Record<string, string>
    }

export async function enqueueTemplatedNotification(
  baseService: Pick<BaseSchoolService, 'notificationGateway' | 'templateService'>,
  input: EnqueueTemplatedNotificationInput,
): Promise<void> {
  const { templateKey, variables, ...enqueueInput } = input
  const content = await renderNotificationEnqueueContent(baseService.templateService, {
    schoolId: input.schoolId,
    templateKey,
    variables,
  })

  await baseService.notificationGateway.enqueue({
    ...enqueueInput,
    ...content,
  })
}
