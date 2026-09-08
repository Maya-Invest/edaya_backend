import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const fees = pgTable('fees', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  defaultAmount: integer('default_amount').notNull(),
  currency: text('currency').notNull(),
  installments: jsonb('installments').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('fees', table))

// 12. Student Fee Table

export const studentFees = pgTable('student_fees', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  feeId: text('fee_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  expectedAmount: integer('expected_amount').notNull(),
  paidAmount: integer('paid_amount').notNull(),
  adjustmentAmount: integer('adjustment_amount').notNull(),
  adjustmentReason: text('adjustment_reason'),
  adjustedById: text('adjusted_by_id'),
  adjustedAt: timestamp('adjusted_at', { mode: 'date' }),
  currency: text('currency').notNull(),
  dueDate: timestamp('due_date', { mode: 'date' }),
  status: text('status').notNull(),
  cancellationReason: text('cancellation_reason'),
  cancelledById: text('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  installments: jsonb('installments').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
}, table => definePerformanceIndexes('student_fees', table))

// 13. Payment Table

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  studentFeeId: text('student_fee_id').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  paymentDate: timestamp('payment_date', { mode: 'date' }).notNull(),
  method: text('method').notNull(),
  status: text('status').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  recordedById: text('recorded_by_id'),
  reversedAt: timestamp('reversed_at', { mode: 'date' }),
  reversedById: text('reversed_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  cancelledById: text('cancelled_by_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('payments', table))

// 14. Schedule Table
