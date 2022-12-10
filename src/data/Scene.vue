<template>
    <div class="scene">
        <img
            v-if="day >= 7"
            :src="cloth"
            class="scene-item"
            style="left: 4%; bottom: 3%; width: 40px; height: 40px"
        />
        <img v-if="day >= 0" :src="tree" class="scene-item" style="left: 10%; bottom: 10%" />
        <img v-if="day >= 1" :src="workshop" class="scene-item" style="left: 40%; bottom: 12%" />
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
        <img v-if="day >= 3" :src="elves" class="scene-item" style="left: 52%; bottom: 12%" />
        <div v-if="day >= 4" class="scene-bubble" style="left: 50%; bottom: 38%">
            <img v-if="day >= 4" :src="paper" class="scene-item" />
            <img v-if="day >= 5" :src="boxes" class="scene-item" />
            <img v-if="day >= 9" :src="plastic" class="scene-item" />
            <img v-if="day >= 10" :src="dyes" class="scene-item" />
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

defineProps<{
    day: number;
}>();
</script>

<style scoped>
.scene {
    width: 600px;
    height: 300px;
    position: relative;
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
    width: 80px;
    height: 80px;
    position: absolute;
    z-index: 1;
}

.scene-bubble {
    position: absolute;
    background: white;
    height: 60px;
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
    height: 60px;
    width: 60px;
    position: static;
}
</style>
