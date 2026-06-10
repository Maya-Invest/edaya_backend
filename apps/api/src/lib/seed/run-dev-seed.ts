import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import {
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASSES,
  SEED_GRADE_LEVELS,
  SEED_GUARDIANS,
  SEED_SCHOOL_ID,
  SEED_STAFF,
  SEED_STUDENTS,
  parseSeedDate,
  splitDisplayName,
} from "@/lib/seed/dataset";
import {
  AcademicPeriodType,
  GradeLevel,
  createSystemActorMetadata,
} from "@edaya/core";

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
  };

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

  await service.registerSchool({
    id: SEED_SCHOOL_ID,
    name: "EDAYA — Campus Central",
    timeZone: "Europe/Paris",
    city: "Paris",
    country: "FR",
  });

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
        isPrimary: true,
        legalGuardian: true,
      });
    }
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
  };
}
