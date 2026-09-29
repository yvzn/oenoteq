import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { startSync } from './sync'
import './style.css'

createApp(App).use(router).mount('#app')
startSync()
