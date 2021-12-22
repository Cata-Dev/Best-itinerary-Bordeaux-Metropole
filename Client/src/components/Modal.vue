<template>
  <div
    ref="focusDiv"
    tabindex="10"
    class="
      flex
			fixed
      top-0
      left-0
			w-full
			h-full
			outline-none
      bg-slate-600/75
      z-50
      transition-all
      duration-150"
    :class="{ 'invisible': !shown, 'opacity-0': !shown, 'visible': shown, 'opacity-100': shown }"
    @keyup.esc="show()"
  >
    <div 
      class="
        m-auto
        w-fit
        pointer-events-none
        duration-300"
    >
      <div
        class="
          border-none
					shadow-lg
					flex
					flex-col
					w-full
					pointer-events-auto
					bg-clip-padding
					rounded-md
					outline-none
					text-current"
        :class="color === 'success' ? [{'bg-success-bg': bg}, 'border-success-t'] : color === 'info' ? [{'bg-info-bg': bg}, 'border-info-t'] : [{'bg-alert-bg': bg}, 'border-alert-t']"
      >
        <div
          class="
						flex
						flex-shrink-0
						items-center
						justify-between
						p-4
						border-b
						rounded-t-md"
          :class="color === 'success' ? {'border-success-t': true} : color === 'info' ? {'border-info-t': true} : {'border-alert-t': true}"
        >
          <h5
            class="text-xl font-medium leading-normal"
            :class="color === 'success' ? ['text-success-t'] : color === 'info' ? ['text-info-t'] : ['text-alert-t']"
          >
            <font-awesome-icon
              :icon="icon || 'spinner'"
              class="mr-1"
            />
            {{ title }}
          </h5>
          <button
            class="
							flex
							hover:scale-[110%]
							duration-300
							items-center
							rounded-md
							justify-self-end"
            @click="show()"
          >
            <font-awesome-icon
              icon="times"
              class="text-t-light-primary dark:text-t-dark-primary text-2xl"
            />
          </button>
        </div>
        <div
          class="relative p-4"
          :class="color === 'success' ? ['text-success-t'] : color === 'info' ? ['text-info-t'] : ['text-alert-t']"
        >
          {{ content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onUpdated, ref } from 'vue'
export default {
    name: 'DynamicModal',
    props: {
        title: {
            type: String,
            required: true,
            default: '',
        },
        content: {
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
            default: true,
        },
        shown: {
            type: Boolean,
            required: true,
            default: false,
        },
    },
    emits: [
      'update:shown'
    ],
    setup(props, ctx) {

      const focusDiv = ref(null)

      function show() {
        ctx.emit('update:shown', !props.shown)
      }

      onUpdated(async () => {
        if (props.shown) setTimeout(() => {
          focusDiv.value.focus()
        }, 200); //wait for transition on focusDiv to proceed
      })

      return {
        show,
        focusDiv
      }
    },
}
</script>