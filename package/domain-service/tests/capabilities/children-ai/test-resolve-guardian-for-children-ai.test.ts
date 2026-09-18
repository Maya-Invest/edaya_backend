import type { OnboardingSchoolApplication } from '../../../src/capabilities/onboarding/onboarding-application'
import { ClassGroup, GradeLevel, Guardian, GuardianStudentLink, Student, StudentClassEnrollment, StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { resolveGuardianForChildrenAi } from '../../../src/capabilities/children-ai/resolve-guardian-for-children-ai'
import { createInMemoryTestApp } from '../../support/create-test-app'

function asSchoolApp(mem: ReturnType<typeof createInMemoryTestApp>): OnboardingSchoolApplication {
  const fullRepositories = (mem.app as { baseService?: { repositories: OnboardingSchoolApplication['repositories'] } })
    .baseService
    ?.repositories
    ?? mem.repositories as unknown as OnboardingSchoolApplication['repositories']

  return {
    repositories: fullRepositories,
    forActor: mem.forActor,
  } as OnboardingSchoolApplication
}

async function seedLinkedChild(
  application: OnboardingSchoolApplication,
  args: {
    schoolId: string
    guardianId?: string
    subjectId?: string
    studentId: string
    firstName: string
    lastName: string
    classGroupId?: string
    className?: string
    gradeLevelId?: string
    gradeLabel?: string
  },
) {
  const guardianId = args.guardianId ?? 'gua-1'
  const subjectId = args.subjectId ?? 'sub-parent'
  const existingGuardian = await application.repositories.guardians.findById(guardianId)
  if (!existingGuardian) {
    await application.repositories.guardians.save(new Guardian({
      id: guardianId,
      schoolId: args.schoolId,
      firstName: 'Awa',
      lastName: 'Diallo',
      subjectId,
    }))
  }
  await application.repositories.students.save(new Student({
    id: args.studentId,
    schoolId: args.schoolId,
    firstName: args.firstName,
    lastName: args.lastName,
  }))
  await application.repositories.guardianLinks.save(new GuardianStudentLink({
    id: `link-${args.studentId}`,
    schoolId: args.schoolId,
    guardianId,
    studentId: args.studentId,
  }))
  if (!args.classGroupId || !args.className) {
    return
  }
  const gradeLevelId = args.gradeLevelId ?? `gl-${args.classGroupId}`
  const existingGrade = await application.repositories.gradeLevels.findById(gradeLevelId)
  if (!existingGrade) {
    await application.repositories.gradeLevels.save(new GradeLevel({
      id: gradeLevelId,
      schoolId: args.schoolId,
      name: args.gradeLabel ?? 'Sixième',
      label: args.gradeLabel ?? '6ème',
      order: 6,
    }))
  }
  const existingClass = await application.repositories.classGroups.findById(args.classGroupId)
  if (!existingClass) {
    await application.repositories.classGroups.save(new ClassGroup({
      id: args.classGroupId,
      schoolId: args.schoolId,
      academicYearId: 'year-1',
      gradeLevelId,
      name: args.className,
    }))
  }
  await application.repositories.enrollments.save(new StudentClassEnrollment({
    id: `enr-${args.studentId}`,
    studentId: args.studentId,
    classGroupId: args.classGroupId,
    academicYearId: 'year-1',
    enrollmentIndex: 1,
    status: StudentClassEnrollmentStatus.Active,
  }))
}

describe('resolveGuardianForChildrenAi', () => {
  it('returns linked students for a guardian subject', async () => {
    const application = asSchoolApp(createInMemoryTestApp())
    const schoolId = 'sch-live'
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-1',
      firstName: 'Kofi',
      lastName: 'Mensah',
    })
    await application.repositories.students.save(new Student({
      id: 'stu-other',
      schoolId,
      firstName: 'Other',
      lastName: 'Child',
    }))

    const listing = await resolveGuardianForChildrenAi(application.repositories, 'sub-parent')
    expect(listing.schoolId).toBe(schoolId)
    expect(listing.displayName).toBe('Awa Diallo')
    expect(listing.children.map(child => child.studentId)).toEqual(['stu-live-1'])
    expect(listing.children[0]).toMatchObject({
      firstName: 'Kofi',
      lastName: 'Mensah',
    })
  })

  it('attaches the active class label and grade of each linked student', async () => {
    const application = asSchoolApp(createInMemoryTestApp())
    const schoolId = 'sch-live'
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-1',
      firstName: 'Kofi',
      lastName: 'Mensah',
      classGroupId: 'cls-6a',
      className: '6ème 1',
      gradeLevelId: 'gl-6',
      gradeLabel: '6ème',
    })
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-2',
      firstName: 'Amina',
      lastName: 'Diallo',
      classGroupId: 'cls-5b',
      className: '5ème 2',
      gradeLevelId: 'gl-5',
      gradeLabel: '5ème',
    })

    const listing = await resolveGuardianForChildrenAi(application.repositories, 'sub-parent')
    expect(listing.children).toEqual([
      {
        studentId: 'stu-live-1',
        schoolId,
        firstName: 'Kofi',
        lastName: 'Mensah',
        classLabel: '6ème 1',
        grade: '6e',
      },
      {
        studentId: 'stu-live-2',
        schoolId,
        firstName: 'Amina',
        lastName: 'Diallo',
        classLabel: '5ème 2',
        grade: '5e',
      },
    ])
  })

  it('ignores closed enrollments when resolving class labels', async () => {
    const application = asSchoolApp(createInMemoryTestApp())
    const schoolId = 'sch-live'
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-1',
      firstName: 'Kofi',
      lastName: 'Mensah',
    })
    await application.repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId,
      name: 'Sixième',
      label: '6ème',
      order: 6,
    }))
    await application.repositories.classGroups.save(new ClassGroup({
      id: 'cls-old',
      schoolId,
      academicYearId: 'year-0',
      gradeLevelId: 'gl-6',
      name: '6ème 9',
    }))
    await application.repositories.enrollments.save(new StudentClassEnrollment({
      id: 'enr-closed',
      studentId: 'stu-live-1',
      classGroupId: 'cls-old',
      academicYearId: 'year-0',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: new Date('2024-09-01'),
      endedAt: new Date('2025-06-30'),
      endReason: 'completed',
      closedBy: 'staff-1',
    }))

    const listing = await resolveGuardianForChildrenAi(application.repositories, 'sub-parent')
    expect(listing.children[0]).toEqual({
      studentId: 'stu-live-1',
      schoolId,
      firstName: 'Kofi',
      lastName: 'Mensah',
    })
  })

  it('loads several linked students in one findByIds call', async () => {
    const application = asSchoolApp(createInMemoryTestApp())
    const schoolId = 'sch-live'
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-1',
      firstName: 'Kofi',
      lastName: 'Mensah',
    })
    await seedLinkedChild(application, {
      schoolId,
      studentId: 'stu-live-2',
      firstName: 'Amina',
      lastName: 'Diallo',
    })

    const students = application.repositories.students
    const originalFindById = students.findById.bind(students)
    let findByIdCalls = 0
    students.findById = async (id: string) => {
      findByIdCalls += 1
      return originalFindById(id)
    }

    const listing = await resolveGuardianForChildrenAi(application.repositories, 'sub-parent')
    expect(findByIdCalls).toBe(0)
    expect(listing.children.map(child => child.studentId)).toEqual(['stu-live-1', 'stu-live-2'])
  })

  it('returns an empty listing when the subject is not a guardian', async () => {
    const application = asSchoolApp(createInMemoryTestApp())
    const listing = await resolveGuardianForChildrenAi(application.repositories, 'nobody')
    expect(listing).toEqual({
      schoolId: '',
      displayName: '',
      children: [],
    })
  })
})
