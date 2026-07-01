import { SEED_SCHOOL_ID } from '../core'

export type SeedAttachmentOwnerKind
  = | 'student_health_profile'
    | 'incident'
    | 'student'
    | 'guardian'
    | 'report_card'
    | 'payment'
    | 'attendance_record'
    | 'assessment_result'
    | 'student_enrollment'
    | 'applied_disciplinary_action'

export interface SeedAttachment {
  id: string
  schoolId: string
  ownerKind: SeedAttachmentOwnerKind
  ownerId: string
  fileName: string
  fileUrl: string
  mimeType?: string
  sizeBytes?: number
  uploadedById?: string
  createdAt: string
}

const DEV_CDN_BASE = 'https://cdn.example.dev/edaya-central'

/** Files attached to domain entities across school life, academics, and finance. */
export const SEED_ATTACHMENTS: readonly SeedAttachment[] = [
  {
    id: 'att-i2-photo',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'incident',
    ownerId: 'i2',
    fileName: 'classroom_disruption.jpg',
    fileUrl: `${DEV_CDN_BASE}/incidents/i2-photo.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 245_760,
    uploadedById: 'st7',
    createdAt: '2026-03-22',
  },
  {
    id: 'att-hp-s3-plan',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'student_health_profile',
    ownerId: 'hp-s3',
    fileName: 'peanut_allergy_plan.pdf',
    fileUrl: `${DEV_CDN_BASE}/health/hp-s3-allergy-plan.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 128_400,
    uploadedById: 'st5',
    createdAt: '2025-09-10',
  },
  {
    id: 'att-sda-i2',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'applied_disciplinary_action',
    ownerId: 'sda-i2-s2',
    fileName: 'parent_acknowledgment.pdf',
    fileUrl: `${DEV_CDN_BASE}/discipline/sda-i2-s2-ack.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 52_300,
    uploadedById: 'st5',
    createdAt: '2026-03-24',
  },
  {
    id: 'att-rcr-s1-t3',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'report_card',
    ownerId: 'rcr-s1-t3',
    fileName: 'bulletin_s1_t3.pdf',
    fileUrl: `${DEV_CDN_BASE}/report-cards/rcr-s1-t3.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 312_000,
    uploadedById: 'st3',
    createdAt: '2026-06-05',
  },
  {
    id: 'att-pay-b1-1',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'payment',
    ownerId: 'pay-b1-1',
    fileName: 'virement_sept_2025.pdf',
    fileUrl: `${DEV_CDN_BASE}/finance/pay-b1-1.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 89_500,
    uploadedById: 'st5',
    createdAt: '2025-09-15',
  },
  {
    id: 'att-ar-e1-s1',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'assessment_result',
    ownerId: 'ar-e1-s1',
    fileName: 'copie_algebra_s1.pdf',
    fileUrl: `${DEV_CDN_BASE}/assessments/ar-e1-s1.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 410_200,
    uploadedById: 'st1',
    createdAt: '2026-04-12',
  },
  {
    id: 'att-att-today-s3',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'attendance_record',
    ownerId: 'att-today-s3',
    fileName: 'justificatif_absence.pdf',
    fileUrl: `${DEV_CDN_BASE}/attendance/att-today-s3.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 67_800,
    uploadedById: 'st3',
    createdAt: '2026-06-16',
  },
  {
    id: 'att-enr-s1',
    schoolId: SEED_SCHOOL_ID,
    ownerKind: 'student_enrollment',
    ownerId: 'enr-s1',
    fileName: 'certificat_scolarite_s1.pdf',
    fileUrl: `${DEV_CDN_BASE}/enrollments/enr-s1.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 95_100,
    uploadedById: 'st5',
    createdAt: '2025-09-01',
  },
] as const

export function countSeedAttachments(): number {
  return SEED_ATTACHMENTS.length
}
