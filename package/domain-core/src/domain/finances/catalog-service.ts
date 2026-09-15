import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, roundTo2, zodDate } from '../shared/utils'

export enum CatalogServiceCategory {
  Tuition = 'tuition',
  Transport = 'transport',
  Meals = 'meals',
  Activities = 'activities',
  Materials = 'materials',
  Other = 'other',
}

export enum CatalogEnrollmentMode {
  Mandatory = 'mandatory',
  OptIn = 'opt_in',
}

export enum CatalogServiceStatus {
  Draft = 'draft',
  Active = 'active',
  Archived = 'archived',
}

export const CATALOG_BILLING_KIND_ONE_TIME = 'one_time' as const
export type CatalogBillingKind = typeof CATALOG_BILLING_KIND_ONE_TIME

export const catalogInstallmentTemplateSchema = z.object({
  label: z.string().trim().min(1, 'installment.label must not be blank'),
  percentage: z.number().positive('installment.percentage must be a strictly positive number'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})
export type CatalogInstallmentTemplate = z.infer<typeof catalogInstallmentTemplateSchema>

export const oneTimeBillingTermsSchema = z.object({
  kind: z.literal(CATALOG_BILLING_KIND_ONE_TIME),
  installments: z.array(catalogInstallmentTemplateSchema).default([]),
  singleDueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})
export type OneTimeBillingTerms = z.infer<typeof oneTimeBillingTermsSchema>
export type CatalogBillingTerms = OneTimeBillingTerms

export const catalogServiceBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  category: z.nativeEnum(CatalogServiceCategory).default(CatalogServiceCategory.Tuition),
  enrollmentMode: z.nativeEnum(CatalogEnrollmentMode).default(CatalogEnrollmentMode.Mandatory),
  billingKind: z.literal(CATALOG_BILLING_KIND_ONE_TIME).default(CATALOG_BILLING_KIND_ONE_TIME),
  defaultPrice: z.number().int().nonnegative('defaultPrice must be a non-negative integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  billingTerms: oneTimeBillingTermsSchema,
  status: z.nativeEnum(CatalogServiceStatus).default(CatalogServiceStatus.Draft),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineCatalogService(data: any, ctx: z.RefinementCtx) {
  if (data.billingTerms.kind !== data.billingKind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'billingTerms.kind must match billingKind',
      path: ['billingTerms', 'kind'],
    })
  }
  if (data.billingTerms.installments.length > 0) {
    const percentageTotal = roundTo2(data.billingTerms.installments.reduce((sum: number, inst: { percentage: number }) => sum + inst.percentage, 0))
    if (percentageTotal !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installment percentages must total 100',
        path: ['billingTerms', 'installments'],
      })
    }
  }
}

export const catalogServiceSchema = catalogServiceBaseSchema.superRefine(refineCatalogService)

export type CatalogServiceData = Omit<z.infer<typeof catalogServiceSchema>, 'defaultPrice' | 'currency'> & {
  defaultPrice: Money
}
export type CatalogServiceInput = z.input<typeof catalogServiceSchema>

export const catalogServiceCreateSchema = catalogServiceBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineCatalogService)
export const catalogServiceUpdateSchema = catalogServiceBaseSchema.partial().required({ id: true }).superRefine((data, ctx) => {
  if (data.billingTerms && data.billingKind && data.billingTerms.kind !== data.billingKind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'billingTerms.kind must match billingKind',
      path: ['billingTerms', 'kind'],
    })
  }
  if (data.billingTerms?.installments && data.billingTerms.installments.length > 0) {
    const percentageTotal = roundTo2(data.billingTerms.installments.reduce((sum, inst) => sum + inst.percentage, 0))
    if (percentageTotal !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installment percentages must total 100',
        path: ['billingTerms', 'installments'],
      })
    }
  }
})

export class CatalogService {
  readonly data: CatalogServiceData

  constructor(args: CatalogServiceInput) {
    const validated = parseDomain(catalogServiceSchema, args)
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      academicYearId: validated.academicYearId,
      name: validated.name,
      description: validated.description,
      category: validated.category,
      enrollmentMode: validated.enrollmentMode,
      billingKind: validated.billingKind,
      billingTerms: validated.billingTerms,
      status: validated.status,
      createdAt: validated.createdAt,
      updatedAt: validated.updatedAt,
      defaultPrice: new Money({ amount: validated.defaultPrice, currency: validated.currency }),
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get description() { return this.data.description }
  get category() { return this.data.category }
  get enrollmentMode() { return this.data.enrollmentMode }
  get billingKind() { return this.data.billingKind }
  get defaultPrice() { return this.data.defaultPrice }
  get billingTerms() { return this.data.billingTerms }
  get status() { return this.data.status }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get isActive() {
    return this.status === CatalogServiceStatus.Active
  }

  copyWith(changes: Partial<CatalogServiceInput>): CatalogService {
    return new CatalogService({
      id: this.id,
      schoolId: this.schoolId,
      academicYearId: this.academicYearId,
      name: this.name,
      description: this.description,
      category: this.category,
      enrollmentMode: this.enrollmentMode,
      billingKind: this.billingKind,
      defaultPrice: this.defaultPrice.amount,
      currency: this.defaultPrice.currency,
      billingTerms: this.billingTerms,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}
