import { createGuardianActorMetadata } from '@edaya/authorization'
import { AttendanceStatus } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

test('staff grade history groups every visible score and pages equal dates within the selected subject', async () => {
  const f = await createReportCardContext()
  await f.db.exec(`
    insert into assessments(id,class_group_id,class_subject_id,period_id,title,kind,max_score,coefficient,starts_at,created_at)
    values ('zero','cg1','cs1','per1','Zero','quiz',10,2,'2026-02-01',now()),
           ('pending','cg1','cs1','per1','Pending','homework',5,3,null,now());
    insert into assessment_results(id,student_id,assessment_id,score,created_at) values
      ('result-zero','stu1','zero',0,now()), ('result-pending','stu1','pending',null,now());
  `)
  const first = await f.service.getStudentGradeHistory({ studentId: 'stu1', limit: 1 })
  expect(first.total).toBe(3)
  expect(first.graded).toBe(2)
  expect(first.average).toBeCloseTo(16 / 3)
  expect(first.subjects).toEqual([{ subject: 'Math', total: 3, graded: 2, average: first.average! }])
  expect(first.items[0]).toMatchObject({ id: 'result-zero', subject: 'Math', date: '2026-02-01', score: 0, outOf: 10 })
  const rest = await f.service.getStudentGradeHistory({ studentId: 'stu1', cursor: first.nextCursor!, limit: 5 })
  expect(rest.items.map(row => row.id)).toEqual(['ar1', 'result-pending'])
  expect(rest.items[1]!.date).toBe('')
  expect(rest.nextCursor).toBeNull()
  const other = await f.service.getStudentGradeHistory({ studentId: 'stu1', subject: 'Unmatched' })
  expect(other.items).toEqual([])
  expect(other.subjects).toEqual(first.subjects)
  await expect(f.service.getStudentGradeHistory({ studentId: 'stu1', subject: 'Math', cursor: first.nextCursor! })).rejects.toThrow('cursor')
  await expect(f.service.getStudentGradeHistory({ studentId: 'unknown' })).rejects.toThrow()
  await f.db.exec('update assessment_results set score=10 where id=\'result-zero\'')
  expect((await f.service.getStudentGradeHistory({ studentId: 'stu1' })).average).toBeCloseTo(56 / 3)
}, 60000)

test('staff attendance scopes all four event kinds and retains full counts through paging and a correction', async () => {
  const f = await createReportCardContext()
  await f.db.exec(`
    insert into attendances(id,school_id,class_group_id,starts_at,ends_at,display_label,created_at)
    values ('cg1:2026-02-01','sch1','cg1','2026-02-01','2026-02-02','Daily register',now());
    insert into activities(id,school_id,short_name,name,category,coach,schedule,participants,capacity,description,start_date,end_date,created_at)
    values ('club','sch1','Art','Arts','art','Coach','Monday',0,10,'Art club','2026-01-01','2026-03-01',now());
    insert into schedules(id,school_id,class_group_id,schedule_kind,activity_id,title,is_recurring,start_time,end_time,created_at)
    values ('schedule-art','sch1','cg1','activity','club','Art club',false,'09:00','10:00',now());
    insert into activity_sessions(id,school_id,class_group_id,activity_id,schedule_id,status,is_exception,starts_at,ends_at,calendar_date,display_label,created_at)
    values ('activity','sch1','cg1','club','schedule-art','pending',false,'2026-02-01 09:00','2026-02-01 10:00','2026-02-01','Art club',now());
    insert into attendance_records(id,student_id,attendance_id,activity_session_id,assessment_id,date,status,justification_status,created_at,updated_at) values
      ('daily-custom','stu1','cg1:2026-02-01',null,null,'2026-02-01','present','none',now(),now()),
      ('activity-row','stu1',null,'activity',null,'2026-02-01','late','none',now(),now()),
      ('exam-row','stu1',null,null,'ass1','2026-02-01','absent','none',now(),now());
  `)
  const first = await f.service.getStudentAttendanceHistory({ studentId: 'stu1', limit: 2 })
  expect(first).toMatchObject({ present: 2, absent: 2, late: 2 })
  expect(first.items.map(row => row.id)).toEqual(['attendance-2', 'attendance-1'])
  const second = await f.service.getStudentAttendanceHistory({ studentId: 'stu1', limit: 2, cursor: first.nextCursor! })
  const third = await f.service.getStudentAttendanceHistory({ studentId: 'stu1', limit: 2, cursor: second.nextCursor! })
  expect([...second.items, ...third.items].map(row => [row.id, row.eventKind, row.label, row.time])).toEqual([
    ['exam-row', 'assessment', 'Math test', '09:00'],
    ['attendance-0', 'lesson', 'Math', '09:00'],
    ['activity-row', 'activity', 'Art club', '09:00'],
    ['daily-custom', 'daily', 'Daily register', '00:00'],
  ])
  expect(third.nextCursor).toBeNull()
  const short = await f.service.getStudentAttendanceHistory({ studentId: 'stu1' })
  expect(short).toEqual({ ...first, items: [...first.items, ...second.items, ...third.items], nextCursor: null })
  await expect(f.service.getStudentAttendanceHistory({ studentId: 'stu1', cursor: 'invalid' })).rejects.toThrow('cursor')
  const guardian = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', academicYearId: 'ay1', subjectId: 'subject-gua1', guardianId: 'gua1', requestId: 'history', authenticatedAt: new Date() }))
  await expect(guardian.getStudentAttendanceHistory({ studentId: 'stu1' })).rejects.toThrow()
  await expect(guardian.getStudentGradeHistory({ studentId: 'stu1' })).rejects.toThrow()
  await expect(f.service.getStudentAttendanceHistory({ studentId: 'unknown' })).rejects.toThrow()
  await f.db.exec('update class_groups set attendance_mode=\'daily\' where id=\'cg1\'')
  const corrected = await f.service.schedulingWorkflow.recordDailyAttendance({ id: 'suggested', studentId: 'stu1', classGroupId: 'cg1', date: new Date('2026-02-01'), status: AttendanceStatus.Absent })
  expect(corrected.id).toBe('daily-custom')
  const updated = await f.service.getStudentAttendanceHistory({ studentId: 'stu1', limit: 2 })
  expect(updated).toMatchObject({ present: 1, absent: 3, late: 2, items: first.items })
  await f.db.exec('update staff_members set is_active=false where id=\'user1\'')
  await expect(f.service.getStudentAttendanceHistory({ studentId: 'stu1', cursor: updated.nextCursor! })).rejects.toThrow()
}, 60000)
