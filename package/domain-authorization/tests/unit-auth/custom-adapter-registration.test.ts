import { describe, expect, it } from 'bun:test'
import {
  createInMemoryTestApp,
  createTestApp,
  setIntegrationTestAdapter,
} from '../support/create-test-app'

describe('Custom adapter registration', () => {
  it('delegates app creation to a registered custom adapter', () => {
    const dummyApp = {
      app: 'mock-custom-app',
      repositories: 'mock-custom-repositories',
      forActor: () => 'mock-custom-actor',
    }

    const customAdapter = {
      createApp: () => dummyApp,
    }

    setIntegrationTestAdapter(customAdapter as any)

    const result = createTestApp() as any
    expect(result.app).toBe('mock-custom-app')
    expect(result.repositories).toBe('mock-custom-repositories')
    expect(result.forActor(null as any)).toBe('mock-custom-actor')

    setIntegrationTestAdapter({
      createApp: actor => createInMemoryTestApp(actor),
    })

    const restoredResult = createTestApp()
    expect(restoredResult.app).not.toBe('mock-custom-app')
  })
})
