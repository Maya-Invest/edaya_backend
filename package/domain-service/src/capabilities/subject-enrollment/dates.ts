/** Date-only academic calendar fields denote civil days in the school timezone. */
export function schoolDayStart(day: Date, timeZone: string, dayOffset = 0): Date {
  const target = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + dayOffset)
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  let instant = target
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(instant))
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
    const shown = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
    if (shown === target)
      return new Date(instant)
    instant += target - shown
  }
  throw new RangeError(`No midnight exists for this school calendar day in ${timeZone}`)
}
