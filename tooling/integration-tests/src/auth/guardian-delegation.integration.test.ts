import type { DelegationGrant } from '@edaya/adaptor-auth'
import { ALL_GUARDIAN_CAPABILITIES } from '@edaya/authorization'
import { Guardian } from '@edaya/core'
import { MINIMAL_AUTH_FIXTURE_GUARDIAN_ID } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { expect, it } from 'bun:test'
import { createGuardianDelegationAuthorization } from '@/lib/integrations/guardian-authorization'
import { guardianScopeRegistry } from '@/lib/integrations/scopes'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('live parent delegation authority', (getContext) => {
  it('covers every guardian read capability exactly once', () => {
    expect(Object.values(guardianScopeRegistry).map(entry => entry.capability).sort()).toEqual([...ALL_GUARDIAN_CAPABILITIES].sort())
  })

  it('rechecks subject, school, explicit children, current links and guardian access', async () => {
    const { application } = getContext()
    const { repositories } = application
    const guardian = (await repositories.guardians.findById(MINIMAL_AUTH_FIXTURE_GUARDIAN_ID))!
    const links = await repositories.guardianLinks.list({ guardianId: guardian.id })
    expect(links.length).toBeGreaterThan(0)
    const selected = links[0]!.studentId
    const selection = { schoolId: guardian.schoolId, studentIds: [selected], scopes: ['students.profile:read'] }
    const authorization = createGuardianDelegationAuthorization(async () => application)
    expect(await authorization.authorizeSelection(guardian.subjectId!, selection)).toEqual({ guardianId: guardian.id })
    await expect(authorization.authorizeSelection('another-subject', selection)).rejects.toThrow()
    await expect(authorization.authorizeSelection(guardian.subjectId!, { ...selection, schoolId: 'another-school' })).rejects.toThrow()
    await expect(authorization.authorizeSelection(guardian.subjectId!, { ...selection, studentIds: [selected, 'unlinked-child'] })).rejects.toThrow()
    await expect(authorization.authorizeSelection(guardian.subjectId!, { ...selection, scopes: ['students:write'] })).rejects.toThrow()
    const grant: DelegationGrant = { ...selection, id: 'synthetic-grant', guardianId: guardian.id, subjectId: guardian.subjectId!, clientId: 'synthetic-client', createdAt: new Date(), expiresAt: new Date(Date.now() + 60000) }
    expect((await authorization.resolveActor(grant)).guardianScope.studentIds).toEqual([selected])
    // Removing one selected link narrows access without extending it to other children.
    const withInvalidChild = { ...grant, studentIds: [selected, 'removed-child'] }
    expect((await authorization.resolveActor(withInvalidChild)).guardianScope.studentIds).toEqual([selected])
    await repositories.guardianLinks.delete(links[0]!.id)
    try {
      expect(await authorization.isGrantCurrent(grant)).toBe(false)
    }
    finally {
      await repositories.guardianLinks.save(links[0]!)
    }
    await repositories.guardians.save(new Guardian({ ...guardian.data, contactMethods: [...guardian.contactMethods], hasAccess: false }))
    try {
      expect(await authorization.isGrantCurrent(grant)).toBe(false)
    }
    finally {
      await repositories.guardians.save(guardian)
    }
  })
}, { isolate: true })
