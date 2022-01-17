<script setup>
import { ref, watch } from 'vue'
import { transportToType } from '../store/'
import TransportBadge from './TransportBadge.vue'

const props = defineProps({
  placeholder: {
    type: String,
    required: true,
  },
  datalist: {
    type: Array,
    required: false,
    default: () => [],
  },
  modelValue: {
    type: Object,
    required: true,
  },
})

watch(() => props.datalist, (curr, old) => {
  if (JSON.stringify(curr) != JSON.stringify(old)) refreshInput()
})

const showDatalist = ref()

const emit = defineEmits([
  'update:modelValue',
  'input',
])

function updateModelValue(v) {
  emit('update:modelValue', v)
}

const inputElem = ref()
const input = ref()

function refreshInput(emitInput = true) {
  const found = props.datalist.find(e => e.display === input.value)
  if (found) updateModelValue(found)
  else updateModelValue({ display: '' })
  if (emitInput) emit('input', input.value)
}

function focus() {
  inputElem.value.focus()
}

function forceInput(v, emitInput = true) {
  input.value = v
  refreshInput(emitInput)
}

defineExpose({
  focus,
  forceInput,
})
</script>

<template>
  <div
    class="
      w-full
      bg-bg-light
      dark:bg-bg-dark"
  >
    <input
      ref="inputElem"
      v-model="input"
      type="text"
      class="
        w-[inherit]
        px-1
        flex-grow
        text-text-light-primary
        dark:text-text-dark-primary
        placeholder-text-light-faded
        dark:placeholder-text-dark-faded"
      :placeholder="placeholder"
      @input="refreshInput()"
      @focus="showDatalist = true"
      @focusout="showDatalist = false"
    >
    <div
      v-if="showDatalist && datalist.length"
      class="
        absolute
        bg-inherit
        shadow-xl
        mt-1
        z-10
        max-h-[40vh]
        overflow-y-auto
        w-fit"
    >
      <div
        v-for="(e, i) in datalist"
        :key="i"
        class="
          px-1
          py-2
          text-sm
          cursor-pointer
          hover:bg-bg-light-contrasted
          hover:dark:bg-bg-dark-contrasted"
        @mousedown="forceInput(e.display)"
      >
        <span
          class="ml-1 mr-2"
        >
          {{ e.display }}
        </span>
        <TransportBadge
          :type="transportToType(e.type.replace('ADRESSE', 'FOOT'))"
          :transport="e.type.replace('ADRESSE', 'FOOT')"
          :custom-text="e.type.toLowerCase().capitalize()"
          class="mr-1"
        />
      </div>
    </div>
  </div>
</template>