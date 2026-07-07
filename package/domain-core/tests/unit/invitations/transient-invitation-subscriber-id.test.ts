import { describe, expect, test } from 'bun:test'
import { buildTransientInvitationSubscriberId } from '../../../src/capabilities/invitations/transient-subscriber-id'

describe('buildTransientInvitationSubscriberId', () => {
  test('prefixes invitation ids for transient delivery subscribers', () => {
    expect(buildTransientInvitationSubscriberId('inv-123'))
      .toBe('invite:inv-123')
  })
})
