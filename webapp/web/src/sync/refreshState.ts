import { reactive } from 'vue'

// What the refresh routine is doing, for the one screen that must tell a
// download in progress from one that is over (the never-downloaded cellar).
export const refreshState = reactive({ inFlight: false })
