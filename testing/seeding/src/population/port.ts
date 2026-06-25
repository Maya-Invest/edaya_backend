export interface StudentSeedRecord {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  birthDate?: string
  subjectId?: string
  sendAccountInvitation?: boolean
}

export interface EnrollmentSeedRecord {
  id: string
  studentId: string
  classGroupId: string
}

export interface GuardianSeedRecord {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  subjectId?: string
  sendAccountInvitation?: boolean
}

export interface GuardianStudentLinkSeedRecord {
  id: string
  guardianId: string
  studentId: string
  relationship?: string
  isPrimary: boolean
  legalGuardian: boolean
}

export interface PopulationSeedPort {
  registerStudent: (record: StudentSeedRecord) => Promise<void>
  enrollStudent: (record: EnrollmentSeedRecord) => Promise<void>
  registerGuardian: (record: GuardianSeedRecord) => Promise<void>
  linkGuardianToStudent: (record: GuardianStudentLinkSeedRecord) => Promise<void>
}
