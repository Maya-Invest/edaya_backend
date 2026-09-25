import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/** Mirrors installment aging: allocate settlement to the earliest due installment first. */
export function chargeAgingCtes(charges: SQL, at: Date): SQL {
  return sql`charges as (${charges}), installments as (
    select c.id, c.student_id, c.status, c.allocated_amount,
      (i->>'expectedAmount')::numeric as amount, (i->>'dueDate')::timestamp as due,
      coalesce(sum((i->>'expectedAmount')::numeric) over (partition by c.id order by (i->>'dueDate')::timestamp nulls last, i->>'id' collate "C" rows between unbounded preceding and 1 preceding), 0) as prior
    from charges c cross join lateral jsonb_array_elements(case when jsonb_array_length(c.installments) > 0 then c.installments else
      jsonb_build_array(jsonb_build_object('id', c.id, 'expectedAmount', greatest(0, c.expected_amount-c.adjustment_amount-c.waiver_amount), 'dueDate', c.due_date)) end) i
  ), overdue as (
    select id, student_id, sum(greatest(0, amount-greatest(0, allocated_amount-prior))) as amount from installments
    where status <> 'cancelled' and due < ${at.toISOString()}::timestamp group by id, student_id
    having sum(greatest(0, amount-greatest(0, allocated_amount-prior))) > 0
  )`
}
