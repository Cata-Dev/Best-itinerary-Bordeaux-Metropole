<template>
    <div class="flex items-stretch w-1/3 relative px-3 bg-bg-light dark:bg-bg-dark rounded-full">
        <button class="flex mr-1 items-center">
            <font-awesome-icon icon="crosshairs" class="text-t-light-primary dark:text-t-dark-primary" style="font-size: 22px;"/>
        </button>
        <input type="text" :list="name" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" class="flex-grow border-none focus:ring-transparent bg-bg-light dark:bg-bg-dark text-t-light-primary dark:text-t-dark-primary placeholder-t-light-faded dark:placeholder-t-dark-faded" :placeholder="placeholder">
        <datalist :id="name">
            <option v-for="data in datalist" :key="data.value" :value="data.display">{{ data.type }}</option>
        </datalist>
        <span class="flex mr-1 items-center">
            <font-awesome-icon :icon="name == 'destination' ? 'flag' : 'map-pin'" class="text-t-light-primary dark:text-t-dark-primary ml-1" style="font-size: 22px;"/>
        </span>
    </div>
</template>

<script>
export default {
    name: 'LocationSearch',
    props: {
        name: String,
        datalist: Array,
        placeholder: String,
        modelValue: String,
    },
    emits: [
        'update:modelValue',
    ],
    setup() {
        
        return {
            
        }
    },
}
</script>