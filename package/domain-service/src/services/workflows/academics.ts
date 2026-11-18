import type { ClassSubjectMatter, Subject, SubjectCategoryEntity, SubjectCategoryInput, SubjectInput, SubjectMatter, SubjectMatterInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { AcademicsWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import type { SyncClassSubjectOptions } from './subject-sync'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, ClassSubject, ClassSubjectProgress, SubjectCategoryEntity as SubjectCategoryRecord, Subject as SubjectEntity, SubjectMatter as SubjectMatterEntity, withShortName } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { assertTeacherWorkflowWrite } from '../../capabilities/academics/teacher-workflow-boundaries'
import { assertParticipationRevision, saveSubjectPolicy } from '../../capabilities/subject-enrollment/policy'

import { assertClassSubjectGradingMutable } from '../entities/config/academics/class-subject'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import * as intake from './intake'
import { removeMirroredClassSubjects, syncSubjectMatterToClassSubject, syncSubjectsToClassGroup, syncSubjectToAllClassGroups } from './subject-sync'

export interface RecordLessonSessionProgressInput {
  id: string
  classSubjectMatterId: string
  lessonSessionId: string
  completed: boolean
  notes?: string
  recordedAt?: Date
}

export interface RemoveSubjectMatterInput { subjectMatterId: string }
export interface RemoveSubjectInput { subjectId: string }
export type UpdateSubjectInput = Partial<Omit<SubjectInput, 'id' | 'schoolId' | 'gradeLevelId' | 'academicYearId' | 'createdAt'>> & { subjectId: string, expectedReportConfigurationRevision?: number, expectedParticipationRevisions?: Record<string, number> }

export interface SetClassSubjectOfferedInput {
  classSubjectId: string
  isOffered: boolean
  expectedParticipationRevision: number
}

export interface ConfigureClassSubjectTimetableInput {
  classSubjectId: string
  periodsPerWeek?: number | null
  minPeriodSpan?: number | null
  maxPeriodSpan?: number | null
}

export type ConfigureSubjectInput = SubjectInput & {
  classSubjectIdsByClassGroupId?: Record<string, string>
  expectedReportConfigurationRevision?: number
  expectedParticipationRevisions?: Record<string, number>
}
export type ConfigureSubjectCategoryInput = Omit<SubjectCategoryInput, 'schoolId'> & { schoolId?: string }
export type ConfigureSubjectMatterInput = SubjectMatterInput

export class AcademicsServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AcademicsWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('academics', base.repositories)
  }

  configureAcademicDiscipline(input: Parameters<typeof intake.configureAcademicDiscipline>[1]) { return intake.configureAcademicDiscipline(this.baseService, input) }
  configurePlacementStatus(input: Parameters<typeof intake.configurePlacementStatus>[1]) { return intake.configurePlacementStatus(this.baseService, input) }
  upsertStudentAcademicYearProfile(input: Parameters<typeof intake.upsertStudentAcademicYearProfile>[1]) { return intake.upsertStudentAcademicYearProfile(this.baseService, input) }
  upsertTeacherAcademicYearProfile(input: Parameters<typeof intake.upsertTeacherAcademicYearProfile>[1]) { return intake.upsertTeacherAcademicYearProfile(this.baseService, input) }
  removeStudentAcademicYearProfile(input: Parameters<typeof intake.removeStudentAcademicYearProfile>[1]) { return intake.removeStudentAcademicYearProfile(this.baseService, input) }
  removeTeacherAcademicYearProfile(input: Parameters<typeof intake.removeTeacherAcademicYearProfile>[1]) { return intake.removeTeacherAcademicYearProfile(this.baseService, input) }

  private async assertReportRevision(gradeLevelId: string, academicYearId: string, expected: number | undefined, required: boolean) {
    if (expected === undefined && !required)
      return
    const level = await this.baseService.repositories.gradeLevels.findById(gradeLevelId)
    if (!level || expected !== level.reportSettingsFor(academicYearId).revision)
      throw new BusinessRuleViolationError('REPORT_CONFIGURATION_REVISION_CONFLICT', 'Reload subjects and modules before saving')
  }

  async configureSubject(input: ConfigureSubjectInput): Promise<Subject> {
    return this.baseService.atomicExecution.execute(async () => {
      const { classSubjectIdsByClassGroupId, expectedReportConfigurationRevision, ...data } = input
      const schoolId = data.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const existing = await this.repositories.subjects.findById(data.id)
      if (existing) {
        if (existing.schoolId !== schoolId || existing.gradeLevelId !== data.gradeLevelId || existing.academicYearId !== data.academicYearId)
          throw new BusinessRuleViolationError('SUBJECT_PLACEMENT_IMMUTABLE', 'A subject cannot move between schools, grades or academic years')
        return this.updateSubject({ ...data, subjectId: data.id, expectedReportConfigurationRevision })
      }
      await this.assertReportRevision(data.gradeLevelId, data.academicYearId, expectedReportConfigurationRevision, !!data.reportModuleId)
      const subject = new SubjectEntity(withShortName({ ...data, schoolId }))
      await this.baseService.entities.subjects.save(subject)
      await syncSubjectToAllClassGroups(this.baseService, subject, Object.fromEntries(
        Object.entries(classSubjectIdsByClassGroupId ?? {}).map(([id, classSubjectId]) => [id, { classSubjectId }]),
      ))
      return subject
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async configureSubjectCategory(input: ConfigureSubjectCategoryInput): Promise<SubjectCategoryEntity> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const category = new SubjectCategoryRecord(await this.namedInput('subjectCategories', { ...input, schoolId }))
      await this.baseService.entities.subjectCategories.save(category)
      return category
    })
  }

  async configureSubjectMatter(input: SubjectMatterInput): Promise<SubjectMatter> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.repositories.subjectMatters.findById(input.id)
      const chapter = new SubjectMatterEntity(await this.namedInput('subjectMatters', { ...input, progressWeight: input.progressWeight ?? existing?.progressWeight ?? 1 }))
      await this.baseService.entities.subjectMatters.save(chapter)
      for (const offering of await this.repositories.classSubjects.list({ subjectId: chapter.subjectId }))
        await syncSubjectMatterToClassSubject(this.baseService, offering, chapter)
      return chapter
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async removeSubjectMatter({ subjectMatterId }: RemoveSubjectMatterInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.entities.subjectMatters.delete(subjectMatterId)
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async removeSubject({ subjectId }: RemoveSubjectInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const subject = await this.requireSubject(subjectId)
      await this.baseService.access.entity('subjects').assertDelete([subject.id])
      await removeMirroredClassSubjects(this.baseService, subjectId)
      for (const chapter of await this.repositories.subjectMatters.list({ subjectId }))
        await this.baseService.entities.subjectMatters.delete(chapter.id)
      await this.baseService.entities.subjects.delete(subjectId)
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async updateSubject({ subjectId, expectedParticipationRevisions, expectedReportConfigurationRevision, ...changes }: UpdateSubjectInput): Promise<Subject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireSubject(subjectId)
      const updated = existing.copyWith(changes)
      await this.assertReportRevision(existing.gradeLevelId, existing.academicYearId, expectedReportConfigurationRevision, updated.reportModuleId !== existing.reportModuleId || updated.reportOrder !== existing.reportOrder)
      if (existing.isOptional !== updated.isOptional)
        await saveSubjectPolicy(this.baseService, updated, existing, expectedParticipationRevisions)
      else
        await this.baseService.entities.subjects.save(updated)
      for (const offering of await this.repositories.classSubjects.list({ subjectId })) {
        const workload = Object.fromEntries(['coefficient', 'periodsPerWeek', 'minPeriodSpan', 'maxPeriodSpan']
          .filter(key => key in changes).map(key => [key, updated.data[key as keyof typeof updated.data]]))
        const next = new ClassSubject({ ...offering.data, ...workload, isOffered: offering.isOffered })
        if (next.minPeriodSpan !== undefined && next.maxPeriodSpan !== undefined && next.maxPeriodSpan < next.minPeriodSpan)
          throw new BusinessRuleViolationError('CLASS_SUBJECT_PERIOD_SPAN_INVALID', 'maxPeriodSpan must be greater than or equal to minPeriodSpan')
        const scope = await this.baseService.access.curriculum.assertUpdateSubject(next, offering)
        await assertClassSubjectGradingMutable(next, offering, this.repositories)
        await this.repositories.classSubjects.forAccess(scope).save(next)
      }
      await syncSubjectToAllClassGroups(this.baseService, updated)
      return updated
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async setClassSubjectOffered({ classSubjectId, isOffered, expectedParticipationRevision }: SetClassSubjectOfferedInput): Promise<ClassSubject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireClassSubject(classSubjectId)
      const updated = new ClassSubject({
        ...existing.data,
        id: existing.id,
        classGroupId: existing.classGroupId,
        subjectId: existing.subjectId,
        coefficient: existing.coefficient,
        periodsPerWeek: existing.periodsPerWeek,
        minPeriodSpan: existing.minPeriodSpan,
        maxPeriodSpan: existing.maxPeriodSpan,
        completedPercentage: existing.completedPercentage,
        isOffered,
        createdAt: existing.createdAt,
      })
      await this.baseService.access.curriculum.assertUpdateSubject(updated, existing)
      assertParticipationRevision(existing, expectedParticipationRevision)
      await this.baseService.entities.classSubjects.save(updated)
      return (await this.repositories.classSubjects.findById(updated.id))!
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async configureClassSubjectTimetable({
    classSubjectId,
    periodsPerWeek,
    minPeriodSpan,
    maxPeriodSpan,
  }: ConfigureClassSubjectTimetableInput): Promise<ClassSubject> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireClassSubject(classSubjectId)
      const nextMinPeriodSpan = minPeriodSpan === undefined
        ? existing.minPeriodSpan
        : (minPeriodSpan ?? undefined)
      const nextMaxPeriodSpan = maxPeriodSpan === undefined
        ? existing.maxPeriodSpan
        : (maxPeriodSpan ?? undefined)
      if (nextMinPeriodSpan !== undefined
        && nextMaxPeriodSpan !== undefined
        && nextMaxPeriodSpan < nextMinPeriodSpan) {
        throw new BusinessRuleViolationError(
          'CLASS_SUBJECT_PERIOD_SPAN_INVALID',
          'maxPeriodSpan must be greater than or equal to minPeriodSpan',
        )
      }
      const updated = new ClassSubject({
        ...existing.data,
        id: existing.id,
        classGroupId: existing.classGroupId,
        subjectId: existing.subjectId,
        coefficient: existing.coefficient,
        periodsPerWeek: periodsPerWeek === undefined
          ? existing.periodsPerWeek
          : (periodsPerWeek ?? undefined),
        minPeriodSpan: nextMinPeriodSpan,
        maxPeriodSpan: nextMaxPeriodSpan,
        completedPercentage: existing.completedPercentage,
        isOffered: existing.isOffered,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.classSubjects.save(updated)
      return updated
    })
  }

  async syncSubjectsToClassGroup(classGroupId: string, optionsBySubjectId: Record<string, SyncClassSubjectOptions> = {}) {
    return this.baseService.atomicExecution.execute(async () => {
      const scope = await this.baseService.access.curriculum.assertSyncClass(classGroupId)
      const classGroup = await this.repositories.classGroups.forAccess(scope).findById(classGroupId)
      if (!classGroup)
        denyResourceAccess()
      return syncSubjectsToClassGroup(this.baseService, classGroup, optionsBySubjectId)
    })
  }

  async recordLessonSessionProgress({
    id,
    classSubjectMatterId,
    lessonSessionId,
    completed,
    notes,
    recordedAt,
  }: RecordLessonSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.baseService.atomicExecution.execute(async () => {
      await assertTeacherWorkflowWrite(this.baseService.actor, 'classSubjectProgress', { lessonSessionId }, undefined, this.baseService.repositories)
      const matter = await this.requireClassSubjectMatter(classSubjectMatterId)
      const classSubject = await this.requireClassSubject(matter.classSubjectId)
      const lessonSession = await this.repositories.lessonSessions.findById(lessonSessionId)
      if (!lessonSession) {
        denyResourceAccess()
      }
      if (lessonSession.schoolId !== this.baseService.actor.schoolId) {
        denyResourceAccess()
      }
      if (lessonSession.classSubjectId !== classSubject.id) {
        denyResourceAccess()
      }

      await this.baseService.access.logbook.assertRecordSession(lessonSessionId)

      const existing = await this.repositories.classSubjectProgress.findOne({ classSubjectMatterId, lessonSessionId })
      if (existing || await this.repositories.classSubjectProgress.findById(id)) {
        throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', `Progress has already been recorded for matter ${classSubjectMatterId} and lesson session ${lessonSessionId}`)
      }
      const snapshot = new ClassSubjectProgress({
        id,
        classSubjectMatterId,
        lessonSessionId,
        completed,
        recordedByStaffId: resolveAuditActorId(this.baseService.actor),
        notes,
        recordedAt,
      })
      const state = await this.baseService.repositories.teacherCorrections.state(this.baseService.actor.schoolId, 'logbook', lessonSessionId)
      if (state?.locked)
        throw new BusinessRuleViolationError('CORRECTION_REQUIRED', 'Request a correction to change a validated logbook')
      const scopes = await this.baseService.access.logbook.assertProgress({ snapshot, previousMatter: matter, matter, previousSubject: classSubject, subject: classSubject })
      await this.repositories.classSubjectProgress.forAccess(scopes.snapshot).save(snapshot)
      const version = (state?.version ?? 0) + 1
      const actorId = resolveAuditActorId(this.baseService.actor)
      await this.baseService.repositories.teacherCorrections.saveState({
        schoolId: this.baseService.actor.schoolId,
        workflow: 'logbook',
        targetId: lessonSessionId,
        version,
        locked: false,
        payload: { chapterId: matter.id },
        history: [...state?.history ?? [], { at: new Date().toISOString(), subjectId: actorId ?? this.baseService.actor.schoolId, action: 'chapter_recorded', payload: { chapterId: matter.id, completed } }],
      })
      return snapshot
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  private async requireSubject(subjectId: string): Promise<Subject> {
    const subject = await this.repositories.subjects.findById(subjectId)
    if (!subject || subject.schoolId !== this.baseService.actor.schoolId)
      denyResourceAccess()
    return subject
  }

  private async requireClassSubjectMatter(classSubjectMatterId: string): Promise<ClassSubjectMatter> {
    const matter = await this.repositories.classSubjectMatters.findById(classSubjectMatterId)
    if (!matter) {
      denyResourceAccess()
    }
    const classSubject = await this.repositories.classSubjects.findById(matter.classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return matter
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return classSubject
  }
}
