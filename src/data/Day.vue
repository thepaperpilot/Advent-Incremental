<template>
    <Tooltip :display="tooltipText">
        <div class="day feature dontMerge" :class="{ opened: unref(opened) }" @click="openLayer">
            <div class="doors"></div>
            <div class="icon" v-if="symbolComp"><component :is="symbolComp" /></div>
            <div class="lore" @click="emit('openLore')">?</div>
            <Notif v-if="unref(shouldNotify)" />
        </div>
    </Tooltip>
</template>

<script setup lang="ts">
import { CoercableComponent } from "features/feature";
import { unref, ref, toRef } from "vue";
import type { Ref } from "vue";
import Notif from "components/Notif.vue";
import Tooltip from "features/tooltips/Tooltip.vue";
import { computeComponent } from "util/vue";

const props = defineProps<{
    day: number;
    symbol: CoercableComponent;
    opened: Ref<boolean>;
    tooltipText: CoercableComponent;
    shouldNotify: Ref<boolean>;
}>();

const emit = defineEmits<{
    (e: "openLore"): void;
    (e: "openLayer"): void;
}>();

const symbolComp = computeComponent(toRef(props, "symbol"));
</script>

<style scoped>
.day {
    width: 100px;
    height: 100px;
    position: relative;
    display: flex;
    background-color: var(--raised-background);
}

.doors {
    position: absolute;
}

.doors::before,
.doors::after {
    
}

.icon,
.icon .material-icons {
    font-size: xxx-large;
    pointer-events: none;
    display: flex;
}

.lore {
    position: absolute;
    top: 5px;
    right: 5px;
    border-radius: 50%;
    
}
</style>
