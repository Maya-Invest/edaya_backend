import { demoExtendedAuthGuardians, demoPopulationAuthGuardians } from '../datasets/demo/people'
import {
  DEV_GUARDIAN_CI_DISPLAY_NAMES,
  DEV_STAFF_CI_DISPLAY_NAMES,
} from './dev-staff-display-names'

export const DEV_AUTH_PASSWORD = 'DevPassword1!'

export const DEV_AUTH_STAFF_ACCOUNTS = [
  { staffId: 'st8', email: 'k.yann@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st8 },
  { staffId: 'st5', email: 'c.moreau@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st5 },
  { staffId: 'st3', email: 'm.leon@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st3 },
  { staffId: 'st7', email: 't.evrard@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st7 },
] as const

export const DEV_AUTH_TEACHER_ACCOUNTS = [
  { teacherId: 't1', email: 'm.dupont@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st1 },
  { teacherId: 't2', email: 'm.garnier@school.edu', name: DEV_STAFF_CI_DISPLAY_NAMES.st2 },
] as const

export const DEV_AUTH_STAFF_ACCESS_ROLE_IDS: Record<
  (typeof DEV_AUTH_STAFF_ACCOUNTS)[number]['staffId'],
  string
> = {
  st8: 'role-director',
  st5: 'role-director',
  st3: 'role-coordinator',
  st7: 'role-educator',
}

export const DEV_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: 'g1', email: 'c.laurent@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g1 },
  { guardianId: 'g2', email: 'j.bennett@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g2 },
  { guardianId: 'g3', email: 'a.okafor@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g3 },
  { guardianId: 'g4', email: 'l.marchetti@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g4 },
  { guardianId: 'g5', email: 'h.tanaka@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g5 },
  { guardianId: 'g6', email: 'm.reyes@mail.com', name: DEV_GUARDIAN_CI_DISPLAY_NAMES.g6 },
  ...demoExtendedAuthGuardians,
  ...demoPopulationAuthGuardians,
] as const

export const MINIMAL_AUTH_FIXTURE_STAFF_ID = DEV_AUTH_STAFF_ACCOUNTS[0].staffId

export const MINIMAL_AUTH_FIXTURE_STAFF_EMAIL = DEV_AUTH_STAFF_ACCOUNTS[0].email

export const MINIMAL_AUTH_FIXTURE_GUARDIAN_ID = DEV_AUTH_GUARDIAN_ACCOUNTS[0].guardianId
