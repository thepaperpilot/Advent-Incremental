<template>
    <div
        class="day feature dontMerge opened"
        :class="{
            mastered: unref(mastered),
            masteryLock,
            wallpaper: day < 8
        }"
        v-if="opened.value && visibility !== Visibility.None"
    >
        <div class="ribbon" v-if="day >= 8" />
        <Tooltip :display="layers[layer ?? '']?.name ?? ''" :direction="Direction.Up" yoffset="5px">
            <Transition appear :name="masteryLock ? 'door-close' : 'door'">
                <div class="doors" @click="emit('openLayer')">
                    <div class="date">Dec<br />{{ day }}</div>
                    <div class="date">Dec<br />{{ day }}</div>
                </div>
            </Transition>
            <div
                class="icon"
                @click="emit('openLayer')"
                :style="{ backgroundImage: `url(${symbol})` }"
            ></div>
            <div class="lore" @click="emit('openLore')">?</div>
            <Notif v-if="unref(shouldNotify)" />
        </Tooltip>
    </div>
    <div
        v-else-if="visibility !== Visibility.None"
        class="day feature dontMerge"
        :class="{ can: canOpen, locked: !canOpen, canOpen, mastered: unref(mastered) }"
        @click="tryUnlock"
    >
        <div class="doors"></div>
        <div class="date">Dec<br />{{ day }}</div>
        <div v-if="!canOpen" class="material-icons lock">lock</div>
        <div v-if="main.day.value === day && !canOpen" class="timer">
            {{
                main.timeUntilNewDay.value < 0
                    ? "Not Ready"
                    : formatTime(main.timeUntilNewDay.value, 0)
            }}
        </div>
        <Notif v-if="canOpen" />
    </div>
</template>

<script setup lang="ts">
import Notif from "components/Notif.vue";
import { Visibility } from "features/feature";
import Tooltip from "features/tooltips/Tooltip.vue";
import { layers } from "game/layers";
import player, { IgnoreDateSettings } from "game/player";
import Decimal from "util/bignum";
import { formatTime } from "util/break_eternity";
import { Direction } from "util/common";
import { ProcessedComputable } from "util/computed";
import { computed, Ref, Transition, unref } from "vue";
import coal from "./layers/coal";
import dyes from "./layers/dyes";
import { main } from "./projEntry";

const props = defineProps<{
    day: number;
    symbol: string;
    layer: string | null;
    opened: Ref<boolean>;
    recentlyUpdated: Ref<boolean>;
    shouldNotify: ProcessedComputable<boolean>;
    mastered: Ref<boolean>;
    visibility?: Visibility;
}>();

const emit = defineEmits<{
    (e: "openLore"): void;
    (e: "openLayer"): void;
    (e: "unlockLayer"): void;
}>();

const canOpen = computed(
    () =>
        props.layer != null &&
        Decimal.gte(main.day.value, props.day) &&
        (new Date().getMonth() === 11 || player.ignoreDate !== IgnoreDateSettings.AsIntended) &&
        (new Date().getDate() >= props.day || player.ignoreDate === IgnoreDateSettings.IgnoreDay)
);

const isMastering = main.isMastery;
const includeMastery = computed(
    () =>
        props.mastered.value ||
        main.currentlyMastering.value == layers[props.layer ?? ""] ||
        ["wrappingPaper", "ribbon"].includes(props.layer ?? "") ||
        (coal.mastered.value && props.layer == "elves") ||
        (dyes.mastered.value && props.layer == "elves")
);
const masteryLock = computed(() => isMastering.value && !includeMastery.value);

