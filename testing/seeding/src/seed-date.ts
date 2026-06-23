export function seedDateTime(date: string): string {
  return `${date}T12:00:00.000Z`
}

export function seedDateAndTime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`
}
