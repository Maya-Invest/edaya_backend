/** Class rosters shared across demo-ci domain fixtures. */
export const demoCiClassRosters = {
  'ci-6a': ['ci-s1', 'ci-s2', 'ci-s3', 'ci-s4', 'ci-s5', 'ci-s6'],
  'ci-6b': ['ci-s7', 'ci-s8', 'ci-s9', 'ci-s10', 'ci-s14', 'ci-s15'],
  'ci-5a': ['ci-s11', 'ci-s12', 'ci-s13', 'ci-s16', 'ci-s17', 'ci-s18'],
  'ci-4a': ['ci-s19', 'ci-s20', 'ci-s21', 'ci-s22'],
  'ci-3a': ['ci-s23', 'ci-s24', 'ci-s25', 'ci-s26', 'ci-s27', 'ci-s28', 'ci-s29', 'ci-s30'],
} as const satisfies Record<string, readonly string[]>

export const demoCiAllStudentIds = [
  ...demoCiClassRosters['ci-6a'],
  ...demoCiClassRosters['ci-6b'],
  ...demoCiClassRosters['ci-5a'],
  ...demoCiClassRosters['ci-4a'],
  ...demoCiClassRosters['ci-3a'],
] as const
