import { seedUpcomingDate } from './dates'
import { SEED_EXTENDED_PAYMENTS, SEED_EXTENDED_STUDENT_FEES } from './extended-dataset'
import { SEED_POPULATION_PAYMENTS, SEED_POPULATION_STUDENT_FEES } from './population-seed'

/** Currency for seeded fee and payment amounts (Paris campus). */
export const SEED_CURRENCY = 'EUR'

const SEED_FEE_YEARLY_INSTALLMENTS = [
  { label: 'September', percentage: 33.33, dueDate: '2025-09-15' },
  { label: 'January', percentage: 33.33, dueDate: '2026-01-15' },
  { label: 'May', percentage: 33.34, dueDate: '2026-05-15' },
] as const

/** School fee catalog from `apps/webapp/src/lib/data/school.ts` `fees[]`. */
export const SEED_FEES = [
  {
    id: 'f1',
    name: 'Tuition — Middle School',
    category: 'tuition' as const,
    defaultAmount: 4800,
    installments: SEED_FEE_YEARLY_INSTALLMENTS,
  },
  {
    id: 'f2',
    name: 'Tuition — High School',
    category: 'tuition' as const,
    defaultAmount: 5600,
    installments: SEED_FEE_YEARLY_INSTALLMENTS,
  },
  {
    id: 'f3',
    name: 'School bus',
    category: 'transport' as const,
    defaultAmount: 720,
    installments: [{ label: 'Annual', percentage: 100, dueDate: '2025-09-15' }],
  },
  {
    id: 'f4',
    name: 'Cafeteria plan',
    category: 'other' as const,
    defaultAmount: 180,
    installments: [] as const,
  },
  {
    id: 'f5',
    name: 'Sports club',
    category: 'other' as const,
    defaultAmount: 240,
    installments: [{ label: 'Term', percentage: 100, dueDate: '2026-01-15' }],
  },
  {
    id: 'f6',
    name: 'Textbook pack',
    category: 'other' as const,
    defaultAmount: 160,
    installments: [{ label: 'Annual', percentage: 100, dueDate: '2025-09-15' }],
  },
] as const

/** Student billing lines with due dates in the dashboard upcoming window. */
export const SEED_UPCOMING_STUDENT_FEES = [
  { id: 'b9', studentId: 's7', feeId: 'f5', total: 240, dueDate: seedUpcomingDate(2) },
  { id: 'b10', studentId: 's8', feeId: 'f6', total: 160, dueDate: seedUpcomingDate(4) },
] as const

/**
 * Student billing lines from mock `billing[]`.
 * UI-only mock fields (`status`) are derived by payment workflow, not stored here.
 */
export const SEED_STUDENT_FEES = [
  { id: 'b1', studentId: 's1', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b2', studentId: 's2', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b3', studentId: 's3', feeId: 'f1', total: 4800, dueDate: '2026-04-15' },
  { id: 'b4', studentId: 's4', feeId: 'f3', total: 720, dueDate: '2025-09-30' },
  { id: 'b5', studentId: 's5', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b6', studentId: 's6', feeId: 'f4', total: 1620, dueDate: '2026-06-01' },
  ...SEED_UPCOMING_STUDENT_FEES,
  ...SEED_EXTENDED_STUDENT_FEES,
  ...SEED_POPULATION_STUDENT_FEES,
] as const

/** Paid installments from mock `billing[]` — replayed via `recordPayment`. */
export const SEED_PAYMENTS = [
  { id: 'pay-b1-1', studentFeeId: 'b1', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b1-2', studentFeeId: 'b1', amount: 1600, paymentDate: '2026-01-15' },
  { id: 'pay-b1-3', studentFeeId: 'b1', amount: 1600, paymentDate: '2026-05-15' },
  { id: 'pay-b2-1', studentFeeId: 'b2', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b2-2', studentFeeId: 'b2', amount: 1600, paymentDate: '2026-01-15' },
  { id: 'pay-b3-1', studentFeeId: 'b3', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b4-1', studentFeeId: 'b4', amount: 720, paymentDate: '2025-09-15' },
  { id: 'pay-b5-1', studentFeeId: 'b5', amount: 4800, paymentDate: '2025-09-15' },
  { id: 'pay-b6-1', studentFeeId: 'b6', amount: 180, paymentDate: '2025-10-01' },
  { id: 'pay-b6-2', studentFeeId: 'b6', amount: 180, paymentDate: '2025-11-01' },
  { id: 'pay-b6-3', studentFeeId: 'b6', amount: 180, paymentDate: '2025-12-01' },
  { id: 'pay-b6-4', studentFeeId: 'b6', amount: 180, paymentDate: '2026-01-01' },
  { id: 'pay-b6-5', studentFeeId: 'b6', amount: 180, paymentDate: '2026-02-01' },
  ...SEED_EXTENDED_PAYMENTS,
  ...SEED_POPULATION_PAYMENTS,
] as const
