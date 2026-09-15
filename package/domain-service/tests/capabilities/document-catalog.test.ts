import { DOCUMENT_TEMPLATE_KEYS } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { documentTemplatesVisibleTo, getDocumentTemplateCatalogEntry, listDocumentTemplateCatalog } from '../../src/capabilities/documents/catalog'

describe('official document catalog', () => {
  test('covers every template key with pdf locales and issue permissions', () => {
    const catalog = listDocumentTemplateCatalog()
    expect(catalog.map(entry => entry.templateKey)).toEqual([...DOCUMENT_TEMPLATE_KEYS])
    for (const entry of catalog) {
      expect(entry.format).toBe('pdf')
      expect(entry.locales).toContain('fr')
      expect(entry.locales).toContain('en')
      expect(entry.issuePermissions.length).toBeGreaterThan(0)
    }
  })

  test('hides operational templates from family and family templates from teachers', () => {
    const family = documentTemplatesVisibleTo('guardian').map(entry => entry.templateKey)
    const teacher = documentTemplatesVisibleTo('teacher').map(entry => entry.templateKey)
    expect(family).not.toContain('logbook.v1')
    expect(family).not.toContain('incident-report.v1')
    expect(family).toContain('report-card.v1')
    expect(family).toContain('receipt.v1')
    expect(teacher).toEqual(['logbook.v1', 'class-timetable.v1', 'teacher-timetable.v1', 'class-roster.v1', 'attendance-sheet.v1'])
    expect(getDocumentTemplateCatalogEntry('student-id-card.v1').assets.portrait).toBe('blocking')
  })
})
