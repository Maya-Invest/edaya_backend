import { requireNonBlank, requireNonNegativeInt, requireValidDate } from '$lib/core/validation'
import { Money } from '$lib/core/value_object/money'

export interface FeeInstallmentTemplate {
  label: string
  percentage: number // e.g., 50 for 50%
  dueDate?: Date | null
}

export interface FeeArgs {
  id: string
  schoolId: string
  academicYearId: string
  name: string
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
  readonly description?: string
  readonly defaultAmount: Money
  readonly installments: readonly FeeInstallmentTemplate[]
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    name,
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
        requireNonNegativeInt(inst.percentage, 'installment.percentage')
        return {
          label: inst.label,
          percentage: inst.percentage,
          dueDate: inst.dueDate ? requireValidDate(inst.dueDate, 'installment.dueDate') : undefined,
        }
      }),
    )

    this.createdAt = createdAt ?? new Date()
  }
}
