import type { Hono } from 'hono'
import type { AppBindings } from '@/http/types'
import type { ApiSchoolApplication } from '@/lib/school-api/application'
import { createSchoolBootstrapActor } from '@edaya/authorization'
import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { expect, it } from 'bun:test'
import {
  createAppRequest,
  grantAccessControlAssign,
  signInWithBearerThroughApp,
  signUpAuthUser,
} from '../support/api-route-harness'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

const INVITEE_EMAIL = 'p.martin.invite-e2e@school.edu'
const UNLINKED_STAFF_ID = 'st-invite-e2e'
const RESEND_STAFF_ID = 'st-invite-resend'

async function registerUnlinkedStaff(
  application: ApiSchoolApplication,
  input: { id: string, email: string, firstName: string, lastName: string },
) {
  const bootstrapActor = createSchoolBootstrapActor({
    schoolId: SEED_SCHOOL_ID,
    requestId: `register-${input.id}`,
  })
  const service = application.forActor(bootstrapActor)
  await service.setupWorkflow.registerStaffMember({
    id: input.id,
    schoolId: SEED_SCHOOL_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  })
}

async function sendStaffInvitation(
  app: Hono<AppBindings>,
  authHeaders: (email?: string) => Promise<Record<string, string>>,
  targetId: string,
  contactValue: string,
) {
  const response = await app.request(createAppRequest('/core/commands/send-account-invitation', {
    method: 'POST',
    headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL),
    body: JSON.stringify({
      kind: 'staff',
      targetId,
      contactChannel: 'email',
      contactValue,
    }),
  }))

  expect(response.status).toBe(200)
  return await response.json() as {
    invitation: { id: string, status: string, targetId: string }
    token: string
  }
}

async function previewInvitation(app: Hono<AppBindings>, token: string) {
  const response = await app.request(createAppRequest(
    `/public/invitations/${encodeURIComponent(token)}`,
  ))
  return {
    status: response.status,
    body: await response.json() as {
      status: string
      kind: string
      targetId: string
      inviteeName: string
      schoolName: string
      contactEmail: string
      authAccountExists: boolean
    },
  }
}

describeWithLightSchool('account invitation public link flow', (getContext) => {
  it('sends an invitation, previews the link, and accepts it end-to-end', async () => {
    const { app, runtime, application, authHeaders } = getContext()
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)
    await registerUnlinkedStaff(application, {
      id: UNLINKED_STAFF_ID,
      email: INVITEE_EMAIL,
      firstName: 'Paul',
      lastName: 'Martin',
    })

    const { token, invitation } = await sendStaffInvitation(
      app,
      authHeaders,
      UNLINKED_STAFF_ID,
      INVITEE_EMAIL,
    )

    expect(token.length).toBeGreaterThan(20)
    expect(invitation.status).toBe('pending')
    expect(invitation.targetId).toBe(UNLINKED_STAFF_ID)

    const preview = await previewInvitation(app, token)
    expect(preview.status).toBe(200)
    expect(preview.body.status).toBe('pending')
    expect(preview.body.kind).toBe('staff')
    expect(preview.body.targetId).toBe(UNLINKED_STAFF_ID)
    expect(preview.body.inviteeName).toContain('Paul')
    expect(preview.body.contactEmail).toBe(INVITEE_EMAIL)
    expect(preview.body.authAccountExists).toBe(false)

    await signUpAuthUser(runtime, {
      email: INVITEE_EMAIL,
      name: 'Paul Martin',
    })
    const inviteeAccessToken = await signInWithBearerThroughApp(app, { email: INVITEE_EMAIL })

    const acceptResponse = await app.request(createAppRequest(
      `/public/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${inviteeAccessToken}`,
        },
      },
    ))

    expect(acceptResponse.status).toBe(200)

    const acceptBody = await acceptResponse.json() as {
      kind: string
      entity: { id: string, subjectId: string }
    }
    expect(acceptBody.kind).toBe('staff')
    expect(acceptBody.entity.id).toBe(UNLINKED_STAFF_ID)
    expect(acceptBody.entity.subjectId).toBeTruthy()

    const linkedStaff = await application.repositories.staffMembers.findById(UNLINKED_STAFF_ID)
    expect(linkedStaff?.subjectId).toBe(acceptBody.entity.subjectId)

    const acceptedPreview = await previewInvitation(app, token)
    expect(acceptedPreview.status).toBe(200)
    expect(acceptedPreview.body.status).toBe('accepted')
  })

  it('revokes the previous link when an invitation is resent', async () => {
    const { app, application, authHeaders } = getContext()
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)
    await registerUnlinkedStaff(application, {
      id: RESEND_STAFF_ID,
      email: 'resend.invite-e2e@school.edu',
      firstName: 'Rita',
      lastName: 'Martin',
    })

    const first = await sendStaffInvitation(
      app,
      authHeaders,
      RESEND_STAFF_ID,
      'resend.invite-e2e@school.edu',
    )

    const resendResponse = await app.request(createAppRequest('/core/commands/resend-account-invitation', {
      method: 'POST',
      headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL),
      body: JSON.stringify({ invitationId: first.invitation.id }),
    }))
    expect(resendResponse.status).toBe(200)

    const resent = await resendResponse.json() as {
      invitation: { id: string, status: string }
      token: string
    }
    expect(resent.token).not.toBe(first.token)
    expect(resent.invitation.id).not.toBe(first.invitation.id)
    expect(resent.invitation.status).toBe('pending')

    const oldPreview = await previewInvitation(app, first.token)
    expect(oldPreview.status).toBe(200)
    expect(oldPreview.body.status).toBe('revoked')

    const newPreview = await previewInvitation(app, resent.token)
    expect(newPreview.status).toBe(200)
    expect(newPreview.body.status).toBe('pending')
  })

  it('returns 404 for unknown invitation tokens', async () => {
    const { app } = getContext()

    const preview = await previewInvitation(app, 'totally-unknown-token-value')
    expect(preview.status).toBe(404)
  })

  it('reports when the invited email already has an auth account', async () => {
    const { app, runtime, application, authHeaders } = getContext()
    const existingEmail = 'existing.invite-e2e@school.edu'
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)
    await registerUnlinkedStaff(application, {
      id: 'st-invite-existing-auth',
      email: existingEmail,
      firstName: 'Existing',
      lastName: 'User',
    })
    await signUpAuthUser(runtime, {
      email: existingEmail,
      name: 'Existing User',
    })

    const { token } = await sendStaffInvitation(
      app,
      authHeaders,
      'st-invite-existing-auth',
      existingEmail,
    )

    const preview = await previewInvitation(app, token)
    expect(preview.status).toBe(200)
    expect(preview.body.authAccountExists).toBe(true)
  })

  it('returns 401 when accepting without a session', async () => {
    const { app, application, authHeaders } = getContext()
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)
    await registerUnlinkedStaff(application, {
      id: 'st-invite-unauth',
      email: 'unauth.invite-e2e@school.edu',
      firstName: 'No',
      lastName: 'Session',
    })

    const { token } = await sendStaffInvitation(
      app,
      authHeaders,
      'st-invite-unauth',
      'unauth.invite-e2e@school.edu',
    )

    const acceptResponse = await app.request(createAppRequest(
      `/public/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    ))

    expect(acceptResponse.status).toBe(401)
  })
}, { isolate: true })
