export const DOCUMENT_TEMPLATE_KEYS = [
  'report-card.v1',
  'logbook.v1',
  'schooling-certificate.v1',
  'enrollment-record.v1',
  'student-id-card.v1',
  'invoice.v1',
  'receipt.v1',
  'settlement-quittance.v1',
  'account-statement.v1',
  'payment-reminder.v1',
  'withdrawal-certificate.v1',
  'annual-transcript.v1',
  'convocation.v1',
  'class-timetable.v1',
  'teacher-timetable.v1',
  'class-roster.v1',
  'attendance-sheet.v1',
  'incident-report.v1',
] as const

export type DocumentTemplateKey = typeof DOCUMENT_TEMPLATE_KEYS[number]

export function isDocumentTemplateKey(value: string): value is DocumentTemplateKey {
  return (DOCUMENT_TEMPLATE_KEYS as readonly string[]).includes(value)
}
