import { createApp } from 'vue'
import App from './App.vue'
import { startBackgroundServices } from './boot'
import { createAppI18n } from './i18n'
import router from './router'
import './style.css'

createApp(App).use(router).use(createAppI18n()).mount('#app')
startBackgroundServices()
