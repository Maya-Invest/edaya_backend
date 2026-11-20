import {
  FAMILY_FEEDBACK_QUESTION_IDS,
  FAMILY_FEEDBACK_QUESTION_VERSION,
  familyFeedbackInstrumentCopy,
  interpolateFamilyFeedbackCopy,
  renderFamilyFeedbackInstrument,
} from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const vars = {
  studentName: 'Ada',
  teacherName: 'Ms. Lovelace',
  subjectName: 'Mathematics',
  className: '6A',
  periodName: 'Term 2',
}

describe('family-feedback.v1 catalog', () => {
  test('freezes four items in order with both locales', () => {
    const fr = familyFeedbackInstrumentCopy('fr')
    const en = familyFeedbackInstrumentCopy('en')
    expect(fr.version).toBe(FAMILY_FEEDBACK_QUESTION_VERSION)
    expect(fr.items.map(item => item.id)).toEqual([...FAMILY_FEEDBACK_QUESTION_IDS])
    expect(en.items.map(item => item.id)).toEqual([...FAMILY_FEEDBACK_QUESTION_IDS])
    expect(fr.scaleLabels.cannot_assess).toBe('Je ne peux pas évaluer')
    expect(en.scaleLabels[5]).toBe('Very satisfied')
  })

  test('interpolates context into stems without exposing scores', () => {
    const rendered = renderFamilyFeedbackInstrument('en', vars)
    expect(rendered.intro).toContain('Ms. Lovelace')
    expect(rendered.intro).toContain('Ada')
    expect(rendered.items[0]!.stem).toContain('Ms. Lovelace')
    expect(rendered.confidentialityNotice).toContain('not anonymous')
    expect(interpolateFamilyFeedbackCopy('{studentName}', vars)).toBe('Ada')
  })
})
