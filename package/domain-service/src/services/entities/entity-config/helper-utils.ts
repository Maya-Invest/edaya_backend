export function dateTime(value: Date | undefined): number | undefined {
  return value?.getTime()
}

export { unique } from '@edaya/core'
