import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import {
  authorizeDeleteByReadAccess,
  authorizeExistingById,
  config,
  directSchoolTenant,
  operationModule,
  read,
  readByIds,
  write,
} from '../../application/entities/entity-config'
import { denyResourceAccess, FinanceOperations } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { Money } from '../../domain/value-objects/money'
import { parseDomain, roundTo2, zodDate } from '../shared/utils'

export enum FeeCategory {
  Tuition = 'tuition',
  Uniform = 'uniform',
  Transport = 'transport',
  Other = 'other',
}

export const feeInstallmentTemplateSchema = z.object({
  label: z.string().trim().min(1, 'installment.label must not be blank'),
  percentage: z.number().positive('installment.percentage must be a strictly positive number'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})
export type FeeInstallmentTemplate = z.infer<typeof feeInstallmentTemplateSchema>

export const feeBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  category: z.nativeEnum(FeeCategory).default(FeeCategory.Tuition),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  defaultAmount: z.number().int().nonnegative('defaultAmount must be a non-negative integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  installments: z.array(feeInstallmentTemplateSchema).default([]),
  createdAt: zodDate().default(() => new Date()),
})

function refineFee(data: any, ctx: z.RefinementCtx) {
  if (data.installments && data.installments.length > 0) {
    const percentageTotal = roundTo2(data.installments.reduce((sum: number, inst: any) => sum + inst.percentage, 0))
    if (percentageTotal !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installment percentages must total 100',
      })
    }
  }
}

export const feeSchema = feeBaseSchema.superRefine(refineFee)

export type FeeData = Omit<z.infer<typeof feeSchema>, 'defaultAmount' | 'currency' | 'installments'> & {
  defaultAmount: Money
  installments: readonly FeeInstallmentTemplate[]
}
export type FeeInput = z.input<typeof feeSchema>

export const feeCreateSchema = feeBaseSchema.omit({ createdAt: true }).superRefine(refineFee)
export const feeUpdateSchema = feeBaseSchema.partial().required({ id: true }).superRefine(refineFee)

/**
 * Defines a global fee for the school (e.g., "Tuition 2026").
 * Scoped to an academic year. Optionally defines an installment plan.
 */
export class Fee {
  readonly data: FeeData

  constructor(args: FeeInput) {
    const validated = parseDomain(feeSchema, args)
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      academicYearId: validated.academicYearId,
      name: validated.name,
      category: validated.category,
      description: validated.description,
      installments: Object.freeze(validated.installments),
      createdAt: validated.createdAt,
      defaultAmount: new Money({
        amount: validated.defaultAmount,
        currency: validated.currency,
      }),
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get category() { return this.data.category }
  get description() { return this.data.description }
  get defaultAmount() { return this.data.defaultAmount }
  get installments() { return this.data.installments }
  get createdAt() { return this.data.createdAt }
}

export const feeConfig: EntityConfigFactory<Fee> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = readByIds((actor, ids) => policy.checkFeeAccess(actor, ids))

  return config({
    repository: repositories.fees,
    tenant: directSchoolTenant(),
    read: read(
      operationModule(FinanceOperations.feeCatalogRead),
      readAccess,
    ),
    write: write(
      operationModule(FinanceOperations.feeConfigure),
      authorizeExistingById(readAccess),
      authorizeDeleteByReadAccess(readAccess),
    ),
    gates: {
      preSave: validateFeeSave,
      preDelete: validateFeeDelete,
    },
    atomicExecution,
  })
}

export async function validateFeeSave(
  fee: Fee,
  _existing: Fee | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [school, academicYear] = await Promise.all([
    repositories.schools.findById(fee.schoolId),
    repositories.academicYears.findById(fee.academicYearId),
  ])
  if (!school || !academicYear || academicYear.schoolId !== fee.schoolId) {
    denyResourceAccess()
  }
}

async function validateFeeDelete(
  fee: Fee,
  repositories: SchoolRepositories,
): Promise<void> {
  const studentFees = await repositories.studentFees.list({ feeId: fee.id })
  if (studentFees.length > 0) {
    throw new BusinessRuleViolationError('FEE_HAS_DEPENDENCIES', `Cannot delete fee ${fee.id}: dependent records still exist`)
  }
}
