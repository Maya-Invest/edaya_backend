export interface FamilyFeedbackSubjectAssignmentSeedRecord {
  id: string
  teacherId: string
}

export interface FamilyFeedbackStaffSeedRecord {
  id: string
}

export interface FamilyFeedbackCampaignSeedRecord {
  id: string
  status: string
}

export interface CreateFamilyFeedbackCampaignSeedRecord {
  requestId: string
  id: string
  academicYearId: string
  academicPeriodId: string
  teacherAssignmentId: string
  moderatorStaffId?: string
}

export interface AssignFamilyFeedbackModeratorSeedRecord {
  requestId: string
  id: string
  moderatorStaffId: string
}

export interface FamilyFeedbackSeedPort {
  listSubjectAssignments: (academicYearId: string) => Promise<FamilyFeedbackSubjectAssignmentSeedRecord[]>
  listStaffMembers: () => Promise<FamilyFeedbackStaffSeedRecord[]>
  listCampaigns: () => Promise<FamilyFeedbackCampaignSeedRecord[]>
  createCampaign: (record: CreateFamilyFeedbackCampaignSeedRecord) => Promise<void>
  assignModerator: (record: AssignFamilyFeedbackModeratorSeedRecord) => Promise<void>
}
