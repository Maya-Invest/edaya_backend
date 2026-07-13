import process from 'node:process'

const BAR_WIDTH = 28

export interface SeedProgressReporter {
  /** Run a plan step; `tick` updates optional sub-progress when `total` is set. */
  step: <T>(work: (tick: (by?: number) => void) => Promise<T>, options?: { label?: string, total?: number }) => Promise<T>
  finish: () => void
}

export interface CreateSeedProgressReporterOptions {
  enabled?: boolean
}

function renderBar(completed: number, total: number, width = BAR_WIDTH): string {
  const ratio = total <= 0 ? 0 : Math.min(1, completed / total)
  const filled = Math.round(ratio * width)
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes > 0) {
    return `${minutes}m ${remainder}s`
  }
  return `${seconds}s`
}

function createNoopSeedProgressReporter(): SeedProgressReporter {
  return {
    async step<T>(work: (tick: (by?: number) => void) => Promise<T>): Promise<T> {
      return work(() => {})
    },
    finish() {},
  }
}

export function createSeedProgressReporter(
  phases: readonly string[],
  options: CreateSeedProgressReporterOptions = {},
): SeedProgressReporter {
  const enabled = options.enabled ?? Boolean(process.stderr.isTTY)
  if (!enabled || phases.length === 0) {
    return createNoopSeedProgressReporter()
  }

  let phaseIndex = 0
  let subCompleted = 0
  let subTotal: number | undefined
  let currentLabel = ''
  let renderedLines = 0
  const startedAt = Date.now()

  function clearRenderedLines(): void {
    if (renderedLines > 0) {
      process.stderr.write(`\x1B[${renderedLines}A\x1B[0J`)
      renderedLines = 0
    }
  }

  function render(): void {
    const overallCompleted = Math.min(phaseIndex, phases.length)
    const overallRatio = phases.length === 0 ? 0 : overallCompleted / phases.length
    const overallBar = renderBar(overallCompleted, phases.length)
    const elapsed = formatDuration(Date.now() - startedAt)

    const lines = [
      `Seeding  [${overallBar}] ${Math.round(overallRatio * 100)}%  (${overallCompleted}/${phases.length})  ${elapsed}`,
    ]

    if (currentLabel) {
      if (subTotal !== undefined && subTotal > 0) {
        const subBar = renderBar(subCompleted, subTotal)
        lines.push(`${currentLabel}  [${subBar}] ${subCompleted}/${subTotal}`)
      }
      else {
        lines.push(`${currentLabel}…`)
      }
    }

    clearRenderedLines()
    process.stderr.write(`${lines.join('\n')}\n`)
    renderedLines = lines.length
  }

  return {
    async step<T>(
      work: (tick: (by?: number) => void) => Promise<T>,
      stepOptions?: { label?: string, total?: number },
    ): Promise<T> {
      currentLabel = stepOptions?.label ?? phases[phaseIndex] ?? `Step ${phaseIndex + 1}`
      subCompleted = 0
      subTotal = stepOptions?.total
      render()

      const tick = (by = 1) => {
        subCompleted += by
        if (subTotal !== undefined && subCompleted > subTotal) {
          subCompleted = subTotal
        }
        render()
      }

      try {
        return await work(tick)
      }
      finally {
        phaseIndex += 1
        if (subTotal !== undefined) {
          subCompleted = subTotal
        }
        render()
      }
    },
    finish() {
      clearRenderedLines()
      phaseIndex = phases.length
      currentLabel = ''
      subTotal = undefined
    },
  }
}

export function countAuthProvisionAccounts(context: {
  staffAccounts: readonly unknown[]
  teacherAccounts: readonly unknown[]
  guardianAccounts: readonly unknown[]
}): number {
  return context.staffAccounts.length + context.teacherAccounts.length + context.guardianAccounts.length
}

export async function runSeedProgressStep<T>(
  progress: SeedProgressReporter | undefined,
  work: (tick: (by?: number) => void) => Promise<T>,
  options?: { label?: string, total?: number },
): Promise<T> {
  if (!progress) {
    return work(() => {})
  }
  return progress.step(work, options)
}
