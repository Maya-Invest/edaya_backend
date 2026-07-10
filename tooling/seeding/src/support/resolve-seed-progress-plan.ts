export function resolveSchoolSeedPhaseLabels(skipProfilePhotos: boolean): readonly string[] {
  const phases = [
    'School structure',
    'Students & guardians',
    'Curriculum',
    'Teachers',
    'Activities',
    'Scheduling',
    'Assessments',
    'School life',
    'Discipline',
    'Attendance',
    'Student support',
    'Report cards',
    'Finance',
    'Communications',
    'Attachments',
  ]

  if (!skipProfilePhotos) {
    phases.push('Profile photos')
  }

  return phases
}

export function resolveFreshBootstrapPhaseLabels(skipProfilePhotos: boolean): readonly string[] {
  return [
    'Auth accounts',
    'Session bootstrap',
    'Access roles',
    'Service account',
    ...resolveSchoolSeedPhaseLabels(skipProfilePhotos),
    'Access assignments',
  ]
}

export function resolveAllSeedPhaseLabels(
  skipProfilePhotos: boolean,
  options?: { skipAuth?: boolean },
): readonly string[] {
  if (options?.skipAuth) {
    return [
      ...resolveSchoolSeedPhaseLabels(skipProfilePhotos),
      'Access assignments',
    ]
  }

  return [
    'Auth accounts',
    ...resolveSchoolSeedPhaseLabels(skipProfilePhotos),
    'Access assignments',
  ]
}

export function resolveSeedPhaseLabels(
  scope: string,
  skipProfilePhotos: boolean,
  options?: { freshBootstrap?: boolean, skipAuth?: boolean },
): readonly string[] {
  if (options?.freshBootstrap) {
    return resolveFreshBootstrapPhaseLabels(skipProfilePhotos)
  }

  switch (scope) {
    case 'school':
      return resolveSchoolSeedPhaseLabels(skipProfilePhotos)
    case 'auth':
      return ['Auth accounts']
    case 'auth:link':
      return ['Auth linking']
    case 'access':
      return ['Access assignments']
    case 'profile-pictures':
      return ['Profile photos']
    case 'service-account':
      return ['Service account']
    case 'validate':
      return ['Validation']
    case 'doctor':
      return ['Doctor']
    case 'all':
      return resolveAllSeedPhaseLabels(skipProfilePhotos, options)
    default:
      return ['Seeding']
  }
}
