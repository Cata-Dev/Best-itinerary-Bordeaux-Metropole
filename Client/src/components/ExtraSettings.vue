<template>
  <div class="flex">
    <button class="flex items-center p-2 bg-bg-light dark:bg-bg-dark rounded-md justify-self-end">
      <font-awesome-icon
        icon="sliders-h"
        class="text-t-light-primary dark:text-t-dark-primary"
        style="font-size: 22px;"
      />
    </button>
  </div>
</template>

<script>
export default {
    name: 'ExtraSettings',
    props: {
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