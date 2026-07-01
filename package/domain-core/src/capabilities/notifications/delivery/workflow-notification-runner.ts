import type { BaseSchoolService } from '../../../application/base-school-service'
import type { ActorMetadata } from '../../../capabilities/authorization'
import type { NotificationTemplateService } from '../../../capabilities/notifications/templates/notification-template-service'
import type { SchoolRepositories } from '../../../ports'
import type { NotificationGatewayPort } from '../../../ports/gateways/notification-gateway'

export interface WorkflowNotificationContext {
  notificationGateway: NotificationGatewayPort
  repositories: SchoolRepositories
  templateService: NotificationTemplateService
  actor: ActorMetadata
}

export type WorkflowNotificationHandler<T = unknown> = (
  context: WorkflowNotificationContext,
  payload: T,
) => Promise<void>

export class WorkflowNotificationRunner {
  private readonly handlers = new Map<string, WorkflowNotificationHandler[]>()

  register<T>(eventKey: string, handler: WorkflowNotificationHandler<T>): void {
    const existing = this.handlers.get(eventKey) ?? []
    existing.push(handler as WorkflowNotificationHandler)
    this.handlers.set(eventKey, existing)
  }

  getHandlers(eventKey: string): readonly WorkflowNotificationHandler[] {
    return this.handlers.get(eventKey) ?? []
  }

  hasHandlers(eventKey: string): boolean {
    return (this.handlers.get(eventKey)?.length ?? 0) > 0
  }

  async run(eventKey: string, context: WorkflowNotificationContext, payload: unknown): Promise<void> {
    for (const handler of this.getHandlers(eventKey)) {
      await handler(context, payload)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

export const workflowNotificationRunner = new WorkflowNotificationRunner()

export async function runWorkflowNotifications(
  baseService: BaseSchoolService,
  eventKey: string,
  payload: unknown,
): Promise<void> {
  await workflowNotificationRunner.run(eventKey, {
    notificationGateway: baseService.notificationGateway,
    repositories: baseService.repositories,
    templateService: baseService.templateService,
    actor: baseService.actor,
  }, payload)
}
