import { ref } from 'vue'

const DURATION_MS = 3000

export function useTransientMessage() {
  const message = ref<string | null>(null)
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  function show(text: string) {
    if (timeoutId) clearTimeout(timeoutId)
    message.value = text
    timeoutId = setTimeout(() => {
      message.value = null
    }, DURATION_MS)
  }

  function clear() {
    if (timeoutId) clearTimeout(timeoutId)
    message.value = null
  }

  return { message, show, clear }
}
