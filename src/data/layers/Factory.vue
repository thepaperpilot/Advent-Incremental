<template>
    <div ref="element" class="factoryDisp" />
</template>
<script setup lang="ts">
import type { Application } from "@pixi/app";
import { onMounted, shallowRef } from "vue";
import {size} from "./factory"
import "lib/pixi";

const element = shallowRef<HTMLElement | null>(null);
const props = defineProps<{
    application: Application;
}>();
console.log(props.application);
onMounted(() => {
    if (element.value !== null) {
        element.value?.append(props.application.view);
        //props.application.resizeTo = element.value;
        //props.application.resize();
    } else {
        throw new TypeError("This should not occur");
    }
});
</script>
<style scoped>
.factoryDisp {
    width: v-bind("size.width");
    height: v-bind("size.height");
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
</style>
