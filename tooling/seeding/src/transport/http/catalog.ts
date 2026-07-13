import { clientBindings } from '@maya-invest/edaya-api-client'

export type SeedEntityKey = keyof typeof clientBindings.entities
export type SeedCommandKey = keyof typeof clientBindings.commands

export function isSeedEntityKey(value: string): value is SeedEntityKey {
  return Object.hasOwn(clientBindings.entities, value)
}

export function seedEntityPublicName(entityKey: SeedEntityKey): string {
  return clientBindings.entities[entityKey].publicName
}

export function seedCommandPublicName(commandKey: SeedCommandKey): string {
  return clientBindings.commands[commandKey].publicName
}
