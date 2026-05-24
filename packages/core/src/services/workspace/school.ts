import type { SchoolRepository } from '$lib/core/ports/school-repository'
import { School } from '$lib/core/entities/school/school'

export interface SchoolServiceArgs {
  schoolRepository: SchoolRepository
}

export class SchoolService {
  constructor(args: SchoolServiceArgs) {
    this.schools = args.schoolRepository
  }

  private readonly schools: SchoolRepository

  async registerSchool({
    id,
    name,
    country,
    city,
    createdAt,
  }: {
    id: string
    name: string
    country?: string
    city?: string
    createdAt?: Date
  }): Promise<School> {
    const school = new School({ id, name, country, city, createdAt })
    await this.schools.save(school)
    return school
  }
}
