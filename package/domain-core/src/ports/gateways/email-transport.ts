export interface EmailSendInput {
  to: string
  from: { email: string, name?: string }
  subject: string
  html: string
  text?: string
  idempotencyKey: string
  correlation?: { deliveryId: string, subjectId: string, schoolId: string }
}

export interface EmailTransportPort {
  send: (input: EmailSendInput) => Promise<{ providerMessageId?: string }>
}
