import type { CatalogService, CommandJson, FinanceReadInput, FinanceReconciliation, Payment, PaymentMethod, SchoolFinanceAging, StudentCharge, StudentServiceEnrollment, StudentYearAccount } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { SchoolCommandKey } from '../runtime/school-command-catalog'
import type { FinanceWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { AccountEntryDirection, AccountEntrySourceKind, Allocation, AllocationKind, BusinessRuleViolationError, CatalogService as CatalogServiceEntity, CatalogServiceStatus, ChargeStatus, compareChargesForFifo, deriveChargeStatus, FINANCE_BATCH_ENROLL_LIMIT, isAllocationActive, netActiveSettlement, oneTimeChargeId, overdueInstallmentRemainder, parseStudentYearAccountId, Payment as PaymentEntity, PaymentKind, PaymentStatus, remainingChargeObligation, ServiceEnrollmentSource, ServiceEnrollmentStatus, StudentAccountEntry, StudentFinanceSummary, StudentServiceEnrollment as StudentServiceEnrollmentEntity, StudentYearAccount as StudentYearAccountEntity, studentYearAccountId, sumEntryBalance, withShortName } from '@edaya/core'
import { acceptedCatalogTerms } from '../../capabilities/finance/accepted-catalog-terms'
import { getAutoBillingOptions, getFeeAutoBilling, retryAutoBilling } from '../../capabilities/finance/auto-billing-management'
import { loadFinanceReconciliation } from '../../capabilities/finance/load-finance-reconciliation'
import { materializeServiceCharge } from '../../capabilities/finance/materialize-service-charge'
import { assertCurrencyAgreement, assertSchoolCurrency, requireSchoolCurrency } from '../../capabilities/finance/school-currency'
import { groupByKey } from '../../capabilities/shared/bounded-reads'
import { schoolCommandScope } from '../commands/school-command-scope'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

export type AllocationPlan
  = { mode: 'account_only' }
    | { mode: 'fifo' }
    | { mode: 'targeted', targets: readonly { chargeId: string, amount: number }[] }

export interface AllocationPreviewItem {
  chargeId: string
  amount: number
  label: string
}

export interface AllocationPreview {
  accountId: string
  availableBefore: number
  availableAfter: number
  allocations: AllocationPreviewItem[]
}

export interface AccountStatement {
  account: StudentYearAccount
  entries: StudentAccountEntry[]
  payments: Payment[]
  allocations: Allocation[]
  charges: StudentCharge[]
  entrySum: number
  projectedAvailable: number
}

export type { SchoolFinanceAging } from '@edaya/core'

export type { FinanceReconciliation } from '@edaya/core'

export interface CreateCatalogServiceInput {
  id: string
  academicYearId: string
  name: string
  shortName?: string
  description?: string
  category?: CatalogService['category']
  autoBilling?: CatalogService['autoBilling']
  defaultPrice: number
  currency: string
  billingTerms: CatalogService['billingTerms']
  status?: CatalogServiceStatus
}

export interface UpdateCatalogServiceInput {
  requestId: string
  id: string
  name?: string
  shortName?: string
  description?: string | null
  category?: CatalogService['category']
  autoBilling?: CatalogService['autoBilling']
  defaultPrice?: number
  billingTerms?: CatalogService['billingTerms']
}

export interface EnrollStudentInServiceInput {
  id: string
  studentId: string
  catalogServiceId: string
  priceOverride?: number
  dueDate?: Date
  materialize?: boolean
}

export interface EnrollStudentsInServiceInput {
  id: string
  catalogServiceId: string
  studentIds: readonly string[]
  priceOverride?: number
  dueDate?: Date
}

export interface RecordPaymentInput {
  id: string
  accountId?: string
  studentId?: string
  academicYearId?: string
  amount: number
  paymentDate: Date
  method: PaymentMethod
  reference?: string
  notes?: string
  allocation?: AllocationPlan
}

export interface AllocateAccountBalanceInput {
  id: string
  accountId: string
  allocation: AllocationPlan
}

export interface ReverseAllocationInput {
  allocationId: string
}

export interface ReversePaymentInput {
  paymentId: string
  reverseAllocationIds?: readonly string[]
}

export interface RefundAvailableBalanceInput {
  id: string
  accountId: string
  amount: number
  paymentDate: Date
  method: PaymentMethod
  reference?: string
  notes?: string
}

export interface AdjustStudentChargeInput {
  requestId: string
  chargeId: string
  adjustmentAmount: number
  reason: string
}

export interface WaiveStudentChargeInput {
  requestId: string
  chargeId: string
  reason: string
  waiverAmount?: number
}

export interface CancelStudentChargeInput {
  requestId: string
  chargeId: string
  reason: string
}

export interface CancelServiceEnrollmentInput {
  enrollmentId: string
  reason: string
}

function financeModelReplaced(): never {
  fail('FINANCE_MODEL_REPLACED', 'The fee model has been replaced by the service catalog and student year accounts')
}

function resourceIdFromStored(stored: CommandJson, fallback: string): string {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored))
    return fallback
  const record = stored as { id?: CommandJson }
  return typeof record.id === 'string' ? record.id : fallback
}

