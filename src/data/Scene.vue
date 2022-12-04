<template>
    <div class="scene">
        <img v-if="day >= 0" :src="tree" class="scene-item" style="left: 10%; bottom: 10%" />
        <img v-if="day >= 1" :src="workshop" class="scene-item" style="left: 40%; bottom: 12%" />
        <img
            v-if="day >= 2"
            :src="coal"
            class="scene-item"
            style="left: 65%; bottom: 12%; width: 40px; height: 40px"
        />
        <img v-if="day >= 3" :src="elves" class="scene-item" style="left: 52%; bottom: 12%" />
    </div>
</template>

<script setup lang="ts">
import tree from "./symbols/tree.png";
import workshop from "./symbols/sws.png";
import coal from "./symbols/coal.png";
import elves from "./symbols/elf.png";

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
</style>
