<template>
    <line
        class="link"
        v-bind="link"
        :class="{ pulsing: link.pulsing }"
        :x1="startPosition.x"
        :y1="startPosition.y"
        :x2="endPosition.x"
        :y2="endPosition.y"
    />
    <text
        v-if="link.weight"
        :x="(startPosition.x + endPosition.x) / 2"
        :y="(startPosition.y + endPosition.y) / 2 + 4"
        style="text-anchor: middle; fill: var(--foreground)"
        >{{ link.weight }}</text
    >
</template>

<script setup lang="ts">
import type { BoardNodeLink } from "features/boards/board";
import { computed, toRefs, unref } from "vue";

const _props = defineProps<{
    link: BoardNodeLink & { weight?: number };
}>();
const props = toRefs(_props);

const startPosition = computed(() => {
    const position = props.link.value.startNode.position;
    if (props.link.value.offsetStart) {
        position.x += unref(props.link.value.offsetStart).x;
        position.y += unref(props.link.value.offsetStart).y;
    }
    return position;
});

const endPosition = computed(() => {
    const position = props.link.value.endNode.position;
    if (props.link.value.offsetEnd) {
        position.x += unref(props.link.value.offsetEnd).x;
        position.y += unref(props.link.value.offsetEnd).y;
    }
    return position;
});
</script>

<style scoped>
.link.pulsing {
    animation: pulsing 2s ease-in infinite;
}

@keyframes pulsing {
    0% {
        opacity: 0.25;
    }

    50% {
        opacity: 1;
    }

    100% {
        opacity: 0.25;
    }
}
</style>
