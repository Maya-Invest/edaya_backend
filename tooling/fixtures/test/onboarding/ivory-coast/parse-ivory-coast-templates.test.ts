import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'
import { resolveCountryCode } from '../../../src/onboarding/country'
import {
  IVORY_COAST_STRUCTURE_TEMPLATES,
  loadIvoryCoastFixture,
  parseIvoryCoastStructureTemplates,
  toStructureTemplateId,
} from '../../../src/onboarding/ivory-coast/parse-ivory-coast-templates'
import { listStructureTemplatesForCountry } from '../../../src/onboarding/registry'

const DATA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/onboarding/ivory-coast',
)

describe('ivory coast structure templates', () => {
  it('derives template ids from cycle keys without hardcoding cycles', () => {
    expect(toStructureTemplateId('College')).toBe('ci-college')
    expect(toStructureTemplateId('Lycee')).toBe('ci-lycee')
    expect(toStructureTemplateId('Collège')).toBe('ci-college')
  })

  it('loads one independent template per cycle in the master fixture', async () => {
    const fixture = await loadIvoryCoastFixture(DATA_ROOT)
    expect(Object.keys(fixture)).toEqual(['College', 'Lycee'])
    expect(IVORY_COAST_STRUCTURE_TEMPLATES).toHaveLength(2)
    expect(IVORY_COAST_STRUCTURE_TEMPLATES.map(template => template.id)).toEqual([
      'ci-college',
      'ci-lycee',
    ])
    expect(IVORY_COAST_STRUCTURE_TEMPLATES.map(template => template.cycle)).toEqual([
      'Collège',
      'Lycée',
    ])
  })

  it('keeps periods on the master model and subjects in per-level files', async () => {
    const fixture = await loadIvoryCoastFixture(DATA_ROOT)
    expect(fixture.College?.periods.map(period => period.code)).toEqual(['T1', 'T2', 'T3'])
    expect(fixture.College?.levels.map(level => level.code)).toEqual([
      '6EME',
      '5EME',
      '4EME',
      '3EME',
    ])

    const master = await Bun.file(path.join(DATA_ROOT, 'fixture.json')).json() as {
      College: { levels: Array<{ order: number, file: string, code?: string, name?: string }> }
    }
    expect(master.College.levels.every(level => typeof level.file === 'string')).toBe(true)
    expect(master.College.levels.every(level => typeof level.order === 'number')).toBe(true)
    expect(master.College.levels.every(level => level.code === undefined && level.name === undefined)).toBe(true)
    expect(master.College.levels.every(level => !('subjects' in level))).toBe(true)

    const sixiemeFile = await Bun.file(path.join(DATA_ROOT, 'college/6eme.json')).json() as {
      subjects: unknown[]
      sections: unknown[]
      periods?: unknown
    }
    expect(sixiemeFile.subjects.length).toBeGreaterThan(0)
    expect(sixiemeFile.sections.length).toBeGreaterThan(0)
    expect(sixiemeFile.periods).toBeUndefined()
  })

  it('nests subjects under each level with one curriculum entry per level+subject', () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')
    expect(college).toBeDefined()

    const sixieme = college!.gradeLevels.find(level => level.code === '6EME')
    const quatrieme = college!.gradeLevels.find(level => level.code === '4EME')
    expect(sixieme?.reportCardStructure?.sections?.find(s => s.label === 'Bilan Science')?.subjectCodes)
      .toEqual(['MATH', 'PC', 'SVT', 'TECH', 'TICE'])
    expect(sixieme?.reportCardStructure?.sections?.find(s => s.label === 'Bilan Lettre')?.subjectCodes)
      .toEqual(['FR', 'ANG', 'HG'])
    expect(quatrieme?.reportCardStructure?.sections?.find(s => s.label === 'Bilan Lettre')?.subjectCodes)
      .toEqual(['FR', 'ANG', 'ALL', 'ESP', 'HG'])

    const lv2 = college!.curriculum.filter(
      entry => entry.levelCode === '4EME' && (entry.subjectCode === 'ALL' || entry.subjectCode === 'ESP'),
    )
    expect(lv2).toHaveLength(2)
    expect(lv2.every(entry => entry.isOptional === true)).toBe(true)

    const angEntries = college!.curriculum.filter(entry => entry.subjectCode === 'ANG')
    expect(angEntries.map(entry => entry.levelCode).sort()).toEqual(['3EME', '4EME', '5EME', '6EME'])
    expect(angEntries.every(entry => entry.levelCode && entry.matters.length > 0)).toBe(true)
  })

  it('aligns lycée série A without SES and with light sciences; C/D include SVT', () => {
    const lycee = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-lycee')
    expect(lycee).toBeDefined()
    expect(lycee!.curriculum.some(entry => entry.subjectCode === 'SES')).toBe(false)

    const secondeA = lycee!.curriculum.filter(entry => entry.levelCode === '2NDA').map(entry => entry.subjectCode)
    expect(secondeA).toContain('PC')
    expect(secondeA).toContain('SVT')

    const tlec = lycee!.curriculum.filter(entry => entry.levelCode === 'TLEC')
    expect(tlec.find(entry => entry.subjectCode === 'MATH')?.coefficient).toBe(5)
    expect(tlec.find(entry => entry.subjectCode === 'PC')?.coefficient).toBe(5)
    expect(tlec.find(entry => entry.subjectCode === 'SVT')?.coefficient).toBe(3)
    expect(tlec.find(entry => entry.subjectCode === 'PHILO')?.coefficient).toBe(4)

    const tled = lycee!.curriculum.filter(entry => entry.levelCode === 'TLED')
    expect(tled.find(entry => entry.subjectCode === 'SVT')?.coefficient).toBe(6)
  })

  it('parses bilan chrome without synthèse and with includeSummary false', () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')
    expect(college?.reportCardStructure?.includeSummary).toBe(false)
    expect(college?.reportCardStructure?.includeComments).toBe(true)
    expect(college?.reportCardStructure?.periods.map(period => period.code)).toEqual([
      'T1',
      'T2',
      'T3',
    ])

    const sixieme = college?.gradeLevels.find(level => level.code === '6EME')
    expect(sixieme?.reportCardStructure?.sections?.map(section => section.label)).toEqual([
      'Bilan Lettre',
      'Bilan Science',
      'Bilan autres',
      'Appréciations',
    ])
    expect(college?.subjects.some(subject => subject.code === 'ALL')).toBe(true)
    expect(college?.subjects.some(subject => subject.code === 'ESP')).toBe(true)
    expect(college?.subjects.some(subject => subject.code === 'LV2')).toBe(false)
  })

  it('parses a College+Lycee-only seed without requiring Primaire', async () => {
    const fixture = await loadIvoryCoastFixture(DATA_ROOT)
    const templates = parseIvoryCoastStructureTemplates({
      College: fixture.College!,
      Lycee: fixture.Lycee!,
    })
    expect(templates.map(template => template.id)).toEqual(['ci-college', 'ci-lycee'])
  })

  it('derives college domain category weights from curriculum coefficients', () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')
    expect(college?.reportCardStructure?.gradingScale).toBe(20)
    const sciences = college?.reportCardStructure?.domainCategories?.find(
      category => category.domain === 'Sciences',
    )
    expect(sciences?.weight).toBeGreaterThan(1)
  })

  it('lists templates for CI only; unknown and empty countries get no templates', () => {
    expect(resolveCountryCode(undefined)).toBe('FR')
    expect(resolveCountryCode('')).toBe('FR')
    expect(resolveCountryCode('Sénégal')).toBe('FR')

    const ci = listStructureTemplatesForCountry('ci')
    expect(ci.countryCode).toBe('CI')
    expect(ci.templates).toHaveLength(2)

    const ivoryCoast = listStructureTemplatesForCountry("Côte d'Ivoire")
    expect(ivoryCoast.countryCode).toBe('CI')
    expect(ivoryCoast.templates).toHaveLength(2)

    const fr = listStructureTemplatesForCountry('France')
    expect(fr.countryCode).toBe('FR')
    expect(fr.templates).toHaveLength(0)

    const senegal = listStructureTemplatesForCountry('Sénégal')
    expect(senegal.countryCode).toBe('FR')
    expect(senegal.templates).toHaveLength(0)

    const omitted = listStructureTemplatesForCountry(undefined)
    expect(omitted.countryCode).toBe('FR')
    expect(omitted.templates).toHaveLength(0)
  })
})
