import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  Fee,
  GradeLevel,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  Resource,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from '../entities'
import type { BaseRepositoryInterface } from './base-repository'

export interface SchoolRepositories {
  // SetupRepositories
  readonly schools: BaseRepositoryInterface<School>
  readonly academicYears: BaseRepositoryInterface<AcademicYear>
  readonly academicPeriods: BaseRepositoryInterface<AcademicPeriod>
  readonly periodDefinitions: BaseRepositoryInterface<PeriodDefinition>
  readonly gradeLevels: BaseRepositoryInterface<GradeLevel>
  readonly staffMembers: BaseRepositoryInterface<StaffMember>
  readonly staffAssignments: BaseRepositoryInterface<StaffAssignment>
  readonly attachments: BaseRepositoryInterface<Attachment>
  readonly resources: BaseRepositoryInterface<Resource>
  readonly resourceAssignments: BaseRepositoryInterface<ResourceAssignment>

  // FinanceRepositories
  readonly fees: BaseRepositoryInterface<Fee>
  readonly studentFees: BaseRepositoryInterface<StudentFee>
  readonly payments: BaseRepositoryInterface<Payment>

  // SchedulingRepositories {
  readonly schedules: BaseRepositoryInterface<Schedule>
  readonly sessions: BaseRepositoryInterface<Session>
  readonly calendarEvents: BaseRepositoryInterface<CalendarEvent>
  readonly attendance: BaseRepositoryInterface<AttendanceRecord> & {
    findByStudentAndSession: (studentId: string, sessionId: string) => Promise<AttendanceRecord | undefined>
  }

  // CommunicationRepositories {
  readonly announcements: BaseRepositoryInterface<Announcement>
  readonly announcementTargets: BaseRepositoryInterface<AnnouncementTarget>
  readonly messageDeliveries: BaseRepositoryInterface<MessageDelivery>

  // AcademicsRepositories {
  readonly subjects: BaseRepositoryInterface<Subject>
  readonly subjectMatters: BaseRepositoryInterface<SubjectMatter>
  readonly classGroups: BaseRepositoryInterface<ClassGroup>
  readonly classSubjects: BaseRepositoryInterface<ClassSubject>
  readonly classSubjectMatters: BaseRepositoryInterface<ClassSubjectMatter> & {
    findByClassSubjectAndSubjectMatter: (
      classSubjectId: string,
      subjectMatterId: string,
    ) => Promise<ClassSubjectMatter | undefined>
  }
  readonly classSubjectProgress: BaseRepositoryInterface<ClassSubjectProgress> & {
    findByClassSubjectMatterAndSession: (
      matterId: string,
      sessionId: string,
    ) => Promise<ClassSubjectProgress | undefined>
  }

  // AssessmentRepositories
  readonly assessments: BaseRepositoryInterface<Assessment>
  readonly assessmentResults: BaseRepositoryInterface<AssessmentResult>
  readonly gradeScales: BaseRepositoryInterface<GradeScale> & {
    findDefaultBySchool: (schoolId: string) => Promise<GradeScale | undefined>
  }
  readonly definitions: BaseRepositoryInterface<ReportCardDefinition> & {
    findDefaultByGradeLevel: (gradeLevelId: string, academicYearId: string) => Promise<ReportCardDefinition | undefined>
  }
  readonly sections: BaseRepositoryInterface<ReportCardDefinitionSection>
  readonly results: BaseRepositoryInterface<ReportCardResult> & {
    findByStudentAndPeriod: (studentId: string, periodId: string) => Promise<ReportCardResult | undefined>
  }

  // StudentRepositories
  readonly students: BaseRepositoryInterface<Student>
  readonly enrollments: BaseRepositoryInterface<StudentClassEnrollment> & {
    findCurrentByStudent: (studentId: string) => Promise<StudentClassEnrollment | undefined>
  }
  readonly guardians: BaseRepositoryInterface<Guardian>
  readonly guardianLinks: BaseRepositoryInterface<GuardianStudentLink> & {
    findByGuardianAndStudent: (guardianId: string, studentId: string) => Promise<GuardianStudentLink | undefined>
  }
  readonly studentNotes: BaseRepositoryInterface<StudentNote>
  readonly studentDisciplinaryActions: BaseRepositoryInterface<StudentDisciplinaryAction>
  readonly disciplinaryActions: BaseRepositoryInterface<DisciplinaryAction>
  readonly studentIncidentInvolvements: BaseRepositoryInterface<StudentIncidentInvolvement>
  readonly incidents: BaseRepositoryInterface<Incident>

}
