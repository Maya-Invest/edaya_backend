import type { BaseRepositoryInterface } from './_base-repository'
import type {
  School,
  AcademicYear,
  AcademicPeriod,
  PeriodDefinition,
  GradeLevel,
  StaffMember,
  StaffAssignment,
  Attachment,
  Resource,
  ResourceAssignment,
  Student,
  StudentClassEnrollment,
  Guardian,
  GuardianStudentLink,
  StudentNote,
  StudentDisciplinaryAction,
  DisciplinaryAction,
  StudentIncidentInvolvement,
  Incident,
  Subject,
  SubjectMatter,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  Activity,
  StudentActivityEnrollment,
  Schedule,
  Session,
  GroupedSession,
  AttendanceRecord,
  CalendarEvent,
  Assessment,
  Grade,
  GradeScale,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  ClassExam,
  Exam,
  ExamSubject,
  Fee,
  StudentFee,
  Payment,
  Announcement,
  AnnouncementTarget,
  MessageDelivery,
} from '../entities'

export interface SetupRepositories {
  readonly schools: BaseRepositoryInterface<School>
  readonly academicYears: BaseRepositoryInterface<AcademicYear> & {
    listBySchool: (schoolId: string) => Promise<AcademicYear[]>
  }
  readonly academicPeriods: BaseRepositoryInterface<AcademicPeriod> & {
    listByAcademicYear: (academicYearId: string) => Promise<AcademicPeriod[]>
    listBySchool: (schoolId: string) => Promise<AcademicPeriod[]>
  }
  readonly periodDefinitions: BaseRepositoryInterface<PeriodDefinition> & {
    listByAcademicYear: (academicYearId: string) => Promise<PeriodDefinition[]>
  }
  readonly gradeLevels: BaseRepositoryInterface<GradeLevel> & {
    listBySchool: (schoolId: string) => Promise<GradeLevel[]>
  }
  readonly staffMembers: BaseRepositoryInterface<StaffMember> & {
    listBySchool: (schoolId: string) => Promise<StaffMember[]>
  }
  readonly staffAssignments: BaseRepositoryInterface<StaffAssignment> & {
    listByStaff: (staffId: string) => Promise<StaffAssignment[]>
    listByClassGroup: (classGroupId: string) => Promise<StaffAssignment[]>
    listByClassSubject: (classSubjectId: string) => Promise<StaffAssignment[]>
    listBySession: (sessionId: string) => Promise<StaffAssignment[]>
    listByGroupedSession: (groupedSessionId: string) => Promise<StaffAssignment[]>
  }
  readonly attachments: BaseRepositoryInterface<Attachment> & {
    listByOwner: (ownerKind: string, ownerId: string) => Promise<Attachment[]>
  }
  readonly resources: BaseRepositoryInterface<Resource>
  readonly resourceAssignments: BaseRepositoryInterface<ResourceAssignment>
}

export interface AcademicsRepositories {
  readonly subjects: BaseRepositoryInterface<Subject> & {
    listBySchool: (schoolId: string) => Promise<Subject[]>
  }
  readonly subjectMatters: BaseRepositoryInterface<SubjectMatter> & {
    listBySubject: (subjectId: string) => Promise<SubjectMatter[]>
  }
  readonly classGroups: BaseRepositoryInterface<ClassGroup> & {
    listByAcademicYear: (academicYearId: string) => Promise<ClassGroup[]>
  }
  readonly classSubjects: BaseRepositoryInterface<ClassSubject> & {
    listByClassGroup: (classGroupId: string) => Promise<ClassSubject[]>
    listBySubject: (subjectId: string) => Promise<ClassSubject[]>
  }
  readonly classSubjectMatters: BaseRepositoryInterface<ClassSubjectMatter> & {
    findByClassSubjectAndSubjectMatter: (
      classSubjectId: string,
      subjectMatterId: string,
    ) => Promise<ClassSubjectMatter | undefined>
    listByClassSubject: (classSubjectId: string) => Promise<ClassSubjectMatter[]>
  }
  readonly classSubjectProgress: BaseRepositoryInterface<ClassSubjectProgress> & {
    findByClassSubjectMatterAndSession: (
      matterId: string,
      sessionId: string,
    ) => Promise<ClassSubjectProgress | undefined>
    listByClassSubjectMatter: (matterId: string) => Promise<ClassSubjectProgress[]>
    listBySession: (sessionId: string) => Promise<ClassSubjectProgress[]>
  }
  readonly activities: BaseRepositoryInterface<Activity>
  readonly studentActivityEnrollments: BaseRepositoryInterface<StudentActivityEnrollment>
}

export interface SchedulingRepositories {
  readonly schedules: BaseRepositoryInterface<Schedule> & {
    listByClassGroup: (classGroupId: string) => Promise<Schedule[]>
  }
  readonly sessions: BaseRepositoryInterface<Session> & {
    listByClassGroup: (classGroupId: string) => Promise<Session[]>
    listBetween: (startDate: Date, endDate: Date) => Promise<Session[]>
  }
  readonly groupedSessions: BaseRepositoryInterface<GroupedSession> & {
    listByAcademicYear: (academicYearId: string) => Promise<GroupedSession[]>
    listBetween: (startDate: Date, endDate: Date) => Promise<GroupedSession[]>
  }
  readonly attendance: BaseRepositoryInterface<AttendanceRecord> & {
    findByStudentAndSession: (studentId: string, sessionId: string) => Promise<AttendanceRecord | undefined>
    listBySession: (sessionId: string) => Promise<AttendanceRecord[]>
    listByStudentBetween: (studentId: string, startDate: Date, endDate: Date) => Promise<AttendanceRecord[]>
  }
  readonly calendarEvents: BaseRepositoryInterface<CalendarEvent> & {
    listBySchool: (schoolId: string) => Promise<CalendarEvent[]>
    listByAcademicYear: (academicYearId: string) => Promise<CalendarEvent[]>
  }
}

