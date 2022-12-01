<template>
    <div class="day feature dontMerge opened" v-if="opened.value">
        <Transition appear name="door">
            <div class="doors" @click="emit('openLayer')">
                <div class="date">Dec<br />{{ day }}</div>
                <div class="date">Dec<br />{{ day }}</div>
            </div>
        </Transition>
        <div class="icon" v-if="symbolComp"><component :is="symbolComp" /></div>
        <div class="lore" @click="emit('openLore')">?</div>
        <Notif v-if="unref(shouldNotify)" />
    </div>
    <div
        v-else
        class="day feature dontMerge"
        :class="{ can: canOpen, locked: !canOpen, canOpen }"
        @click="tryUnlock"
    >
        <div class="doors"></div>
        <div class="date">Dec<br />{{ day }}</div>
        <div v-if="!canOpen" class="material-icons lock">lock</div>
        <Notif v-if="canOpen" />
    </div>
</template>

<script setup lang="ts">
import { CoercableComponent } from "features/feature";
import { unref, toRef, computed } from "vue";
import type { Ref } from "vue";
import Notif from "components/Notif.vue";
import { computeComponent } from "util/vue";
import { ProcessedComputable } from "util/computed";
import Decimal from "util/bignum";
import { main } from "./projEntry";

const props = defineProps<{
    day: number;
    symbol: CoercableComponent;
    opened: Ref<boolean>;
    shouldNotify: ProcessedComputable<boolean>;
}>();

const emit = defineEmits<{
    (e: "openLore"): void;
    (e: "openLayer"): void;
    (e: "unlockLayer"): void;
}>();

const symbolComp = computeComponent(toRef(props, "symbol"));

const canOpen = computed(
    () =>
        Decimal.gte(main.day.value, props.day) &&
        new Date().getMonth() === 11 &&
        new Date().getDate() >= props.day
);

function tryUnlock() {
    if (canOpen.value) {
        emit("unlockLayer");
    }
}
</script>

<style scoped>
.day {
    flex: 13% 0 0;
    position: relative;
    display: flex;
    background-color: var(--raised-background);
    aspect-ratio: 1;
    margin: 5%;
}

.door-enter-from::before,
.door-enter-from::after,
.door-leave-to::before,
.door-leave-to::after {
    transform: perspective(150px) rotateY(0) !important;
}

.door-enter-from .date,
.door-leave-to .date {
    transform: translate(-50%, -50%) perspective(150px) rotateY(0) !important;
}

.door-enter-active::before,
.door-enter-active::after,
.door-leave-active::before,
.door-leave-active::after {
    z-index: 2;
}

.door-enter-active .date,
.door-leave-active .date {
    z-index: 3;
}

.day.opened .doors::before,
.day.opened .doors::after,
.day.opened .doors .date {
    transition: 1s;
}

.day.opened .doors::before {
    transform-origin: left;
    transform: perspective(150px) rotateY(-135deg);
}

.day.opened .doors::after {
    transform-origin: right;
    transform: perspective(150px) rotateY(135deg);
}

.day.opened .doors .date:first-child {
    transform-origin: left;
    transform: translate(-50%, -50%) perspective(150px) rotateY(-135deg);
    clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
}

.day.opened .doors .date:last-child {
    transform-origin: right;
    transform: translate(-50%, -50%) perspective(150px) rotateY(135deg);
    clip-path: polygon(100% 0, 50% 0, 50% 100%, 100% 100%);
}

.doors {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
}

.day.opened .doors {
    cursor: pointer;
}

.doors::before,
.doors::after {
    content: "";
    position: absolute;
    background-color: var(--locked);
    width: 50%;
    height: 100%;
    pointer-events: none;
}

.doors::before {
    top: 0;
    left: 0;
}

.doors::after {
    top: 0;
    right: 0;
}

.date {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    font-size: large;
    pointer-events: none;
    user-select: none;
    backface-visibility: hidden;
    width: 100%;
}

.icon,
.icon .material-icons {
    font-size: xx-large;
    pointer-events: none;
    display: flex;
    user-select: none;
}

.lore {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    z-index: 1;
    border-radius: 50%;
    cursor: pointer;
    background-color: var(--highlighted);
    user-select: none;
}

.lore:hover {
    box-shadow: 0 0 10px var(--points);
}

.lock {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.2;
    font-size: 400%;
}
</style>
