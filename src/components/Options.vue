<template>
    <Modal v-model="isOpen">
        <template v-slot:header>
            <h2>Settings</h2>
            <div class="option-tabs">
                <button :class="{selected: isTab('behaviour')}" @click="setTab('behaviour')">Behaviour</button>
                <button :class="{selected: isTab('appearance')}" @click="setTab('appearance')">Appearance</button>
            </div>
        </template>
        <template v-slot:body>
            <div v-if="isTab('behaviour')">
                <Toggle :title="autosaveTitle" v-model="autosave" />
                <FeedbackButton v-if="!autosave" class="button save-button" @click="save()">Manually save</FeedbackButton>
                <Toggle v-if="projInfo.enablePausing" :title="isPausedTitle" v-model="isPaused" />
                <Toggle :title="autoPauseTitle" v-model="autoPause" />
            </div>
            <div v-if="isTab('appearance')">
                <Select :title="themeTitle" :options="themes" v-model="theme" />
                <component :is="settingFieldsComponent" />
                <Toggle :title="showTPSTitle" v-model="showTPS" />
                <Toggle :title="progressMethodTitle" v-model="usingLog" />
                <Toggle :title="alignModifierUnitsTitle" v-model="alignUnits" />
            </div>
        </template>
    </Modal>
</template>

<script setup lang="tsx">
import Modal from "components/Modal.vue";
import projInfo from "data/projInfo.json";
import rawThemes from "data/themes";
import { jsx } from "features/feature";
import Tooltip from "features/tooltips/Tooltip.vue";
import player from "game/player";
import settings, { settingFields } from "game/settings";
import { camelToTitle } from "util/common";
import { save } from "util/save";
import { coerceComponent, render } from "util/vue";
import { computed, ref, toRefs } from "vue";
import Select from "./fields/Select.vue";
import Toggle from "./fields/Toggle.vue";
import FeedbackButton from "./fields/FeedbackButton.vue";

const isOpen = ref(false);

const currentTab = ref("behaviour");

defineExpose({
    isTab,
    setTab,
    save() {
        save();
    },
    open() {
        isOpen.value = true;
    }
});

function isTab (tab: string): boolean {
    return tab == currentTab.value;
}

function setTab (tab: string) {
    currentTab.value = tab;
}

const themes = Object.keys(rawThemes).map(theme => ({
    label: camelToTitle(theme),
    value: theme
}));

const settingFieldsComponent = computed(() => {
    return coerceComponent(jsx(() => <>{settingFields.map(render)}</>));
});

const { showTPS, theme, usingLog, alignUnits } = toRefs(settings);

const { autosave, autoPause } = toRefs(player);

const isPaused = computed({
    get() {
        return player.devSpeed === 0;
    },
    set(value: boolean) {
        player.devSpeed = value ? 0 : null;
    }
});


const autosaveTitle = jsx(() => (
    <span class="option-title">
        Autosave<Tooltip display="Save-specific">*</Tooltip>
        <desc>Automatically save the game every second or when the game is closed.</desc>
    </span>
));
const isPausedTitle = jsx(() => (
    <span class="option-title">
        Pause game<Tooltip display="Save-specific">*</Tooltip>
        <desc>Stop everything from moving.</desc>
    </span>
));
const autoPauseTitle = jsx(() => (
    <span class="option-title">
        Auto-pause<Tooltip display="Save-specific">*</Tooltip>
        <desc>Automatically pause the game when a day is completed. It is best to keep this on to avoid over-grinding.</desc>
    </span>
));

const themeTitle = jsx(() => (
    <span class="option-title">
        Theme
        <desc>How the game looks.</desc>
    </span>
));
const showTPSTitle = jsx(() => (
    <span class="option-title">
        Show TPS
        <desc>Show TPS meter at the bottom-left corner of the page.</desc>
    </span>
));
const progressMethodTitle = jsx(() => (
    <span class="option-title">
        Logarithmic progress bars
        <desc>Whether progress bars should be normalized for exponential growth.</desc>
    </span>
));
const alignModifierUnitsTitle = jsx(() => (
    <span class="option-title">
        Align modifier units
        <desc>Align numbers to the beginning of the unit in modifier view.</desc>
    </span>
));
</script>

<style>
.option-tabs {
    border-bottom: 2px solid var(--outline);
}

.option-tabs button {
    background-color: transparent;
    color: var(--foreground);
    margin-bottom: -2px;
    font-size: 14px;
    cursor: pointer;
    padding: 5px 20px;
    border: none;
    border-bottom: 2px solid var(--foreground);
}

.option-tabs button:not(.selected) {
    border-bottom-color: transparent;
}

.option-title .tooltip-container {
    display: inline;
    margin-left: 5px;
}
.option-title desc {
    display: block;
    opacity: 0.6;
    font-size: small;
    width: 300px;
    margin-left: 0;
}

.save-button {
    text-align: right;
}
</style>
