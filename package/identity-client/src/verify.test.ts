import { describe, expect, test } from 'bun:test'
import { createTestIdentityKeys, signTestIdentityToken } from './testing'
import { verifyIdentityToken } from './verify'

const issuer = 'http://localhost:9900'
const audience = 'http://localhost:9999'

describe('verifyIdentityToken', () => {
  test('accepts a resource-audience JWT with email', async () => {
    const keys = await createTestIdentityKeys()
    const token = await signTestIdentityToken(keys, {
      sub: 'user-1',
      email: 'jane@school.edu',
      email_verified: true,
      iss: issuer,
      aud: audience,
    })
    await expect(verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks })).resolves.toMatchObject({
      sub: 'user-1',
      email: 'jane@school.edu',
      email_verified: true,
    })
  })

  test('rejects the wrong audience', async () => {
    const keys = await createTestIdentityKeys()
    const token = await signTestIdentityToken(keys, {
      sub: 'user-1',
      email: 'jane@school.edu',
      iss: issuer,
      aud: 'https://other.example',
    })
    await expect(verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks })).rejects.toMatchObject({ code: 'audience' })
  })

  test('accepts a resource-audience JWT with phone only', async () => {
    const keys = await createTestIdentityKeys()
    const token = await signTestIdentityToken(keys, {
      sub: 'user-2',
      phone: '+2250700000000',
      iss: issuer,
      aud: audience,
    })
    await expect(verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks })).resolves.toMatchObject({
      sub: 'user-2',
      phone: '+2250700000000',
    })
  })

  test('accepts an Account token without contact claims', async () => {
    const keys = await createTestIdentityKeys()
    const token = await signTestIdentityToken(keys, {
      sub: 'user-1',
      iss: issuer,
      aud: audience,
    })
    await expect(verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks })).resolves.toMatchObject({ sub: 'user-1' })
  })
})
