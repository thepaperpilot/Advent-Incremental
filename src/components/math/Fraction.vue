<template>
    <div class="fraction">
        <slot />
    </div>
</template>

<style>
.fraction {
    display: inline-block;
    text-align: center;
    font-size: smaller;
    vertical-align: -0.6em;
}

.fraction > * {
    display: block;
}

.fraction > :last-child {
    border-top: 1px solid;
}
</style>
