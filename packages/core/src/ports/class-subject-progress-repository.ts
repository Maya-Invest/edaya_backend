import type { ClassSubjectProgress } from '$lib/core/entities/academics/class-subject-progress'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectProgressRepository extends BaseRepositoryInterface<ClassSubjectProgress> {
  findByClassSubjectMatterAndSession: (
    classSubjectMatterId: string,
    sessionId: string,
  ) => Promise<ClassSubjectProgress | undefined>
  listByClassSubjectMatter: (classSubjectMatterId: string) => Promise<ClassSubjectProgress[]>
  listBySession: (sessionId: string) => Promise<ClassSubjectProgress[]>
}
