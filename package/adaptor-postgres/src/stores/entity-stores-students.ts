import type { Guardian } from '@edaya/core'
import type { EntityStores } from './entity-stores-types'
import {
  DisciplinaryAction as DisciplinaryActionCtor,
  Guardian as GuardianCtor,
  GuardianStudentLink as GuardianStudentLinkCtor,
  Incident as IncidentCtor,
  StudentClassEnrollment as StudentClassEnrollmentCtor,
  Student as StudentCtor,
  StudentDisciplinaryAction as StudentDisciplinaryActionCtor,
  StudentHealthProfile as StudentHealthProfileCtor,
  StudentIncidentInvolvement as StudentIncidentInvolvementCtor,
  StudentNote as StudentNoteCtor,
} from '@edaya/core'
import { createDefaultMappers, deserializeJsonb } from '../lib/mappers'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'

export function createStudentsEntityStores(db: any): Pick<EntityStores, 'students' | 'enrollments' | 'guardians' | 'guardianLinks' | 'studentNotes' | 'studentHealthProfiles' | 'studentDisciplinaryActions' | 'disciplinaryActions' | 'studentIncidentInvolvements' | 'incidents'> {
  return {
    students: defaultStore(db, schema.students, StudentCtor),

    enrollments: defaultStore(db, schema.studentClassEnrollments, StudentClassEnrollmentCtor),

    guardians: customStore(
      db,
      schema.guardians,
      (entity: Guardian) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        code: entity.code ?? null,
        photoUrl: entity.photoUrl ?? null,
        email: entity.email ?? null,
        phone: entity.phone ?? null,
        notificationEmail: entity.notificationEmail ?? null,
        notificationPhone: entity.notificationPhone ?? null,
        subjectId: entity.subjectId ?? null,
        hasAccess: entity.hasAccess,
        contactMethods: entity.contactMethods.map(method => ({
          type: method.type,
          value: method.value,
          label: method.label,
          isPrimary: method.isPrimary,
          allowsNotifications: method.allowsNotifications,
        })),
        createdAt: entity.createdAt,
      }),
      row => new GuardianCtor({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        code: row.code,
        photoUrl: row.photoUrl,
        email: row.email,
        phone: row.phone,
        notificationEmail: row.notificationEmail,
        notificationPhone: row.notificationPhone,
        subjectId: row.subjectId,
        hasAccess: row.hasAccess,
        contactMethods: deserializeJsonb(row.contactMethods),
        createdAt: row.createdAt,
      }),
    ),

    guardianLinks: defaultStore(db, schema.guardianStudentLinks, GuardianStudentLinkCtor),

    studentNotes: defaultStore(db, schema.studentNotes, StudentNoteCtor),

    studentHealthProfiles: customStore(
      db,
      schema.studentHealthProfiles,
      createDefaultMappers(StudentHealthProfileCtor).toRow,
      row => new StudentHealthProfileCtor({
        id: row.id,
        schoolId: row.schoolId,
        studentId: row.studentId,
        bloodType: row.bloodType,
        allergies: deserializeJsonb(row.allergies),
        medicalConditions: deserializeJsonb(row.medicalConditions),
        medications: row.medications ?? undefined,
        clinicalNotes: row.clinicalNotes ?? undefined,
        lastVisit: row.lastVisit ?? undefined,
        createdAt: row.createdAt,
      }),
    ),

    studentDisciplinaryActions: defaultStore(db, schema.studentDisciplinaryActions, StudentDisciplinaryActionCtor),

    disciplinaryActions: defaultStore(db, schema.disciplinaryActions, DisciplinaryActionCtor),

    studentIncidentInvolvements: defaultStore(db, schema.studentIncidentInvolvements, StudentIncidentInvolvementCtor),

    incidents: defaultStore(db, schema.incidents, IncidentCtor),
  }
}
