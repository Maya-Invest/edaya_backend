import type { CalculatedGrade, ReportCardResult } from '@edaya/core'
import { roundGrade } from '@edaya/core'

function zeroDecimal(currency: string): boolean {
  return ['XOF', 'XAF', 'JPY', 'KRW', 'VND'].includes(currency)
}

export function formatDocumentMoney(amountMinor: number, currency: string, locale: string): string {
  const digits = zeroDecimal(currency) ? 0 : 2
  const value = digits === 0 ? amountMinor : amountMinor / 100
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function formatDocumentDate(value: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'long', day: 'numeric' }).format(value)
}

export function formatDocumentIsoDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}

export function formatReportAverage(value: number, grading: CalculatedGrade | undefined, locale: string): string {
  const digits = grading?.decimalPlaces ?? 2
  const reported = grading ? roundGrade(value, grading) : value
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(reported)} / ${grading?.maximum ?? 20}`
}

/** Class statistics use published snapshots with matching grading and module configuration. */
export function gradingPeerAverages(result: ReportCardResult, peers: readonly ReportCardResult[]): number[] {
  const values: number[] = []
  for (const peer of [...peers].sort((a, b) => a.id.localeCompare(b.id))) {
    const candidates = [peer, ...peer.publicationHistory]
    const sameRevision = candidates.find(candidate => candidate.status === 'published' && candidate.reportConfigurationRevision === result.reportConfigurationRevision && candidate.gradingPolicyRevision === result.gradingPolicyRevision && candidate.grading?.maximum === result.grading?.maximum && candidate.grading?.scaleId === result.grading?.scaleId && !candidate.calculationStale)
    if (!sameRevision)
      return []
    const value = sameRevision.grading?.value ?? sameRevision.overallAverage
    if (value !== undefined)
      values.push(value)
  }
  return values
}
