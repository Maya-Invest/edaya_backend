export function resolveSchoolSeedPhaseLabels(
  skipProfilePhotos: boolean,
  skipAttachments = false,
): readonly string[] {
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
  ]

  if (!skipAttachments) {
    phases.push('Attachments')
  }

  if (!skipProfilePhotos) {
    phases.push('Profile photos')
  }

  return phases
}

export function resolveFreshBootstrapPhaseLabels(
  skipProfilePhotos: boolean,
  skipAttachments = false,
): readonly string[] {
  return [
    'Auth accounts',
    'Session bootstrap',
    'Access roles',
    'Service account',
    ...resolveSchoolSeedPhaseLabels(skipProfilePhotos, skipAttachments),
    'Access assignments',
    'Children AI S2S',
  ]
}

export function resolveAllSeedPhaseLabels(
  skipProfilePhotos: boolean,
  options?: { skipAuth?: boolean, skipAttachments?: boolean },
): readonly string[] {
  const skipAttachments = options?.skipAttachments ?? false
  if (options?.skipAuth) {
    return [
      ...resolveSchoolSeedPhaseLabels(skipProfilePhotos, skipAttachments),
      'Access assignments',
      'Children AI S2S',
    ]
  }

  return [
    'Auth accounts',
    ...resolveSchoolSeedPhaseLabels(skipProfilePhotos, skipAttachments),
    'Access assignments',
    'Children AI S2S',
  ]
}

export function resolveSeedPhaseLabels(
  scope: string,
  skipProfilePhotos: boolean,
  options?: { freshBootstrap?: boolean, skipAuth?: boolean, skipAttachments?: boolean },
): readonly string[] {
  const skipAttachments = options?.skipAttachments ?? false
  if (options?.freshBootstrap) {
    return resolveFreshBootstrapPhaseLabels(skipProfilePhotos, skipAttachments)
  }

  switch (scope) {
    case 'school':
      return resolveSchoolSeedPhaseLabels(skipProfilePhotos, skipAttachments)
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
    case 's2s-clients':
      return ['Children AI S2S']
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
