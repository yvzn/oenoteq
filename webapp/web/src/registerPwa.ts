import { registerSW } from 'virtual:pwa-register'
import { handleNeedRefresh } from './pwaUpdate'

export function registerPwaUpdates(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      handleNeedRefresh(() => void updateSW(true)).catch((e) => console.error('PWA update check failed', e))
    },
  })
}
