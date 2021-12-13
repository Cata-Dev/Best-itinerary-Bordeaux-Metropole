<template>
    <div class="flex w-full items-stretch relative px-3 bg-bg-light dark:bg-bg-dark rounded-full">
        <button class="flex mr-1 items-center">
            <font-awesome-icon icon="crosshairs" class="text-t-light-primary dark:text-t-dark-primary" style="font-size: 22px;"/>
        </button>
        <input type="text" :list="name" v-model="location.input" @keyup="refreshSuggestions()"
            class="
                w-auto
				flex-grow
				border-none
				focus:ring-transparent
				bg-transparent
				text-t-light-primary
				dark:text-t-dark-primary
				placeholder-t-light-faded
				dark:placeholder-t-dark-faded"  
            :placeholder="placeholder">
        <datalist :id="name">
            <option v-for="data in location.datalist" :key="data.value" :value="data.display">{{ data.type }}</option>
        </datalist>
        <span class="flex mr-1 items-center">
            <font-awesome-icon :icon="name == 'destination' ? 'flag' : 'map-pin'"
                class="
                    text-t-light-primary
                    dark:text-t-dark-primary
                    ml-1"
                style="font-size: 22px;"/>
        </span>
    </div>
</template>

<script>
import { ref } from 'vue'
import { client } from '../store/'

export default {
    name: 'LocationSearch',
    props: {
        name: String,
        placeholder: String,
        modelValue: String,
    },
    emits: [
        'update:modelValue',
    ],
    setup(props, ctx) {

        const location = ref({
            datalist: [],
            input: '',
            previousInput: null,
            updated: Date.now(),
        })

        function updateModelValue(v) {
            ctx.emit('update:modelValue', JSON.stringify(v))
        }

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

        async function refreshSuggestions() {

            if (location.value.previousInput === location.value.input) return
            if (location.value.input.length < 5) return location.value.datalist = []
            const validLocation = location.value.datalist.find(l => l.display == location.value.input)
            if (validLocation) {
                updateModelValue(validLocation)
                return
            }
            const now = Date.now()
            let suggestions
            try {
                suggestions = await client.service('geocode').find({ query: { id: location.value.input, max: 25, uniqueVoies: true } })
            // eslint-disable-next-line no-empty
            } catch(_) {}
            if (now < location.value.updated) return
            location.value.datalist = suggestions && suggestions.length ? suggestions.map(s => ({ value: s.coords, ...parseGeocode(s) })) : []
            location.value.previousInput = location.value.input
            location.value.updated = now

        }
        
        return {
            location,
            updateModelValue,
            refreshSuggestions,
        }
    },
}
</script>