import type { GradeScaleArgs } from '../../entities/assessments/grade-scale'
import type { ReportCardDefinitionArgs } from '../../entities/assessments/report-card-definition'
import type { ReportCardDefinitionSectionKind } from '../../entities/assessments/report-card-definition-section'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { AuthorizedServiceArgs } from '../authorization'
import type { AttendanceService } from '../scheduling/attendance'
import { GradeScale } from '../../entities/assessments/grade-scale'
import { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import { ReportCardDefinitionSection } from '../../entities/assessments/report-card-definition-section'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { AssessmentService } from './assessment'
import { GradeService } from './grade'
import { ReportCardResultService } from './report-card-result'

export interface AssessmentsServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  attendanceService: Pick<AttendanceService, 'buildAttendanceSummary'>
}

export class AssessmentsService {
  private readonly schools: SchoolRepositories['setup']['schools']
  private readonly academicYears: SchoolRepositories['setup']['academicYears']
  private readonly gradeLevels: SchoolRepositories['setup']['gradeLevels']
  private readonly gradeScales: SchoolRepositories['assessments']['gradeScales']
  private readonly reportCardDefinitions: SchoolRepositories['assessments']['definitions']
  private readonly reportCardDefinitionSections: SchoolRepositories['assessments']['sections']
  private readonly assessments: AssessmentService
  private readonly grades: GradeService
  private readonly reportCardResults: ReportCardResultService
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly students: SchoolRepositories['students']['students']
  private readonly classGroups: SchoolRepositories['academics']['classGroups']
  private readonly classSubjects: SchoolRepositories['academics']['classSubjects']
  private readonly assessmentRepository: SchoolRepositories['assessments']['assessments']
  private readonly academicPeriods: SchoolRepositories['setup']['academicPeriods']
  private readonly sessions: SchoolRepositories['scheduling']['sessions']

  constructor(args: AssessmentsServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schools = args.repositories.setup.schools
    this.academicYears = args.repositories.setup.academicYears
    this.gradeLevels = args.repositories.setup.gradeLevels
    this.gradeScales = args.repositories.assessments.gradeScales
    this.reportCardDefinitions = args.repositories.assessments.definitions
    this.reportCardDefinitionSections = args.repositories.assessments.sections
    this.students = args.repositories.students.students
    this.classGroups = args.repositories.academics.classGroups
    this.classSubjects = args.repositories.academics.classSubjects
    this.assessmentRepository = args.repositories.assessments.assessments
    this.academicPeriods = args.repositories.setup.academicPeriods
    this.sessions = args.repositories.scheduling.sessions
    this.assessments = new AssessmentService({
      classGroupRepository: args.repositories.academics.classGroups,
      classSubjectRepository: args.repositories.academics.classSubjects,
      academicPeriodRepository: args.repositories.setup.academicPeriods,
      sessionRepository: args.repositories.scheduling.sessions,
      assessmentRepository: args.repositories.assessments.assessments,
    })
    this.grades = new GradeService({
      studentRepository: args.repositories.students.students,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      assessmentRepository: args.repositories.assessments.assessments,
      classSubjectRepository: args.repositories.academics.classSubjects,
      academicPeriodRepository: args.repositories.setup.academicPeriods,
      gradeRepository: args.repositories.assessments.grades,
      classGroupRepository: args.repositories.academics.classGroups,
      reportCardDefinitionSectionRepository: args.repositories.assessments.sections,
    })
    this.reportCardResults = new ReportCardResultService({
      atomicExecution: args.atomicExecution,
      studentRepository: args.repositories.students.students,
      classGroupRepository: args.repositories.academics.classGroups,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      academicPeriodRepository: args.repositories.setup.academicPeriods,
      assessmentRepository: args.repositories.assessments.assessments,
      gradeRepository: args.repositories.assessments.grades,
      reportCardDefinitionRepository: args.repositories.assessments.definitions,
      reportCardResultRepository: args.repositories.assessments.results,
      attendanceService: args.attendanceService,
      gradeService: this.grades,
    })
  }

