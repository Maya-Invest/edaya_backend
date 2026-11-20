import { createGuardianActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Teacher } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

test('notices page within the current account and profile, with a stable cursor and independent full count', async () => {
  const f = await createReportCardContext()
  const account = { schoolId: 'sch1', academicYearId: 'ay1', subjectId: 'subject-gua1', requestId: 'notices', authenticatedAt: new Date() }
  await f.repositories.teachers.save(new Teacher({ id: 'teacher', schoolId: 'sch1', firstName: 'A', lastName: 'Teacher', subjectId: account.subjectId }))
  const teacher = f.forActor(createTeacherActorMetadata({ ...account, teacherId: 'teacher' }))
  const guardian = f.forActor(createGuardianActorMetadata({ ...account, guardianId: 'gua1' }))
  await f.db.exec(`insert into message_deliveries(id,school_id,subject_id,recipient_kind,recipient_id,title,body,status,event_key,created_at,sent_at,updated_at) values
    ('g:2','sch1','subject-gua1','guardian','gua1','Two',repeat('é',400),'sent',null,'2026-01-01','2026-01-02 12:00:00.123456',now()),
    ('g:1','sch1','subject-gua1','guardian','gua1','One','Full','read','general','2026-01-02 12:00:00.123456','2026-01-02 12:00:00.123456',now()),
    ('g:0','sch1','subject-gua1','guardian','gua1','Old','Full','pending',null,'2026-01-02 12:00:00.123455',null,now()),
    ('thread','sch1','subject-gua1','guardian','gua1','Thread','Full','sent','conversation.message','2026-01-03','2026-01-03',now()),
    ('teaching','sch1','subject-gua1','teacher','teacher','Teaching','Full','pending',null,'2026-01-02',null,now()),
    ('wrong-account','sch1','other','guardian','gua1','Other','Full','sent',null,'2026-01-03','2026-01-03',now()),
    ('wrong-school','other-school','subject-gua1','guardian','gua1','Other','Full','sent',null,'2026-01-03','2026-01-03',now()),
    ('wrong-recipient','sch1','subject-gua1','guardian','other','Other','Full','sent',null,'2026-01-03','2026-01-03',now())`)
  const first = await guardian.getDeliveryInbox({ limit: 1 })
  expect(first.items.map(row => row.id)).toEqual(['g:2'])
  expect(first.unreadCount).toBe(2)
  expect(first.items[0]!.preview).toBe('é'.repeat(320))
  expect(first.items[0]!.at).toBe('2026-01-02T12:00:00.123456Z')
  const second = await guardian.getDeliveryInbox({ limit: 1, cursor: first.nextCursor! })
  expect(second.items.map(row => row.id)).toEqual(['g:1'])
  await f.db.exec('insert into message_deliveries (id,school_id,subject_id,recipient_kind,recipient_id,title,body,status,created_at,updated_at) values (\'new\',\'sch1\',\'subject-gua1\',\'guardian\',\'gua1\',\'New\',\'Full\',\'pending\',\'2026-01-04\',now())')
  const last = await guardian.getDeliveryInbox({ limit: 1, cursor: second.nextCursor! })
  expect(last.items.map(row => row.id)).toEqual(['g:0'])
  expect(last.nextCursor).toBeNull()
  expect(last.unreadCount).toBe(3)
  const detail = await guardian.communicationsWorkflow.markDeliveryRead({ deliveryId: 'g:2' })
  expect(detail.body).toBe('é'.repeat(400))
  expect((await guardian.getDeliveryInbox({})).unreadCount).toBe(2)
  expect((await teacher.getDeliveryInbox({})).items.map(row => row.id)).toEqual(['teaching'])
  await expect(teacher.communicationsWorkflow.markDeliveryRead({ deliveryId: 'g:0' })).rejects.toThrow()
  await expect(guardian.getDeliveryInbox({ cursor: 'broken' })).rejects.toThrow('cursor')
  await expect(f.service.getDeliveryInbox({})).rejects.toThrow()
  await f.db.exec('update teachers set is_active=false where id=\'teacher\'')
  await expect(teacher.getDeliveryInbox({})).rejects.toThrow()
}, 60000)
