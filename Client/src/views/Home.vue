<template>
    <div class="flex flex-col flex-wrap max-h-full h-4/5 w-full justify-center content-center">
        <LocationSearch name="source" ref="sourceElem" :datalist="source.datalist" @keyup="refreshSuggestions(source)" v-model="source.input" placeholder="Départ" class="my-1" />
        <LocationSearch name="destination" ref="destinationElem" :datalist="destination.datalist" @keyup="refreshSuggestions(destination)" v-model="destination.input" placeholder="Arrivée" class="my-1" />
        <ExtraSettings v-model="o"/>
    </div>
</template>

<script>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
import { client } from '../store/'

export default {
    name: 'Home',
    components: {
        LocationSearch,
        ExtraSettings,
    },
    setup() {

        const source = ref({
            datalist: [],
            input: '',
            previousInput: null,
            updated: Date.now(),
        })
        const destination = ref({
            datalist: [],
            input: '',
            previousInput: null,
            updated: Date.now(),
        })

        function parseGeocode(s) {

            switch(s.GEOCODE_type) {

                case 'Addresses':
                    return { display: `${s.numero} ${s.rep ? s.rep+' ' : ''}${s.nom_voie} ${s.commune}`, type: "Adresse" }

                case 'TBM_Stops':
                    return { display: s.libelle, type: s.vehicule }

                case 'SNCF_Stops':
                    return { display: s.name, type: "Train" }

                default: return null

            }

        }

        async function refreshSuggestions(type) {

            if (type.previousInput === type.input) return
            if (type.input.length < 5) return type.datalist = []
            const now = Date.now()
            let suggestions
            try {
                suggestions = await client.service('geocode').find({ query: { id: type.input, max: 25, uniqueVoies: true } })
            // eslint-disable-next-line no-empty
            } catch(_) {}
            if (now < type.updated) return
            type.datalist = suggestions && suggestions.length ? suggestions.map(s => ({ value: s.coords, ...parseGeocode(s) })) : []
            type.previousInput = type.input
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