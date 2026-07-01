import type { InvitationDeliveryInput, InvitationDeliveryPort } from '../ports/gateways/invitation-delivery'

export const noOpInvitationDeliveryPort: InvitationDeliveryPort = {
  deliver: async () => {},
  revoke: async () => {},
}

export class RecordingInvitationDeliveryPort implements InvitationDeliveryPort {
  readonly deliveries: InvitationDeliveryInput[] = []
  readonly revokedInvitationIds: string[] = []

  async deliver(input: InvitationDeliveryInput): Promise<void> {
    this.deliveries.push(input)
  }

  async revoke(invitationId: string): Promise<void> {
    this.revokedInvitationIds.push(invitationId)
  }
}
