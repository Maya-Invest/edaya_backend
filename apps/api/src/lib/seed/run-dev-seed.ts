import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { seedReportCards } from "@/lib/seed/seed-report-cards";
import {
  parseSeedDate,

  parseSeedDateTime,
  planningSessionDate,
  SEED_ABSENCE_RECORDS,
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_ASSESSMENT_RESULT_SCORES,
  SEED_ASSESSMENTS,
  SEED_CALENDAR_EVENTS,
  SEED_CLASS_SUBJECT_MATTERS,
  SEED_CLASS_SUBJECTS,
  SEED_CLASSES,
  SEED_CURRENCY,
  SEED_FEES,
  SEED_FINANCE_REFERENCE_DATE,
  SEED_GRADE_LEVELS,
  SEED_GUARDIANS,
  SEED_INCIDENTS,
  SEED_PAYMENTS,
  SEED_PEDAGOGICAL_NOTES,
  SEED_PERIOD_DEFINITIONS,
  SEED_PLANNING_SLOTS,
  SEED_RESOURCES,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_PROFILE,
  SEED_SESSION_PROGRESS,
  SEED_STAFF,
  SEED_STUDENT_FEES,
  SEED_STUDENT_HEALTH_PROFILES,
  SEED_STUDENTS,
  SEED_SUBJECT_CATALOG,
  SEED_SUBJECT_MATTERS,
  seedPeriodIdForDate,
  splitDisplayName,
} from "@edaya/dev-fixtures";
import type {
  FeeCategory,
} from "@edaya/core";
import {
  AcademicPeriodType,
  AssessmentKind,
  AttendanceStatus,
  CalendarEventKind,
  CalendarEventScopeKind,
  ClassSubjectMatterStatus,
  createSystemActorMetadata,
  DayOfWeek,
  GradeLevel,
  IncidentInvolvementRole,
  IncidentKind,
  PaymentMethod,
  PeriodDefinition,
  Resource,
  ResourceKind,
  SessionKind,
  StudentNote,
  StudentNoteCategory,
  Subject,
  SubjectMatter,
} from "@edaya/core";

const SEED_NOTE_CATEGORY_BY_LABEL: Record<string, StudentNoteCategory> = {
  Comportement: StudentNoteCategory.Behavior,
  Travail: StudentNoteCategory.Work,
  Progression: StudentNoteCategory.Progress,
  Encouragement: StudentNoteCategory.Encouragement,
};

export type DevSeedResult =
  | { status: "skipped"; reason: "already-seeded"; schoolCount: number }
  | {
    status: "seeded";
    schoolId: string;
    academicYearId: string;
    gradeLevels: number;
    classes: number;
    staff: number;
    students: number;
    guardians: number;
    academicPeriods: number;
    subjects: number;
    classSubjects: number;
    periodDefinitions: number;
    fees: number;
    studentFees: number;
    payments: number;
    classSubjectMatters: number;
    resources: number;
    schedules: number;
    sessions: number;
    assessments: number;
    assessmentResults: number;
    calendarEvents: number;
    incidents: number;
    attendanceRecords: number;
    studentHealthProfiles: number;
    studentNotes: number;
    gradeScales: number;
    reportCardDefinitions: number;
    reportCardSections: number;
    reportCardResults: number;
  };

function joinHealthList(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(", ") : undefined;
}

