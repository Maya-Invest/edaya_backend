import type { Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError, GradeLevel, ReportCardResult, withShortName } from '@edaya/core'

/** Called under the school academic lock, including by curriculum/import hooks. */
export async function invalidateReportConfiguration(repositories: SchoolRepositories, gradeLevelId: string, academicYearId: string) {
  const level = await repositories.gradeLevels.findById(gradeLevelId)
  if (!level)
    throw new BusinessRuleViolationError('REPORT_LEVEL_REQUIRED', 'The report grade level no longer exists')
  const settings = level.reportSettingsFor(academicYearId)
  const updated = new GradeLevel(withShortName({ ...level.data, reportSettings: [...level.reportSettings.filter(row => row.academicYearId !== academicYearId), { ...settings, revision: settings.revision + 1 }] }))
  await repositories.gradeLevels.forSchool!(level.schoolId).save(updated)
  let after = ''
  for (;;) {
    const results = await repositories.results.forSchool!(level.schoolId).list({ gradeLevelId, academicYearId, id: { $gt: after }, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 50 })
    for (const result of results) {
      if (result.status === 'published' && !result.revisedDraft)
        continue
      const revisedDraft = result.revisedDraft ? { ...result.revisedDraft, calculationStale: true, version: result.revisedDraft.version + 1, rank: undefined } : undefined
      await repositories.results.forSchool!(level.schoolId).save(new ReportCardResult({ ...result.data, sectionResults: [...result.sectionResults], ...(result.status === 'draft' ? { calculationStale: true, version: result.version + 1, rank: undefined } : {}), revisedDraft }))
    }
    if (results.length < 50)
      break
    after = results.at(-1)!.id
  }
  return updated.reportSettingsFor(academicYearId)
}

export async function subjectReportConfigurationChanged(subject: Subject, previous: Subject | undefined, repositories: SchoolRepositories) {
  if (!previous || ['name', 'coefficient', 'reportModuleId', 'reportOrder'].some(key => subject.data[key as keyof Subject['data']] !== previous.data[key as keyof Subject['data']]))
    await invalidateReportConfiguration(repositories, subject.gradeLevelId, subject.academicYearId)
}
