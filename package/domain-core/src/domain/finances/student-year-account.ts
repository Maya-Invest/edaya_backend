import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'

export const studentYearAccountBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  availableBalance: z.number().int().nonnegative('availableBalance must be a non-negative integer').default(0),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export const studentYearAccountSchema = studentYearAccountBaseSchema

export type StudentYearAccountData = Omit<z.infer<typeof studentYearAccountSchema>, 'availableBalance' | 'currency'> & {
  availableBalance: Money
}
export type StudentYearAccountInput = z.input<typeof studentYearAccountSchema>

export const studentYearAccountCreateSchema = studentYearAccountBaseSchema.omit({ createdAt: true, updatedAt: true })
export const studentYearAccountUpdateSchema = studentYearAccountBaseSchema.partial().required({ id: true })

export class StudentYearAccount {
  readonly data: StudentYearAccountData

  constructor(args: StudentYearAccountInput) {
    const validated = parseDomain(studentYearAccountSchema, args)
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      studentId: validated.studentId,
      academicYearId: validated.academicYearId,
      createdAt: validated.createdAt,
      updatedAt: validated.updatedAt,
      availableBalance: new Money({ amount: validated.availableBalance, currency: validated.currency }),
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get academicYearId() { return this.data.academicYearId }
  get availableBalance() { return this.data.availableBalance }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get currency() {
    return this.availableBalance.currency
  }

  copyWith(changes: Partial<StudentYearAccountInput>): StudentYearAccount {
    return new StudentYearAccount({
      id: this.id,
      schoolId: this.schoolId,
      studentId: this.studentId,
      academicYearId: this.academicYearId,
      currency: this.currency,
      availableBalance: this.availableBalance.amount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}

export function studentYearAccountId(schoolId: string, studentId: string, academicYearId: string, currency: string): string {
  return `sya:${schoolId}:${studentId}:${academicYearId}:${currency}`
}

/** Parse a generated account id. `schoolId` is required so student ids may contain colons. */
export function parseStudentYearAccountId(
  id: string,
  schoolId: string,
): { schoolId: string, studentId: string, academicYearId: string, currency: string } | undefined {
  const prefix = `sya:${schoolId}:`
  if (!id.startsWith(prefix))
    return undefined
  const rest = id.slice(prefix.length)
  const currencySep = rest.lastIndexOf(':')
  if (currencySep <= 0)
    return undefined
  const currency = rest.slice(currencySep + 1)
  const middle = rest.slice(0, currencySep)
  const yearSep = middle.lastIndexOf(':')
  if (yearSep <= 0 || !currency)
    return undefined
  return {
    schoolId,
    studentId: middle.slice(0, yearSep),
    academicYearId: middle.slice(yearSep + 1),
    currency,
  }
}
