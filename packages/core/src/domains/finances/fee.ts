import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { Money } from '../../value_object/money'
import { requireNonBlank, requireNonNegativeInt, requirePositiveNumber, requireValidDate, roundTo2 } from '../utils'

export interface FeeInstallmentTemplate {
  label: string
  percentage: number // e.g., 50 for 50%
  dueDate?: Date | null
}

export enum FeeCategory {
  Tuition = 'tuition',
  Uniform = 'uniform',
  Transport = 'transport',
  Other = 'other',
}

export interface FeeArgs {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  category?: FeeCategory
  description?: string | null
  defaultAmount: number
  currency: string
  installments?: readonly FeeInstallmentTemplate[]
  createdAt?: Date
}

/**
 * Defines a global fee for the school (e.g., "Tuition 2026").
 * Scoped to an academic year. Optionally defines an installment plan.
 */
export class Fee {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly name: string
  readonly category: FeeCategory
  readonly description?: string
  readonly defaultAmount: Money
  readonly installments: readonly FeeInstallmentTemplate[]
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    name,
    category = FeeCategory.Tuition,
    description,
    defaultAmount,
    currency,
    installments = [],
    createdAt,
  }: FeeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.name = requireNonBlank(name, 'name')
    this.category = category

    if (description != null && description.trim() !== '') {
      this.description = description.trim()
    }

    this.defaultAmount = new Money({
      amount: requireNonNegativeInt(defaultAmount, 'defaultAmount'),
      currency: requireNonBlank(currency, 'currency'),
    })

    this.installments = Object.freeze(
      installments.map((inst) => {
        requireNonBlank(inst.label, 'installment.label')
        requirePositiveNumber(inst.percentage, 'installment.percentage')
        return {
          label: inst.label,
          percentage: inst.percentage,
          dueDate: inst.dueDate ? requireValidDate(inst.dueDate, 'installment.dueDate') : undefined,
        }
      }),
    )
    if (this.installments.length > 0) {
      const percentageTotal = roundTo2(this.installments.reduce((sum, installment) => sum + installment.percentage, 0))
      if (percentageTotal !== 100) {
        throw new Error('installment percentages must total 100')
      }
    }

    this.createdAt = createdAt ?? new Date()
  }
}

export const feeConfig: EntityConfigFactory<Fee> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.fees,
    Permission.FINANCIAL_CONFIG_READ,
    Permission.FINANCIAL_CONFIG_CONFIGURE,
    readByIds((actor, ids) => input.policy.checkFeeAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateFeeSave,
      preDelete: validateFeeDelete,
    },
  }
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
