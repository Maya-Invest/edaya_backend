import { demoExtendedAuthGuardians, demoPopulationAuthGuardians } from '../datasets/demo/people'

export const DEV_AUTH_PASSWORD = 'DevPassword1!'

export const DEV_AUTH_STAFF_ACCOUNTS = [
  { staffId: 'st8', email: 'k.yann@school.edu', name: 'Koussi Yann' },
  { staffId: 'st5', email: 'c.moreau@school.edu', name: 'Camille Moreau' },
  { staffId: 'st1', email: 'm.dupont@school.edu', name: 'Mme Dupont' },
  { staffId: 'st2', email: 'm.garnier@school.edu', name: 'M. Garnier' },
  { staffId: 'st3', email: 'm.leon@school.edu', name: 'Mme Léon' },
  { staffId: 'st7', email: 't.evrard@school.edu', name: 'Tom Évrard' },
] as const

export const DEV_AUTH_STAFF_ACCESS_ROLE_IDS: Record<
  (typeof DEV_AUTH_STAFF_ACCOUNTS)[number]['staffId'],
  string
> = {
  st8: 'role-director',
  st5: 'role-director',
  st1: 'role-teacher',
  st2: 'role-teacher',
  st3: 'role-coordinator',
  st7: 'role-educator',
}

export const DEV_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: 'g1', email: 'c.laurent@mail.com', name: 'Claire Laurent' },
  { guardianId: 'g2', email: 'j.bennett@mail.com', name: 'James Bennett' },
  { guardianId: 'g3', email: 'a.okafor@mail.com', name: 'Adaeze Okafor' },
  { guardianId: 'g4', email: 'l.marchetti@mail.com', name: 'Luca Marchetti' },
  { guardianId: 'g5', email: 'h.tanaka@mail.com', name: 'Hana Tanaka' },
  { guardianId: 'g6', email: 'm.reyes@mail.com', name: 'Marco Reyes' },
  ...demoExtendedAuthGuardians,
  ...demoPopulationAuthGuardians,
] as const

export const MINIMAL_AUTH_FIXTURE_STAFF_ID = DEV_AUTH_STAFF_ACCOUNTS[0].staffId

export const MINIMAL_AUTH_FIXTURE_STAFF_EMAIL = DEV_AUTH_STAFF_ACCOUNTS[0].email

export const MINIMAL_AUTH_FIXTURE_GUARDIAN_ID = DEV_AUTH_GUARDIAN_ACCOUNTS[0].guardianId
