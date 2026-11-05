import type { RouterScrollBehavior } from 'vue-router'

// The paged lists (cellar, consumption history) fill in asynchronously, so a saved scroll offset can
// only be re-applied once their rows are on screen: the list view reports when that is.
let listRendered = false
let waiting: Array<() => void> = []

const LIST_ROUTES = ['cellar', 'history']

export function setListRendered(rendered: boolean) {
  listRendered = rendered
  if (!rendered) return
  const resume = waiting
  waiting = []
  resume.forEach((done) => done())
}

function whenListRendered(): Promise<void> {
  if (listRendered) return Promise.resolve()
  return new Promise((resolve) => waiting.push(resolve))
}

// Back/forward restores the offset the reader left at (waiting for the list to
// render); every other navigation, including a filter, sort or page change, starts at the top.
export const scrollBehavior: RouterScrollBehavior = async (to, _from, savedPosition) => {
  // The target of a named anchor isn't rendered yet (its page loads asynchronously), so the page scrolls
  // there itself; resetting to the top here could land after it and undo it.
  if (!savedPosition && to.hash) return false
  if (!savedPosition) return { top: 0 }
  if (LIST_ROUTES.includes(to.name as string)) await whenListRendered()
  return savedPosition
}
