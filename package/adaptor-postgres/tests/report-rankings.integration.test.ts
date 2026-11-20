import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresAssessmentDependencies } from '../src/stores/assessment-dependencies-store'

test('captured section rankings isolate cohorts, retain publications and version only changed drafts', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create table class_groups(id text primary key, school_id text);
      create table report_card_results(id text primary key, class_group_id text, academic_year_id text, period_id text,
        grading_policy_revision integer, report_configuration_revision integer, overall_average numeric, rank integer,
        class_size integer, calculation_stale boolean, version integer, status text, section_results jsonb, revised_draft jsonb);
      insert into class_groups values ('class','school'),('other','foreign');`)
    const sections = (score?: number) => [{ sectionId: 'module:science', sectionKind: 'module', average: score, weight: 1, name: 'Science', comment: 'Preserved', subResults: [{ sectionId: 'subject:math', sectionKind: 'subject', average: score, name: 'Math', weight: 1, subResults: [] }] }]
    async function add(id: string, score?: number, extra: { status?: string, period?: string, stale?: boolean, group?: string, revision?: number, revised?: boolean } = {}) {
      const snapshot = { academicYearId: 'year', periodId: extra.period ?? 'term', gradingPolicyRevision: 1, reportConfigurationRevision: extra.revision ?? 1, overallAverage: score, version: 5, sectionResults: sections(score), calculationStale: extra.stale ?? false }
      await db.query('insert into report_card_results values ($1,$2,$3,$4,1,$5,$6,null,null,$7,5,$8,$9,$10)', [id, extra.group ?? 'class', 'year', snapshot.periodId, snapshot.reportConfigurationRevision, score ?? null, extra.stale ?? false, extra.status ?? 'draft', JSON.stringify(sections(score)), extra.revised ? JSON.stringify(snapshot) : null])
    }
    await add('one', 18)
    await add('tie', 18)
    await add('zero', 0)
    await add('absent')
    await add('published', 12, { status: 'published' })
    await add('revision', 15, { status: 'published', revised: true })
    await add('stale', 20, { stale: true })
    await add('annual', 2, { period: 'annual' })
    await add('other-config', 20, { revision: 2 })
    await add('foreign', 20, { group: 'other' })
    const store = new PostgresAssessmentDependencies(drizzle(db))
    const read = async (id: string) => (await db.query<any>('select * from report_card_results where id=$1', [id])).rows[0]
    const publication = await read('published')
    const revisedOriginal = await read('revision')
    await store.refreshGradingRankings({ schoolId: 'school', classGroupId: 'class', policyRevision: 1 })
    expect((await read('one')).section_results[0]).toMatchObject({ rank: 1, participantCount: 5, comment: 'Preserved', subResults: [{ rank: 1, participantCount: 5 }] })
    expect((await read('tie')).rank).toBe(1)
    expect((await read('zero')).section_results[0]).toMatchObject({ rank: 5, participantCount: 5 })
    expect((await read('absent')).section_results[0].rank).toBeUndefined()
    expect((await read('stale')).rank).toBeNull()
    expect((await read('annual')).section_results[0]).toMatchObject({ rank: 1, participantCount: 1 })
    expect((await read('other-config')).rank).toBe(1)
    expect((await read('foreign')).version).toBe(5)
    expect(await read('published')).toEqual(publication)
    const revision = await read('revision')
    expect(revision.section_results).toEqual(revisedOriginal.section_results)
    expect(revision.version).toBe(5)
    expect(revision.revised_draft).toMatchObject({ version: 6, rank: 3, sectionResults: [{ rank: 3, participantCount: 5 }] })
    expect((await read('one')).version).toBe(6)
    await store.refreshGradingRankings({ schoolId: 'school', classGroupId: 'class', policyRevision: 1 })
    expect((await read('one')).version).toBe(6)
    // Removing a previously scored optional subject clears its saved rank and count.
    await db.query(`update report_card_results set section_results=$1 where id='zero'`, [JSON.stringify([{ ...sections()[0], rank: 5, participantCount: 5 }])])
    await store.refreshGradingRankings({ schoolId: 'school', classGroupId: 'class', policyRevision: 1 })
    expect((await read('zero')).section_results[0]).toMatchObject({ rank: null, participantCount: null })
    expect((await read('one')).section_results[0].participantCount).toBe(4)
  }
  finally { await db.close() }
})
