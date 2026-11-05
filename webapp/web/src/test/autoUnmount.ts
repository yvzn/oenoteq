import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

// A wrapper left mounted keeps reacting to every later write to the shared local store,
// so each test got slower than the one before it. Unmount after each test.
enableAutoUnmount(afterEach)
