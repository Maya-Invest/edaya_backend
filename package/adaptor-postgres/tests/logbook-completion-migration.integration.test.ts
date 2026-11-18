import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

test('populated cutover preserves original evidence and rebuilds weighted coverage after corrections', async () => {
  const db = new PGlite()
  const migrations = join(import.meta.dir, '../drizzle')
  try {
    for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && name < '0057_').sort())
      await db.exec(await Bun.file(join(migrations, name)).text())
    await db.exec(`
      INSERT INTO schools(id,short_name,name,time_zone,created_at) VALUES('school','School','School','UTC',now());
      INSERT INTO class_groups(id,school_id,grade_level_id,name,short_name,academic_year_id,created_at) VALUES('group','school','grade','Group','Group','year',now());
      INSERT INTO class_subjects(id,class_group_id,subject_id,created_at,completed_percentage)
        VALUES ('offering','group','subject',now(),50);
      INSERT INTO subject_matters(id,subject_id,name,short_name,sequence_order,created_at)
        SELECT id,'subject',id,id,1,now() FROM unnest(ARRAY['a','b','c']) id;
      INSERT INTO class_subject_matters(id,class_subject_id,subject_matter_id,status,completed_percentage,updated_at)
        SELECT id,'offering',id,'not_started',0,now() FROM subject_matters;
      INSERT INTO lesson_sessions(id,school_id,class_group_id,class_subject_id,status,is_exception,starts_at,ends_at,calendar_date,display_label,created_at)
        SELECT 'lesson-'||day,'school','group','offering','completed',false,'2026-01-01'::date+day,'2026-01-02'::date+day,'2026-01-01'::date+day,'Lesson',now()
        FROM generate_series(1,3) day;
      INSERT INTO class_subject_progress(id,class_subject_matter_id,lesson_session_id,completed_percentage,notes,recorded_at)
        VALUES ('review','a','lesson-3',100,'Review','2026-01-05'),('finish','a','lesson-2',100,'Finished','2026-02-01'),
        ('partial','b','lesson-1',35,NULL,now()),('zero','c','lesson-2',0,'Planned for later',now());
    `)
    const before = { workflow: 'logbook', targetId: 'lesson-1', sessionNote: null, progress: [{ matterId: 'b', completedPercentage: 35 }] }
    const request = { id: 'request', workflow: 'logbook', targetId: 'lesson-1', before, proposal: { ...before, progress: [{ matterId: 'b', completedPercentage: 65 }] }, baseVersion: 4, version: 2, status: 'pending', revisions: [] }
    for (const [target, payload] of [['lesson-1', { version: 4, locked: true }], ['correction:request', { payload: { snapshot: before } }]] as const)
      await db.query(`INSERT INTO teacher_workflow_states VALUES('school','logbook',$1,$2::jsonb)`, [target, JSON.stringify(payload)])
    await db.query(`INSERT INTO teacher_corrections(id,school_id,class_group_id,workflow,target_id,status,created_at,payload)
      VALUES('request','school','group','logbook','lesson-1','pending',now(),$1::jsonb)`, [JSON.stringify(request)])
    const migration = await Bun.file(join(migrations, '0057_logbook_completion.sql')).text()
    const migrate = () => db.transaction(async (tx) => {
      for (const part of migration.split('--> statement-breakpoint')) await tx.query(part)
    })
    const facts = async () => (await db.query('select id,completed,completed_percentage,notes from class_subject_progress order by id')).rows
    const report = async (name: string) => db.exec(await Bun.file(join(migrations, '../../../tooling/repo/db/school', name)).text())
    const inventory = await report('logbook-inventory.sql')
    expect(inventory[1]!.rows).toEqual([])
    await migrate()
    const reconciliation = await report('logbook-reconciliation.sql')
    expect(reconciliation.slice(0, 2).map(query => query.rows)).toEqual([[], []])
    const migrated = (await db.query<{ payload: typeof request & { legacySourceConflict?: boolean } }>('select payload from teacher_corrections')).rows[0]!.payload
    expect(migrated.before).toEqual(migrated.proposal)
    expect(migrated.legacySourceConflict).toBeUndefined()
    expect(migrated.version).toBe(2)
    expect((await db.query(`select original from logbook_legacy_workflows where kind='request'`)).rows[0]).toEqual({ original: request })
    expect((await db.query(`select payload->'locked' as locked from teacher_workflow_states where target_id='lesson-1'`)).rows[0]).toEqual({ locked: true })
    const first = await facts()
    expect(first).toEqual([
      { id: 'finish', completed: true, completed_percentage: 100, notes: 'Finished' },
      { id: 'partial', completed: false, completed_percentage: 35, notes: null },
      { id: 'review', completed: false, completed_percentage: 100, notes: 'Review' },
      { id: 'zero', completed: null, completed_percentage: 0, notes: 'Planned for later' },
    ])
    await migrate()
    expect(await facts()).toEqual(first)
    const summary = async () => (await db.query('select completed_percentage,chapter_count,completed_chapter_count,ongoing_chapter_count from class_subjects')).rows[0]
    await db.exec('update subject_matters set progress_weight=2 where id=\'a\'')
    expect(await summary()).toEqual({ completed_percentage: 63, chapter_count: 3, completed_chapter_count: 1, ongoing_chapter_count: 1 })
    await db.exec('update class_subject_progress set completed=false where id=\'finish\'')
    expect(await summary()).toMatchObject({ completed_percentage: 38, completed_chapter_count: 0, ongoing_chapter_count: 2 })
    await migrate()
    expect(await summary()).toMatchObject({ completed_percentage: 38 })
    await db.exec('update class_subject_progress set completed=true where id in (\'finish\',\'review\')')
    await db.exec('delete from class_subject_progress where id=\'finish\'')
    expect(await summary()).toMatchObject({ completed_percentage: 63 })
    await db.exec('delete from class_subject_progress where id=\'review\'')
    expect(await summary()).toMatchObject({ completed_percentage: 13, ongoing_chapter_count: 1 })
    await db.exec(`INSERT INTO class_subjects(id,class_group_id,subject_id,created_at) VALUES('other','other-class','subject',now());
      INSERT INTO class_subject_matters(id,class_subject_id,subject_matter_id,updated_at) VALUES ('other-a','other','a',now()), ('other-b','other','b',now());
      UPDATE subject_matters SET progress_weight=0.5 WHERE id='a';`)
    const offerings = (await db.query('select id,completed_percentage from class_subjects order by id')).rows
    expect(offerings).toEqual([{ id: 'offering', completed_percentage: 20 }, { id: 'other', completed_percentage: 0 }])
    await expect(db.exec('update subject_matters set progress_weight=0')).rejects.toThrow()
    const backup = await db.dumpDataDir()
    const restored = await PGlite.create({ loadDataDir: backup })
    try {
      expect((await restored.query('select id,completed_percentage from class_subjects order by id')).rows).toEqual(offerings)
      expect((await restored.query('select id,completed,completed_percentage,notes from class_subject_progress order by id')).rows).toEqual(await facts())
    }
    finally { await restored.close() }
  }
  finally { await db.close() }
}, 120000)
