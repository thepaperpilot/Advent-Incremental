<template>
    <div>
        <div>Info on components</div>
        <div class="componentDisp">
            <div class="componentSelect">
                <div class="i">
                    <h2>Components!</h2>
                </div>
            </div>
            <div
                ref="element"
                class="factoryDisp"
                @click="e => $emit('click', e)"
                @mousemove="e => $emit('mouseMove', e)"
                @mouseenter="e => $emit('mouseEnter', e)"
                @mouseleave="e => $emit('mouseLeave', e)"
            />
        </div>
    </div>
</template>
<script setup lang="ts">
import type { Application } from "@pixi/app";
import { onMounted, shallowRef } from "vue";
import "lib/pixi";

const element = shallowRef<HTMLElement | null>(null);
const props = defineProps<{
    application: Application;
}>();

defineEmits<{
    (e: "mouseMove", i: MouseEvent): void;
    (e: "mouseEnter", i: MouseEvent): void;
    (e: "mouseLeave", i: MouseEvent): void;
    (e: "click", i: MouseEvent): void;
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
.componentDisp {
    display: flex;
    border: 2px solid grey;
    align-items: stretch;
}
.componentSelect {
    flex-grow: 1;
    border: 2px solid green;
}
.factoryDisp {
    flex-grow: 1;
    border: 2px solid green;
}
</style>
