/** Synthetic structure only. No source names, phones, identifiers or school decisions. */
export function schoolSubmissionFixture() {
  const classes = Array.from({ length: 27 }, (_, index) => ({ name: `Reviewed class ${index + 1}`, grade: 'reviewed-grade', capacity: 50 }))
  const students = Array.from({ length: 1144 }, (_, index) => ({ identifier: String(index + 1).padStart(6, '0'), first_name: `Synthetic First ${index + 1}`, last_name: 'Synthetic Compound Last', class: classes[index % 27]!.name, is_repeating: index < 231, enrollment_effective_date: '2025-09-01' }))
  const teachers = Array.from({ length: 34 }, (_, index) => ({ code: `T${String(index + 1).padStart(3, '0')}`, first_name: `Synthetic Teacher ${index + 1}`, last_name: 'Synthetic Last', declared_hours: index < 31 ? 20 : index === 31 ? 29 : null, hours_period: 'unspecified' }))
  const coefficients = [
    ...Array.from({ length: 133 }, (_, index) => ({ source: `cell-${index + 1}`, kind: 'numeric', raw: String(index % 5 + 1), disposition: 'pending_review' })),
    ...Array.from({ length: 4 }, (_, index) => ({ source: `optional-${index + 1}`, kind: 'optional', raw: '1 FAC', disposition: 'pending_review' })),
    ...Array.from({ length: 2 }, (_, index) => ({ source: `alternative-${index + 1}`, kind: 'alternative', raw: 'A1/A2', disposition: 'pending_review' })),
    ...Array.from({ length: 11 }, (_, index) => ({ source: `dash-${index + 1}`, kind: 'dash', raw: '--', disposition: 'pending_review' })),
    ...Array.from({ length: 6 }, (_, index) => ({ source: `blank-${index + 1}`, kind: 'blank', raw: '', disposition: 'pending_review' })),
  ]
  const totals = Array.from({ length: 12 }, (_, index) => ({ source: `total-${index + 1}`, inconsistent: index < 3, disposition: 'pending_review' }))
  return { classes, students, teachers, coefficients, totals }
}
