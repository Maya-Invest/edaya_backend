import { PlatformPolicies, createPlatformActorMetadata, createS2sActorMetadata, createS2sClient, createPlatformUser } from '@edaya/authorization'
import { PlatformUser, S2sClient } from '@edaya/core'
import { PostgresAtomicExecution } from '../src/lib/transaction'
import { AccessPolicies, ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AssessmentResult, Permission, StaffPermissionAssignment } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresSchoolRepositories } from '../src/postgres-school-repositories'
import { seedAuthorizationPlacement } from './support/authorization-database'

describe('authorization policies against native repository scopes', () => {
  let db: PGlite
  let repositories: PostgresSchoolRepositories
  const staff = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request', assuranceLevel: ActorAssuranceLevel.Verified })
  const teacher = createTeacherActorMetadata({ schoolId: 'school-a', teacherId: 'teacher-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request' })
  const guardian = createGuardianActorMetadata({ schoolId: 'school-a', guardianId: 'guardian-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request' })
  beforeEach(async () => {
    db = new PGlite()
    repositories = new PostgresSchoolRepositories(drizzle(db))
    await repositories.init({ driver: 'pglite' })
    await seedAuthorizationPlacement(db)
    await db.exec(`
      INSERT INTO academic_periods (id, school_id, academic_year_id, name, start_date, end_date, created_at) VALUES
        ('period-a', 'school-a', 'year-a', 'A', '2026-01-01', '2026-06-01', now()), ('period-b', 'school-b', 'year-b', 'B', '2026-01-01', '2026-06-01', now());
      INSERT INTO students (id, school_id, first_name, last_name, status, created_at) VALUES
        ('student-a', 'school-a', 'A', 'Student', 'active', now()), ('student-other', 'school-a', 'Other', 'Student', 'active', now()),
        ('student-b', 'school-b', 'B', 'Student', 'active', now());
      INSERT INTO student_class_enrollments (id, student_id, class_group_id, academic_year_id, enrollment_index, status, enrolled_at, created_at) VALUES
        ('enrollment-a', 'student-a', 'class-a', 'year-a', 1, 'active', now(), now()),
        ('enrollment-other', 'student-other', 'class-other', 'year-a', 1, 'active', now(), now()),
        ('enrollment-b', 'student-b', 'class-b', 'year-b', 1, 'active', now(), now());
      INSERT INTO assessments (id, class_group_id, class_subject_id, period_id, title, kind, max_score, coefficient, due_at, created_at) VALUES
        ('assessment-math', 'class-a', 'math-a', 'period-a', 'Math', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-french', 'class-a', 'french-a', 'period-a', 'French', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-other', 'class-other', 'math-other', 'period-a', 'Other', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-b', 'class-b', 'math-b', 'period-b', 'B', 'homework', 20, 1, '2026-05-01', now());
      INSERT INTO assessment_results (id, assessment_id, student_id, score, created_at) VALUES
        ('1-math', 'assessment-math', 'student-a', 10, now()), ('2-french', 'assessment-french', 'student-a', 12, now()),
        ('3-other', 'assessment-other', 'student-other', 14, now()), ('4-foreign', 'assessment-b', 'student-b', 16, now());
      INSERT INTO teachers (id, school_id, first_name, last_name, subject_id, is_active, created_at) VALUES ('teacher-a', 'school-a', 'A', 'Teacher', 'person-a', true, now());
      INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, kind, class_subject_id, status, created_at) VALUES
        ('teaching', 'teacher-a', 'year-a', 'subject', 'math-a', 'active', now());
      INSERT INTO guardians (id, school_id, first_name, last_name, subject_id, has_access, contact_methods, created_at) VALUES ('guardian-a', 'school-a', 'A', 'Guardian', 'person-a', true, '[]', now());
      INSERT INTO guardian_student_links (id, school_id, guardian_id, student_id, relationship, is_primary, created_at) VALUES
        ('guardian-link', 'school-a', 'guardian-a', 'student-a', 'parent', true, now());
    `)
  })
  afterEach(async () => { await db.close() })

  async function addGrant(permission: Permission, classGroupId = 'class-a', extra: Partial<ConstructorParameters<typeof StaffPermissionAssignment>[0]> = {}) {
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `${permission}-${classGroupId}`, schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a',
      permission, scopes: [{ kind: 'class_group', classGroupId }], ...extra,
    }))
  }

  test('read, single, count and pagination have identical tenant and class boundaries', async () => {
    await addGrant(Permission.GRADE_READ)
    const access = new AccessPolicies(staff, repositories)
    const results = repositories.assessmentResults.forAccess(await access.grades.readScope())
    expect((await results.list()).map(row => row.id)).toEqual(['1-math', '2-french'])
    expect(await results.count()).toBe(2)
    expect(await results.findById('3-other')).toBeUndefined()
    expect(await results.findById('4-foreign')).toBeUndefined()
    expect((await results.list({ $offset: 1, $limit: 1 })).map(row => row.id)).toEqual(['2-french'])
    expect(await results.list({ $offset: 2, $limit: 1 })).toEqual([])
  })

  test('a read grant never contributes placement to a write grant', async () => {
    await addGrant(Permission.GRADE_READ, 'class-other')
    await addGrant(Permission.GRADE_INPUT)
    const access = new AccessPolicies(staff, repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-other', studentId: 'student-other' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-other' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
  })

  test('subject teachers cannot read or input another subject for their own student', async () => {
    const access = new AccessPolicies(teacher, repositories)
    const resultRepo = repositories.assessmentResults.forAccess(await access.grades.readScope())
    expect((await resultRepo.list()).map(row => row.id)).toEqual(['1-math'])
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-french', studentId: 'student-a' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-other', studentId: 'student-other' })).rejects.toThrow()
  })

  test('homeroom access admits class grade reads but not subject grade input', async () => {
    await db.exec("DELETE FROM teacher_assignments; INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, kind, class_group_id, status, created_at) VALUES ('homeroom', 'teacher-a', 'year-a', 'homeroom', 'class-a', 'active', now())")
    const access = new AccessPolicies(teacher, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(2)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
  })

  test('uses current facts after expiration, relationship removal and selected-year changes', async () => {
    await addGrant(Permission.GRADE_INPUT, 'class-a', { endsAt: new Date('2000-01-01') })
    const access = new AccessPolicies(staff, repositories)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    const teacherAccess = new AccessPolicies(teacher, repositories)
    await teacherAccess.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await db.exec("DELETE FROM teacher_assignments WHERE id = 'teaching'")
    await expect(teacherAccess.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    const oldYear = new AccessPolicies({ ...staff, academicYearId: 'year-old' }, repositories)
    expect((await oldYear.grades.readScope()).clauses).toEqual([])
  })

  test('assignments confer authority directly and removal takes effect without grant synchronization', async () => {
    await db.exec(`INSERT INTO staff_assignments (id, staff_id, academic_year_id, role, permissions, class_group_id, created_at)
      VALUES ('assignment', 'staff-a', 'year-a', 'Supervisor', '["GRADE_INPUT"]', 'class-a', now())`)
    const access = new AccessPolicies(staff, repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    expect(await repositories.staffPermissionAssignments.count()).toBe(0)
    await db.exec("DELETE FROM staff_assignments WHERE id = 'assignment'")
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
  })

  test('selected guardian profile never inherits the same person’s staff or teaching grants', async () => {
    await addGrant(Permission.GRADE_INPUT)
    await db.exec("UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a'")
    const access = new AccessPolicies(guardian, repositories)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(0)
  })

  test('updates check both old and proposed placement, including every student', async () => {
    await addGrant(Permission.GRADE_INPUT)
    const access = new AccessPolicies(staff, repositories)
    const old = (await repositories.assessmentResults.findById('3-other'))!
    const moved = new AssessmentResult({ ...old.data, assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', moved, old)).rejects.toThrow()
    const local = (await repositories.assessmentResults.findById('1-math'))!
    const foreignStudent = new AssessmentResult({ ...local.data, studentId: 'student-b' })
    await expect(access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', foreignStudent, local)).rejects.toThrow()
    const updated = new AssessmentResult({ ...local.data, score: 18 })
    const scope = await access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', updated, local)
    await repositories.assessmentResults.forAccess(scope).save(updated)
    expect((await repositories.assessmentResults.findById(local.id))?.score).toBe(18)
  })

  test('owners retain tenant boundaries and unknown job identities receive no authority', async () => {
    await db.exec("UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a'")
    const access = new AccessPolicies(staff, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(3)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
    const job = createSystemActorMetadata({ schoolId: 'school-a', systemId: 'unknown', requestId: 'job', reason: 'test' })
    expect((await new AccessPolicies(job, repositories).grades.readScope()).clauses).toEqual([])
  })
  test('S2S access classes use live facts, school boundaries and canonical actions', async () => {
    const client = new S2sClient({ id: 'client', schoolId: 'school-a', clientId: 'integration', accessClass: 'read', keyPrefix: 's2s', keyHash: 'hash', createdBySubjectId: 'operator' })
    await repositories.s2sClients.save(client)
    const actor = createS2sActorMetadata({ actorId: client.id, schoolId: client.schoolId, clientId: client.clientId, requestId: 'test' })
    expect('accessClass' in actor).toBe(false)
    const access = new AccessPolicies(actor, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(3)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    await repositories.s2sClients.save(new S2sClient({ ...client.data, accessClass: 'write' }))
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
    for (const action of [Permission.ACCESS_CONTROL_ASSIGN, Permission.SERVICE_ACCOUNT_CREATE, Permission.PLATFORM_USER_CREATE, Permission.S2S_CLIENT_CREATE]) {
      await expect(access.assertSchool(action)).rejects.toThrow()
    }
    await repositories.s2sClients.save(new S2sClient({ ...client.data, revokedAt: new Date() }))
    await expect(access.grades.readScope()).rejects.toThrow()
  })

  test('platform grants are live, profile-isolated and bounded when delegated', async () => {
    const user = new PlatformUser({ id: 'operator', subjectId: 'person-a', email: 'operator@example.com', isActive: true, createdBySubjectId: 'bootstrap',
      permissions: [Permission.PLATFORM_USER_READ, Permission.PLATFORM_USER_CREATE, Permission.S2S_CLIENT_CREATE],
    })
    await repositories.platformUsers.save(user)
    const actor = createPlatformActorMetadata({ actorId: user.id, subjectId: user.subjectId, email: user.email, authenticatedAt: new Date(), requestId: 'test' })
    expect('permissions' in actor).toBe(false)
    const policies = new PlatformPolicies(actor, repositories.platformUsers)
    await policies.readUsers()
    await expect(new PlatformPolicies(staff, repositories.platformUsers).readUsers()).rejects.toThrow()
    await db.exec("UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a'")
    await expect(new AccessPolicies(staff, repositories).assertSchool(Permission.PLATFORM_USER_READ)).rejects.toThrow()
    const atomic = new PostgresAtomicExecution(drizzle(db))
    await expect(createPlatformUser(repositories.platformUsers, actor, {
      subjectId: 'new-operator', email: 'new@example.com', permissions: [Permission.S2S_CLIENT_REVOKE],
    }, atomic)).rejects.toThrow()
    expect(await repositories.platformUsers.count()).toBe(1)
    await expect(createS2sClient(repositories, actor, { schoolId: 'missing-school', clientId: 'missing', accessClass: 'read' }, atomic)).rejects.toThrow()
    expect(await repositories.s2sClients.count()).toBe(0)
    const created = await createS2sClient(repositories, actor, { schoolId: 'school-a', clientId: 'valid', accessClass: 'read' }, atomic)
    expect(created.client.schoolId).toBe('school-a')
    await repositories.platformUsers.save(new PlatformUser({ ...user.data, permissions: [Permission.PLATFORM_USER_CREATE] }))
    await expect(policies.readUsers()).rejects.toThrow()
    await repositories.platformUsers.save(new PlatformUser({ ...user.data, isActive: false }))
    await expect(policies.createUser()).rejects.toThrow()
  })

})
