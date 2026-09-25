import type { AcademicPeriod, AcademicYear, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, CatalogService, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, DocumentIssuance, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, StaffAssignment, StaffMember, StaffPermissionProfile, StaffPermissionProfileBinding, Student, StudentCharge, StudentClassEnrollment, StudentDisciplinaryAction, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, StudentPhotoSubmission, StudentServiceEnrollment, StudentYearAccount, Subject, SubjectCategoryEntity, SubjectMatter, Teacher, TeacherAssignment, TeacherUnavailability } from '@edaya/core'
import type { RepositoryStore as PostgresStore } from '../postgres-store'
import type { ConsortiumRow } from './consortium-row'

export interface EntityStores {
  /** Kept for schema init / legacy row mapping; not exposed on SchoolRepositories. */
  consortiums: PostgresStore<ConsortiumRow>
  schoolsStore: PostgresStore<School>
  academicYears: PostgresStore<AcademicYear>
  academicPeriods: PostgresStore<AcademicPeriod>
  periodDefinitions: PostgresStore<PeriodDefinition>
  gradeLevels: PostgresStore<GradeLevel>
  staffMembers: PostgresStore<StaffMember>
  staffAssignments: PostgresStore<StaffAssignment>
  staffPermissionProfiles: PostgresStore<StaffPermissionProfile>
  staffPermissionProfileBindings: PostgresStore<StaffPermissionProfileBinding>
  teachers: PostgresStore<Teacher>
  teacherAssignments: PostgresStore<TeacherAssignment>
  teacherUnavailabilities: PostgresStore<TeacherUnavailability>
  attachments: PostgresStore<Attachment>
  resources: PostgresStore<Resource>
  resourceAssignments: PostgresStore<ResourceAssignment>
  catalogServices: PostgresStore<CatalogService>
  studentServiceEnrollments: PostgresStore<StudentServiceEnrollment>
  studentCharges: PostgresStore<StudentCharge>
  studentYearAccounts: PostgresStore<StudentYearAccount>
  payments: PostgresStore<Payment>
  schedules: PostgresStore<Schedule>
  lessonSessions: PostgresStore<LessonSession>
  activitySessions: PostgresStore<ActivitySession>
  attendances: PostgresStore<Attendance>
  calendarEvents: PostgresStore<CalendarEvent>
  attendance: PostgresStore<AttendanceRecord>
  announcements: PostgresStore<Announcement>
  announcementTargets: PostgresStore<AnnouncementTarget>
  messageDeliveries: PostgresStore<MessageDelivery>
  subjects: PostgresStore<Subject>
  subjectCategories: PostgresStore<SubjectCategoryEntity>
  subjectMatters: PostgresStore<SubjectMatter>
  gradeLevelSubjects: PostgresStore<GradeLevelSubject>
  gradeLevelSubjectMatters: PostgresStore<GradeLevelSubjectMatter>
  classGroups: PostgresStore<ClassGroup>
  classSubjects: PostgresStore<ClassSubject>
  classSubjectMatters: PostgresStore<ClassSubjectMatter>
  classSubjectProgress: PostgresStore<ClassSubjectProgress>
  activities: PostgresStore<Activity>
  activityEnrollments: PostgresStore<ActivityEnrollment>
  classActivityEnrollments: PostgresStore<ClassActivityEnrollment>
  assessments: PostgresStore<Assessment>
  assessmentResults: PostgresStore<AssessmentResult>
  gradeScales: PostgresStore<GradeScale>
  definitions: PostgresStore<ReportCardDefinition>
  sections: PostgresStore<ReportCardDefinitionSection>
  results: PostgresStore<ReportCardResult>
  students: PostgresStore<Student>
  enrollments: PostgresStore<StudentClassEnrollment>
  guardians: PostgresStore<Guardian>
  guardianLinks: PostgresStore<GuardianStudentLink>
  studentNotes: PostgresStore<StudentNote>
  studentPhotoSubmissions: PostgresStore<StudentPhotoSubmission>
  studentHealthProfiles: PostgresStore<StudentHealthProfile>
  studentDisciplinaryActions: PostgresStore<StudentDisciplinaryAction>
  disciplinaryActions: PostgresStore<DisciplinaryAction>
  studentIncidentInvolvements: PostgresStore<StudentIncidentInvolvement>
  incidents: PostgresStore<Incident>
  documentIssuances: PostgresStore<DocumentIssuance>
}
