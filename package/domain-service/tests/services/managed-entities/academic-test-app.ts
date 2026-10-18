import { AcademicPeriod, AcademicPeriodType, AcademicYear, ClassGroup, ClassSubject, GradeLevel, GradeScale, ReportCardDefinition, Subject } from '@edaya/core'
import { createTestApp } from '../../support/create-test-app'
import { actor } from './managed-entity-test-context'

/** Complete academic parents for tests of command invariants after tenant checks. */
export async function createAcademicTestApp() {
  const fixture = await createTestApp(actor, { owner: true })
  const r = fixture.schoolRepositories
  await r.academicYears.save(new AcademicYear({ id: 'year-1', schoolId: 'school', name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await r.gradeLevels.save(new GradeLevel({ id: 'grade-1', schoolId: 'school', name: 'Grade 1', label: 'G1', order: 1 }))
  await r.subjects.save(new Subject({ gradeLevelId: 'grade-1', academicYearId: 'year-1', id: 'subject-1', schoolId: 'school', name: 'Math' }))
  await r.gradeScales.save(new GradeScale({ id: 'gs-test', schoolId: 'school', name: '20 points', minScore: 0, maxScore: 20, ranges: [{ letter: 'A', minScore: 0, maxScore: 20 }] }))
  await r.classGroups.save(new ClassGroup({ id: 'class-1', schoolId: 'school', gradeLevelId: 'grade-1', academicYearId: 'year-1', name: 'Class 1' }))
  await r.classSubjects.save(new ClassSubject({ id: 'class-subject-1', classGroupId: 'class-1', subjectId: 'subject-1' }))
  await r.academicPeriods.save(new AcademicPeriod({ id: 'period-1', schoolId: 'school', academicYearId: 'year-1', name: 'Term 1', type: AcademicPeriodType.Trimester, startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), isPublished: true }))
  await r.definitions.save(new ReportCardDefinition({ id: 'definition-1', schoolId: 'school', academicYearId: 'year-1', gradeLevelId: 'grade-1', gradeScaleId: 'gs-test', name: 'Report' }))
  return fixture
}
