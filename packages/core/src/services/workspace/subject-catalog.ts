import type { School } from '$lib/core/entities/core/school'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { Subject } from '$lib/core/entities/academics/subject'

export interface SubjectCatalogServiceArgs {
  schoolRepository: SchoolRepository
  subjectRepository: SubjectRepository
}

export class SubjectCatalogService {
  constructor(args: SubjectCatalogServiceArgs) {
    this.schools = args.schoolRepository
    this.subjects = args.subjectRepository
  }

  private readonly schools: SchoolRepository
  private readonly subjects: SubjectRepository

  async createSubject({
    id,
    schoolId,
    name,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    createdAt?: Date
  }): Promise<Subject> {
    await this.requireSchool(schoolId)
    const subject = new Subject({ id, schoolId, name, createdAt })
    await this.subjects.save(subject)
    return subject
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }
}
