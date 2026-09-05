import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import {
  isEphemeralDatabase,
  isPgliteDatabase,
  resolveMigrationDriver,
  resolvePersistedPgliteDataDir,
  resolvePgliteDataDir,
} from '../../src/lib/database-url'

describe('database-url', () => {
  describe('isEphemeralDatabase', () => {
    it('treats in-memory aliases as ephemeral', () => {
      expect(isEphemeralDatabase('pglite')).toBe(true)
      expect(isEphemeralDatabase('memory')).toBe(true)
      expect(isEphemeralDatabase('memory://')).toBe(true)
      expect(isEphemeralDatabase('postgres://memory')).toBe(true)
    })

    it('treats persisted pglite URLs as non-ephemeral', () => {
      expect(isEphemeralDatabase('pglite:.data/school')).toBe(false)
      expect(isEphemeralDatabase('file://.data/school')).toBe(false)
    })
  })

  describe('isPgliteDatabase', () => {
    it('includes ephemeral and persisted pglite URLs', () => {
      expect(isPgliteDatabase('pglite')).toBe(true)
      expect(isPgliteDatabase('pglite:.data/school')).toBe(true)
      expect(isPgliteDatabase('file://.data/school')).toBe(true)
    })

    it('excludes real postgres URLs', () => {
      expect(isPgliteDatabase('postgres://admin:admin@localhost:5432/edaya')).toBe(false)
    })
  })

  describe('resolvePgliteDataDir', () => {
    it('returns undefined for in-memory URLs', () => {
      expect(resolvePgliteDataDir('pglite')).toBeUndefined()
      expect(resolvePgliteDataDir('memory')).toBeUndefined()
    })

    it('extracts a path from pglite: URLs', () => {
      expect(resolvePgliteDataDir('pglite:.data/school')).toBe('.data/school')
      expect(resolvePgliteDataDir('pglite:./.data/school')).toBe('./.data/school')
    })

    it('extracts a path from file:// URLs', () => {
      expect(resolvePgliteDataDir('file://.data/school')).toBe('.data/school')
    })

    it('throws when a persisted URL has no path', () => {
      expect(() => resolvePgliteDataDir('pglite:')).toThrow(/requires a data directory path/)
      expect(() => resolvePgliteDataDir('file://')).toThrow(/requires a data directory path/)
    })
  })

  describe('resolvePersistedPgliteDataDir', () => {
    it('anchors .data paths to repoRoot for local dev', () => {
      const repoRoot = '/repo/edaya_backend'
      expect(resolvePersistedPgliteDataDir('pglite:.data/school', { repoRoot }))
        .toBe(path.resolve(repoRoot, '.data/school'))
    })

    it('leaves non-.data relative paths unchanged', () => {
      expect(resolvePersistedPgliteDataDir('pglite:tmp/school', { repoRoot: '/repo' }))
        .toBe('tmp/school')
    })
  })

  describe('resolveMigrationDriver', () => {
    it('uses the pglite driver for all pglite URLs', () => {
      expect(resolveMigrationDriver('pglite')).toBe('pglite')
      expect(resolveMigrationDriver('pglite:.data/school')).toBe('pglite')
      expect(resolveMigrationDriver('file://.data/school')).toBe('pglite')
    })

    it('uses node-postgres for real postgres URLs', () => {
      expect(resolveMigrationDriver('postgres://admin:admin@localhost:5432/edaya')).toBe('node-postgres')
    })
  })
})
