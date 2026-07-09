import { describe, expect, it } from 'bun:test'
import { createSeedProgressReporter } from '../../src/support/seed-progress'
import {
  resolveFreshBootstrapPhaseLabels,
  resolveSchoolSeedPhaseLabels,
} from '../../src/support/resolve-seed-progress-plan'

describe('seed progress', () => {
  it('resolveSchoolSeedPhaseLabels omits profile photos when skipped', () => {
    expect(resolveSchoolSeedPhaseLabels(true)).not.toContain('Profile photos')
    expect(resolveSchoolSeedPhaseLabels(false)).toContain('Profile photos')
  })

  it('resolveFreshBootstrapPhaseLabels includes bootstrap steps', () => {
    const phases = resolveFreshBootstrapPhaseLabels(false)
    expect(phases[0]).toBe('Auth accounts')
    expect(phases).toContain('Service account')
    expect(phases.at(-1)).toBe('Access assignments')
  })

  it('runs steps without throwing when disabled', async () => {
    const progress = createSeedProgressReporter(['One', 'Two'], { enabled: false })
    let ticks = 0
    await progress.step(async (tick) => {
      tick()
      ticks += 1
    }, { total: 2 })
    await progress.step(async () => {})
    progress.finish()
    expect(ticks).toBe(1)
  })
})
