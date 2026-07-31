import { OccurrenceStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildLogbookV1Payload } from '../../../src/capabilities/documents/build-logbook-v1-payload'

describe('buildLogbookV1Payload', () => {
  test('groups by subject, sorts chronologically, and skips empty sessions', () => {
    const payload = buildLogbookV1Payload({
      schoolName: 'Collège Edaya',
      classLabel: '6ème A',
      schoolYear: '2025-2026',
      periodLabel: '1er Trimestre',
      subjects: [
        { classSubjectId: 'cs-math', name: 'Mathématiques', teacherName: 'Mme Kouassi' },
        { classSubjectId: 'cs-fr', name: 'Français' },
        { classSubjectId: 'cs-empty', name: 'EPS' },
      ],
      sessions: [
        {
          id: 'ls-empty',
          classSubjectId: 'cs-math',
          startsAt: new Date('2025-09-15T08:00:00.000Z'),
          endsAt: new Date('2025-09-15T09:00:00.000Z'),
          displayLabel: 'Math',
          status: OccurrenceStatus.Completed,
        },
        {
          id: 'ls-math-2',
          classSubjectId: 'cs-math',
          startsAt: new Date('2025-09-18T08:00:00.000Z'),
          endsAt: new Date('2025-09-18T09:00:00.000Z'),
          displayLabel: 'Math',
          sessionNote: 'Addition des relatifs',
          status: OccurrenceStatus.Pending,
        },
        {
          id: 'ls-math-1',
          classSubjectId: 'cs-math',
          startsAt: new Date('2025-09-16T08:00:00.000Z'),
          endsAt: new Date('2025-09-16T09:00:00.000Z'),
          displayLabel: 'Math',
          status: OccurrenceStatus.Cancelled,
        },
        {
          id: 'ls-fr',
          classSubjectId: 'cs-fr',
          startsAt: new Date('2025-09-17T10:00:00.000Z'),
          endsAt: new Date('2025-09-17T11:00:00.000Z'),
          displayLabel: 'Français',
          status: OccurrenceStatus.Completed,
        },
        {
          id: 'ls-eps',
          classSubjectId: 'cs-empty',
          startsAt: new Date('2025-09-19T14:00:00.000Z'),
          endsAt: new Date('2025-09-19T15:00:00.000Z'),
          displayLabel: 'EPS',
          status: OccurrenceStatus.Completed,
        },
      ],
      progress: [
        {
          lessonSessionId: 'ls-math-1',
          classSubjectMatterId: 'csm-relatifs',
          completedPercentage: 25,
          notes: 'Définitions',
        },
      ],
      chapters: [
        { classSubjectMatterId: 'csm-relatifs', name: 'Nombres relatifs' },
      ],
      homework: [
        { lessonSessionId: 'ls-fr', text: 'Apprendre les mots difficiles' },
      ],
      timeZone: 'UTC',
      locale: 'fr-FR',
    })

    expect(payload.subjects.map(subject => subject.name)).toEqual(['Mathématiques', 'Français'])
    expect(payload.subjects[0]!.entries.map(entry => entry.date)).toEqual(['2025-09-16', '2025-09-18'])
    expect(payload.subjects[0]!.entries[0]).toMatchObject({
      title: 'Nombres relatifs',
      status: 'cancelled',
      chapters: [{ name: 'Nombres relatifs', completedPercentage: 25, notes: 'Définitions' }],
    })
    expect(payload.subjects[0]!.entries[1]).toMatchObject({
      content: 'Addition des relatifs',
      status: 'pending',
    })
    expect(payload.subjects[1]!.entries[0]).toMatchObject({
      homework: 'Apprendre les mots difficiles',
    })
    expect(payload.summary).toEqual({ subjectCount: 2, sessionCount: 3 })
  })

  test('throws when no session has logbook content', () => {
    expect(() => buildLogbookV1Payload({
      schoolName: 'Collège Edaya',
      classLabel: '6ème A',
      subjects: [{ classSubjectId: 'cs-math', name: 'Mathématiques' }],
      sessions: [{
        id: 'ls-1',
        classSubjectId: 'cs-math',
        startsAt: new Date('2025-09-16T08:00:00.000Z'),
        endsAt: new Date('2025-09-16T09:00:00.000Z'),
        displayLabel: 'Math',
        status: OccurrenceStatus.Completed,
      }],
      progress: [],
      chapters: [],
      homework: [],
    })).toThrow(/no logbook content/)
  })
})
