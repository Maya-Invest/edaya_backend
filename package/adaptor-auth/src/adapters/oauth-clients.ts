import type { SQL } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { hashOAuthToken } from './delegation-grants'

export interface RegisteredOAuthClient {
  clientId: string
  name: string
  purpose: string
  redirectUris: string[]
  scopes: string[]
  confidential: boolean
}

/** Operator-only adapter. The public HTTP provider cannot create clients. */
export function createOAuthClientRegistry(database: unknown) {
  const db = database as { execute: (query: SQL) => Promise<unknown> }
  return {
    async register(input: RegisteredOAuthClient): Promise<{ clientId: string, clientSecret?: string }> {
      const clientSecret = input.confidential ? randomBytes(32).toString('base64url') : undefined
      await db.execute(sql`INSERT INTO auth.oauth_client
        (id, client_id, client_secret, name, metadata, redirect_uris, scopes, grant_types, response_types,
         token_endpoint_auth_method, require_pkce, skip_consent, disabled, created_at, updated_at)
        VALUES (${randomUUID()}, ${input.clientId}, ${clientSecret ? hashOAuthToken(clientSecret) : null}, ${input.name},
          ${JSON.stringify({ purpose: input.purpose })}::jsonb, ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.redirectUris)}::jsonb)), ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.scopes)}::jsonb)),
          ARRAY['authorization_code', 'refresh_token'], ARRAY['code'], ${input.confidential ? 'client_secret_basic' : 'none'},
          true, false, false, NOW(), NOW())`)
      return { clientId: input.clientId, ...(clientSecret ? { clientSecret } : {}) }
    },
    async disable(clientId: string): Promise<void> {
      await db.execute(sql`UPDATE auth.oauth_client SET disabled = true, updated_at = NOW() WHERE client_id = ${clientId}`)
      await db.execute(sql`UPDATE auth.edaya_delegation_grants SET revoked_at = COALESCE(revoked_at, NOW()) WHERE client_id = ${clientId}`)
    },
    async rotate(clientId: string): Promise<{ clientId: string, clientSecret: string }> {
      const clientSecret = randomBytes(32).toString('base64url')
      const result = await db.execute(sql`UPDATE auth.oauth_client SET client_secret = ${hashOAuthToken(clientSecret)}, updated_at = NOW()
        WHERE client_id = ${clientId} AND token_endpoint_auth_method = 'client_secret_basic' RETURNING id`) as { rows?: unknown[] }
      if (!result.rows?.length)
        throw new Error('An existing confidential client is required')
      await db.execute(sql`UPDATE auth.edaya_delegation_grants SET revoked_at = COALESCE(revoked_at, NOW()) WHERE client_id = ${clientId}`)
      return { clientId, clientSecret }
    },
  }
}
