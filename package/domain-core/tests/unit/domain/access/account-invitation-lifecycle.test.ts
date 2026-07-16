import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, toPublicAccountInvitation } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const baseArgs = {
  id: 'inv-1',
  schoolId: 'school-1',
  kind: AccountInvitationKind.Staff,
  targetId: 'staff-1',
  contactChannel: AccountInvitationContactChannel.Email,
  contactValue: 'staff@school.edu',
  tokenHash: 'hash-1',
  expiresAt: new Date('2026-12-31T00:00:00.000Z'),
  createdByStaffId: 'admin-1',
}

describe('AccountInvitation lifecycle helpers', () => {
  test('isPending returns true only for unexpired pending invitations', () => {
    const pending = new AccountInvitation(baseArgs)
    expect(pending.isPending(new Date('2026-06-01T00:00:00.000Z'))).toBe(true)
    expect(pending.isPending(new Date('2027-01-01T00:00:00.000Z'))).toBe(false)
  })

  test('isPending returns false for accepted or revoked invitations', () => {
    const accepted = new AccountInvitation({
      ...baseArgs,
      status: AccountInvitationStatus.Accepted,
      acceptedAt: new Date('2026-06-02T00:00:00.000Z'),
      acceptedSubjectId: 'auth-1',
    })

    expect(accepted.isPending()).toBe(false)
  })

  test('copyWith updates invitation fields immutably', () => {
    const invitation = new AccountInvitation(baseArgs)
    const expired = invitation.copyWith({ status: AccountInvitationStatus.Expired })

    expect(invitation.status).toBe(AccountInvitationStatus.Pending)
    expect(expired.status).toBe(AccountInvitationStatus.Expired)
  })

  test('toPublicAccountInvitation strips token hashes from API payloads', () => {
    const publicInvitation = toPublicAccountInvitation(new AccountInvitation(baseArgs))

    expect(publicInvitation).toMatchObject({
      id: 'inv-1',
      contactValue: 'staff@school.edu',
      status: AccountInvitationStatus.Pending,
    })
    expect('tokenHash' in publicInvitation).toBe(false)
  })
})
