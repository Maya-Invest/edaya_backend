import type { School } from '../../entities/school/school'
import type { StaffRole } from '../../entities/school/staff-member'
import type { SchoolRepository } from '../../ports/school-repository'
import type { StaffMemberRepository } from '../../ports/staff-member-repository'
import { StaffMember } from '../../entities/school/staff-member'

export interface StaffServiceArgs {
  schoolRepository: SchoolRepository
  staffMemberRepository: StaffMemberRepository
}

export class StaffService {
  constructor(args: StaffServiceArgs) {
    this.schools = args.schoolRepository
    this.staffMembers = args.staffMemberRepository
  }

  private readonly schools: SchoolRepository
  private readonly staffMembers: StaffMemberRepository

  async registerStaffMember({
    id,
    schoolId,
    firstName,
    lastName,
    roles,
    email,
    isActive = true,
    createdAt,
  }: {
    id: string
    schoolId: string
    firstName: string
    lastName: string
    roles: readonly StaffRole[]
    email?: string
    isActive?: boolean
    createdAt?: Date
  }): Promise<StaffMember> {
    await this.requireSchool(schoolId)
    return this.saveStaffMember({
      id,
      schoolId,
      firstName,
      lastName,
      roles,
      email,
      isActive,
      createdAt,
    })
  }

  private async saveStaffMember({
    id,
    schoolId,
    firstName,
    lastName,
    roles,
    email,
    isActive = true,
    createdAt,
  }: {
    id: string
    schoolId: string
    firstName: string
    lastName: string
    roles: readonly StaffRole[]
    email?: string
    isActive?: boolean
    createdAt?: Date
  }): Promise<StaffMember> {
    const existing = await this.staffMembers.findById(id)
    const mergedRoles = [...new Set([...(existing?.roles ?? []), ...roles])]
    const staffMember = new StaffMember({
      id,
      schoolId,
      firstName,
      lastName,
      roles: mergedRoles,
      email: email ?? existing?.email,
      isActive,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.staffMembers.save(staffMember)
    return staffMember
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }
}
