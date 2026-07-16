export interface AuthLinkTeacherRecord {
  id: string
  subjectId?: string
}

export interface AuthLinkSchoolRecord {
  id: string
  ownerSubjectId?: string
}

export interface AuthLinkStaffRecord {
  id: string
  subjectId?: string
}

export interface AuthLinkGuardianRecord {
  id: string
  subjectId?: string
}

export interface RegisterSeedStaffInput {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  email: string
}

export interface LinkSeedActorSubjectInput {
  subjectId: string
  staffMemberId?: string
  guardianId?: string
  teacherId?: string
}

export interface AuthLinkSeedPort {
  findSchoolById: (id: string) => Promise<AuthLinkSchoolRecord | undefined>
  setSchoolOwnerSubjectId: (schoolId: string, subjectId: string) => Promise<void>
  findStaffById: (id: string) => Promise<AuthLinkStaffRecord | undefined>
  registerStaffMember: (input: RegisterSeedStaffInput) => Promise<void>
  replaceStaffSubjectId: (staffId: string, subjectId: string) => Promise<void>
  findGuardianById: (id: string) => Promise<AuthLinkGuardianRecord | undefined>
  findTeacherById: (id: string) => Promise<AuthLinkTeacherRecord | undefined>
  replaceGuardianSubjectId: (guardianId: string, subjectId: string) => Promise<void>
  linkActorSubject: (input: LinkSeedActorSubjectInput) => Promise<void>
}
