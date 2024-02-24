<script setup lang="ts">
defineProps({
  text: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  bg: {
    type: Boolean,
    required: false,
    default: true,
  },
});
</script>

<template>
  <div
    class="flex py-[0.125rem] px-2 rounded-full items-center border-2"
    :class="
      color === 'success'
        ? [{ 'bg-success-bg': bg }, 'border-success-t']
        : color === 'info'
          ? [{ 'bg-info-bg': bg }, 'border-info-t']
          : [{ 'bg-alert-bg': bg }, 'border-alert-t']
    "
  >
    <span
      class="mr-1 text-sm whitespace-nowrap"
      :class="
        color === 'success' ? ['text-success-t'] : color === 'info' ? ['text-info-t'] : ['text-alert-t']
      "
    >
      <p class="inline">{{ text }}</p>
    </span>
    <div
      v-if="icon === 'loading'"
      class="spinner-border animate-spin inline-block w-4 h-4 squared border-2 rounded-full border-info-t"
      role="status"
    />
    <font-awesome-icon v-else :icon="icon" class="text-xl" :class="`text-${color}-t`" />
  </div>
</template>

<style scoped>
.spinner-border {
  border-right: 0.25em solid transparent;
}
</style>
