import type { ClassRosterMembersInput, StudentDirectoryInput, StudentDirectoryPage, StudentDirectoryScopes } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { DomainValidationError, studentDirectoryRelations } from '@edaya/core'

async function directoryScopes(base: BaseSchoolService, input: StudentDirectoryInput) {
  if (base.actor.kind !== 'staff' || base.actor.accountKind !== 'human')
    denyResourceAccess()
  if (input.view === 'class-roster' && !input.classGroupId)
    throw new DomainValidationError('A class roster requires a class group')
  const access = base.access.forOperation()
  const students = await access.entity('students').readScope()
  const relations = await Promise.all(studentDirectoryRelations.map(async (resource) => {
    try {
      return [resource, await access.entity(resource).readScope()] as const
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
      return [resource, null] as const
    }
  }))
  const scopes = { students, ...Object.fromEntries(relations) } as StudentDirectoryScopes
  if ((input.photoReview && !scopes.studentPhotoSubmissions)
    || (input.classGroupId && !scopes.enrollments)
    || (input.sort === 'attendance' && !scopes.attendance)
    || (input.sort === 'average' && (!scopes.assessments || !scopes.assessmentResults))) {
    denyResourceAccess()
  }
  return { actor: base.actor, scopes }
}

export async function readStudentDirectory(base: BaseSchoolService, input: StudentDirectoryInput) {
  return base.atomicExecution.execute(async () => base.repositories.studentDirectory.page(input, (await directoryScopes(base, input)).scopes), { readSnapshot: true })
}

export async function revalidateStudentDirectory(base: BaseSchoolService, input: StudentDirectoryInput, ifNoneMatch?: string): Promise<{ etag: string, page?: StudentDirectoryPage }> {
  return base.atomicExecution.execute(async () => {
    const { actor, scopes } = await directoryScopes(base, input)
    const store = base.repositories.studentDirectory
    const revision = await store.revision(base.actor.schoolId)
    const signature = [
      'student-directory-v2',
      actor.schoolId,
      actor.subjectId,
      actor.staffMemberId,
      actor.academicYearId,
      input.view,
      (input.view ? input.q : input.q?.trim()) || '',
      input.classGroupId,
      input.periodId,
      input.status,
      input.photoReview,
      input.sort ?? 'roster',
      input.sortDir ?? 'asc',
      input.offset ?? 0,
      input.limit ?? 25,
      scopes,
      revision,
    ]
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(signature))))
    const etag = `"${Array.from(hash, b => b.toString(16).padStart(2, '0')).join('')}"`
    if (ifNoneMatch?.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag))
      return { etag }
    return { etag, page: await store.page(input, scopes) }
  }, { readSnapshot: true })
}

/** Freeze the complete authorized selection for a user-initiated class export. */
export async function readClassRosterMemberIds(base: BaseSchoolService, input: ClassRosterMembersInput) {
  if (base.actor.kind !== 'staff' || base.actor.accountKind !== 'human')
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const access = base.access.forOperation()
    const [students, enrollments] = await Promise.all([access.entity('students').readScope(), access.entity('enrollments').readScope()])
    const studentIds = await base.repositories.studentDirectory.classRosterMemberIds(input, { students, enrollments })
    return { studentIds }
  }, { readSnapshot: true })
}
