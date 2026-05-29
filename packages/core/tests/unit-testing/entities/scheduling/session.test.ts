import { describe, expect, test } from 'bun:test'
import { Session, SessionKind } from '../../../../src/entities/scheduling/session'

describe('Session entity', () => {
  const baseArgs = {
    id: 'ses1',
    classGroupId: 'cg1',
    title: 'Math Class',
    kind: SessionKind.Course,
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  }

  test('instantiates successfully with valid inputs', () => {
    const session = new Session(baseArgs)
    expect(session.id).toBe('ses1')
    expect(session.classGroupId).toBe('cg1')
    expect(session.title).toBe('Math Class')
    expect(session.kind).toBe(SessionKind.Course)
    expect(session.durationMinutes).toBe(60)
  })

  test('throws error if endsAt is before startsAt', () => {
    expect(() => {
      new Session({
        ...baseArgs,
        endsAt: new Date('2026-09-01T07:00:00Z'),
      })
    }).toThrow('endsAt must be after startsAt')
  })

  test('throws error if endsAt equals startsAt', () => {
    expect(() => {
      new Session({
        ...baseArgs,
        endsAt: new Date('2026-09-01T08:00:00Z'),
      })
    }).toThrow('endsAt must be after startsAt')
  })

  test('copies successfully using copyWith', () => {
    const session = new Session(baseArgs)
    const newStartsAt = new Date('2026-09-01T10:00:00Z')
    const newEndsAt = new Date('2026-09-01T11:00:00Z')

    const updated = session.copyWith({
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      title: 'Advanced Math',
    })

    expect(updated.id).toBe('ses1')
    expect(updated.title).toBe('Advanced Math')
    expect(updated.startsAt).toEqual(newStartsAt)
    expect(updated.endsAt).toEqual(newEndsAt)
    expect(updated.durationMinutes).toBe(60)
  })
})