function tryUnlock() {
    if (canOpen.value === true) {
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

.mastered.day.wallpaper {
    box-shadow: rgb(0 0 0 / 25%) 0px 0px 0px 3px inset;
    background: linear-gradient(
        225deg,
        rgb(255, 76, 76) 11.1%,
        rgb(255, 255, 255) 11.1% 22.2%,
        rgb(65, 255, 95) 22.2% 33.3%,
        rgb(255, 255, 255) 33.3% 44.4%,
        rgb(255, 76, 76) 44.4% 55.5%,
        rgb(255, 255, 255) 55.5% 66.6%,
        rgb(65, 255, 95) 66.6% 77.7%,
        rgb(255, 255, 255) 77.7% 88.8%,
        rgb(255, 76, 76) 88.8%
    );
}

.door-enter-from::before,
.door-enter-from::after,
.door-close-enter-to::before,
.door-close-enter-to::after {
    transform: perspective(150px) rotateY(0) !important;
}

.door-enter-from .date,
.door-close-enter-to .date {
    transform: translate(-50%, -50%) perspective(150px) rotateY(0) !important;
}

.door-enter-active::before,
.door-enter-active::after,
.door-close-enter-active::before,
.door-close-enter-active::after {
    z-index: 2;
}

.door-enter-active .date,
.door-close-enter-active .date {
    z-index: 3;
}

.day .doors::before,
.day .doors::after,
.day .doors .date {
    transition: 1s;
}

.day.opened .doors::before {
    transform-origin: left;
}

.day.opened .doors::after {
    transform-origin: right;
}

.day.opened:not(.masteryLock) .doors::before {
    transform: perspective(150px) rotateY(-135deg);
}

.day.opened:not(.masteryLock) .doors::after {
    transform: perspective(150px) rotateY(135deg);
}

.day.opened .doors .date:first-child {
    transform-origin: left;
    clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
}

.day.opened .doors .date:last-child {
    transform-origin: right;
    clip-path: polygon(100% 0, 50% 0, 50% 100%, 100% 100%);
}

.day.opened:not(.masteryLock) .doors .date:first-child {
    transform: translate(-50%, -50%) perspective(150px) rotateY(-135deg);
}

.day.opened:not(.masteryLock) .doors .date:last-child {
    transform: translate(-50%, -50%) perspective(150px) rotateY(135deg);
}

.tooltip-container,
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
    z-index: 1;
}

.doors::before {
    top: 0;
    left: 0;
}

.doors::after {
    top: 0;
    right: 0;
}

.masteryLock {
    cursor: not-allowed;
}
.masteryLock > * {
    pointer-events: none;
}
.masteryLock > * > :not(.doors) {
    opacity: 0;
}
.masteryLock .icon {
    transition-duration: 0.2s;
    transition-delay: 0.8s;
}

.mastered.wallpaper .doors::before,
.mastered.wallpaper .doors::after {
    background: linear-gradient(
        225deg,
        rgb(255, 76, 76) 11.1%,
        rgb(255, 255, 255) 11.1% 22.2%,
        rgb(65, 255, 95) 22.2% 33.3%,
        rgb(255, 255, 255) 33.3% 44.4%,
        rgb(255, 76, 76) 44.4% 55.5%,
        rgb(255, 255, 255) 55.5% 66.6%,
        rgb(65, 255, 95) 66.6% 77.7%,
        rgb(255, 255, 255) 77.7% 88.8%,
        rgb(255, 76, 76) 88.8%
    );
}

.mastered .ribbon {
    position: absolute;
    top: -2px;
    left: 0px;
    width: calc(100% + 0px);
    height: calc(100% + 4px);
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    z-index: 11;
}

.mastered .ribbon::after {
    content: "🎀";
    color: red;
    position: absolute;
    top: -5px;
    left: -5px;
    font-size: xx-large;
    transform: rotateZ(-45deg);
    z-index: 1;
}

.mastered .ribbon::before {
    content: "";
    width: calc(100% - 24px);
    height: 100%;
    border: solid darkred 8px;
    transform: rotateZ(45deg);
    position: absolute;
    top: 0;
    left: 0;
    border-top: none;
    border-bottom: none;
    z-index: 1;
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
    width: calc(100% - 14px);
}

.timer {
    position: absolute;
    bottom: -12px;
    left: 50%;
    padding: 0 3px;
    transform: translateX(-50%);
    z-index: 3;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    font-size: small;
    border: 2px solid rgba(0, 0, 0, 0.125);
    border-radius: var(--border-radius);
    background: var(--locked);
}
.icon {
    pointer-events: none;
    background-size: contain;
    width: 90%;
    height: 90%;
    margin: 5%;
}

.lore {
    position: absolute;
    top: 2px;
    right: 2px;
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
    z-index: 2;
}
</style>
