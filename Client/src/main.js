import { createApp } from 'vue'
import { router } from './router';
import './index.css'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCrosshairs, faSearchLocation, faMoon, faSun, faMapPin, faFlag } from '@fortawesome/free-solid-svg-icons'
import {  } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faCrosshairs, faSearchLocation, faMoon, faSun, faMapPin, faFlag )
import App from './App.vue'

const app = createApp(App)
app
    .component('font-awesome-icon', FontAwesomeIcon)
app
    .use(router)
    .use(router)

app.mount('#app')
