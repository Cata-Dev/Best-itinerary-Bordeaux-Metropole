<template>
    <div class="flex flex-col flex-wrap max-h-full h-4/5 w-full justify-center content-center">
        <LocationSearch name="source" ref="sourceElem" v-model="source" placeholder="Départ"/>
        <LocationSearch name="destination" ref="destinationElem" v-model="destination" placeholder="Arrivée" class="mt-2" />
        <ExtraSettings v-model="settings" class="mt-2"/>
    </div>
</template>

<script>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
// import { client } from '../store/'

export default {
    name: 'Home',
    components: {
        LocationSearch,
        ExtraSettings,
    },
    setup() {

        const source = ref(null)
        const destination = ref(null)
        const settings = ref(null)

        return {
            source,
            destination,
            settings,
        }
    },
}
</script>