  async createGradeScale(input: GradeScaleArgs): Promise<GradeScale> {
    await this.authorize('assessments.manage_configuration', { schoolId: input.schoolId })
    await this.requireSchool(input.schoolId)
    if (input.isDefault) {
      const existingDefault = await this.gradeScales.findDefaultBySchool(input.schoolId)
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`School ${input.schoolId} already has a default grade scale`)
      }
    }
    const gradeScale = new GradeScale(input)
    await this.gradeScales.save(gradeScale)
    return gradeScale
  }

  async createReportCardDefinition(input: ReportCardDefinitionArgs): Promise<ReportCardDefinition> {
    await this.authorize('assessments.manage_configuration', {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
    })
    await this.requireSchool(input.schoolId)
    const academicYear = await this.academicYears.findById(input.academicYearId)
    if (!academicYear || academicYear.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    const gradeLevel = await this.gradeLevels.findById(input.gradeLevelId)
    if (!gradeLevel || gradeLevel.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    if (input.isDefault) {
      const existingDefault = await this.reportCardDefinitions.findDefaultByGradeLevel(
        input.gradeLevelId,
        input.academicYearId,
      )
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`Grade level ${input.gradeLevelId} already has a default report card definition`)
      }
    }
    const definition = new ReportCardDefinition(input)
    await this.reportCardDefinitions.save(definition)
    return definition
  }


  async createAssessment(input: Parameters<AssessmentService['createAssessment']>[0]) {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: input.classSubjectId,
    })
    await this.requireAssessmentConfigurationResources(input, classGroup.id, classGroup.schoolId, classGroup.academicYearId)
    return this.assessments.createAssessment(input)
  }

  async completeAssessment(input: Parameters<AssessmentService['completeAssessment']>[0]) {
    const assessment = await this.requireAssessment(input.assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
    })
    return this.assessments.completeAssessment(input)
  }

  async recordGrade(input: Omit<Parameters<GradeService['recordGrade']>[0], 'createdBy'>) {
    const assessment = await this.requireAssessment(input.assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId: input.studentId,
    })
    await this.requireStudentInSchool(input.studentId, classGroup.schoolId)
    return this.grades.recordGrade({ ...input, createdBy: resolveAuditActorId(this.actor) })
  }

  async recordGradeCompliance(input: Omit<Parameters<GradeService['recordGradeCompliance']>[0], 'createdBy'>) {
    const assessment = await this.requireAssessment(input.assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId: input.studentId,
    })
    await this.requireStudentInSchool(input.studentId, classGroup.schoolId)
    return this.grades.recordGradeCompliance({ ...input, createdBy: resolveAuditActorId(this.actor) })
  }

  async listClassSubjectGradesForPeriod(input: Parameters<GradeService['listClassSubjectGradesForPeriod']>[0]) {
    const classSubject = await this.requireClassSubject(input.classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('assessments.read_grades', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
    const period = await this.academicPeriods.findById(input.periodId)
    if (!period || period.schoolId !== classGroup.schoolId || period.academicYearId !== classGroup.academicYearId) {
      denyResourceAccess()
    }
    return this.grades.listClassSubjectGradesForPeriod(input)
  }

  async createReportCardDefinitionSection({
    id,
    reportCardDefinitionId,
    kind,
    name,
    weight,
    parentSectionId,
    subjectId,
    createdAt,
  }: {
    id: string
    reportCardDefinitionId: string
    kind: ReportCardDefinitionSectionKind
    name: string
    weight: number
    parentSectionId?: string
    subjectId?: string
    createdAt?: Date
  }): Promise<ReportCardDefinitionSection> {
    const definition = await this.reportCardDefinitions.findById(reportCardDefinitionId)
    if (!definition) {
      denyResourceAccess()
    }
    await this.authorize('assessments.manage_configuration', {
      schoolId: definition.schoolId,
      academicYearId: definition.academicYearId,
    })
    if (parentSectionId) {
      const parent = await this.reportCardDefinitionSections.findById(parentSectionId)
      if (!parent || parent.reportCardDefinitionId !== reportCardDefinitionId) {
        denyResourceAccess()
      }
    }

    const section = new ReportCardDefinitionSection({
      id,
      reportCardDefinitionId,
      kind,
      name,
      weight,
      parentSectionId,
      subjectId,
      createdAt,
    })
    await this.reportCardDefinitionSections.save(section)
    return section
  }

  async generateReportCardResult(input: Parameters<ReportCardResultService['generateReportCardResult']>[0]) {
    const student = await this.requireStudent(input.studentId)
    await this.authorize('assessments.publish_report_card', {
      schoolId: student.schoolId,
      studentId: student.id,
    })
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.reportCardResults.generateReportCardResult(input)
  }

  async publishReportCardResult(input: Parameters<ReportCardResultService['publishReportCardResult']>[0]) {
    const student = await this.requireStudent(input.studentId)
    await this.authorize('assessments.publish_report_card', {
      schoolId: student.schoolId,
      studentId: student.id,
      reportCardResultId: input.id,
    })
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.reportCardResults.publishReportCardResult(input)
  }

  private async requireSchool(schoolId: string): Promise<void> {
    if (!await this.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
  }

  private async requireStudent(studentId: string) {
    const student = await this.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireClassGroup(classGroupId: string) {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireClassSubject(classSubjectId: string) {
    const classSubject = await this.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async requireAssessment(assessmentId: string) {
    const assessment = await this.assessmentRepository.findById(assessmentId)
    if (!assessment) {
      denyResourceAccess()
    }
    return assessment
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireAssessmentConfigurationResources(
    input: Parameters<AssessmentService['createAssessment']>[0],
    classGroupId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<void> {
    const [classSubject, period, session] = await Promise.all([
      this.classSubjects.findById(input.classSubjectId),
      this.academicPeriods.findById(input.periodId),
      input.sessionId ? this.sessions.findById(input.sessionId) : Promise.resolve(undefined),
    ])
    if (
      !classSubject
      || classSubject.classGroupId !== classGroupId
      || !period
      || period.schoolId !== schoolId
      || period.academicYearId !== academicYearId
      || (input.sessionId && (
        !session
        || session.classGroupId !== classGroupId
        || (session.classSubjectId && session.classSubjectId !== input.classSubjectId)
      ))
    ) {
      denyResourceAccess()
    }
  }

  private async requireReportCardResources(
    periodId: string,
    reportCardDefinitionId: string | undefined,
    schoolId: string,
  ): Promise<void> {
    const period = await this.academicPeriods.findById(periodId)
    const definition = reportCardDefinitionId
      ? await this.reportCardDefinitions.findById(reportCardDefinitionId)
      : undefined
    if (!period || period.schoolId !== schoolId || (reportCardDefinitionId && !definition)) {
      denyResourceAccess()
    }
    if (definition && definition.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async authorize(
    action: 'assessments.manage_configuration' | 'assessments.record_grade' | 'assessments.read_grades' | 'assessments.publish_report_card',
    resource: {
      schoolId: string
      academicYearId?: string
      classGroupId?: string
      classSubjectId?: string
      studentId?: string
      reportCardResultId?: string
    },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
