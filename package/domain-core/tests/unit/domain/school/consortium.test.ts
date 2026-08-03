import { Consortium } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('Consortium entity', () => {
  const baseArgs = {
    id: 'cons-1',
    name: 'Groupe scolaire Méthodiste',
    ownerSubjectId: 'subject-owner',
  }

  test('instantiates successfully with valid inputs', () => {
    const consortium = new Consortium({
      ...baseArgs,
      country: 'CI',
      sharedRules: { structureTemplateIds: ['ci-college'] },
    })

    expect(consortium.id).toBe('cons-1')
    expect(consortium.name).toBe('Groupe scolaire Méthodiste')
    expect(consortium.ownerSubjectId).toBe('subject-owner')
    expect(consortium.country).toBe('CI')
    expect(consortium.sharedRules.structureTemplateIds).toEqual(['ci-college'])
    expect(consortium.createdAt).toBeInstanceOf(Date)
  })

  test('defaults sharedRules to empty template list', () => {
    const consortium = new Consortium(baseArgs)
    expect(consortium.sharedRules.structureTemplateIds).toEqual([])
  })

  test('throws for blank name', () => {
    expect(() => {
      new Consortium({ ...baseArgs, name: '   ' })
    }).toThrow()
  })
})
