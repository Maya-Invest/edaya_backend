import { describe, expect, it } from 'bun:test'
import { resolveCountryCode } from '../../../src/onboarding/country'
import { IVORY_COAST_STRUCTURE_TEMPLATES } from '../../../src/onboarding/ivory-coast/parse-ivory-coast-templates'
import { listStructureTemplatesForCountry } from '../../../src/onboarding/registry'

describe('ivory coast structure templates', () => {
  it('loads three CI templates from the exhaustive seed JSON', () => {
    expect(IVORY_COAST_STRUCTURE_TEMPLATES).toHaveLength(3)
    expect(IVORY_COAST_STRUCTURE_TEMPLATES.map(template => template.id)).toEqual([
      'ci-primaire',
      'ci-college',
      'ci-lycee',
    ])
  })

  it('maps primaire grade levels and curriculum long names', () => {
    const primaire = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-primaire')
    expect(primaire).toBeDefined()
    expect(primaire?.gradeLevels).toHaveLength(6)
    expect(primaire?.gradeLevels[0]).toMatchObject({
      id: 'ci-primaire:CP1',
      code: 'CP1',
      shortLabel: 'CP1',
    })
    expect(primaire?.subjects.find(subject => subject.code === 'FR')).toMatchObject({
      shortName: 'Français',
      defaultCoefficient: 1,
    })

    const frenchEntry = primaire?.curriculum.find(entry => entry.subjectCode === 'FR' && entry.levelCodes.includes('CP1'))
    expect(frenchEntry?.longName).toBe('Français — CP1/CP2')
    expect(frenchEntry?.matters.length).toBeGreaterThan(3)
  })

  it('derives college domain category weights from curriculum coefficients', () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')
    expect(college).toBeDefined()
    expect(college?.reportCardStructure?.gradingScale).toBe(20)
    expect(college?.subjects).toHaveLength(9)

    const sciences = college?.reportCardStructure?.domainCategories.find(category => category.domain === 'Sciences')
    expect(sciences?.weight).toBeGreaterThan(1)
  })

  it('lists templates for CI and defaults unknown countries to CI', () => {
    expect(resolveCountryCode(undefined)).toBe('CI')
    expect(resolveCountryCode('Côte d\'Ivoire')).toBe('CI')
    expect(resolveCountryCode('France')).toBe('FR')

    const ci = listStructureTemplatesForCountry('ci')
    expect(ci.countryCode).toBe('CI')
    expect(ci.templates).toHaveLength(3)

    const fr = listStructureTemplatesForCountry('France')
    expect(fr.countryCode).toBe('FR')
    expect(fr.templates).toHaveLength(0)
  })
})
