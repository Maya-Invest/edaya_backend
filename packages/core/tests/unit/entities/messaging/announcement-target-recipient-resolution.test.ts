import { describe, expect, it } from 'bun:test'
import { AnnouncementTarget, AnnouncementTargetKind } from '../../../../src/entities/messaging/announcement-target'

describe('AnnouncementTarget entity recipient resolution', () => {
  it('instantiates successfully with valid broadcast targets and no targetId', () => {
    const broadcastKinds = [
      AnnouncementTargetKind.School,
      AnnouncementTargetKind.AllStaff,
      AnnouncementTargetKind.AllGuardians,
      AnnouncementTargetKind.AllStudents,
    ]

    for (const kind of broadcastKinds) {
      const target = new AnnouncementTarget({
        id: `target-${kind}`,
        announcementId: 'announcement-1',
        targetKind: kind,
      })

      expect(target.id).toBe(`target-${kind}`)
      expect(target.announcementId).toBe('announcement-1')
      expect(target.targetKind).toBe(kind)
      expect(target.targetId).toBeUndefined()
      expect(target.createdAt).toBeInstanceOf(Date)
    }
  })

  it('throws error if broadcast target defines targetId', () => {
    const broadcastKinds = [
      AnnouncementTargetKind.School,
      AnnouncementTargetKind.AllStaff,
      AnnouncementTargetKind.AllGuardians,
      AnnouncementTargetKind.AllStudents,
    ]

    for (const kind of broadcastKinds) {
      expect(() => new AnnouncementTarget({
        id: `target-${kind}`,
        announcementId: 'announcement-1',
        targetKind: kind,
        targetId: 'some-id',
      })).toThrow('broadcast announcement targets must not define targetId')
    }
  })

  it('instantiates successfully with valid scoped targets and targetId', () => {
    const scopedKinds = [
      AnnouncementTargetKind.ClassGroup,
      AnnouncementTargetKind.GradeLevel,
      AnnouncementTargetKind.StaffMember,
      AnnouncementTargetKind.Guardian,
      AnnouncementTargetKind.Student,
    ]

    for (const kind of scopedKinds) {
      const target = new AnnouncementTarget({
        id: `target-${kind}`,
        announcementId: 'announcement-1',
        targetKind: kind,
        targetId: 'target-item-id',
      })

      expect(target.id).toBe(`target-${kind}`)
      expect(target.announcementId).toBe('announcement-1')
      expect(target.targetKind).toBe(kind)
      expect(target.targetId).toBe('target-item-id')
    }
  })

  it('throws error if scoped target does not define targetId', () => {
    const scopedKinds = [
      AnnouncementTargetKind.ClassGroup,
      AnnouncementTargetKind.GradeLevel,
      AnnouncementTargetKind.StaffMember,
      AnnouncementTargetKind.Guardian,
      AnnouncementTargetKind.Student,
    ]

    for (const kind of scopedKinds) {
      expect(() => new AnnouncementTarget({
        id: `target-${kind}`,
        announcementId: 'announcement-1',
        targetKind: kind,
      })).toThrow('scoped announcement targets must define targetId')

      expect(() => new AnnouncementTarget({
        id: `target-${kind}`,
        announcementId: 'announcement-1',
        targetKind: kind,
        targetId: '  ',
      })).toThrow()
    }
  })

  it('throws error when required fields are empty', () => {
    expect(() => new AnnouncementTarget({
      id: '',
      announcementId: 'announcement-1',
      targetKind: AnnouncementTargetKind.School,
    })).toThrow()

    expect(() => new AnnouncementTarget({
      id: 'target-1',
      announcementId: ' ',
      targetKind: AnnouncementTargetKind.School,
    })).toThrow()
  })
})
