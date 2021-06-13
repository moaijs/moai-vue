<template>
  <button :class="$style.moaiButton">{{ label }}</button>
</template>

<script lang="ts">
import { defineComponent } from "vue";
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

<style lang="scss" scoped module>
.moaiButton {
  padding: 5rem;
  background: black;
  color: white;
  border: 0;
}
</style>
