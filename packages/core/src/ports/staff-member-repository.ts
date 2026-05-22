import type { StaffMember } from '$lib/core/entities/staff-member'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StaffMemberRepository extends BaseRepositoryInterface<StaffMember> {
  listBySchool: (schoolId: string) => Promise<StaffMember[]>
}
