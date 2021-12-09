<template>
    <div class="flex flex-col flex-wrap max-h-full h-4/5 w-full justify-center content-center">
        <location-search name="source" :datalist="source.datalist" @keyup="refreshSuggestions(source)" v-model="source.input" placeholder="Départ" class="my-1" />
        <location-search name="destination" :datalist="destination.datalist" @keyup="refreshSuggestions(destination)" v-model="destination.input" placeholder="Arrivée" class="my-1" />
    </div>
</template>

<script>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import { client } from '../store/'

export default {
    name: 'Home',
    components: {
        LocationSearch,
    },
    setup() {

        const source = ref({
            datalist: [],
            input: '',
            updated: Date.now(),
        })
        const destination = ref({
            datalist: [],
            input: '',
            updated: Date.now(),
        })

        function displayFromGeocode(s) {

            switch(s.GEOCODE_type) {

                case 'Addresses':
                    return `${s.numero} ${s.rep ? s.rep+' ' : ''}${s.nom_voie} ${s.commune}`

                case 'TBM_Stops':
                    return s.libelle

                case 'SNCF_Stops':
                    return s.name

                default: return null

            }

        }

        async function refreshSuggestions(type) {
            
            if (type.input.length < 5) return type.datalist = []
            const now = Date.now()
            let suggestions
            try {
                suggestions = await client.service('geocode').find({ query: { id: type.input, max: 25 } })
            // eslint-disable-next-line no-empty
            } catch(_) {console.error(_)}
            if (now < type.updated) return
            type.datalist = suggestions && suggestions.length ? suggestions.map(s => ({ value: s.coords, display: displayFromGeocode(s) })) : []
            type.updated = now

        }

        return {
            source,
            destination,
            refreshSuggestions,
        }
    },
}
</script>