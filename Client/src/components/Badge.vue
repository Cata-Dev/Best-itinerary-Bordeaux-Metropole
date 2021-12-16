<template>
  <div
    class="
        flex
        my-[0.33rem]
        ml-4
        py-[0.125rem]
        px-2
        rounded-full
        items-center
        border-2"
    :class="badegStyle"
  >
    <span 
      class="mr-1 text-sm"
      :class="color === 'success' ? ['text-success-t'] : color === 'info' ? ['text-info-t'] : ['text-alert-t']"
    >
      {{ text }}
    </span>
    <div
      v-if="icon === 'loading'"
      class="
        spinner-border
        animate-spin
        inline-block
        w-4
        h-4
        squared
        border-2
        rounded-full
        border-info-t"
      role="status"
    />
    <font-awesome-icon
      v-else
      :icon="icon"
      class="text-xl"
      :class="`text-${color}-t`"
    />
  </div>
</template>

<script>
import { ref, onBeforeUpdate } from 'vue'

export default {
    name: 'DynamicBadge',
    props: {
        text: {
            type: String,
            required: true,
            default: '',
        },
        icon: {
            type: String,
            required: true,
            default: 'info',
        },
        color: {
            type: String,
            required: true,
            default: '',
        },
        bg: {
            type: Boolean,
            required: false,
            default: true
        },
    },
    setup(props) {

        let badegStyle = ref({
            [`bg-${props.color}-bg`]: props.bg,
            [`border-${props.color}-t`]: true,
        })

        onBeforeUpdate(() => {
            for (const c in badegStyle.value) {
                delete badegStyle.value[c]
            }
            badegStyle.value[`bg-${props.color}-bg`] = props.bg
            badegStyle.value[`border-${props.color}-t`] = true
        })

      return {
          badegStyle
      }
    },
}
</script>

<style>
.spinner-border {
    border-right: .25em solid transparent;
}
</style>