import { createApp } from 'vue'
import App from './App.vue'
import { createAppI18n } from './i18n'
import router from './router'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'
import './style.css'

createApp(App).use(router).use(createAppI18n()).mount('#app')
startSync()
registerPwaUpdates()
