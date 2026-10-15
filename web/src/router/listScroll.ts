import type { RouterScrollBehavior } from 'vue-router'

// The cellar list fills in asynchronously, so a saved scroll offset can only be
// re-applied once its rows are on screen: the list view reports when that is.
let listRendered = false
let waiting: Array<() => void> = []

export function setCellarListRendered(rendered: boolean) {
  listRendered = rendered
  if (!rendered) return
  const resume = waiting
  waiting = []
  resume.forEach((done) => done())
}

function whenCellarListRendered(): Promise<void> {
  if (listRendered) return Promise.resolve()
  return new Promise((resolve) => waiting.push(resolve))
}

// Back/forward restores the offset the reader left at (waiting for the list to
// render); every other navigation, including a filter, sort or page change, starts at the top.
export const scrollBehavior: RouterScrollBehavior = async (to, _from, savedPosition) => {
  if (!savedPosition) return { top: 0 }
  if (to.name === 'cellar') await whenCellarListRendered()
  return savedPosition
}