export interface AssessmentRepositories {
  readonly assessments: BaseRepositoryInterface<Assessment> & {
    listByClassSubjectAndPeriod: (classSubjectId: string, periodId: string) => Promise<Assessment[]>
    listByPeriod: (periodId: string) => Promise<Assessment[]>
  }
  readonly grades: BaseRepositoryInterface<Grade> & {
    listByStudentAndPeriod: (studentId: string, periodId: string) => Promise<Grade[]>
    listByClassSubjectAndPeriod: (classSubjectId: string, periodId: string) => Promise<Grade[]>
    listByAssessment: (assessmentId: string) => Promise<Grade[]>
  }
  readonly gradeScales: BaseRepositoryInterface<GradeScale> & {
    findDefaultBySchool: (schoolId: string) => Promise<GradeScale | undefined>
    listBySchool: (schoolId: string) => Promise<GradeScale[]>
  }
  readonly definitions: BaseRepositoryInterface<ReportCardDefinition> & {
    findDefaultByGradeLevel: (gradeLevelId: string, academicYearId: string) => Promise<ReportCardDefinition | undefined>
    listByGradeLevel: (gradeLevelId: string, academicYearId: string) => Promise<ReportCardDefinition[]>
  }
  readonly sections: BaseRepositoryInterface<ReportCardDefinitionSection> & {
    listByReportCardDefinition: (definitionId: string) => Promise<ReportCardDefinitionSection[]>
  }
  readonly results: BaseRepositoryInterface<ReportCardResult> & {
    findByStudentAndPeriod: (studentId: string, periodId: string) => Promise<ReportCardResult | undefined>
    findByStudentAndExam: (studentId: string, examId: string) => Promise<ReportCardResult | undefined>
    listByStudent: (studentId: string) => Promise<ReportCardResult[]>
  }
  readonly classExams: BaseRepositoryInterface<ClassExam> & {
    findByExamAndClassGroupAndPeriod: (
      examId: string,
      classGroupId: string,
      periodId: string,
    ) => Promise<ClassExam | undefined>
    listByExam: (examId: string) => Promise<ClassExam[]>
    listByClassGroupAndPeriod: (classGroupId: string, periodId: string) => Promise<ClassExam[]>
  }
  readonly exams: BaseRepositoryInterface<Exam>
  readonly examSubjects: BaseRepositoryInterface<ExamSubject>
}

export interface StudentRepositories {
  readonly students: BaseRepositoryInterface<Student> & {
    listBySchool: (schoolId: string) => Promise<Student[]>
  }
  readonly enrollments: BaseRepositoryInterface<StudentClassEnrollment> & {
    findCurrentByStudent: (studentId: string) => Promise<StudentClassEnrollment | undefined>
    listByStudent: (studentId: string) => Promise<StudentClassEnrollment[]>
    listByClassGroup: (classGroupId: string) => Promise<StudentClassEnrollment[]>
  }
  readonly guardians: BaseRepositoryInterface<Guardian> & {
    listBySchool: (schoolId: string) => Promise<Guardian[]>
  }
  readonly guardianLinks: BaseRepositoryInterface<GuardianStudentLink> & {
    findByGuardianAndStudent: (guardianId: string, studentId: string) => Promise<GuardianStudentLink | undefined>
    listByGuardian: (guardianId: string) => Promise<GuardianStudentLink[]>
    listByStudent: (studentId: string) => Promise<GuardianStudentLink[]>
  }
  readonly studentNotes: BaseRepositoryInterface<StudentNote>
  readonly studentDisciplinaryActions: BaseRepositoryInterface<StudentDisciplinaryAction>
  readonly disciplinaryActions: BaseRepositoryInterface<DisciplinaryAction>
  readonly studentIncidentInvolvements: BaseRepositoryInterface<StudentIncidentInvolvement>
  readonly incidents: BaseRepositoryInterface<Incident>
}

export interface FinanceRepositories {
  readonly fees: BaseRepositoryInterface<Fee> & {
    listBySchool: (schoolId: string) => Promise<Fee[]>
    listByAcademicYear: (academicYearId: string) => Promise<Fee[]>
  }
  readonly studentFees: BaseRepositoryInterface<StudentFee> & {
    listByStudent: (studentId: string) => Promise<StudentFee[]>
  }
  readonly payments: BaseRepositoryInterface<Payment> & {
    listByStudentFee: (studentFeeId: string) => Promise<Payment[]>
  }
}

export interface CommunicationRepositories {
  readonly announcements: BaseRepositoryInterface<Announcement> & {
    listBySchool: (schoolId: string) => Promise<Announcement[]>
  }
  readonly announcementTargets: BaseRepositoryInterface<AnnouncementTarget> & {
    listByAnnouncement: (announcementId: string) => Promise<AnnouncementTarget[]>
    listByTarget: (targetKind: string, targetId: string) => Promise<AnnouncementTarget[]>
  }
  readonly messageDeliveries: BaseRepositoryInterface<MessageDelivery> & {
    listByAnnouncement: (announcementId: string) => Promise<MessageDelivery[]>
    listByRecipient: (recipientId: string) => Promise<MessageDelivery[]>
  }
}

export interface SchoolRepositories {
  readonly setup: SetupRepositories
  readonly academics: AcademicsRepositories
  readonly scheduling: SchedulingRepositories
  readonly assessments: AssessmentRepositories
  readonly students: StudentRepositories
  readonly finance: FinanceRepositories
  readonly communications: CommunicationRepositories
}
