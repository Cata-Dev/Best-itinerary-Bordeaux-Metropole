<script setup lang="ts">
import { getNewTopZIndex } from "@/store";
import { onMounted, onUpdated, ref, useTemplateRef } from "vue";
import CloseButton from "./CloseButton.vue";

export interface Modal {
  mainClasses: string[];
  initShown?: boolean;
}
const props = withDefaults(defineProps<Modal>(), { initShown: false });

const emit = defineEmits<(e: "update:shown", shown: boolean) => void>();

const focusDiv = useTemplateRef("focusDiv");

const zIndex = ref<number>(-1);
onMounted(() => {
  zIndex.value = getNewTopZIndex();
});

const shown = ref<boolean>(props.initShown);

function show(s = !shown.value) {
  if (s === shown.value) return;
  shown.value = s;
  emit("update:shown", s);
}

defineExpose({
  show,
  shown,
});

onUpdated(() => {
  if (shown.value)
    setTimeout(() => {
      focusDiv.value?.focus();
    }, 300); // wait for transition on focusDiv to proceed
});
</script>

<template>
  <div
    ref="focusDiv"
    tabindex="10"
    class="flex fixed top-0 left-0 w-full h-full outline-hidden transition-all duration-150 bg-slate-600/75"
    :class="{
      invisible: !shown,
      'opacity-0': !shown,
      visible: shown,
      'opacity-100': shown,
    }"
    :style="{ zIndex: zIndex }"
    @keyup.esc="show(false)"
    @click="show(false)"
  >
    <div class="m-auto w-fit duration-300 overflow-hidden" @click="(e: MouseEvent) => e.stopPropagation()">
      <div class="shadow-lg flex flex-col w-full rounded-md" :class="[mainClasses]">
        <div class="flex shrink-0 items-center justify-between py-4 px-2 mx-2 border-b border-inherit">
          <slot name="title"></slot>
          <CloseButton class="ml-2 hover:scale-[110%] duration-300 justify-self-end" @click="show(false)" />
        </div>
        <div class="relative p-4">
          <slot name="content"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
