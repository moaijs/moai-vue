<template>
  <button>{{ label }}</button>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
export default defineComponent({
  name: "Button",
  props: {
    label: String
  },
  setup(props) {
    return {
      label: props.label
    }
  }
});
</script>
