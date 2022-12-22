<template>
    <div class="toy">
        <img :src="image" />
        <ResourceVue :resource="resource" :color="color" style="font-size: large" />
    </div>
</template>
<script setup lang="ts">
import { Resource } from "features/resources/resource";
import ResourceVue from "features/resources/Resource.vue";

defineProps<{
    resource: Resource;
    image: string;
    color: string;
}>();
</script>
<style scoped>
.toy {
    width: 80px;
    display: flex;
    flex-direction: column;
    margin: 10px !important;
}

.toy img {
    width: 100%;
    aspect-ratio: 1/1;
}
</style>
