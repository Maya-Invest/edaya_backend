import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { FamilyFeedbackSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postCoreQuery, postEntityList } from '../../../transport/http/core-entity'

export interface CreateHttpFamilyFeedbackSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
  }
  return []
}

export function createHttpFamilyFeedbackSeedPort(
  options: CreateHttpFamilyFeedbackSeedPortOptions,
): FamilyFeedbackSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-family-feedback-seed',
  }

  return {
    listSubjectAssignments: academicYearId => withSeedPortError('familyFeedback.listSubjectAssignments', async () => {
      const rows = await postEntityList(requestOptions, 'teacherAssignments', {
        academicYearId,
        kind: 'subject',
        status: 'active',
      })
      return asRecordList(rows).flatMap((row) => {
        if (typeof row.id !== 'string' || typeof row.teacherId !== 'string') {
          return []
        }
        return [{ id: row.id, teacherId: row.teacherId }]
      })
    }),
    listStaffMembers: () => withSeedPortError('familyFeedback.listStaffMembers', async () => {
      const rows = await postEntityList(requestOptions, 'staffMembers', { accountKind: 'human' })
      return asRecordList(rows).flatMap((row) => {
        if (typeof row.id !== 'string') {
          return []
        }
        return [{ id: row.id }]
      })
    }),
    listCampaigns: () => withSeedPortError('familyFeedback.listCampaigns', async () => {
      const rows = await postCoreQuery(requestOptions, 'listFamilyFeedbackCampaigns', {})
      return asRecordList(rows).flatMap((row) => {
        if (typeof row.id !== 'string') {
          return []
        }
        return [{ id: row.id, status: typeof row.status === 'string' ? row.status : 'draft' }]
      })
    }),
    createCampaign: record => withSeedPortError('familyFeedback.createCampaign', async () => {
      await postCoreCommand(requestOptions, 'createFamilyFeedbackCampaign', record)
    }),
  }
}
