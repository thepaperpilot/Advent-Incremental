<template>
    <table>
        <tr>
            <td>Info</td>
        </tr>
        <tr>
            <td class="components">Components! go brrrrrrr</td>
            <td>
                <div
                    ref="element"
                    class="factoryDisp"
                    @click="e => $emit('click', e)"
                    @mousemove="e => $emit('mouseMove', e)"
                    @mouseenter="e => $emit('mouseEnter', e)"
                    @mouseleave="e => $emit('mouseLeave', e)"
                />
            </td>
        </tr>
    </table>
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

.factoryDisp {
    border: 2px solid green;
}
.components {
    width: 20%
}
</style>
