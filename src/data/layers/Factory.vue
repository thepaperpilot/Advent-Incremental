<template>
    <div ref="element" class="factoryDisp" />
</template>
<script setup lang="ts">
import type { Application } from "@pixi/app";
import { onMounted, shallowRef } from "vue";
import "lib/pixi";

const element = shallowRef<HTMLElement | null>(null);
const props = defineProps<{
    application: Application;
}>();

onMounted(() => {
    if (element.value !== null) {
        element.value?.append(props.application.view);
        props.application.resizeTo = element.value;
        props.application.resize();
    } else {
        throw new TypeError("This should not occur");
    }
});
</script>
<style scoped>
.factoryDisp {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 148px;
    right: 0;
    touch-action: none;
}
</style>
