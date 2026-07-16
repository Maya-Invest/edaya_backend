import type { ClassGroupInput, GuardianInput, GuardianStudentLinkInput, SchoolInput, StaffMemberInput, StudentInput } from '@edaya/core'
import type { FixtureDataset } from '../types'
import { DEV_STAFF_CI_NAME_PARTS } from '../../meta/dev-staff-display-names'
import { CI_FIRST_NAMES, CI_LAST_NAMES } from '../bulk/name-pools'

const CI_SCHOOL: SchoolInput = {
  id: 'sch-edaya-central',
  name: 'École Edaya — Cocody',
  timeZone: 'Africa/Abidjan',
  city: 'Abidjan',
  country: 'Côte d\'Ivoire',
}

const STAFF_CI_NAMES = DEV_STAFF_CI_NAME_PARTS

const NARRATIVE_STUDENT_CI_NAMES: Record<string, { firstName: string, lastName: string }> = {
  s1: { firstName: 'Aminata', lastName: 'Koné' },
  s2: { firstName: 'Moussa', lastName: 'Traoré' },
  s3: { firstName: 'Fatou', lastName: 'Diabaté' },
  s4: { firstName: 'Kouadio', lastName: 'Yao' },
  s5: { firstName: 'Mariam', lastName: 'Coulibaly' },
  s6: { firstName: 'Ibrahim', lastName: 'Ouattara' },
  s7: { firstName: 'Adjoua', lastName: 'Bamba' },
  s8: { firstName: 'Seydou', lastName: 'Bamba' },
  s9: { firstName: 'Akissi', lastName: 'N\'Guessan' },
  s10: { firstName: 'Yao', lastName: 'Koffi' },
  s11: { firstName: 'Aïcha', lastName: 'Sanogo' },
  s12: { firstName: 'Kader', lastName: 'Sanogo' },
  s13: { firstName: 'Maimouna', lastName: 'Sanogo' },
  s14: { firstName: 'Affoué', lastName: 'Touré' },
  s15: { firstName: 'Lassina', lastName: 'Touré' },
  s16: { firstName: 'Salimata', lastName: 'Diomandé' },
  s17: { firstName: 'Koffi', lastName: 'Gbé' },
  s18: { firstName: 'Awa', lastName: 'Zongo' },
  s19: { firstName: 'Oumar', lastName: 'Sanogo' },
  s20: { firstName: 'Bintou', lastName: 'Sanogo' },
  s21: { firstName: 'Siaka', lastName: 'Assi' },
  s22: { firstName: 'Fanta', lastName: 'Aka' },
  s23: { firstName: 'Issouf', lastName: 'Aka' },
  s24: { firstName: 'Adama', lastName: 'Kouamé' },
  s25: { firstName: 'Evelyne', lastName: 'Ble' },
  s26: { firstName: 'Souleymane', lastName: 'Ble' },
  s27: { firstName: 'Kadiatou', lastName: 'Gnahoré' },
  s28: { firstName: 'Mamadou', lastName: 'Doumbia' },
  s29: { firstName: 'Aya', lastName: 'Fofana' },
  s30: { firstName: 'Seydou', lastName: 'Camara' },
}

const NARRATIVE_GUARDIAN_CI_NAMES: Record<string, { firstName: string, lastName: string }> = {
  g1: { firstName: 'Mariam', lastName: 'Koné' },
  g2: { firstName: 'Issouf', lastName: 'Traoré' },
  g3: { firstName: 'Salimata', lastName: 'Diabaté' },
  g4: { firstName: 'Koffi', lastName: 'Yao' },
  g5: { firstName: 'Awa', lastName: 'Coulibaly' },
  g6: { firstName: 'Oumar', lastName: 'Ouattara' },
  g7: { firstName: 'Affoué', lastName: 'Bamba' },
  g8: { firstName: 'Fatou', lastName: 'Sanogo' },
  g9: { firstName: 'Akissi', lastName: 'N\'Guessan' },
  g10: { firstName: 'Lassina', lastName: 'Touré' },
  g11: { firstName: 'Maimouna', lastName: 'Diomandé' },
  g12: { firstName: 'Siaka', lastName: 'Gbé' },
  g13: { firstName: 'Kadiatou', lastName: 'Zongo' },
  g14: { firstName: 'Moussa', lastName: 'Sanogo' },
  g15: { firstName: 'Ibrahim', lastName: 'Assi' },
  g16: { firstName: 'Salimata', lastName: 'Aka' },
  g17: { firstName: 'Koffi', lastName: 'Kouamé' },
  g18: { firstName: 'Aminata', lastName: 'Ble' },
  g19: { firstName: 'Souleymane', lastName: 'Gnahoré' },
  g20: { firstName: 'Mariam', lastName: 'Doumbia' },
  g21: { firstName: 'Fanta', lastName: 'Fofana' },
}

