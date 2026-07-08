import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import { expireAccountInvitations } from '../../src/capabilities/scheduling-jobs/jobs/expire-account-invitations'

describe('expireAccountInvitations', () => {
  test('expires pending invitations past asOf and skips active ones', async () => {
    const expiredInvitation = new AccountInvitation({
      id: 'inv-expired',
      schoolId: 'school-1',
      kind: AccountInvitationKind.Staff,
      targetId: 'staff-1',
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: 'staff@school.edu',
      tokenHash: 'hash-expired',
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      createdByStaffId: 'admin-1',
    })
    const activeInvitation = new AccountInvitation({
      id: 'inv-active',
      schoolId: 'school-1',
      kind: AccountInvitationKind.Guardian,
      targetId: 'guardian-1',
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: 'guardian@school.edu',
      tokenHash: 'hash-active',
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date('2026-01-03T00:00:00Z'),
      createdByStaffId: 'admin-1',
    })

    const saved: AccountInvitation[] = []
    const revoke = mock(async () => {})
    const context = {
      asOf: new Date('2026-01-02T00:00:00Z'),
      actor: {
        kind: 'system' as const,
        systemId: 'cron',
        schoolId: 'school-1',
        requestId: 'cron:test',
        reason: 'test',
      },
      service: {
        baseService: {
          repositories: {
            accountInvitations: {
              list: mock(async () => [expiredInvitation, activeInvitation]),
              save: mock(async (entity: AccountInvitation) => {
                saved.push(entity)
              }),
            },
          },
          invitationDelivery: { revoke },
        },
      },
    } as never

    const result = await expireAccountInvitations(context)

    expect(result).toEqual({ processed: 1, skipped: 1 })
    expect(revoke).toHaveBeenCalledWith('inv-expired')
    expect(saved).toHaveLength(1)
    expect(saved[0]?.status).toBe(AccountInvitationStatus.Expired)
  })
})
