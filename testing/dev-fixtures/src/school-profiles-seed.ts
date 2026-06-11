/** School profiles for multi-school UI demo. Only Campus Central is fully seeded in PGLite. */
export const SEED_SCHOOL_PROFILES = [
  {
    id: 'sch-edaya-central',
    name: 'EDAYA — Campus Central',
    shortName: 'Campus Central',
    city: 'Paris',
    timeZone: 'Europe/Paris',
  },
  {
    id: 'sch-edaya-nord',
    name: 'EDAYA — Campus Nord',
    shortName: 'Campus Nord',
    city: 'Lille',
    timeZone: 'Europe/Paris',
  },
] as const
