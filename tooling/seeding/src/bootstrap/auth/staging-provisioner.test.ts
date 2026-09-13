import { expect, test } from 'bun:test'
import { HttpSeedClient } from '../../transport/http/client'
import { HttpAuthProvisioner } from './http-provisioner'

test('staging only signs in pre-provisioned accounts and never calls local verification', async () => {
  const paths: string[] = []
  const client = new HttpSeedClient({ baseUrl: 'https://staging.api.school.edayaplus.com', authUrl: 'https://staging.identity.edayaplus.com', fetch: async (input) => {
    paths.push(new URL(String(input)).pathname)
    return Response.json({ user: { id: 'fixture-user' } })
  } })
  expect(await new HttpAuthProvisioner(client).ensureUser({ email: 'fixture@example.test', password: 'fixture', name: 'Fixture' })).toEqual({ subjectId: 'fixture-user' })
  expect(paths).toEqual(['/auth/sign-in/email'])
})
