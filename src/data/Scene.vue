<template>
    <div class="scene">
        <img
            v-if="day >= 7"
            :src="cloth"
            class="scene-item"
            style="left: 4%; bottom: 3%; width: 40px; height: 40px"
        />
        <img v-if="day >= 0" :src="tree" class="scene-item" style="left: 10%; bottom: 10%" />
        <img
            v-if="day >= 13"
            :src="letters"
            class="scene-item"
            style="left: 26%; bottom: 12%; width: 40px; height: 40px"
        />
        <img
            v-if="day >= 12"
            :src="advManagement"
            class="scene-item"
            style="left: 33%; bottom: 12%; width: 30%; height: 60%"
        />
        <template v-else>
            <img
                v-if="day >= 11"
                :src="management"
                class="scene-item"
                style="left: 28%; bottom: 12%"
            />
            <img
                v-if="day >= 1"
                :src="workshop"
                class="scene-item"
                style="left: 40%; bottom: 12%"
            />
            <img v-if="day >= 3" :src="elves" class="scene-item" style="left: 52%; bottom: 12%" />
        </template>
        <img
            v-if="day >= 2"
            :src="coal"
            class="scene-item"
            style="left: 65%; bottom: 12%; width: 40px; height: 40px"
        />
        <img
            v-if="day >= 6"
            :src="metal"
            class="scene-item"
            style="left: 72%; bottom: 8%; width: 40px; height: 40px"
        />
        <img v-if="day >= 8" :src="oil" class="scene-item" style="left: 80%; bottom: 6%" />
        <div
            v-if="day >= 4"
            class="scene-bubble"
            :style="day >= 12 ? `left: 33%; bottom: 73%` : `left: 50%; bottom: 38%`"
        >
            <img v-if="day >= 4" :src="paper" class="scene-item" />
            <img v-if="day >= 5" :src="boxes" class="scene-item" />
            <img v-if="day >= 9" :src="plastic" class="scene-item" />
            <img v-if="day >= 10" :src="dyes" class="scene-item" />
            <img v-if="day >= 14" :src="wrappingPaper" class="scene-item" />
            <img v-if="day >= 15" :src="ribbons" class="scene-item" />
        </div>
    </div>
</template>

<script setup lang="ts">
import tree from "./symbols/tree.png";
import workshop from "./symbols/sws.png";
import coal from "./symbols/coal.png";
import elves from "./symbols/elf.png";
import paper from "./symbols/paperStacks.png";
import boxes from "./symbols/cardboardBox.png";
import metal from "./symbols/metal.png";
import cloth from "./symbols/cloth.png";
import oil from "./symbols/oil.png";
import plastic from "./symbols/plastic.png";
import dyes from "./symbols/dyes.png";
import management from "./symbols/elfManagement.png";
import advManagement from "./symbols/workshopMansion.png";
import letters from "./symbols/letterbox.png";
import wrappingPaper from "./symbols/wrappingPaper.png";
import ribbons from "./symbols/ribbons.png";

defineProps<{
    day: number;
}>();
</script>

<style scoped>
.scene {
    width: 600px;
    position: relative;
    max-width: 95%;
    aspect-ratio: 2/1;
}

.scene::after {
    content: "";
    position: absolute;
    width: 100%;
    height: 20%;
    border-radius: 50% / 100%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    bottom: 0;
    background: white;
}

.scene-item {
    width: 13.3%;
    height: 26.6%;
    position: absolute;
    z-index: 1;
}

.scene-bubble {
    position: absolute;
    background: white;
    height: 20%;
    padding: 5px;
    border-radius: 10px;
}

.scene-bubble::after {
    content: "";
    position: absolute;
    width: 0;
    height: 0;
    top: 100%;
    left: 20px;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 15px solid white;
}

.scene-bubble .scene-item {
    height: calc(100% - 10px);
    width: unset;
    aspect-ratio: 1/1;
    position: static;
}
</style>
