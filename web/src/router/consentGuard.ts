import type { NavigationGuard } from 'vue-router'
import { readConsent } from '../consent/storageConsent'

// Only same-site paths: the destination travels in the URL, so never follow it off-site.
// Browsers read "/\host" as "//host" and drop tabs/newlines inside URLs, so resolve rather than pattern-match.
export function safeDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  const origin = 'http://destination.invalid'
  const resolved = new URL(value, origin)
  return resolved.origin === origin ? resolved.pathname + resolved.search + resolved.hash : '/'
}

// Until the user has chosen, every route is the consent page (remembering where they wanted to go).
// Once chosen, the consent page itself has nothing left to ask.
export const consentGuard: NavigationGuard = (to) => {
  const noChoice = readConsent() === 'no-choice'
  if (noChoice && to.name !== 'consent') {
    return { name: 'consent', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  if (!noChoice && to.name === 'consent') return safeDestination(to.query.redirect)
  return true
}
