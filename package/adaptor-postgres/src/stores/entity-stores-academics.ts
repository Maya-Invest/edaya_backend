import type {
  AcademicPeriod,
  AcademicYear,
  Activity,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  SubjectMatter,
} from '@edaya/core'
import type { StoreDatabase } from '../postgres-store'
import type { EntityStores } from './entity-stores-types'
import {
  AcademicPeriod as AcademicPeriodCtor,
  AcademicYear as AcademicYearCtor,
  Activity as ActivityCtor,
  ActivityEnrollment as ActivityEnrollmentCtor,
  ClassActivityEnrollment as ClassActivityEnrollmentCtor,
  ClassGroup as ClassGroupCtor,
  ClassSubject as ClassSubjectCtor,
  ClassSubjectMatter as ClassSubjectMatterCtor,
  ClassSubjectMatterStatus,
  ClassSubjectProgress as ClassSubjectProgressCtor,
  GradeLevel as GradeLevelCtor,
  PeriodDefinition as PeriodDefinitionCtor,
  SubjectCategoryEntity as SubjectCategoryCtor,
  Subject as SubjectCtor,
  SubjectMatter as SubjectMatterCtor,
} from '@edaya/core'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import {
  enumValue,
} from './entity-store-helpers'

export function createAcademicsEntityStores(db: StoreDatabase): Pick<EntityStores, 'academicYears' | 'academicPeriods' | 'periodDefinitions' | 'gradeLevels' | 'subjects' | 'subjectCategories' | 'subjectMatters' | 'classGroups' | 'classSubjects' | 'classSubjectMatters' | 'classSubjectProgress' | 'activities' | 'activityEnrollments' | 'classActivityEnrollments'> {
  return {
    academicYears: customStore(
      db,
      schema.academicYears,
      (entity: AcademicYear) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        startDate: entity.startDate,
        endDate: entity.endDate,
        status: entity.status,
        createdAt: entity.createdAt,
      }),
      row => new AcademicYearCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        createdAt: row.createdAt,
      }),
    ),

    academicPeriods: customStore(
      db,
      schema.academicPeriods,
      (entity: AcademicPeriod) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        name: entity.name,
        type: entity.type ?? null,
        startDate: entity.startDate,
        endDate: entity.endDate,
        isPublished: entity.isPublished,
        createdAt: entity.createdAt,
      }),
      row => new AcademicPeriodCtor({
        id: row.id,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        name: row.name,
        type: row.type ?? undefined,
        startDate: row.startDate,
        endDate: row.endDate,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
      }),
    ),

    periodDefinitions: defaultStore(db, schema.periodDefinitions, PeriodDefinitionCtor),

    gradeLevels: defaultStore(db, schema.gradeLevels, GradeLevelCtor),

    subjects: defaultStore(db, schema.subjects, SubjectCtor),

    subjectCategories: defaultStore(db, schema.subjectCategories, SubjectCategoryCtor),

    subjectMatters: customStore(
      db,
      schema.subjectMatters,
      (entity: SubjectMatter) => ({
        id: entity.id,
        subjectId: entity.subjectId,
        name: entity.name,
        description: entity.description ?? null,
        sequenceOrder: entity.sequenceOrder,
        estimatedHours: entity.estimatedHours ?? null,
        createdAt: entity.createdAt,
      }),
      row => new SubjectMatterCtor({
        id: row.id,
        subjectId: row.subjectId,
        name: row.name,
        description: row.description,
        sequenceOrder: row.sequenceOrder,
        estimatedHours: row.estimatedHours,
        createdAt: row.createdAt,
      }),
    ),

    classGroups: defaultStore(db, schema.classGroups, ClassGroupCtor),

    classSubjects: customStore(
      db,
      schema.classSubjects,
      (entity: ClassSubject) => ({
        id: entity.id,
        classGroupId: entity.classGroupId,
        subjectId: entity.subjectId,
        coefficient: entity.coefficient ?? null,
        periodsPerWeek: entity.periodsPerWeek ?? null,
        minPeriodSpan: entity.minPeriodSpan ?? null,
        maxPeriodSpan: entity.maxPeriodSpan ?? null,
        completedPercentage: entity.completedPercentage,
        participationRevision: entity.participationRevision,
        isOffered: entity.isOffered,
        createdAt: entity.createdAt,
      }),
      row => new ClassSubjectCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        subjectId: row.subjectId,
        coefficient: row.coefficient,
        periodsPerWeek: row.periodsPerWeek,
        minPeriodSpan: row.minPeriodSpan,
        maxPeriodSpan: row.maxPeriodSpan,
        completedPercentage: row.completedPercentage,
        participationRevision: row.participationRevision,
        isOffered: row.isOffered,
        createdAt: row.createdAt,
      }),
    ),

    classSubjectMatters: customStore(
      db,
      schema.classSubjectMatters,
      (entity: ClassSubjectMatter) => ({
        id: entity.id,
        classSubjectId: entity.classSubjectId,
        subjectMatterId: entity.subjectMatterId,
        status: entity.status,
        completedPercentage: entity.completedPercentage,
        updatedByStaffId: entity.updatedByStaffId ?? null,
        startedAt: entity.startedAt ?? null,
        completedAt: entity.completedAt ?? null,
        notes: entity.notes ?? null,
        updatedAt: entity.updatedAt,
      }),
      row => new ClassSubjectMatterCtor({
        id: row.id,
        classSubjectId: row.classSubjectId,
        subjectMatterId: row.subjectMatterId,
        status: enumValue(ClassSubjectMatterStatus, row.status, 'classSubjectMatters.status'),
        completedPercentage: row.completedPercentage,
        updatedByStaffId: row.updatedByStaffId,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        notes: row.notes,
        updatedAt: row.updatedAt,
      }),
    ),

    classSubjectProgress: customStore(
      db,
      schema.classSubjectProgress,
      (entity: ClassSubjectProgress) => ({
        id: entity.id,
        classSubjectMatterId: entity.classSubjectMatterId,
        lessonSessionId: entity.lessonSessionId,
        completedPercentage: entity.completedPercentage,
        recordedByStaffId: entity.recordedByStaffId ?? null,
        notes: entity.notes ?? null,
        recordedAt: entity.recordedAt,
      }),
      row => new ClassSubjectProgressCtor({
        id: row.id,
        classSubjectMatterId: row.classSubjectMatterId,
        lessonSessionId: row.lessonSessionId,
        completedPercentage: row.completedPercentage,
        recordedByStaffId: row.recordedByStaffId,
        notes: row.notes,
        recordedAt: row.recordedAt,
      }),
    ),

    activities: customStore(
      db,
      schema.activities,
      (entity: Activity) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        category: entity.category,
        coach: entity.coach,
        schedule: entity.schedule,
        participants: entity.participants,
        capacity: entity.capacity,
        description: entity.description,
        startDate: entity.startDate,
        endDate: entity.endDate,
        createdAt: entity.createdAt,
      }),
      row => new ActivityCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        category: row.category as Activity['category'],
        coach: row.coach,
        schedule: row.schedule,
        participants: row.participants,
        capacity: row.capacity,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        createdAt: row.createdAt,
      }),
    ),

    activityEnrollments: defaultStore(db, schema.activityEnrollments, ActivityEnrollmentCtor),

    classActivityEnrollments: defaultStore(db, schema.classActivityEnrollments, ClassActivityEnrollmentCtor),
  }
}
