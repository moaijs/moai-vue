<template>
  <button>Hello {{ world }}</button>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
export default defineComponent({
  name: "Button",
  setup() {
    const world = ref<String>("World");
    return { world };
  }
});
</script>
