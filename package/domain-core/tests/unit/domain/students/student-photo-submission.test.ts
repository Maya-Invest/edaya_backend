import { StudentPhotoSubmission, StudentPhotoSubmissionStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('StudentPhotoSubmission', () => {
  const base = {
    id: 'sps-1',
    schoolId: 'school',
    studentId: 'stu1',
    attachmentId: 'att-1',
    submitterGuardianId: 'gua1',
    status: StudentPhotoSubmissionStatus.Pending,
    version: 1,
  }

  test('requires a rejection reason when rejected', () => {
    expect(() => new StudentPhotoSubmission({
      ...base,
      status: StudentPhotoSubmissionStatus.Rejected,
    })).toThrow()
    expect(new StudentPhotoSubmission({
      ...base,
      status: StudentPhotoSubmissionStatus.Rejected,
      rejectionReason: 'Blurry',
    }).rejectionReason).toBe('Blurry')
  })

  test('copyWith preserves identity fields', () => {
    const submission = new StudentPhotoSubmission(base)
    const withdrawn = submission.copyWith({ status: StudentPhotoSubmissionStatus.Withdrawn })
    expect(withdrawn.id).toBe('sps-1')
    expect(withdrawn.attachmentId).toBe('att-1')
    expect(withdrawn.isPending).toBe(false)
  })
})