export async function runDevSeed(application: ApiSchoolApplication): Promise<DevSeedResult> {
  const existingSchools = await application.repositories.schools.list();
  if (existingSchools.length > 0) {
    return { status: "skipped", reason: "already-seeded", schoolCount: existingSchools.length };
  }

  const actor = createSystemActorMetadata({
    systemId: "dev-seed",
    schoolId: SEED_SCHOOL_ID,
    requestId: "dev-seed",
    reason: "Local development database seed",
  });
  const service = application.forActor(actor);

  await service.registerSchool(SEED_SCHOOL_PROFILE);

  for (const gradeLevel of SEED_GRADE_LEVELS) {
    await service.baseService.gradeLevels.save(new GradeLevel({
      id: gradeLevel.id,
      schoolId: SEED_SCHOOL_ID,
      name: gradeLevel.name,
      order: gradeLevel.order,
      cycle: gradeLevel.cycle,
    }), { moduleChecked: true });
  }

  await service.createAcademicYear({
    id: SEED_ACADEMIC_YEAR_ID,
    schoolId: SEED_SCHOOL_ID,
    name: "2025 — 2026",
    startDate: parseSeedDate("2025-09-01"),
    endDate: parseSeedDate("2026-07-03"),
  });

  for (const period of SEED_ACADEMIC_PERIODS) {
    const created = await service.createAcademicPeriod({
      id: period.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      name: period.name,
      type: AcademicPeriodType.Trimester,
      startDate: parseSeedDate(period.startDate),
      endDate: parseSeedDate(period.endDate),
    });
    await service.publishAcademicPeriod({ academicPeriodId: created.id });
  }

  for (const slot of SEED_PERIOD_DEFINITIONS) {
    await service.baseService.periodDefinitions.save(new PeriodDefinition({
      id: slot.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      label: slot.label,
      order: slot.order,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBreak: slot.isBreak,
    }), { moduleChecked: true });
  }

  const director = SEED_STAFF[0];
  const directorName = splitDisplayName(director.name);
  await service.registerStaffMember({
    id: director.id,
    schoolId: SEED_SCHOOL_ID,
    firstName: directorName.firstName,
    lastName: directorName.lastName,
    email: director.email,
  });

  await service.updateSchoolConfiguration({
    schoolId: SEED_SCHOOL_ID,
    ownerStaffId: director.id,
  });

  for (const member of SEED_STAFF.slice(1)) {
    const { firstName, lastName } = splitDisplayName(member.name);
    await service.registerStaffMember({
      id: member.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: member.email,
    });
  }

  for (const classGroup of SEED_CLASSES) {
    await service.createClassGroup({
      id: classGroup.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      gradeLevelId: classGroup.gradeLevelId,
      name: classGroup.name,
      capacity: classGroup.capacity,
      homeroomStaffId: classGroup.id === "6a" ? "st3" : undefined,
    });
  }

  for (const student of SEED_STUDENTS) {
    const { firstName, lastName } = splitDisplayName(student.name);
    await service.registerStudent({
      id: student.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      birthDate: parseSeedDate(student.birthDate),
    });
    await service.enrollStudent({
      id: `enr-${student.id}`,
      studentId: student.id,
      classGroupId: student.classId,
    });
  }

  for (const guardian of SEED_GUARDIANS) {
    const { firstName, lastName } = splitDisplayName(guardian.name);
    await service.registerGuardian({
      id: guardian.id,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: guardian.email,
      phone: guardian.phone,
    });

    for (const studentId of guardian.studentIds) {
      await service.linkGuardianToStudent({
        id: `link-${guardian.id}-${studentId}`,
        guardianId: guardian.id,
        studentId,
        relationship: guardian.relationship,
        isPrimary: true,
        legalGuardian: true,
      });
    }
  }

  for (const subject of SEED_SUBJECT_CATALOG) {
    await service.baseService.subjects.save(new Subject({
      id: subject.id,
      schoolId: SEED_SCHOOL_ID,
      name: subject.name,
      code: subject.code,
      defaultCoefficient: subject.defaultCoefficient,
    }), { moduleChecked: true });
  }

  for (const matter of SEED_SUBJECT_MATTERS) {
    await service.baseService.subjectMatters.save(new SubjectMatter({
      id: matter.id,
      subjectId: matter.subjectId,
      name: matter.name,
      description: matter.description,
      sequenceOrder: matter.sequenceOrder,
      estimatedHours: matter.estimatedHours,
    }), { moduleChecked: true });
  }

  for (const offering of SEED_CLASS_SUBJECTS) {
    await service.offerSubjectToClass({
      id: offering.id,
      classGroupId: offering.classGroupId,
      subjectId: offering.subjectId,
      coefficient: offering.coefficient,
    });
  }

  for (const link of SEED_CLASS_SUBJECT_MATTERS) {
    await service.assignMatterToClassSubject({
      id: link.id,
      classSubjectId: link.classSubjectId,
      subjectMatterId: link.subjectMatterId,
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
    });
  }

  const planningDayOfWeek = {
    Mon: DayOfWeek.Monday,
    Tue: DayOfWeek.Tuesday,
    Wed: DayOfWeek.Wednesday,
    Thu: DayOfWeek.Thursday,
    Fri: DayOfWeek.Friday,
  } as const;

  const resourceKindBySeed = {
    location: ResourceKind.Location,
    equipment: ResourceKind.Equipment,
    vehicle: ResourceKind.Vehicle,
  } as const;

  for (const resource of SEED_RESOURCES) {
    await service.baseService.resources.save(new Resource({
      id: resource.id,
      schoolId: SEED_SCHOOL_ID,
      name: resource.name,
      kind: resourceKindBySeed[resource.kind],
      capacity: "capacity" in resource ? resource.capacity : undefined,
      description: resource.description,
    }), { moduleChecked: true });
  }

  for (const slot of SEED_PLANNING_SLOTS) {
    await service.createSchedule({
      id: slot.scheduleId,
      classGroupId: slot.classGroupId,
      classSubjectId: slot.classSubjectId,
      title: slot.title,
      isRecurring: true,
      dayOfWeek: planningDayOfWeek[slot.day],
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  }

  for (const slot of SEED_PLANNING_SLOTS) {
    const sessionDate = planningSessionDate(slot.day);
    const session = await service.createSession({
      id: slot.sessionId,
      classGroupId: slot.classGroupId,
      classSubjectId: slot.classSubjectId,
      scheduleId: slot.scheduleId,
      title: slot.title,
      kind: SessionKind.Course,
      startsAt: parseSeedDateTime(sessionDate, slot.startTime),
      endsAt: parseSeedDateTime(sessionDate, slot.endTime),
    });

    await service.assignStaffToSession({
      id: `sa-${session.id}-${slot.teacherId}`,
      staffId: slot.teacherId,
      responsibility: "Teacher",
      sessionId: session.id,
    });

    if ("resourceId" in slot && slot.resourceId) {
      await service.assignResourceToSession({
        id: `ra-${session.id}-${slot.resourceId}`,
        resourceId: slot.resourceId,
        sessionId: session.id,
      });
    }
  }

  await service.recordSessionProgress({
    id: SEED_SESSION_PROGRESS.id,
    classSubjectMatterId: SEED_SESSION_PROGRESS.classSubjectMatterId,
    sessionId: SEED_SESSION_PROGRESS.sessionId,
    completedPercentage: SEED_SESSION_PROGRESS.completedPercentage,
    notes: SEED_SESSION_PROGRESS.notes,
    recordedAt: parseSeedDateTime(planningSessionDate("Mon"), "09:00"),
  });

  const assessmentKindBySeed = {
    quiz: AssessmentKind.Quiz,
    homework: AssessmentKind.Homework,
    project: AssessmentKind.Project,
    other: AssessmentKind.Other,
  } as const;

  let assessmentResultCount = 0;

  for (const assessment of SEED_ASSESSMENTS) {
    await service.createAssessment({
      id: assessment.id,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
      periodId: seedPeriodIdForDate(assessment.date),
      title: assessment.title,
      kind: assessmentKindBySeed[assessment.kind],
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      date: parseSeedDate(assessment.date),
    });

    const scores = SEED_ASSESSMENT_RESULT_SCORES[assessment.id] ?? {};
    for (const [studentId, score] of Object.entries(scores)) {
      await service.recordAssessmentResult({
        id: `ar-${assessment.id}-${studentId}`,
        assessmentId: assessment.id,
        studentId,
        score,
      });
      assessmentResultCount += 1;
    }
  }

  const calendarKindByMock = {
    holiday: CalendarEventKind.Holiday,
    vacation: CalendarEventKind.Break,
    closure: CalendarEventKind.Other,
    ceremony: CalendarEventKind.Event,
  } as const;

  let calendarEventCount = 0;

  for (const event of SEED_CALENDAR_EVENTS) {
    const isNonSchoolDay = event.mockType === "holiday"
      || event.mockType === "vacation"
      || event.mockType === "closure";

    if (event.scope === "all") {
      await service.createCalendarEvent({
        id: event.id,
        schoolId: SEED_SCHOOL_ID,
        academicYearId: SEED_ACADEMIC_YEAR_ID,
        title: event.title,
        description: event.description,
        startDate: parseSeedDate(event.startDate),
        endDate: parseSeedDate(event.endDate),
        kind: calendarKindByMock[event.mockType],
        isNonSchoolDay,
        scopeKind: CalendarEventScopeKind.School,
      });
      calendarEventCount += 1;
      continue;
    }

    for (const classGroupId of event.scope) {
      await service.createCalendarEvent({
        id: `${event.id}-${classGroupId}`,
        schoolId: SEED_SCHOOL_ID,
        academicYearId: SEED_ACADEMIC_YEAR_ID,
        title: event.title,
        description: event.description,
        startDate: parseSeedDate(event.startDate),
        endDate: parseSeedDate(event.endDate),
        kind: calendarKindByMock[event.mockType],
        isNonSchoolDay,
        scopeKind: CalendarEventScopeKind.ClassGroup,
        scopeId: classGroupId,
      });
      calendarEventCount += 1;
    }
  }

  for (const incident of SEED_INCIDENTS) {
    await service.recordIncident({
      id: incident.id,
      schoolId: SEED_SCHOOL_ID,
      classGroupId: incident.classGroupId,
      title: incident.title,
      description: incident.description,
      date: parseSeedDate(incident.date),
      kind: incident.kind === "major_infraction"
        ? IncidentKind.MajorInfraction
        : IncidentKind.MinorInfraction,
      reporterId: "st7",
    });
    await service.addStudentInvolvement({
      id: `inv-${incident.id}-${incident.studentId}`,
      incidentId: incident.id,
      studentId: incident.studentId,
      role: IncidentInvolvementRole.Subject,
    });
  }

  for (const absence of SEED_ABSENCE_RECORDS) {
    await service.createSession({
      id: absence.sessionId,
      classGroupId: absence.classGroupId,
      classSubjectId: absence.classSubjectId,
      title: "Absence session",
      kind: SessionKind.Course,
      startsAt: parseSeedDateTime(absence.date, absence.startTime),
      endsAt: parseSeedDateTime(absence.date, absence.endTime),
    });
    await service.recordAttendance({
      id: absence.id,
      studentId: absence.studentId,
      sessionId: absence.sessionId,
      status: AttendanceStatus.Absent,
    });
  }

  for (const profile of SEED_STUDENT_HEALTH_PROFILES) {
    await service.upsertStudentHealthProfile({
      id: profile.id,
      studentId: profile.studentId,
      bloodType: profile.bloodType,
      allergies: joinHealthList(profile.allergies) ?? "Aucune",
      medicalConditions: joinHealthList(profile.chronicConditions) ?? "Aucune",
      medications: joinHealthList(profile.medications),
      clinicalNotes: profile.notes,
      lastVisit: parseSeedDate(profile.lastVisit),
    });
  }

  for (const note of SEED_PEDAGOGICAL_NOTES) {
    await application.repositories.studentNotes.save(new StudentNote({
      id: note.id,
      schoolId: SEED_SCHOOL_ID,
      studentId: note.studentId,
      authorStaffId: note.authorId,
      category: SEED_NOTE_CATEGORY_BY_LABEL[note.category] ?? StudentNoteCategory.Work,
      body: note.content,
      createdAt: parseSeedDate(note.date),
    }));
  }

  const financeReferenceDate = parseSeedDate(SEED_FINANCE_REFERENCE_DATE);
  const reportCardCounts = await seedReportCards(application, service);

  for (const fee of SEED_FEES) {
    await service.createFee({
      id: fee.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      name: fee.name,
      category: fee.category as FeeCategory,
      defaultAmount: fee.defaultAmount,
      currency: SEED_CURRENCY,
      installments: fee.installments.map(installment => ({
        label: installment.label,
        percentage: installment.percentage,
        dueDate: installment.dueDate ? parseSeedDate(installment.dueDate) : undefined,
      })),
    });
  }

  for (const studentFee of SEED_STUDENT_FEES) {
    await service.assignFeeToStudent({
      id: studentFee.id,
      studentId: studentFee.studentId,
      feeId: studentFee.feeId,
      expectedAmount: studentFee.total,
      dueDate: parseSeedDate(studentFee.dueDate),
      referenceDate: financeReferenceDate,
    });
  }

  for (const payment of SEED_PAYMENTS) {
    await service.recordPayment({
      id: payment.id,
      studentFeeId: payment.studentFeeId,
      amount: payment.amount,
      paymentDate: parseSeedDate(payment.paymentDate),
      method: PaymentMethod.BankTransfer,
      referenceDate: financeReferenceDate,
    });
  }

  return {
    status: "seeded",
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    gradeLevels: SEED_GRADE_LEVELS.length,
    classes: SEED_CLASSES.length,
    staff: SEED_STAFF.length,
    students: SEED_STUDENTS.length,
    guardians: SEED_GUARDIANS.length,
    academicPeriods: SEED_ACADEMIC_PERIODS.length,
    subjects: SEED_SUBJECT_CATALOG.length,
    classSubjects: SEED_CLASS_SUBJECTS.length,
    periodDefinitions: SEED_PERIOD_DEFINITIONS.length,
    fees: SEED_FEES.length,
    studentFees: SEED_STUDENT_FEES.length,
    payments: SEED_PAYMENTS.length,
    classSubjectMatters: SEED_CLASS_SUBJECT_MATTERS.length,
    resources: SEED_RESOURCES.length,
    schedules: SEED_PLANNING_SLOTS.length,
    sessions: SEED_PLANNING_SLOTS.length,
    assessments: SEED_ASSESSMENTS.length,
    assessmentResults: assessmentResultCount,
    calendarEvents: calendarEventCount,
    incidents: SEED_INCIDENTS.length,
    attendanceRecords: SEED_ABSENCE_RECORDS.length,
    studentHealthProfiles: SEED_STUDENT_HEALTH_PROFILES.length,
    studentNotes: SEED_PEDAGOGICAL_NOTES.length,
    gradeScales: reportCardCounts.gradeScales,
    reportCardDefinitions: reportCardCounts.definitions,
    reportCardSections: reportCardCounts.sections,
    reportCardResults: reportCardCounts.results,
  };
}
