export const DEV_CI_AUTH_PASSWORD = 'DevPassword1!'

export const DEV_CI_AUTH_STAFF_ACCOUNTS = [
  { staffId: 'ci-st8', email: 'a.kone@ecole-ci.edaya.dev', name: 'Aminata Koné' },
  { staffId: 'ci-st5', email: 'j.aka@ecole-ci.edaya.dev', name: 'Jean-Baptiste Aka' },
  { staffId: 'ci-st3', email: 'f.assi@ecole-ci.edaya.dev', name: 'Mme Assi' },
  { staffId: 'ci-st7', email: 'm.zongo@ecole-ci.edaya.dev', name: 'Mme Zongo' },
] as const

export const DEV_CI_AUTH_TEACHER_ACCOUNTS = [
  { teacherId: 'ci-t1', email: 'a.toure@ecole-ci.edaya.dev', name: 'Mme Touré' },
  { teacherId: 'ci-t2', email: 'k.diomande@ecole-ci.edaya.dev', name: 'M. Diomandé' },
] as const

export const DEV_CI_AUTH_STAFF_ACCESS_ROLE_IDS: Record<
  (typeof DEV_CI_AUTH_STAFF_ACCOUNTS)[number]['staffId'],
  string
> = {
  'ci-st8': 'role-director',
  'ci-st5': 'role-director',
  'ci-st3': 'role-coordinator',
  'ci-st7': 'role-educator',
}

export const DEV_CI_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: 'ci-g1', email: 'm.kone@mail.ci', name: 'Mariam Koné' },
  { guardianId: 'ci-g2', email: 'i.traore@mail.ci', name: 'Issouf Traoré' },
  { guardianId: 'ci-g3', email: 's.diabate@mail.ci', name: 'Salimata Diabaté' },
  { guardianId: 'ci-g4', email: 'k.yao@mail.ci', name: 'Koffi Yao' },
  { guardianId: 'ci-g5', email: 'a.coulibaly@mail.ci', name: 'Awa Coulibaly' },
  { guardianId: 'ci-g6', email: 'o.ouattara@mail.ci', name: 'Oumar Ouattara' },
] as const

export const MINIMAL_CI_AUTH_FIXTURE_STAFF_ID = DEV_CI_AUTH_STAFF_ACCOUNTS[0].staffId

export const MINIMAL_CI_AUTH_FIXTURE_STAFF_EMAIL = DEV_CI_AUTH_STAFF_ACCOUNTS[0].email
