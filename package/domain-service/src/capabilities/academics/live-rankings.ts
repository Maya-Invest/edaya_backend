import type { Assessment, AssessmentResult, ClassSubject, GradingPolicy, ReportCardAggregation, ReportCardResult } from '@edaya/core'
import { roundGrade } from '@edaya/core'
import { buildSubjectAverageFromAssessments, buildSubjectAverageFromPriorReportCards } from '../../services/workflows/report-card-aggregation'
import { groupByKey } from '../shared/bounded-reads'

interface Ranking { rank: number, participantCount: number }

function competitionRanks(entries: Array<{ id: string, value: number }>) {
  entries.sort((a, b) => b.value - a.value)
  const ranks = new Map<string, Ranking>()
  let previous: number | undefined
  let rank = 0
  for (const [index, entry] of entries.entries()) {
    if (entry.value !== previous)
      rank = index + 1
    ranks.set(entry.id, { rank, participantCount: entries.length })
    previous = entry.value
  }
  return ranks
}

const legacyPrecision = { decimalPlaces: 2, roundingMode: 'nearest' } as const

/** Only submitted roster members with comparable official values participate. */
export function evaluationRankings(assessments: Assessment[], results: AssessmentResult[]) {
  const ranks = new Map<string, Ranking>()
  const byAssessment = groupByKey(results, result => result.assessmentId)
  for (const assessment of assessments) {
    if (assessment.marksStatus !== 'submitted')
      continue
    const roster = new Set(assessment.marksReview.rosterStudentIds)
    const eligible = (byAssessment.get(assessment.id) ?? []).filter(result =>
      roster.has(result.studentId) && result.designation !== 'absent' && result.designation !== 'exempt')
    const groups = groupByKey(eligible, ({ calculation }) => calculation
      ? JSON.stringify([calculation.scaleId, calculation.scaleRevision, calculation.policyRevision, calculation.units])
      : 'legacy')
    for (const rows of groups.values()) {
      const entries = rows.flatMap((row) => {
        const value = row.calculation?.reportedValue ?? (row.score === undefined ? undefined : roundGrade(row.score, legacyPrecision))
        return value === undefined ? [] : [{ id: row.id, value }]
      })
      for (const [id, rank] of competitionRanks(entries)) ranks.set(id, rank)
    }
  }
  return ranks
}

export function subjectStandings(assessments: Assessment[], results: AssessmentResult[], policy?: GradingPolicy) {
  const standings = new Map<string, Map<string, Ranking & { value: number }>>()
  if (policy && policy.status !== 'completed')
    return standings
  const byAssessment = groupByKey(results, result => result.assessmentId)
  for (const [offering, sheets] of groupByKey(assessments, row => row.classSubjectId)) {
    const contributions = sheets.flatMap((assessment) => {
      const roster = new Set(assessment.marksReview.rosterStudentIds)
      return (byAssessment.get(assessment.id) ?? []).filter(row => roster.has(row.studentId)).map(result => ({ result, assessment }))
    })
    const entries = []
    for (const [id, rows] of groupByKey(contributions, row => row.result.studentId)) {
      if (rows.some(({ result }) => result.calculation && (!policy || result.calculation.policyRevision !== policy.revision || result.calculation.scaleId !== policy.scale.id || result.calculation.scaleRevision !== policy.scale.revision)))
        continue
      const average = buildSubjectAverageFromAssessments(offering, rows, policy)
      if (average !== undefined)
        entries.push({ id, value: roundGrade(average, policy?.scale ?? legacyPrecision) })
    }
    const ranks = competitionRanks(entries)
    standings.set(offering, new Map(entries.map(({ id, value }) => [id, { ...ranks.get(id)!, value }])))
  }
  return standings
}

export function subjectStandingsFromReports(reports: ReportCardResult[], offerings: ClassSubject[], aggregation: ReportCardAggregation, policy: GradingPolicy) {
  const bySubject = new Map(offerings.map(row => [row.id, row.subjectId]))
  const byStudent = groupByKey(reports, row => row.studentId)
  return new Map(offerings.map((offering) => {
    const entries: Array<{ id: string, value: number }> = []
    for (const [id, rows] of byStudent) {
      const sources = new Map(rows.map(row => [row.periodId, row]))
      if (sources.size !== rows.length || !aggregation.sourcePeriodIds.every(periodId => sources.get(periodId)?.gradingPolicyRevision === policy.revision))
        continue
      const value = buildSubjectAverageFromPriorReportCards(`subject:${offering.subjectId}`, aggregation, sources, { id: offering.subjectId, byClassSubject: bySubject }, policy)
      if (value !== undefined)
        entries.push({ id, value: roundGrade(value, policy.scale) })
    }
    const ranked = competitionRanks(entries)
    return [offering.id, new Map(entries.map(({ id, value }) => [id, { ...ranked.get(id)!, value }]))] as const
  }))
}
