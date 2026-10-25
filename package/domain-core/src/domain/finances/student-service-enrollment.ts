import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'
import {
  CATALOG_BILLING_KIND_ONE_TIME,
  catalogInstallmentTemplateSchema,
  CatalogServiceCategory,
  oneTimeBillingTermsSchema,
} from './catalog-service'

export enum ServiceEnrollmentStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}

export enum ServiceEnrollmentSource {
  Staff = 'staff',
  Automatic = 'automatic',
}

export const acceptedServiceTermsSchema = z.object({
  catalogServiceId: z.string().trim().min(1, 'acceptedTerms.catalogServiceId must not be blank'),
  name: z.string().trim().min(1, 'acceptedTerms.name must not be blank'),
  category: z.nativeEnum(CatalogServiceCategory),
  currency: z.string().trim().min(1, 'acceptedTerms.currency must not be blank'),
  price: z.number().int().nonnegative('acceptedTerms.price must be a non-negative integer'),
  billingKind: z.literal(CATALOG_BILLING_KIND_ONE_TIME),
  billingTerms: oneTimeBillingTermsSchema,
  installmentTemplates: z.array(catalogInstallmentTemplateSchema).default([]),
})
export type AcceptedServiceTerms = z.infer<typeof acceptedServiceTermsSchema>

export const studentServiceEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  catalogServiceId: z.string().trim().min(1, 'catalogServiceId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  status: z.nativeEnum(ServiceEnrollmentStatus).default(ServiceEnrollmentStatus.Active),
  source: z.nativeEnum(ServiceEnrollmentSource).default(ServiceEnrollmentSource.Staff),
  automation: z.object({
    runId: z.string().min(1),
    trigger: z.string().min(1),
    triggeredById: z.string().min(1),
    configurationRevision: z.string().min(1),
  }).nullable().optional().transform(v => v ?? undefined),
  acceptedTerms: acceptedServiceTermsSchema,
  enrolledAt: zodDate().default(() => new Date()),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  cancellationReason: z.string().trim().min(1, 'cancellationReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledById: z.string().trim().min(1, 'cancelledById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineEnrollment(data: any, ctx: z.RefinementCtx) {
  if ((data.source === ServiceEnrollmentSource.Automatic) !== Boolean(data.automation))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Automatic assignments require automation provenance' })
  if (data.acceptedTerms.catalogServiceId !== data.catalogServiceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'acceptedTerms.catalogServiceId must match catalogServiceId',
      path: ['acceptedTerms', 'catalogServiceId'],
    })
  }
  if (data.status === ServiceEnrollmentStatus.Cancelled && (!data.cancelledAt || !data.cancelledById || !data.cancellationReason)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancellation reason, actor, and date are required for cancelled enrollments',
    })
  }
  if (data.status !== ServiceEnrollmentStatus.Cancelled && (data.cancelledAt || data.cancelledById || data.cancellationReason)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'active enrollments must not define cancellation audit fields',
    })
  }
}

export const studentServiceEnrollmentSchema = studentServiceEnrollmentBaseSchema.superRefine(refineEnrollment)

export type StudentServiceEnrollmentData = Omit<z.infer<typeof studentServiceEnrollmentSchema>, 'acceptedTerms'> & {
  acceptedTerms: AcceptedServiceTerms & { priceMoney: Money }
}
export type StudentServiceEnrollmentInput = z.input<typeof studentServiceEnrollmentSchema>

export const studentServiceEnrollmentCreateSchema = studentServiceEnrollmentBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineEnrollment)
export const studentServiceEnrollmentUpdateSchema = studentServiceEnrollmentBaseSchema.partial().required({ id: true })

export class StudentServiceEnrollment {
  readonly data: StudentServiceEnrollmentData

  constructor(args: StudentServiceEnrollmentInput) {
    const validated = parseDomain(studentServiceEnrollmentSchema, args)
    this.data = {
      ...validated,
      acceptedTerms: {
        ...validated.acceptedTerms,
        priceMoney: new Money({ amount: validated.acceptedTerms.price, currency: validated.acceptedTerms.currency }),
      },
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get catalogServiceId() { return this.data.catalogServiceId }
  get academicYearId() { return this.data.academicYearId }
  get status() { return this.data.status }
  get source() { return this.data.source }
  get automation() { return this.data.automation }
  get acceptedTerms() { return this.data.acceptedTerms }
  get enrolledAt() { return this.data.enrolledAt }
  get cancelledAt() { return this.data.cancelledAt }
  get cancellationReason() { return this.data.cancellationReason }
  get cancelledById() { return this.data.cancelledById }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get isActive() {
    return this.status === ServiceEnrollmentStatus.Active
  }

  copyWith(changes: Partial<StudentServiceEnrollmentInput>): StudentServiceEnrollment {
    return new StudentServiceEnrollment({
      id: this.id,
      schoolId: this.schoolId,
      studentId: this.studentId,
      catalogServiceId: this.catalogServiceId,
      academicYearId: this.academicYearId,
      status: this.status,
      source: this.source,
      automation: this.automation,
      acceptedTerms: {
        catalogServiceId: this.acceptedTerms.catalogServiceId,
        name: this.acceptedTerms.name,
        category: this.acceptedTerms.category,
        currency: this.acceptedTerms.currency,
        price: this.acceptedTerms.price,
        billingKind: this.acceptedTerms.billingKind,
        billingTerms: this.acceptedTerms.billingTerms,
        installmentTemplates: [...this.acceptedTerms.installmentTemplates],
      },
      enrolledAt: this.enrolledAt,
      cancelledAt: this.cancelledAt,
      cancellationReason: this.cancellationReason,
      cancelledById: this.cancelledById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}
