import type { Locale } from './locales'

// English reads day-first here ("12 March 2026"), like French.
const DATE_LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' }

// Stored/sent dates stay YYYY-MM-DD; this is display only. Parsed as UTC and formatted in UTC so the
// day never shifts with the viewer's time zone.
export function formatDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

// Years are identifiers, not quantities: never "2,018" or "2 018".
export function formatYear(year: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(year)
}
