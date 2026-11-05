import { onMounted, onUnmounted, ref } from 'vue'
import { apiClient } from '../api/client'

// `navigator.onLine` only reflects whether the device has a network
// interface up — on the home Wi-Fi with the PC powered off it stays `true`
// even though nothing is reachable (ADR-0002). A live `/health` check is the
// only way to tell those two cases apart.
export function useConnectivity() {
  const isOnline = ref(navigator.onLine)

  async function check(): Promise<void> {
    if (!navigator.onLine) {
      isOnline.value = false
      return
    }
    try {
      await apiClient.get('/health')
      isOnline.value = true
    } catch {
      isOnline.value = false
    }
  }

  function handleOffline(): void {
    isOnline.value = false
  }

  function handleOnline(): void {
    check()
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    check()
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline, check }
}
