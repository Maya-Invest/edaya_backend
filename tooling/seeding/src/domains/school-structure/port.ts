import type { AcademicPeriodType, AttendanceMode, DayOfWeek, SchoolType, StaffProfileRole } from '@edaya/core'

export interface SchoolStructureSeedState {
  schoolIds: readonly string[]
  studentCount: number
}

export interface SchoolStructureSchoolRecord {
  id: string
  name: string
  timeZone: string
  financeCurrency?: string
  ownerSubjectId?: string
  type?: SchoolType
  country?: string
  city?: string
  issuingName?: string
  postalAddress?: string
  phone?: string
  email?: string
  schoolCode?: string
}

export interface GradeLevelSeedRecord {
  id: string
  schoolId: string
  name: string
  /** Stem used to build class names (`6ème` → `6ème 1`). */
  label: string
  order: number
  cycle?: string
}

export interface AcademicYearSeedRecord {
  id: string
  schoolId: string
  name: string
  startDate: string
  endDate: string
}

export interface AcademicPeriodSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  type: AcademicPeriodType
  startDate: string
  endDate: string
}

export interface PeriodDefinitionSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  label: string
  dayOfWeek: DayOfWeek
  order: number
  startTime: string
  endTime: string
  isBreak: boolean
  isTeachingSlot: boolean
}

export interface SchoolStructureStaffRecord {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  email?: string
  profileRole?: StaffProfileRole
  sendAccountInvitation?: boolean
}

export interface ClassGroupSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  capacity?: number
  homeroomStaffId?: string
  attendanceMode?: AttendanceMode
}

export interface SchoolStructureSeedPort {
  inspectSeedState: (demoSchoolId: string) => Promise<SchoolStructureSeedState>
  registerSchool: (record: SchoolStructureSchoolRecord) => Promise<void>
  saveGradeLevel: (record: GradeLevelSeedRecord) => Promise<void>
  createAcademicYear: (record: AcademicYearSeedRecord) => Promise<void>
  publishAcademicYear: (academicYearId: string) => Promise<void>
  createAcademicPeriod: (record: AcademicPeriodSeedRecord) => Promise<void>
  publishAcademicPeriod: (academicPeriodId: string) => Promise<void>
  savePeriodDefinition: (record: PeriodDefinitionSeedRecord) => Promise<void>
  staffMemberExists: (staffId: string) => Promise<boolean>
  registerStaffMember: (record: SchoolStructureStaffRecord) => Promise<void>
  createClassGroup: (record: ClassGroupSeedRecord) => Promise<void>
}
