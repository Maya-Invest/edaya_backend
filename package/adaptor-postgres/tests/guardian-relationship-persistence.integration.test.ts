import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GuardianStudentLink, StudentHealthProfile } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'
import { createRepositoryDatabase, installSchemaBeforeTypedGrants, migrationDirectory } from './support/authorization-database'

const migration = readFileSync(resolve(migrationDirectory, '0010_guardian_relationship_details.sql'), 'utf8')

describe('authoritative guardian relationship and health details', () => {
  test('persists both denied notifications and explicit legal, pickup and billing settings', async () => {
    const { db, repositories } = await createRepositoryDatabase()
    try {
      const link = new GuardianStudentLink({ id: 'link', schoolId: 'school', guardianId: 'guardian', studentId: 'student', receivesAcademicReports: false, receivesAttendanceAlerts: false, canPickup: true, legalGuardian: true, isBillingContact: true, emergencyContactPriority: 2, contactRestrictions: 'Use email', notes: 'Recorded by office' })
      await repositories.guardianLinks.save(link)
      expect((await repositories.guardianLinks.findById(link.id))?.data).toEqual(link.data)
      const updated = new GuardianStudentLink({ ...link.data, canPickup: false, isBillingContact: false, legalGuardian: false, receivesAttendanceAlerts: true })
      await repositories.guardianLinks.save(updated)
      expect((await repositories.guardianLinks.findById(link.id))?.data).toEqual(updated.data)
    }
    finally { await db.close() }
  })

  test('persists optional health fields, emergency protocols and update time without inventing values', async () => {
    const { db, repositories } = await createRepositoryDatabase()
    try {
      const profile = new StudentHealthProfile({ id: 'health', schoolId: 'school', studentId: 'student', allergies: 'Peanuts', emergencyProtocols: 'Contact guardian', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01') })
      await repositories.studentHealthProfiles.save(profile)
      expect((await repositories.studentHealthProfiles.findById(profile.id))?.data).toEqual(profile.data)
      const cleared = new StudentHealthProfile({ ...profile.data, allergies: undefined, emergencyProtocols: undefined, updatedAt: new Date('2026-03-01') })
      await repositories.studentHealthProfiles.save(cleared)
      expect((await repositories.studentHealthProfiles.findById(profile.id))?.data).toEqual(cleared.data)
    }
    finally { await db.close() }
  })

  test('deployment migration preserves prior relationship defaults and health data', async () => {
    const db = new PGlite()
    try {
      await installSchemaBeforeTypedGrants(db)
      await db.exec(`INSERT INTO guardian_student_links (id, school_id, guardian_id, student_id, relationship, is_primary, created_at) VALUES ('link', 'school', 'guardian', 'student', 'parent', true, '2026-01-01');
        INSERT INTO student_health_profiles (id, school_id, student_id, allergies, medical_conditions, created_at) VALUES ('health', 'school', 'student', '"Peanuts"', '"Recorded condition"', '2026-01-01');`)
      await db.exec(migration)
      const links = await db.query('SELECT receives_academic_reports, receives_attendance_alerts, can_pickup, is_billing_contact, legal_guardian, is_primary FROM guardian_student_links')
      expect(links.rows[0]).toEqual({ receives_academic_reports: true, receives_attendance_alerts: true, can_pickup: false, is_billing_contact: false, legal_guardian: false, is_primary: true })
      const health = await db.query('SELECT allergies, medical_conditions, created_at = updated_at AS timestamp_preserved FROM student_health_profiles')
      expect(health.rows[0]).toEqual({ allergies: 'Peanuts', medical_conditions: 'Recorded condition', timestamp_preserved: true })
      await db.exec('UPDATE student_health_profiles SET allergies = NULL, medical_conditions = NULL, emergency_protocols = \'Contact guardian\'')
      expect((await db.query('SELECT allergies FROM student_health_profiles')).rows[0]).toEqual({ allergies: null })
    }
    finally { await db.close() }
  })
})
