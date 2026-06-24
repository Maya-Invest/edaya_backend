import { SEED_GUARDIANS, SEED_SCHOOL_ID, SEED_STAFF, SEED_STUDENTS } from './dataset'

export type SeedAnnouncementStatus = 'draft' | 'published' | 'archived'
export type SeedAnnouncementPriority = 'normal' | 'important' | 'urgent'

export interface SeedAnnouncement {
  id: string
  schoolId: string
  title: string
  content: string
  createdBy: string
  status: SeedAnnouncementStatus
  priority?: SeedAnnouncementPriority
  premiumNotification?: boolean
  createdAt: string
  publishedAt?: string
  expiresAt?: string
}

export type SeedAnnouncementTargetKind
  = | 'school'
    | 'all_staff'
    | 'all_guardians'
    | 'all_students'
    | 'class_group'
    | 'grade_level'
    | 'staff_member'
    | 'guardian'
    | 'student'

export interface SeedAnnouncementTarget {
  id: string
  announcementId: string
  targetKind: SeedAnnouncementTargetKind
  targetId?: string
}

export type SeedMessageDeliveryRecipientKind = 'staff' | 'guardian' | 'student'
export type SeedMessageDeliveryStatus = 'pending' | 'sent' | 'failed' | 'read' | 'cancelled'

export interface SeedMessageDelivery {
  id: string
  announcementId: string
  subjectId: string
  recipientKind: SeedMessageDeliveryRecipientKind
  recipientId: string
  status: SeedMessageDeliveryStatus
  sentAt?: string
  readAt?: string
  failureReason?: string
}

/** Published announcements that need an extra materialize pass after publish (idempotent). */
export const SEED_ANNOUNCEMENT_MATERIALIZE_PLANS: readonly { announcementId: string }[] = [
  { announcementId: 'ann-rentree' },
  { announcementId: 'ann-sports-day' },
  { announcementId: 'ann-staff-training' },
] as const

/** School communications across the year — mix of published and draft. */
export const SEED_ANNOUNCEMENTS: readonly SeedAnnouncement[] = [
  {
    id: 'ann-rentree',
    schoolId: SEED_SCHOOL_ID,
    title: 'Rentrée scolaire 2025',
    content: 'La rentrée des classes aura lieu le lundi 1er septembre à 8h30. Merci de vérifier les fournitures listées sur Pronote.',
    createdBy: 'st5',
    status: 'published',
    priority: 'important',
    createdAt: '2025-08-25',
    publishedAt: '2025-08-25',
  },
  {
    id: 'ann-parent-meeting',
    schoolId: SEED_SCHOOL_ID,
    title: 'Réunion parents-professeurs — 6ème A',
    content: 'La réunion parents-professeurs de la classe de 6ème A se tiendra le jeudi 6 février à 18h00 en salle polyvalente.',
    createdBy: 'st3',
    status: 'published',
    priority: 'normal',
    createdAt: '2026-01-28',
    publishedAt: '2026-01-28',
  },
  {
    id: 'ann-sports-day',
    schoolId: SEED_SCHOOL_ID,
    title: 'Journée sportive inter-classes',
    content: 'La journée sportive annuelle aura lieu le vendredi 16 mai. Tenue de sport obligatoire.',
    createdBy: 'st5',
    status: 'published',
    priority: 'normal',
    createdAt: '2026-05-02',
    publishedAt: '2026-05-02',
    expiresAt: '2026-05-17',
  },
  {
    id: 'ann-staff-training',
    schoolId: SEED_SCHOOL_ID,
    title: 'Formation numérique — enseignants',
    content: 'Session obligatoire sur les outils pédagogiques numériques le mardi 14 janvier de 16h à 18h.',
    createdBy: 'st5',
    status: 'published',
    priority: 'important',
    premiumNotification: true,
    createdAt: '2026-01-06',
    publishedAt: '2026-01-06',
  },
  {
    id: 'ann-draft-fete',
    schoolId: SEED_SCHOOL_ID,
    title: 'Fête de fin d\'année (brouillon)',
    content: 'Programme provisoire de la fête de fin d\'année — à valider par le conseil d\'établissement.',
    createdBy: 'st5',
    status: 'draft',
    priority: 'normal',
    createdAt: '2026-06-10',
  },
] as const

export const SEED_ANNOUNCEMENT_TARGETS: readonly SeedAnnouncementTarget[] = [
  { id: 'at-rentree-guardians', announcementId: 'ann-rentree', targetKind: 'all_guardians' },
  { id: 'at-parent-meeting-6a', announcementId: 'ann-parent-meeting', targetKind: 'class_group', targetId: '6a' },
  { id: 'at-sports-students', announcementId: 'ann-sports-day', targetKind: 'all_students' },
  { id: 'at-staff-training', announcementId: 'ann-staff-training', targetKind: 'all_staff' },
  { id: 'at-draft-school', announcementId: 'ann-draft-fete', targetKind: 'school' },
] as const

/** Explicit delivery records with varied statuses for parent-meeting announcement. */
export const SEED_MESSAGE_DELIVERIES: readonly SeedMessageDelivery[] = [
  {
    id: 'md-parent-g1-read',
    announcementId: 'ann-parent-meeting',
    subjectId: 'subject-g1',
    recipientKind: 'guardian',
    recipientId: 'g1',
    status: 'read',
    sentAt: '2026-01-28T18:05:00',
    readAt: '2026-01-28T19:12:00',
  },
  {
    id: 'md-parent-g2-sent',
    announcementId: 'ann-parent-meeting',
    subjectId: 'subject-g2',
    recipientKind: 'guardian',
    recipientId: 'g2',
    status: 'sent',
    sentAt: '2026-01-28T18:05:00',
  },
  {
    id: 'md-parent-g3-pending',
    announcementId: 'ann-parent-meeting',
    subjectId: 'subject-g3',
    recipientKind: 'guardian',
    recipientId: 'g3',
    status: 'pending',
  },
  {
    id: 'md-parent-st3-read',
    announcementId: 'ann-parent-meeting',
    subjectId: 'subject-s3',
    recipientKind: 'student',
    recipientId: 's3',
    status: 'read',
    sentAt: '2026-01-28T18:10:00',
    readAt: '2026-01-29T07:45:00',
  },
] as const

export function countSeedAnnouncements(): number {
  return SEED_ANNOUNCEMENTS.length
}

export function countSeedAnnouncementTargets(): number {
  return SEED_ANNOUNCEMENT_TARGETS.length
}

export function countSeedExplicitMessageDeliveries(): number {
  return SEED_MESSAGE_DELIVERIES.length
}

/** Minimum deliveries after materialize plans run (explicit + materialized audiences). */
export function countSeedMessageDeliveriesMinimum(): number {
  const guardianCount = SEED_GUARDIANS.length
  const staffCount = SEED_STAFF.length
  let materialized = 0
  for (const plan of SEED_ANNOUNCEMENT_MATERIALIZE_PLANS) {
    if (plan.announcementId === 'ann-rentree') {
      materialized += guardianCount
    }
    else if (plan.announcementId === 'ann-sports-day') {
      materialized += SEED_STUDENTS.length
    }
    else if (plan.announcementId === 'ann-staff-training') {
      materialized += staffCount
    }
  }
  return countSeedExplicitMessageDeliveries() + materialized
}
