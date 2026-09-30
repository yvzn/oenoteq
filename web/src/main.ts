import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'
import './style.css'

createApp(App).use(router).mount('#app')
startSync()
registerPwaUpdates()
