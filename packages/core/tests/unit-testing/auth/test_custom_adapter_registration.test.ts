import { describe, expect, it } from 'bun:test'
import {
  createInMemoryTestApp,
  createTestApp,
  setIntegrationTestAdapter,
} from '../../support/in-memory-school-headless-app'

describe('Custom adapter registration', () => {
  it('delegates app creation to a registered custom adapter', () => {
    // 1. Create a dummy custom adapter
    const dummyApp = {
      app: 'mock-custom-app',
      repositories: 'mock-custom-repositories',
      forActor: () => 'mock-custom-actor',
    }

    const customAdapter = {
      createApp: () => dummyApp,
    }

    // 2. Register the custom adapter
    setIntegrationTestAdapter(customAdapter as any)

    // 3. Verify createTestApp delegates to the custom adapter
    const result = createTestApp() as any
    expect(result.app).toBe('mock-custom-app')
    expect(result.repositories).toBe('mock-custom-repositories')
    expect(result.forActor(null as any)).toBe('mock-custom-actor')

    // 4. Restore the default in-memory adapter
    setIntegrationTestAdapter({
      createApp: actor => createInMemoryTestApp(actor),
    })

    // 5. Verify the default adapter is restored
    const restoredResult = createTestApp()
    expect(restoredResult.app).not.toBe('mock-custom-app')
  })
})
