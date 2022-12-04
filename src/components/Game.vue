<template>
    <div class="tabs-container" :class="{ useHeader }">
        <div
            v-for="(tab, index) in tabs"
            :key="index"
            class="tab"
            :ref="`tab-${index}`"
            :style="unref(layers[tab]?.style)"
            :class="unref(layers[tab]?.classes)"
        >
            <Nav v-if="index === 0 && !useHeader" />
            <div class="inner-tab">
                <Layer
                    v-if="layerKeys.includes(tab)"
                    v-bind="gatherLayerProps(layers[tab]!)"
                    :index="index"
                    :tab="() => (($refs[`tab-${index}`] as HTMLElement[] | undefined)?.[0])"
                />
                <component :is="tab" :index="index" v-else />
            </div>
        </div>
        <Modal
            :modelValue="main.showLoreModal.value"
            @update:model-value="value => (main.showLoreModal.value = value)"
        >
            <template v-slot:header
                ><h2>{{ main.loreTitle.value }}</h2></template
            >
            <template v-slot:body>
                <component v-if="loreBody" :is="loreBody" />
                <div v-if="main.loreScene.value !== -1">
                    <Scene :day="main.loreScene.value" />
                    <br />
                    You can help continue the <i>advent</i>ure at:
                    <a href="https://discord.gg/WzejVAx" class="info-modal-discord-link">
                        <span class="material-icons info-modal-discord">discord</span>
                        The Paper Pilot Community
                    </a>
                </div>
            </template>
        </Modal>
    </div>
</template>

<script setup lang="ts">
import { main } from "data/projEntry";
import projInfo from "data/projInfo.json";
import Scene from "data/Scene.vue";
import type { GenericLayer } from "game/layers";
import { layers } from "game/layers";
import player from "game/player";
import { computeOptionalComponent } from "util/vue";
import { computed, toRef, unref } from "vue";
import Layer from "./Layer.vue";
import Modal from "./Modal.vue";
import Nav from "./Nav.vue";

const tabs = toRef(player, "tabs");
const layerKeys = computed(() => Object.keys(layers));
const useHeader = projInfo.useHeader;

const loreBody = computeOptionalComponent(main.loreBody);

function gatherLayerProps(layer: GenericLayer) {
    const { display, minimized, minWidth, name, color, minimizable, nodes } = layer;
    return { display, minimized, minWidth, name, color, minimizable, nodes };
}
</script>

<style scoped>
.tabs-container {
    width: 100vw;
    flex-grow: 1;
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
}

.tabs-container:not(.useHeader) {
    width: calc(100vw - 50px);
    margin-left: 50px;
}

.tab {
    position: relative;
    height: 100%;
    flex-grow: 1;
    transition-duration: 0s;
    overflow-y: auto;
    overflow-x: hidden;
}

.inner-tab {
    padding: 50px 10px;
    min-height: calc(100% - 100px);
    display: flex;
    flex-direction: column;
    margin: 0;
    flex-grow: 1;
}

.tab + .tab > .inner-tab {
    border-left: solid 4px var(--outline);
}
</style>

<style>
.tab hr {
    height: 4px;
    border: none;
    background: var(--outline);
    margin: var(--feature-margin) 0;
}

.tab .modal-body hr {
    margin: 7px 0;
}
</style>
