import type { ClassSubjectMatter } from '../entities/academics/class-subject-matter'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectMatterRepository extends BaseRepositoryInterface<ClassSubjectMatter> {
  findByClassSubjectAndSubjectMatter: (
    classSubjectId: string,
    subjectMatterId: string,
  ) => Promise<ClassSubjectMatter | undefined>
  listByClassSubject: (classSubjectId: string) => Promise<ClassSubjectMatter[]>
}
