<!-- Make eslint not whine about putting spaces before the +'s -->
<!-- eslint-disable prettier/prettier -->
<template>
    <template v-if="isCtrl"
        ><div class="key">Ctrl</div
        >+</template
    ><template v-if="isShift"
        ><div class="key">Shift</div
        >+</template
    >
    <div class="key">{{ key }}</div>
</template>

<script setup lang="ts">
import { GenericHotkey } from "features/hotkey";
import { reactive } from "vue";

const props = defineProps<{
    hotkey: GenericHotkey;
}>();

let key = reactive(props.hotkey).key;

let isCtrl = key.startsWith("ctrl+");
if (isCtrl) key = key.slice(5);

let isShift = key.startsWith("shift+");
if (isShift) key = key.slice(6);

let isAlpha = key.length == 1 && key.toLowerCase() != key.toUpperCase();
if (isAlpha) key = key.toUpperCase();
</script>

<style scoped>
.key {
    display: inline-block;
    height: 1.4em;
    min-width: 1em;
    margin: 0.1em;
    padding-inline: 0.2em;

    background: var(--foreground);
    color: var(--feature-foreground);
    border: 1px solid #0007;
    border-radius: 0.3em;

    font-size: smaller;
    text-align: center;
}
</style>
