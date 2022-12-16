<template>
    <div ref="element" style="factory" />
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
    } else {
        throw new TypeError("This should not occur");
    }
});
</script>
<style scoped>
.factory {
    width: 100%;
    height: 100%;
}
</style>
