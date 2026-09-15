import type {
  FixtureDataset,
  FixtureDatasetEntities,
  FixtureDatasetExtensions,
} from '../types'

function mergeArrayField<T>(
  existing: readonly T[] | undefined,
  incoming: readonly T[] | undefined,
): readonly T[] | undefined {
  if (!incoming) {
    return existing
  }
  if (!existing) {
    return incoming
  }
  return [...existing, ...incoming]
}

function mergeEntities(
  base: FixtureDatasetEntities,
  layer: FixtureDatasetEntities,
): FixtureDatasetEntities {
  return {
    ...base,
    ...layer,
    guardians: mergeArrayField(base.guardians, layer.guardians),
    students: mergeArrayField(base.students, layer.students),
    enrollments: mergeArrayField(base.enrollments, layer.enrollments),
    guardianLinks: mergeArrayField(base.guardianLinks, layer.guardianLinks),
    classGroups: mergeArrayField(base.classGroups, layer.classGroups),
    staffMembers: mergeArrayField(base.staffMembers, layer.staffMembers),
    academicPeriods: mergeArrayField(base.academicPeriods, layer.academicPeriods),
    gradeLevels: mergeArrayField(base.gradeLevels, layer.gradeLevels),
    periodDefinitions: mergeArrayField(base.periodDefinitions, layer.periodDefinitions),
    subjects: mergeArrayField(base.subjects, layer.subjects),
    subjectMatters: mergeArrayField(base.subjectMatters, layer.subjectMatters),
    classSubjects: mergeArrayField(base.classSubjects, layer.classSubjects),
    resources: mergeArrayField(base.resources, layer.resources),
    schedules: mergeArrayField(base.schedules, layer.schedules),
    inClassAssessments: mergeArrayField(base.inClassAssessments, layer.inClassAssessments),
    homeworkAssessments: mergeArrayField(base.homeworkAssessments, layer.homeworkAssessments),
    homeworkSubmissions: mergeArrayField(base.homeworkSubmissions, layer.homeworkSubmissions),
    attendanceRecords: mergeArrayField(base.attendanceRecords, layer.attendanceRecords),
    activities: mergeArrayField(base.activities, layer.activities),
    activityEnrollments: mergeArrayField(base.activityEnrollments, layer.activityEnrollments),
    catalogServices: mergeArrayField(base.catalogServices, layer.catalogServices),
    studentServiceEnrollments: mergeArrayField(base.studentServiceEnrollments, layer.studentServiceEnrollments),
    payments: mergeArrayField(base.payments, layer.payments),
    announcements: mergeArrayField(base.announcements, layer.announcements),
    announcementTargets: mergeArrayField(base.announcementTargets, layer.announcementTargets),
    messageDeliveries: mergeArrayField(base.messageDeliveries, layer.messageDeliveries),
    incidents: mergeArrayField(base.incidents, layer.incidents),
    disciplinaryActions: mergeArrayField(base.disciplinaryActions, layer.disciplinaryActions),
    studentDisciplinaryActions: mergeArrayField(base.studentDisciplinaryActions, layer.studentDisciplinaryActions),
    gradeScales: mergeArrayField(base.gradeScales, layer.gradeScales),
    school: layer.school ?? base.school,
    academicYear: layer.academicYear ?? base.academicYear,
  }
}

function mergeExtensions(
  base: FixtureDatasetExtensions | undefined,
  layer: FixtureDatasetExtensions | undefined,
): FixtureDatasetExtensions | undefined {
  if (!layer) {
    return base
  }
  if (!base) {
    return { ...layer }
  }

  return {
    ...base,
    ...layer,
    assessmentResultScores: {
      ...base.assessmentResultScores,
      ...layer.assessmentResultScores,
    },
  }
}

export function mergeDemoWithGeneratedPopulation(
  demo: FixtureDataset<'demo'>,
  populationLayer: FixtureDataset<'bulk'>,
): FixtureDataset<'bulk'> {
  return {
    purpose: 'bulk',
    schoolId: demo.schoolId,
    entities: mergeEntities(demo.entities, populationLayer.entities),
    extensions: mergeExtensions(demo.extensions, populationLayer.extensions),
  }
}
