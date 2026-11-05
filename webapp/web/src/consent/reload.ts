// Consent changes leave the page through a full load, so every module (gateway,
// sync, service worker) starts cleanly in the new mode. A seam so tests can observe it.
export function reloadInto(path: string): void {
  window.location.assign(path)
}
