import type { SubjectMatter } from '../entities/academics/subject-matter'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SubjectMatterRepository extends BaseRepositoryInterface<SubjectMatter> {
  listBySubject: (subjectId: string) => Promise<SubjectMatter[]>
}