export class FinanceServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: FinanceWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('finance', base.repositories)
  }

  getAutoBillingOptions() { return getAutoBillingOptions(this.baseService) }
  getFeeAutoBilling(input: { catalogServiceId: string }) { return getFeeAutoBilling(this.baseService, input) }
  retryAutoBilling(input: { runId: string, requestId: string }) { return retryAutoBilling(this.baseService, input) }

  createFee(): never { return financeModelReplaced() }
  assignFeeToStudent(): never { return financeModelReplaced() }
  cancelPayment(): never { return financeModelReplaced() }
  adjustStudentFee(): never { return financeModelReplaced() }
  cancelStudentFee(): never { return financeModelReplaced() }

  async createCatalogService(input: CreateCatalogServiceInput): Promise<CatalogService> {
    const schoolId = this.schoolId()
    return this.run({
      command: 'createCatalogService',
      requestId: input.id,
      input,
      lockKeys: [`academic-state:${this.schoolId()}`, `catalog:${input.id}`],
      authorize: async () => {
        await this.baseService.access.entity('catalogServices').assertSave(new CatalogServiceEntity(withShortName({
          id: input.id,
          schoolId,
          academicYearId: input.academicYearId,
          name: input.name,
          shortName: input.shortName,
          description: input.description,
          category: input.category,
          autoBilling: input.autoBilling,
          defaultPrice: input.defaultPrice,
          currency: input.currency,
          billingTerms: input.billingTerms,
          status: input.status ?? CatalogServiceStatus.Draft,
        })))
      },
      execute: async () => {
        const existing = await this.repositories.catalogServices.findById(input.id)
        if (existing)
          return this.sameCatalog(existing, input)
        const service = new CatalogServiceEntity(withShortName({
          id: input.id,
          schoolId,
          academicYearId: input.academicYearId,
          name: input.name,
          shortName: input.shortName,
          description: input.description,
          category: input.category,
          autoBilling: input.autoBilling,
          defaultPrice: input.defaultPrice,
          currency: input.currency,
          billingTerms: input.billingTerms,
          status: input.status ?? CatalogServiceStatus.Draft,
        }))
        await this.baseService.entities.catalogServices.save(service)
        return service
      },
      replay: stored => this.requireCatalog(stored.id),
      persistResult: service => ({ id: service.id }),
    })
  }

  async updateCatalogService(input: UpdateCatalogServiceInput): Promise<CatalogService> {
    return this.run({
      command: 'updateCatalogService',
      requestId: input.requestId,
      input,
      lockKeys: [`academic-state:${this.schoolId()}`, `catalog:${input.id}`],
      authorize: async () => {
        const existing = await this.requireCatalog(input.id)
        await this.baseService.access.entity('catalogServices').assertSave(existing.copyWith({
          name: input.name ?? existing.name,
          shortName: input.shortName ?? existing.shortName,
          description: input.description === undefined ? existing.description : input.description ?? undefined,
          category: input.category ?? existing.category,
          autoBilling: input.autoBilling ?? existing.autoBilling,
          defaultPrice: input.defaultPrice ?? existing.defaultPrice.amount,
          billingTerms: input.billingTerms ?? existing.billingTerms,
        }), existing)
      },
      execute: async () => {
        const existing = await this.requireCatalog(input.id)
        if (existing.status === CatalogServiceStatus.Archived)
          fail('CATALOG_ARCHIVED', `Catalog service ${input.id} is archived`)
        const updated = existing.copyWith({
          name: input.name ?? existing.name,
          shortName: input.shortName ?? existing.shortName,
          description: input.description === undefined ? existing.description : input.description ?? undefined,
          category: input.category ?? existing.category,
          autoBilling: input.autoBilling ?? existing.autoBilling,
          defaultPrice: input.defaultPrice ?? existing.defaultPrice.amount,
          billingTerms: input.billingTerms ?? existing.billingTerms,
          updatedAt: new Date(),
        })
        await this.baseService.entities.catalogServices.save(updated)
        return updated
      },
      replay: stored => this.requireCatalog(stored.id),
      persistResult: service => ({ id: service.id }),
    })
  }

  async activateCatalogService(input: { id: string, requestId: string }): Promise<CatalogService> {
    return this.setCatalogStatus(input, CatalogServiceStatus.Active, 'activateCatalogService')
  }

  async archiveCatalogService(input: { id: string, requestId: string }): Promise<CatalogService> {
    return this.setCatalogStatus(input, CatalogServiceStatus.Archived, 'archiveCatalogService')
  }

  async enrollStudentInService(input: EnrollStudentInServiceInput): Promise<StudentServiceEnrollment> {
    const [enrollment] = await this.enrollStudentsInService({
      id: input.id,
      catalogServiceId: input.catalogServiceId,
      studentIds: [input.studentId],
      priceOverride: input.priceOverride,
      dueDate: input.dueDate,
    })
    return enrollment!
  }

  async enrollStudentsInService(input: EnrollStudentsInServiceInput): Promise<StudentServiceEnrollment[]> {
    if (input.studentIds.length === 0 || input.studentIds.length > FINANCE_BATCH_ENROLL_LIMIT)
      fail('ENROLLMENT_BATCH_LIMIT', `Enrollment batch must contain 1–${FINANCE_BATCH_ENROLL_LIMIT} students`)
    const unique = [...new Set(input.studentIds)].sort()
    const catalog = await this.requireCatalog(input.catalogServiceId)
    const accountIds = unique.map(studentId => studentYearAccountId(this.schoolId(), studentId, catalog.academicYearId, catalog.defaultPrice.currency))
    const chargeIds = unique.map((_, index) => oneTimeChargeId(unique.length === 1 ? input.id : `${input.id}:${unique[index]}`))
    return this.run<StudentServiceEnrollment[], { ids: string[] }>({
      command: 'enrollStudentsInService',
      requestId: input.id,
      input,
      lockKeys: [
        `catalog:${catalog.id}`,
        ...unique.map(id => `service-assignment:${catalog.id}:${id}:${catalog.academicYearId}`),
        ...accountIds.map(id => `account:${id}`),
        ...chargeIds.map(id => `charge:${id}`),
        ...unique.map(id => `account-create:${this.schoolId()}:${id}:${catalog.academicYearId}:${catalog.defaultPrice.currency}`),
      ],
      authorize: async () => {
        if (!catalog.isActive)
          fail('CATALOG_INACTIVE', `Catalog service ${catalog.id} is not active`)
        for (const studentId of unique)
          await this.baseService.access.finance.assertEnrollStudent(studentId)
      },
      execute: async () => {
        const enrollments: StudentServiceEnrollment[] = []
        for (const studentId of unique) {
          const enrollmentId = unique.length === 1 ? input.id : `${input.id}:${studentId}`
          enrollments.push(await this.enrollOne({
            id: enrollmentId,
            studentId,
            catalog,
            priceOverride: input.priceOverride,
            dueDate: input.dueDate,
          }))
        }
        return enrollments
      },
      replay: async stored => Promise.all(stored.ids.map(id => this.requireEnrollment(id))),
      persistResult: enrollments => ({ ids: enrollments.map(enrollment => enrollment.id) }),
    })
  }

  async materializeOneTimeCharge(input: { enrollmentId: string }): Promise<StudentCharge> {
    const enrollment = await this.requireEnrollment(input.enrollmentId)
    return this.run({
      command: 'materializeOneTimeCharge',
      requestId: input.enrollmentId,
      input,
      lockKeys: [`charge:${oneTimeChargeId(enrollment.id)}`, `enrollment:${enrollment.id}`],
      authorize: async () => {
        await this.baseService.access.finance.assertEnrollStudent(enrollment.studentId)
      },
      execute: async () => this.materializeCharge(enrollment),
      replay: stored => this.requireCharge(stored.id),
      persistResult: charge => ({ id: charge.id }),
    })
  }

  async cancelServiceEnrollment(input: CancelServiceEnrollmentInput): Promise<StudentServiceEnrollment> {
    return this.run({
      command: 'cancelServiceEnrollment',
      requestId: `cancel-enrollment:${input.enrollmentId}`,
      input,
      lockKeys: [`enrollment:${input.enrollmentId}`, `charge:${oneTimeChargeId(input.enrollmentId)}`],
      authorize: async () => {
        const enrollment = await this.requireEnrollment(input.enrollmentId)
        await this.baseService.access.entity('studentServiceEnrollments').assertSave(enrollment.copyWith({
          status: ServiceEnrollmentStatus.Cancelled,
          cancellationReason: input.reason,
          cancelledById: this.actorId(),
          cancelledAt: new Date(),
        }), enrollment)
      },
      execute: async () => {
        const enrollment = await this.requireEnrollment(input.enrollmentId)
        if (!enrollment.isActive)
          return enrollment
        const charge = await this.repositories.studentCharges.findById(oneTimeChargeId(enrollment.id))
        if (charge && !charge.cancelledAt)
          fail('ENROLLMENT_HAS_CHARGE', `Enrollment ${enrollment.id} still has an active charge`)
        const cancelled = enrollment.copyWith({
          status: ServiceEnrollmentStatus.Cancelled,
          cancellationReason: input.reason,
          cancelledById: this.actorId(),
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        await this.baseService.entities.studentServiceEnrollments.save(cancelled)
        return cancelled
      },
      replay: stored => this.requireEnrollment(stored.id),
      persistResult: enrollment => ({ id: enrollment.id }),
    })
  }

  async adjustStudentCharge(input: AdjustStudentChargeInput): Promise<StudentCharge> {
    if (input.adjustmentAmount <= 0)
      fail('INVALID_ADJUSTMENT_AMOUNT', 'adjustmentAmount must be strictly positive')
    return this.mutateCharge(input, 'adjustStudentCharge', async (charge, allocations) => {
      if (charge.adjustedAt)
        fail('ALREADY_ADJUSTED_CHARGE', 'This charge already has an adjustment')
      const settlement = netActiveSettlement(allocations, charge.id)
      if (input.adjustmentAmount + charge.waiverAmount.amount + settlement > charge.expectedAmount.amount)
        fail('ADJUSTMENT_BELOW_SETTLEMENT', 'adjustmentAmount must not reduce a charge below active settlement')
      return charge.copyWith({
        adjustmentAmount: input.adjustmentAmount,
        adjustmentReason: input.reason,
        adjustedById: this.actorId(),
        adjustedAt: new Date(),
        updatedAt: new Date(),
      })
    })
  }

  async waiveStudentCharge(input: WaiveStudentChargeInput): Promise<StudentCharge> {
    return this.mutateCharge(input, 'waiveStudentCharge', async (charge, allocations) => {
      if (charge.waivedAt)
        fail('ALREADY_WAIVED_CHARGE', 'This charge already has a waiver')
      const settlement = netActiveSettlement(allocations, charge.id)
      const remaining = remainingChargeObligation(charge, settlement)
      const waiverAmount = input.waiverAmount ?? remaining
      if (waiverAmount <= 0)
        fail('INVALID_WAIVER_AMOUNT', 'waiverAmount must be strictly positive')
      if (waiverAmount + charge.adjustmentAmount.amount + settlement > charge.expectedAmount.amount)
        fail('ADJUSTMENT_BELOW_SETTLEMENT', 'waiver must not reduce a charge below active settlement')
      return charge.copyWith({
        waiverAmount,
        waiverReason: input.reason,
        waivedById: this.actorId(),
        waivedAt: new Date(),
        updatedAt: new Date(),
      })
    })
  }

  async cancelStudentCharge(input: CancelStudentChargeInput): Promise<StudentCharge> {
    return this.mutateCharge(input, 'cancelStudentCharge', async (charge, allocations) => {
      if (allocations.some(allocation => isAllocationActive(allocation, allocations)))
        fail('CHARGE_HAS_ACTIVE_ALLOCATIONS', `Charge ${charge.id} cannot be cancelled while active allocations remain`)
      return charge.copyWith({
        status: ChargeStatus.Cancelled,
        cancellationReason: input.reason,
        cancelledById: this.actorId(),
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
    })
  }

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const plan = input.allocation ?? { mode: 'account_only' as const }
    return this.run({
      command: 'recordPayment',
      requestId: input.id,
      input,
      lockKeys: await this.paymentLockKeys(input, plan),
      authorize: async () => {
        const identity = await this.resolveAccountIdentity(input)
        const accountId = studentYearAccountId(this.schoolId(), identity.studentId, identity.academicYearId, identity.currency)
        const existing = await this.repositories.studentYearAccounts.findById(accountId)
        if (existing)
          await this.baseService.access.finance.assertRecordPayment(existing.id)
        else
          await this.baseService.access.finance.assertEnrollStudent(identity.studentId)
        if (plan.mode !== 'account_only' && existing)
          await this.baseService.access.finance.assertAllocate(existing.id)
      },
      execute: async () => {
        const account = await this.getOrCreateAccount(await this.resolveAccountIdentity(input))
        await this.assertUniqueReference(account, input.reference, input.id)
        const existing = await this.repositories.payments.findById(input.id)
        if (existing)
          return existing
        if (input.amount <= 0)
          fail('INVALID_PAYMENT_AMOUNT', 'Payment amount must be strictly positive')
        if (account.currency !== (await this.resolveAccountIdentity(input)).currency)
          fail('CURRENCY_MISMATCH', 'Payment currency must match the account')
        const payment = new PaymentEntity({
          id: input.id,
          schoolId: account.schoolId,
          accountId: account.id,
          academicYearId: account.academicYearId,
          kind: PaymentKind.Receipt,
          amount: input.amount,
          currency: account.currency,
          paymentDate: input.paymentDate,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          recordedById: this.actorId(),
        })
        await this.baseService.entities.payments.save(payment)
        let current = await this.creditAccount(account, input.amount, AccountEntrySourceKind.PaymentReceipt, payment.id, payment.paymentDate)
        if (plan.mode !== 'account_only') {
          const preview = await this.buildPreview(current, plan)
          current = await this.applySettlements(current, preview.allocations, payment.id, payment.paymentDate)
        }
        return payment
      },
      replay: stored => this.requirePayment(stored.id),
      persistResult: payment => ({ id: payment.id }),
    })
  }

  async allocateAccountBalance(input: AllocateAccountBalanceInput): Promise<AllocationPreview> {
    return this.run<AllocationPreview, CommandJson>({
      command: 'allocateAccountBalance',
      requestId: input.id,
      input,
      lockKeys: await this.allocationLockKeys(input.accountId, input.allocation),
      authorize: async () => {
        await this.baseService.access.finance.assertAllocate(input.accountId)
      },
      execute: async () => {
        const account = await this.requireAccount(input.accountId)
        const preview = await this.buildPreview(account, input.allocation)
        if (preview.allocations.length === 0)
          return preview
        await this.applySettlements(account, preview.allocations, undefined, new Date())
        return { ...preview, availableAfter: preview.availableAfter }
      },
      replay: async (stored) => {
        const record = stored as unknown as AllocationPreview
        return {
          accountId: record.accountId,
          availableBefore: record.availableBefore,
          availableAfter: record.availableAfter,
          allocations: record.allocations,
        }
      },
      persistResult: (preview): CommandJson => ({
        id: input.id,
        accountId: preview.accountId,
        availableBefore: preview.availableBefore,
        availableAfter: preview.availableAfter,
        allocations: preview.allocations.map(item => ({
          chargeId: item.chargeId,
          amount: item.amount,
          label: item.label,
        })),
      }),
    })
  }

  async previewAccountAllocation(input: { accountId: string, allocation: AllocationPlan }): Promise<AllocationPreview> {
    const account = await this.requireAccount(input.accountId)
    await this.baseService.access.finance.assertReadAccount(account.id)
    return this.buildPreview(account, input.allocation)
  }

  async getStudentFinanceSummary(input: { studentId: string, academicYearId: string }): Promise<StudentFinanceSummary> {
    await this.baseService.access.finance.assertReadStudent(input.studentId)
    const chargeScope = await this.baseService.access.entity('studentCharges').readScope()
    const accountScope = await this.baseService.access.entity('studentYearAccounts').readScope()
    const charges = await this.repositories.studentCharges.forAccess(chargeScope).list({
      studentId: input.studentId,
      academicYearId: input.academicYearId,
    })
    const accounts = await this.repositories.studentYearAccounts.forAccess(accountScope).list({
      studentId: input.studentId,
      academicYearId: input.academicYearId,
    })
    const account = accounts[0]
    const currency = await requireSchoolCurrency(this.repositories, this.schoolId())
    assertCurrencyAgreement(currency, [...accounts.map(row => row.currency), ...charges.map(row => row.currency)])
    const referenceDate = new Date()
    const outstanding = charges.reduce((sum, charge) => sum + remainingChargeObligation(charge), 0)
    const overdue = charges.reduce((sum, charge) => sum + Math.min(remainingChargeObligation(charge), overdueInstallmentRemainder(charge, charge.allocatedAmount.amount, referenceDate)), 0)
    return new StudentFinanceSummary({
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      accountId: account?.id,
      currency,
      available: { amount: account?.availableBalance.amount ?? 0, currency },
      outstanding: { amount: outstanding, currency },
      overdue: { amount: overdue, currency },
    })
  }

  async getAccountStatement(input: { accountId: string }): Promise<AccountStatement> {
    const account = await this.requireAccount(input.accountId)
    await this.baseService.access.finance.assertReadAccount(account.id)
    await assertSchoolCurrency(this.repositories, this.schoolId(), account.currency)
    const entries = await this.repositories.studentAccountEntries.list({ accountId: account.id })
    const payments = await this.repositories.payments.forAccess(await this.baseService.access.entity('payments').readScope()).list({ accountId: account.id })
    const allocations = await this.repositories.allocations.list({ accountId: account.id })
    const charges = await this.repositories.studentCharges.forAccess(await this.baseService.access.entity('studentCharges').readScope()).list({
      studentId: account.studentId,
      academicYearId: account.academicYearId,
    })
    assertCurrencyAgreement(account.currency, [...charges.map(row => row.currency), ...entries.map(row => row.amount.currency), ...allocations.map(row => row.amount.currency), ...payments.map(row => row.amount.currency)])
    return {
      account,
      entries: [...entries].sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime() || left.id.localeCompare(right.id)),
      payments,
      allocations,
      charges,
      entrySum: sumEntryBalance(entries),
      projectedAvailable: account.availableBalance.amount,
    }
  }

  async getSchoolFinanceAging(input: { schoolId: string, academicYearId?: string }): Promise<SchoolFinanceAging> {
    this.checkActorSchool(input.schoolId)
    const chargeScope = await this.baseService.access.finance.agingScope()
    const currency = await requireSchoolCurrency(this.repositories, this.schoolId())
    return this.repositories.financeProjections.aging({ ...input, currency, referenceDate: new Date() }, chargeScope)
  }

  private async financeReadContext(input: { schoolId: string, academicYearId: string }) {
    this.checkActorSchool(input.schoolId)
    const [charges, accounts, payments, currency] = await Promise.all([
      this.baseService.access.entity('studentCharges').readScope(),
      this.baseService.access.entity('studentYearAccounts').readScope(),
      this.baseService.access.entity('payments').readScope(),
      requireSchoolCurrency(this.repositories, this.schoolId()),
    ])
    if (!charges.clauses.length || !accounts.clauses.length || !payments.clauses.length)
      denyResourceAccess()
    return { scopes: { charges, accounts, payments }, input: { ...input, currency, referenceDate: new Date() } }
  }

  async getFinanceOverview(input: { schoolId: string, academicYearId: string }) {
    const context = await this.financeReadContext(input)
    return this.repositories.financeProjections.overview(context.input, context.scopes)
  }

  async getFeeFinanceOverview(input: { schoolId: string, academicYearId: string, feeId: string }) {
    const context = await this.financeReadContext(input)
    const fee = await this.repositories.catalogServices.forAccess(await this.baseService.access.entity('catalogServices').readScope()).findById(input.feeId)
    if (!fee || fee.academicYearId !== input.academicYearId)
      fail('NOT_FOUND', 'Fee not found in the selected academic year')
    return this.repositories.financeProjections.overview({ ...context.input, feeId: fee.id }, context.scopes)
  }

  async getFinanceBillingPage(input: Omit<FinanceReadInput, 'currency' | 'referenceDate' | 'chargeId'>) {
    const context = await this.financeReadContext(input)
    return this.repositories.financeProjections.billingPage({ ...input, ...context.input }, context.scopes)
  }

  async getFinancePaymentsPage(input: Omit<FinanceReadInput, 'currency' | 'referenceDate' | 'chargeId'>) {
    const context = await this.financeReadContext(input)
    return this.repositories.financeProjections.paymentsPage({ ...input, ...context.input }, context.scopes)
  }

  async getFinanceBillingDetail(input: { schoolId: string, academicYearId: string, chargeId: string }) {
    const context = await this.financeReadContext(input)
    const page = await this.repositories.financeProjections.billingPage({ ...context.input, chargeId: input.chargeId, limit: 1 }, context.scopes)
    return page.rows[0] ?? null
  }

  async getFinanceReconciliation(input: { schoolId: string, academicYearId?: string }): Promise<FinanceReconciliation> {
    this.checkActorSchool(input.schoolId)
    await this.baseService.access.finance.assertReconciliation()
    return loadFinanceReconciliation(this.repositories, {
      accounts: await this.baseService.access.finance.reconciliationScope(),
      charges: await this.baseService.access.finance.agingScope(),
    }, input)
  }

  async countOverdueCharges(): Promise<number> {
    const aging = await this.getSchoolFinanceAging({ schoolId: this.schoolId() })
    return aging.overdueCount
  }

  async getRelatedFamilyFinanceOverview(input: { academicYearId: string }): Promise<{ academicYearId: string, students: StudentFinanceSummary[] }> {
    const studentIds = [...new Set(await this.relatedStudentIds())]
    const students = await Promise.all(studentIds.map(studentId => this.getStudentFinanceSummary({
      studentId,
      academicYearId: input.academicYearId,
    })))
    return { academicYearId: input.academicYearId, students }
  }

  async getStudentAccountStatement(input: { studentId: string, academicYearId: string, currency?: string }): Promise<AccountStatement | null> {
    await this.baseService.access.finance.assertReadStudent(input.studentId)
    const accounts = await this.repositories.studentYearAccounts.forAccess(await this.baseService.access.entity('studentYearAccounts').readScope()).list({
      studentId: input.studentId,
      academicYearId: input.academicYearId,
    })
    const currency = await requireSchoolCurrency(this.repositories, this.schoolId())
    assertCurrencyAgreement(currency, [...accounts.map(row => row.currency), ...(input.currency ? [input.currency] : [])])
    const account = accounts[0]
    if (!account)
      return null
    return this.getAccountStatement({ accountId: account.id })
  }

  async listOpenDueCharges(input: { schoolId: string, academicYearId?: string }): Promise<{
    schoolId: string
    academicYearId?: string
    charges: Array<{
      chargeId: string
      studentId: string
      label: string
      remainingAmount: number
      overdueAmount: number
      dueDate?: string
      status: ChargeStatus
    }>
  }> {
    this.checkActorSchool(input.schoolId)
    const chargeScope = await this.baseService.access.finance.agingScope()
    const charges = await this.repositories.studentCharges.forAccess(chargeScope).list({
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
    })
    const referenceDate = new Date()
    return {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      charges: charges
        .filter(charge => remainingChargeObligation(charge) > 0)
        .map(charge => ({
          chargeId: charge.id,
          studentId: charge.studentId,
          label: charge.label,
          remainingAmount: remainingChargeObligation(charge),
          overdueAmount: overdueInstallmentRemainder(charge, charge.allocatedAmount.amount, referenceDate),
          dueDate: charge.dueDate?.toISOString(),
          status: charge.status,
        })),
    }
  }

  async getPaymentSettlementHistory(input: { accountId: string }) {
    const statement = await this.getAccountStatement(input)
    return {
      accountId: statement.account.id,
      studentId: statement.account.studentId,
      academicYearId: statement.account.academicYearId,
      currency: statement.account.currency,
      payments: statement.payments.map(payment => ({
        id: payment.id,
        kind: payment.kind,
        amount: payment.amount.amount,
        status: payment.status,
        paymentDate: payment.paymentDate.toISOString(),
        method: payment.method,
        reference: payment.reference,
        reversesPaymentId: payment.reversesPaymentId,
        reversedByPaymentId: payment.reversedByPaymentId,
      })),
      allocations: statement.allocations.map(allocation => ({
        id: allocation.id,
        chargeId: allocation.chargeId,
        amount: allocation.amount.amount,
        kind: allocation.kind,
        causedByPaymentId: allocation.causedByPaymentId,
        reversesAllocationId: allocation.reversesAllocationId,
        recordedAt: allocation.recordedAt.toISOString(),
      })),
    }
  }

  async reconcileStudentYearAccount(input: { accountId: string }) {
    const statement = await this.getAccountStatement(input)
    await this.baseService.access.finance.assertReconciliation()
    const allocationsByCharge = groupByKey(statement.allocations, row => row.chargeId)
    const charges = statement.charges.map((charge) => {
      const allocations = allocationsByCharge.get(charge.id) ?? []
      const settlement = netActiveSettlement(allocations, charge.id)
      return {
        chargeId: charge.id,
        projectedAllocated: charge.allocatedAmount.amount,
        settlement,
        difference: charge.allocatedAmount.amount - settlement,
      }
    })
    return {
      accountId: statement.account.id,
      studentId: statement.account.studentId,
      projectedAvailable: statement.projectedAvailable,
      entrySum: statement.entrySum,
      difference: statement.projectedAvailable - statement.entrySum,
      charges,
      balanced: statement.projectedAvailable === statement.entrySum && charges.every(row => row.difference === 0),
    }
  }

  async reconcileSchoolFinance(input: { schoolId: string, academicYearId?: string }) {
    return this.getFinanceReconciliation(input)
  }

  private async relatedStudentIds(): Promise<string[]> {
    const actor = this.baseService.actor
    if (actor.kind === 'guardian') {
      const links = await this.repositories.guardianLinks.list({ guardianId: actor.guardianId })
      return links.map(link => link.studentId)
    }
    const charges = await this.repositories.studentCharges.forAccess(await this.baseService.access.entity('studentCharges').readScope()).list()
    return charges.map(charge => charge.studentId)
  }

  async reverseAllocation(input: ReverseAllocationInput): Promise<Allocation> {
    return this.run({
      command: 'reverseAllocation',
      requestId: `reverse-allocation:${input.allocationId}`,
      input,
      lockKeys: await this.reverseAllocationLockKeys(input.allocationId),
      authorize: async () => {
        const allocation = await this.requireAllocation(input.allocationId)
        await this.baseService.access.finance.assertAllocate(allocation.accountId)
      },
      execute: async () => this.reverseOneAllocation(input.allocationId),
      replay: stored => this.requireAllocation(stored.id),
      persistResult: allocation => ({ id: allocation.id }),
    })
  }

  async reversePayment(input: ReversePaymentInput): Promise<Payment> {
    return this.run({
      command: 'reversePayment',
      requestId: `reverse-payment:${input.paymentId}`,
      input,
      lockKeys: await this.reversePaymentLockKeys(input),
      authorize: async () => {
        await this.baseService.access.finance.assertReversePayment(input.paymentId)
      },
      execute: async () => {
        const payment = await this.requirePayment(input.paymentId)
        if (payment.status === PaymentStatus.Reversed)
          return payment
        if (payment.kind !== PaymentKind.Receipt)
          fail('INVALID_PAYMENT_REVERSAL', `Payment ${payment.id} is not a recorded receipt`)
        let account = await this.requireAccount(payment.accountId)
        const selected = input.reverseAllocationIds ?? []
        for (const allocationId of selected)
          await this.reverseOneAllocation(allocationId)
        account = await this.requireAccount(payment.accountId)
        if (account.availableBalance.amount < payment.amount.amount)
          fail('PAYMENT_REVERSAL_INSUFFICIENT_FUNDS', 'Payment reversal needs enough available funds or explicit allocation reversals')
        account = await this.debitAccount(account, payment.amount.amount, AccountEntrySourceKind.PaymentReversal, payment.id, new Date())
        const reversed = payment.copyWith({
          status: PaymentStatus.Reversed,
          reversedAt: new Date(),
          reversedById: this.actorId(),
        })
        await this.baseService.entities.payments.save(reversed)
        return reversed
      },
      replay: stored => this.requirePayment(stored.id),
      persistResult: payment => ({ id: payment.id }),
    })
  }

  async refundAvailableBalance(input: RefundAvailableBalanceInput): Promise<Payment> {
    return this.run({
      command: 'refundAvailableBalance',
      requestId: input.id,
      input,
      lockKeys: [`account:${input.accountId}`, `payment:${input.id}`],
      authorize: async () => {
        await this.baseService.access.finance.assertRefund(input.accountId)
      },
      execute: async () => {
        const existing = await this.repositories.payments.findById(input.id)
        if (existing)
          return existing
        const account = await this.requireAccount(input.accountId)
        if (input.amount <= 0)
          fail('INVALID_PAYMENT_AMOUNT', 'Refund amount must be strictly positive')
        if (input.amount > account.availableBalance.amount)
          fail('REFUND_EXCEEDS_AVAILABLE', 'Refund cannot exceed available funds')
        await this.assertUniqueReference(account, input.reference, input.id)
        const payment = new PaymentEntity({
          id: input.id,
          schoolId: account.schoolId,
          accountId: account.id,
          academicYearId: account.academicYearId,
          kind: PaymentKind.Disbursement,
          amount: input.amount,
          currency: account.currency,
          paymentDate: input.paymentDate,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          recordedById: this.actorId(),
        })
        await this.baseService.entities.payments.save(payment)
        await this.debitAccount(account, input.amount, AccountEntrySourceKind.Refund, payment.id, payment.paymentDate)
        return payment
      },
      replay: stored => this.requirePayment(stored.id),
      persistResult: payment => ({ id: payment.id }),
    })
  }

  private async setCatalogStatus(input: { id: string, requestId: string }, status: CatalogServiceStatus, command: 'activateCatalogService' | 'archiveCatalogService'): Promise<CatalogService> {
    const { id } = input
    return this.run({
      command,
      requestId: input.requestId,
      input,
      lockKeys: [`academic-state:${this.schoolId()}`, `catalog:${id}`],
      authorize: async () => {
        await this.requireCatalog(id)
        await this.baseService.access.entity('catalogServices').assertSave(
          (await this.requireCatalog(id)).copyWith({ status }),
          await this.requireCatalog(id),
        )
      },
      execute: async () => {
        const existing = await this.requireCatalog(id)
        if (existing.status === status)
          return existing
        const updated = existing.copyWith({ status, updatedAt: new Date() })
        await this.baseService.entities.catalogServices.save(updated)
        return updated
      },
      replay: stored => this.requireCatalog(stored.id),
      persistResult: service => ({ id: service.id }),
    })
  }

  private async enrollOne(input: {
    id: string
    studentId: string
    catalog: CatalogService
    priceOverride?: number
    dueDate?: Date
  }): Promise<StudentServiceEnrollment> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    if (input.catalog.schoolId !== student.schoolId)
      denyResourceAccess()
    const existingActive = (await this.repositories.studentServiceEnrollments.list({
      studentId: student.id,
      catalogServiceId: input.catalog.id,
      academicYearId: input.catalog.academicYearId,
      status: ServiceEnrollmentStatus.Active,
    })).find(row => row.id !== input.id)
    const existing = await this.repositories.studentServiceEnrollments.findById(input.id)
    if (existing)
      return existing
    if (existingActive)
      fail('ENROLLMENT_ACTIVE_EXISTS', `Student ${student.id} is already enrolled in ${input.catalog.id}`)
    const enrollment = new StudentServiceEnrollmentEntity({
      id: input.id,
      schoolId: student.schoolId,
      studentId: student.id,
      catalogServiceId: input.catalog.id,
      academicYearId: input.catalog.academicYearId,
      acceptedTerms: acceptedCatalogTerms(input.catalog, input.priceOverride),
      source: ServiceEnrollmentSource.Staff,
    })
    await this.baseService.entities.studentServiceEnrollments.save(enrollment)
    await this.materializeCharge(enrollment, input.dueDate)
    return enrollment
  }

  private async materializeCharge(enrollment: StudentServiceEnrollment, dueDate?: Date): Promise<StudentCharge> {
    return materializeServiceCharge(this.baseService, enrollment, dueDate)
  }

  private async mutateCharge(
    input: AdjustStudentChargeInput | WaiveStudentChargeInput | CancelStudentChargeInput,
    command: 'adjustStudentCharge' | 'waiveStudentCharge' | 'cancelStudentCharge',
    mutate: (charge: StudentCharge, allocations: Allocation[]) => Promise<StudentCharge>,
  ): Promise<StudentCharge> {
    const { chargeId } = input
    return this.run({
      command,
      requestId: input.requestId,
      input,
      lockKeys: [`charge:${chargeId}`],
      authorize: async () => {
        const charge = await this.requireCharge(chargeId)
        await this.baseService.access.finance.assertEnrollStudent(charge.studentId)
      },
      execute: async () => {
        const charge = await this.requireCharge(chargeId)
        const allocations = await this.repositories.allocations.list({ chargeId })
        const next = await mutate(charge, allocations)
        const settlement = netActiveSettlement(allocations, charge.id)
        const projected = this.projectCharge(next.copyWith({ allocatedAmount: settlement }), allocations)
        await this.baseService.entities.studentCharges.save(projected)
        return projected
      },
      replay: stored => this.requireCharge(stored.id),
      persistResult: charge => ({ id: charge.id }),
    })
  }

  private async buildPreview(account: StudentYearAccount, plan: AllocationPlan): Promise<AllocationPreview> {
    if (plan.mode === 'account_only') {
      return { accountId: account.id, availableBefore: account.availableBalance.amount, availableAfter: account.availableBalance.amount, allocations: [] }
    }
    const charges = (await this.repositories.studentCharges.list({
      studentId: account.studentId,
      academicYearId: account.academicYearId,
    })).filter(charge => !charge.cancelledAt)
    await assertSchoolCurrency(this.repositories, this.schoolId(), account.currency)
    assertCurrencyAgreement(account.currency, charges.map(row => row.currency))
    const allocations = await this.repositories.allocations.list({ accountId: account.id })
    const open = charges
      .map(charge => this.projectCharge(charge, allocations))
      .filter(charge => remainingChargeObligation(charge) > 0)
      .sort(compareChargesForFifo)
    const items: AllocationPreviewItem[] = []
    let remaining = account.availableBalance.amount
    if (plan.mode === 'fifo') {
      for (const charge of open) {
        if (remaining <= 0)
          break
        const need = remainingChargeObligation(charge)
        const amount = Math.min(need, remaining)
        if (amount > 0) {
          items.push({ chargeId: charge.id, amount, label: charge.label })
          remaining -= amount
        }
      }
    }
    else {
      for (const target of plan.targets) {
        const charge = open.find(item => item.id === target.chargeId) ?? charges.find(item => item.id === target.chargeId)
        if (!charge || charge.cancelledAt)
          fail('CHARGE_STUDENT_MISMATCH', `Charge ${target.chargeId} is not an open charge on this account`)
        if (charge.studentId !== account.studentId || charge.academicYearId !== account.academicYearId || charge.currency !== account.currency)
          fail('CURRENCY_MISMATCH', 'Targeted charge must match the account student, year, and currency')
        const projected = this.projectCharge(charge, allocations)
        const need = remainingChargeObligation(projected)
        if (target.amount <= 0 || target.amount > need)
          fail('ALLOCATION_EXCEEDS_CHARGE', `Allocation exceeds remaining obligation on charge ${charge.id}`)
        if (target.amount > remaining)
          fail('NEGATIVE_AVAILABLE_FUNDS', 'Allocation exceeds available account funds')
        items.push({ chargeId: charge.id, amount: target.amount, label: charge.label })
        remaining -= target.amount
      }
    }
    return {
      accountId: account.id,
      availableBefore: account.availableBalance.amount,
      availableAfter: remaining,
      allocations: items,
    }
  }

  private async applySettlements(
    account: StudentYearAccount,
    items: readonly AllocationPreviewItem[],
    paymentId: string | undefined,
    effectiveAt: Date,
  ): Promise<StudentYearAccount> {
    let current = account
    for (const item of items) {
      const charge = await this.requireCharge(item.chargeId)
      const allocations = await this.repositories.allocations.list({ chargeId: charge.id })
      const settlement = netActiveSettlement(allocations, charge.id)
      if (item.amount > remainingChargeObligation(charge.copyWith({ allocatedAmount: settlement })))
        fail('ALLOCATION_EXCEEDS_CHARGE', `Allocation exceeds remaining obligation on charge ${charge.id}`)
      if (item.amount > current.availableBalance.amount)
        fail('NEGATIVE_AVAILABLE_FUNDS', 'Allocation exceeds available account funds')
      const allocation = new Allocation({
        id: `alloc-${crypto.randomUUID()}`,
        schoolId: current.schoolId,
        accountId: current.id,
        chargeId: charge.id,
        amount: item.amount,
        currency: current.currency,
        kind: AllocationKind.Settle,
        causedByPaymentId: paymentId,
        effectiveAt,
        recordedAt: new Date(),
      })
      await this.repositories.allocations.save(allocation)
      current = await this.debitAccount(current, item.amount, AccountEntrySourceKind.AllocationSettle, allocation.id, effectiveAt)
      const nextAllocations = [...allocations, allocation]
      await this.baseService.entities.studentCharges.save(this.projectCharge(charge, nextAllocations))
    }
    return current
  }

  private async reverseOneAllocation(allocationId: string): Promise<Allocation> {
    const allocation = await this.requireAllocation(allocationId)
    if (allocation.kind !== AllocationKind.Settle)
      fail('ALLOCATION_ALREADY_DEALLOCATED', `Allocation ${allocation.id} is not an active settlement`)
    const siblings = await this.repositories.allocations.list({ chargeId: allocation.chargeId })
    if (!isAllocationActive(allocation, siblings)) {
      const existingReverse = siblings.find(item => item.reversesAllocationId === allocation.id)
      if (existingReverse)
        return existingReverse
      fail('ALLOCATION_ALREADY_DEALLOCATED', `Allocation ${allocation.id} is already reversed`)
    }
    const reverse = new Allocation({
      id: `alloc-rev-${crypto.randomUUID()}`,
      schoolId: allocation.schoolId,
      accountId: allocation.accountId,
      chargeId: allocation.chargeId,
      amount: allocation.amount.amount,
      currency: allocation.amount.currency,
      kind: AllocationKind.Reverse,
      reversesAllocationId: allocation.id,
      causedByPaymentId: allocation.causedByPaymentId,
      effectiveAt: new Date(),
      recordedAt: new Date(),
    })
    await this.repositories.allocations.save(reverse)
    const account = await this.requireAccount(allocation.accountId)
    await this.creditAccount(account, allocation.amount.amount, AccountEntrySourceKind.AllocationReverse, reverse.id, reverse.effectiveAt)
    const charge = await this.requireCharge(allocation.chargeId)
    const next = [...siblings, reverse]
    await this.baseService.entities.studentCharges.save(this.projectCharge(charge, next))
    return reverse
  }

  private projectCharge(charge: StudentCharge, allocations: Allocation[]): StudentCharge {
    const settlement = netActiveSettlement(allocations, charge.id)
    const overdueRemainder = overdueInstallmentRemainder(charge.copyWith({ allocatedAmount: settlement }), settlement, new Date())
    const status = deriveChargeStatus({
      cancelled: !!charge.cancelledAt,
      expectedAmount: charge.expectedAmount.amount,
      adjustmentAmount: charge.adjustmentAmount.amount,
      waiverAmount: charge.waiverAmount.amount,
      settlement,
      overdueRemainder,
    })
    return charge.copyWith({ allocatedAmount: settlement, status, updatedAt: new Date() })
  }

  private async getOrCreateAccount(identity: { studentId: string, academicYearId: string, currency: string }): Promise<StudentYearAccount> {
    const id = studentYearAccountId(this.schoolId(), identity.studentId, identity.academicYearId, identity.currency)
    const existing = await this.repositories.studentYearAccounts.findById(id)
    if (existing)
      return existing
    const student = await this.requireStudent(identity.studentId)
    this.checkActorSchool(student.schoolId)
    const year = await this.repositories.academicYears.findById(identity.academicYearId)
    if (!year || year.schoolId !== student.schoolId)
      denyResourceAccess()
    const account = new StudentYearAccountEntity({
      id,
      schoolId: student.schoolId,
      studentId: student.id,
      academicYearId: identity.academicYearId,
      currency: identity.currency,
      availableBalance: 0,
    })
    await this.baseService.entities.studentYearAccounts.save(account)
    return account
  }

  private async creditAccount(
    account: StudentYearAccount,
    amount: number,
    sourceKind: AccountEntrySourceKind,
    sourceId: string,
    effectiveAt: Date,
  ): Promise<StudentYearAccount> {
    return this.postEntry(account, AccountEntryDirection.Credit, amount, sourceKind, sourceId, effectiveAt)
  }

  private async debitAccount(
    account: StudentYearAccount,
    amount: number,
    sourceKind: AccountEntrySourceKind,
    sourceId: string,
    effectiveAt: Date,
  ): Promise<StudentYearAccount> {
    if (amount > account.availableBalance.amount)
      fail('NEGATIVE_AVAILABLE_FUNDS', 'Available funds cannot become negative')
    return this.postEntry(account, AccountEntryDirection.Debit, amount, sourceKind, sourceId, effectiveAt)
  }

  private async postEntry(
    account: StudentYearAccount,
    direction: AccountEntryDirection,
    amount: number,
    sourceKind: AccountEntrySourceKind,
    sourceId: string,
    effectiveAt: Date,
  ): Promise<StudentYearAccount> {
    const nextBalance = account.availableBalance.amount + (direction === AccountEntryDirection.Credit ? amount : -amount)
    if (nextBalance < 0)
      fail('NEGATIVE_AVAILABLE_FUNDS', 'Available funds cannot become negative')
    const entry = new StudentAccountEntry({
      id: `sae-${crypto.randomUUID()}`,
      schoolId: account.schoolId,
      accountId: account.id,
      direction,
      amount,
      currency: account.currency,
      sourceKind,
      sourceId,
      effectiveAt,
      recordedAt: new Date(),
      resultingAvailableBalance: nextBalance,
    })
    await this.repositories.studentAccountEntries.save(entry)
    const updated = account.copyWith({ availableBalance: nextBalance, updatedAt: new Date() })
    await this.baseService.entities.studentYearAccounts.save(updated)
    return updated
  }

  private async assertUniqueReference(account: StudentYearAccount, reference: string | undefined, paymentId: string): Promise<void> {
    if (!reference)
      return
    const matches = await this.repositories.payments.list({
      schoolId: account.schoolId,
      academicYearId: account.academicYearId,
      reference,
    })
    if (matches.some(payment => payment.id !== paymentId))
      fail('PAYMENT_REFERENCE_DUPLICATE', `Payment reference ${reference} is already used in this school year`)
  }

  private async resolveAccountIdentity(input: RecordPaymentInput): Promise<{ studentId: string, academicYearId: string, currency: string }> {
    if (input.accountId) {
      const existing = await this.repositories.studentYearAccounts.findById(input.accountId)
      if (existing) {
        if (existing.schoolId !== this.schoolId())
          denyResourceAccess()
        await assertSchoolCurrency(this.repositories, this.schoolId(), existing.currency)
        return { studentId: existing.studentId, academicYearId: existing.academicYearId, currency: existing.currency }
      }
      const parsed = parseStudentYearAccountId(input.accountId, this.schoolId())
      if (!parsed)
        denyResourceAccess()
      await assertSchoolCurrency(this.repositories, this.schoolId(), parsed.currency)
      return { studentId: parsed.studentId, academicYearId: parsed.academicYearId, currency: parsed.currency }
    }
    if (!input.studentId || !input.academicYearId)
      fail('ACCOUNT_REQUIRED', 'recordPayment requires accountId or studentId and academicYearId')
    const currency = await requireSchoolCurrency(this.repositories, this.schoolId())
    return { studentId: input.studentId, academicYearId: input.academicYearId, currency }
  }

  private async paymentLockKeys(input: RecordPaymentInput, plan: AllocationPlan): Promise<string[]> {
    const identity = await this.resolveAccountIdentity(input)
    const accountId = studentYearAccountId(this.schoolId(), identity.studentId, identity.academicYearId, identity.currency)
    const chargeIds = plan.mode === 'targeted'
      ? plan.targets.map(target => target.chargeId)
      : (await this.repositories.studentCharges.list({
          studentId: identity.studentId,
          academicYearId: identity.academicYearId,
        })).map(charge => charge.id)
    return [
      `account:${accountId}`,
      `account-create:${this.schoolId()}:${identity.studentId}:${identity.academicYearId}:${identity.currency}`,
      `payment:${input.id}`,
      ...chargeIds.map(id => `charge:${id}`),
    ]
  }

  private async allocationLockKeys(accountId: string, plan: AllocationPlan): Promise<string[]> {
    const account = await this.requireAccount(accountId)
    const chargeIds = plan.mode === 'targeted'
      ? plan.targets.map(target => target.chargeId)
      : (await this.repositories.studentCharges.list({ studentId: account.studentId, academicYearId: account.academicYearId })).map(charge => charge.id)
    return [`account:${accountId}`, ...chargeIds.map(id => `charge:${id}`)]
  }

  private async reverseAllocationLockKeys(allocationId: string): Promise<string[]> {
    const allocation = await this.requireAllocation(allocationId)
    return [`account:${allocation.accountId}`, `charge:${allocation.chargeId}`, `allocation:${allocation.id}`]
  }

  private async reversePaymentLockKeys(input: ReversePaymentInput): Promise<string[]> {
    const payment = await this.requirePayment(input.paymentId)
    const extras = (input.reverseAllocationIds ?? []).map(id => `allocation:${id}`)
    return [`account:${payment.accountId}`, `payment:${payment.id}`, ...extras]
  }

  private sameCatalog(existing: CatalogService, input: CreateCatalogServiceInput): CatalogService {
    if (existing.name !== input.name || existing.defaultPrice.amount !== input.defaultPrice || existing.academicYearId !== input.academicYearId)
      fail('CATALOG_REPLAY_CONFLICT', 'Catalog service ID was already used with a different payload')
    return existing
  }

  private schoolId(): string {
    return this.baseService.actor.schoolId
  }

  private actorId(): string {
    return resolveAuditActorId(this.baseService.actor)
  }

  private async requireCatalog(id: string): Promise<CatalogService> {
    const service = await this.repositories.catalogServices.findById(id)
    if (!service || service.schoolId !== this.schoolId())
      denyResourceAccess()
    return service
  }

  private async requireEnrollment(id: string): Promise<StudentServiceEnrollment> {
    const enrollment = await this.repositories.studentServiceEnrollments.findById(id)
    if (!enrollment || enrollment.schoolId !== this.schoolId())
      denyResourceAccess()
    return enrollment
  }

  private async requireCharge(id: string): Promise<StudentCharge> {
    const charge = await this.repositories.studentCharges.findById(id)
    if (!charge || charge.schoolId !== this.schoolId())
      denyResourceAccess()
    return charge
  }

  private async requireAccount(id: string): Promise<StudentYearAccount> {
    const account = await this.repositories.studentYearAccounts.findById(id)
    if (!account || account.schoolId !== this.schoolId())
      denyResourceAccess()
    return account
  }

  private async requirePayment(id: string): Promise<Payment> {
    const payment = await this.repositories.payments.findById(id)
    if (!payment || payment.schoolId !== this.schoolId())
      denyResourceAccess()
    return payment
  }

  private async requireAllocation(id: string): Promise<Allocation> {
    const allocation = await this.repositories.allocations.findById(id)
    if (!allocation || allocation.schoolId !== this.schoolId())
      denyResourceAccess()
    return allocation
  }

  private async run<Result, Stored extends CommandJson = { id: string }>(options: {
    command: SchoolCommandKey
    requestId: string
    input: unknown
    lockKeys: string[]
    authorize: () => Promise<void>
    execute: () => Promise<Result>
    replay: (stored: Stored) => Promise<Result>
    persistResult: (result: Result) => Stored
  }): Promise<Result> {
    return this.baseService.commandExecution.execute<Result, Stored>({
      scope: await schoolCommandScope(this.baseService.actor, options.command, options.requestId),
      input: options.input,
      resultMode: 'ordinary',
      lockKeys: [`0-finance-state:${this.schoolId()}`, ...options.lockKeys ?? []],
      authorize: options.authorize,
      execute: options.execute,
      replay: stored => options.replay(stored),
      persistResult: result => options.persistResult(result),
      audit: (result) => {
        const stored = options.persistResult(result)
        return [{ event: options.command, resourceType: 'finance', resourceId: resourceIdFromStored(stored, options.requestId) }]
      },
    })
  }
}
