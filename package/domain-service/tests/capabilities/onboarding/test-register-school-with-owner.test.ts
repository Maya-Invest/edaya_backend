import { describe, expect, it } from 'bun:test'
import { resolveOwnerProfile } from '../../../src/capabilities/onboarding/register-school-with-owner'

describe('register school with owner', () => {
  it('splits a display name into first and last name', () => {
    expect(resolveOwnerProfile({
      user: { id: 'user-1', name: 'Ada Lovelace' },
    })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
  })

  it('falls back to owner defaults when the display name is blank', () => {
    expect(resolveOwnerProfile({
      user: { id: 'user-1', name: '   ' },
    })).toEqual({
      firstName: 'Owner',
      lastName: 'Account',
    })
  })

  it('includes a trimmed email when present', () => {
    expect(resolveOwnerProfile({
      user: {
        id: 'user-1',
        name: 'Ada',
        email: '  owner@school.edu ',
      },
    })).toEqual({
      firstName: 'Ada',
      lastName: 'Account',
      email: 'owner@school.edu',
    })
  })
})
