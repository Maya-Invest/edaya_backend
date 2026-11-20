interface Section {
  sectionId: string
  sectionKind: string
  average?: number | null
  rank?: number | null
  participantCount?: number | null
  subResults?: Section[]
  [key: string]: unknown
}
interface Snapshot {
  academicYearId: string
  periodId: string
  reportConfigurationRevision: number
  overallAverage?: number | null
  calculationStale?: boolean
  rank?: number | null
  classSize?: number | null
  version: number
  sectionResults: Section[]
}
export interface RankingInput { id: string, payload: { snapshot: Snapshot, mutable: boolean, revised: boolean } }

/** Competition ranks use only captured scores from the caller's authorized class/policy cohort. */
export function refreshReportRankings(rows: RankingInput[]) {
  const cohorts = new Map<string, Array<{ id: string, score: number }>>()
  const key = (snapshot: Snapshot, section = '') => JSON.stringify([snapshot.academicYearId, snapshot.periodId, snapshot.reportConfigurationRevision, section])
  const add = (group: string, id: string, score: number | null | undefined) => {
    if (score == null || !Number.isFinite(score))
      return
    const entries = cohorts.get(group) ?? []
    entries.push({ id, score })
    cohorts.set(group, entries)
  }
  for (const { id, payload: { snapshot } } of rows) {
    if (snapshot.calculationStale)
      continue
    add(key(snapshot), id, snapshot.overallAverage)
    const visit = (sections: Section[]) => {
      for (const section of sections) {
        add(key(snapshot, `${section.sectionKind}:${section.sectionId}`), id, section.average)
        visit(section.subResults ?? [])
      }
    }
    visit(snapshot.sectionResults)
  }
  const ranks = new Map<string, Map<string, { rank: number, count: number }>>()
  for (const [group, entries] of cohorts) {
    entries.sort((a, b) => b.score - a.score)
    let rank = 0
    ranks.set(group, new Map(entries.map((entry, index) => {
      if (!index || entry.score !== entries[index - 1]!.score)
        rank = index + 1
      return [entry.id, { rank, count: entries.length }]
    })))
  }
  return rows.flatMap(({ id, payload: { snapshot, mutable, revised } }) => {
    if (!mutable)
      return []
    const result = snapshot.calculationStale ? undefined : ranks.get(key(snapshot))?.get(id)
    let changed = (snapshot.rank ?? null) !== (result?.rank ?? null) || (snapshot.classSize ?? null) !== (result?.count ?? null)
    const patch = (sections: Section[]): Section[] => sections.map((section) => {
      const ranking = snapshot.calculationStale ? undefined : ranks.get(key(snapshot, `${section.sectionKind}:${section.sectionId}`))?.get(id)
      changed ||= (section.rank ?? null) !== (ranking?.rank ?? null) || (section.participantCount ?? null) !== (ranking?.count ?? null)
      return { ...section, rank: ranking?.rank ?? null, participantCount: ranking?.count ?? null, subResults: patch(section.subResults ?? []) }
    })
    const sections = patch(snapshot.sectionResults)
    return changed ? [{ id, revised, rank: result?.rank ?? null, size: result?.count ?? null, sections, previous_version: snapshot.version, version: snapshot.version + 1 }] : []
  })
}