function localizeClassGroupName(name: string): string {
  return name
    .replace(/\b6th\b/g, '6ème')
    .replace(/\b5th\b/g, '5ème')
    .replace(/\b4th\b/g, '4ème')
    .replace(/\b3rd\b/g, '3ème')
    .replace(/\b2nd\b/g, '2nde')
    .replace(/\b1st\b/g, '1ère')
    .replace(/\bTerm\b/g, 'Terminale')
    .replace(/\bBulk\b/g, 'Groupe')
}

function localizePhone(phone: string | null | undefined, index: number): string | undefined {
  if (!phone) {
    return phone ?? undefined
  }
  const suffix = String(10_000_000 + (index * 1_234_567) % 90_000_000).slice(-8)
  const formatted = `${suffix.slice(0, 2)} ${suffix.slice(2, 4)} ${suffix.slice(4, 6)} ${suffix.slice(6, 8)}`
  return `+225 07 ${formatted}`
}

function localizeRelationship(relationship: string): string {
  switch (relationship) {
    case 'mother':
      return 'Mère'
    case 'father':
      return 'Père'
    case 'parent':
      return 'Parent'
    default:
      return relationship
  }
}

function localizeStudent(student: StudentInput): StudentInput {
  const localized = NARRATIVE_STUDENT_CI_NAMES[student.id]
  if (localized) {
    return { ...student, firstName: localized.firstName, lastName: localized.lastName }
  }

  const studentNumber = Number.parseInt(student.id.slice(1), 10)
  const firstName = CI_FIRST_NAMES[studentNumber % CI_FIRST_NAMES.length]!
  const lastName = CI_LAST_NAMES[(studentNumber + 7) % CI_LAST_NAMES.length]!
  return { ...student, firstName, lastName }
}

function localizeGuardian(guardian: GuardianInput, index: number): GuardianInput {
  const localized = NARRATIVE_GUARDIAN_CI_NAMES[guardian.id]
  if (localized) {
    return {
      ...guardian,
      firstName: localized.firstName,
      lastName: localized.lastName,
      phone: localizePhone(guardian.phone, index),
    }
  }

  const guardianNumber = Number.parseInt(guardian.id.slice(1), 10)
  const firstName = CI_FIRST_NAMES[(guardianNumber + 3) % CI_FIRST_NAMES.length]!
  const lastName = CI_LAST_NAMES[guardianNumber % CI_LAST_NAMES.length]!
  return {
    ...guardian,
    firstName,
    lastName,
    phone: localizePhone(guardian.phone, index),
  }
}

function localizeStaffMember(staff: StaffMemberInput): StaffMemberInput {
  const localized = STAFF_CI_NAMES[staff.id as keyof typeof STAFF_CI_NAMES]
  if (!localized) {
    return staff
  }
  return { ...staff, firstName: localized.firstName, lastName: localized.lastName }
}

/** Applies Ivorian display names and Abidjan school metadata while preserving ids and auth emails. */
export function localizeDemoDatasetForCi(demo: FixtureDataset<'demo'>): FixtureDataset<'demo'> {
  return {
    ...demo,
    entities: {
      ...demo.entities,
      school: { ...demo.entities.school, ...CI_SCHOOL },
      students: demo.entities.students?.map(localizeStudent),
      guardians: demo.entities.guardians?.map((guardian, index) => localizeGuardian(guardian, index)),
      staffMembers: demo.entities.staffMembers?.map(localizeStaffMember),
      classGroups: demo.entities.classGroups?.map((classGroup: ClassGroupInput) => ({
        ...classGroup,
        name: localizeClassGroupName(classGroup.name),
      })),
      guardianLinks: demo.entities.guardianLinks?.map((link: GuardianStudentLinkInput) => ({
        ...link,
        relationship: localizeRelationship(link.relationship ?? ''),
      })),
    },
  }
}
