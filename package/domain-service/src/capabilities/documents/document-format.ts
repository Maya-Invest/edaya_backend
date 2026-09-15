function zeroDecimal(currency: string): boolean {
  return ['XOF', 'XAF', 'JPY', 'KRW', 'VND'].includes(currency)
}

export function formatDocumentMoney(amountMinor: number, currency: string, locale: string): string {
  const digits = zeroDecimal(currency) ? 0 : 2
  const value = digits === 0 ? amountMinor : amountMinor / 100
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function formatDocumentDate(value: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'long', day: 'numeric' }).format(value)
}

export function formatDocumentIsoDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}
