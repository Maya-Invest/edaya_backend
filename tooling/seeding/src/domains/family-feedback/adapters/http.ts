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

function recordString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key]
  return typeof value === 'string' ? value : undefined
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
        const id = recordString(row, 'id')
        const teacherId = recordString(row, 'teacherId')
        if (!id || !teacherId) {
          return []
        }
        return [{ id, teacherId }]
      })
    }),
    listStaffMembers: () => withSeedPortError('familyFeedback.listStaffMembers', async () => {
      const rows = await postEntityList(requestOptions, 'staffMembers', { accountKind: 'human' })
      return asRecordList(rows).flatMap((row) => {
        const id = recordString(row, 'id')
        if (!id) {
          return []
        }
        return [{ id }]
      })
    }),
    listCampaigns: () => withSeedPortError('familyFeedback.listCampaigns', async () => {
      const rows = await postCoreQuery(requestOptions, 'listFamilyFeedbackCampaigns', {})
      return asRecordList(rows).flatMap((row) => {
        const id = recordString(row, 'id')
        if (!id) {
          return []
        }
        return [{ id, status: recordString(row, 'status') ?? 'draft' }]
      })
    }),
    createCampaign: record => withSeedPortError('familyFeedback.createCampaign', async () => {
      await postCoreCommand(requestOptions, 'createFamilyFeedbackCampaign', record)
    }),
    assignModerator: record => withSeedPortError('familyFeedback.assignModerator', async () => {
      await postCoreCommand(requestOptions, 'assignFamilyFeedbackModerator', record)
    }),
  }
}
