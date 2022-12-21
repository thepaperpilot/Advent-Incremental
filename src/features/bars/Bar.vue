<template>
    <div
        v-if="unref(visibility) !== Visibility.None"
        :style="[
            {
                width: unref(width) + 'px',
                height: unref(height) + 'px',
                visibility: unref(visibility) === Visibility.Hidden ? 'hidden' : undefined
            },
            unref(style) ?? {}
        ]"
        :class="{
            bar: true,
            ...unref(classes)
        }"
    >
        <div
            class="border"
            :style="[
                { width: unref(width) + 'px', height: unref(height) + 'px' },
                unref(style) ?? {},
                unref(baseStyle) ?? {},
                unref(borderStyle) ?? {}
            ]"
        >
            <div class="fill" :style="[barStyle, unref(style) ?? {}, unref(fillStyle) ?? {}]" />
        </div>
        <div
            class="overlayTextContainer border"
            :style="[
                { width: unref(width) - 1 + 'px', height: unref(height) - 1 + 'px' },
                unref(borderStyle) ?? {}
            ]"
        >
            <span v-if="component" class="overlayText" :style="unref(textStyle)">
                <component :is="component" />
            </span>
        </div>
        <MarkNode :mark="unref(mark)" />
        <Node :id="id" />
    </div>
</template>

<script lang="ts">
import MarkNode from "components/MarkNode.vue";
import Node from "components/Node.vue";
import { CoercableComponent, Visibility } from "features/feature";
import type { DecimalSource } from "util/bignum";
import Decimal from "util/bignum";
import { Direction } from "util/common";
import { computeOptionalComponent, processedPropType, unwrapRef } from "util/vue";
import type { CSSProperties, StyleValue } from "vue";
import { computed, defineComponent, toRefs, unref } from "vue";

export default defineComponent({
    props: {
        progress: {
            type: processedPropType<DecimalSource>(String, Object, Number),
            required: true
        },
        width: {
            type: processedPropType<number>(Number),
            required: true
        },
        height: {
            type: processedPropType<number>(Number),
            required: true
        },
        direction: {
            type: processedPropType<Direction>(String),
            required: true
        },
        display: processedPropType<CoercableComponent>(Object, String, Function),
        visibility: {
            type: processedPropType<Visibility>(Number),
            required: true
        },
        style: processedPropType<StyleValue>(Object, String, Array),
        classes: processedPropType<Record<string, boolean>>(Object),
        borderStyle: processedPropType<StyleValue>(Object, String, Array),
        textStyle: processedPropType<StyleValue>(Object, String, Array),
        baseStyle: processedPropType<StyleValue>(Object, String, Array),
        fillStyle: processedPropType<StyleValue>(Object, String, Array),
        mark: processedPropType<boolean | string>(Boolean, String),
        id: {
            type: String,
            required: true
        }
    },
    components: {
        MarkNode,
        Node
    },
    setup(props) {
        const { progress, width, height, direction, display } = toRefs(props);

        const normalizedProgress = computed(() => {
            let progressNumber =
                progress.value instanceof Decimal
                    ? progress.value.toNumber()
                    : Number(progress.value);
            return (1 - Math.min(Math.max(progressNumber, 0), 1)) * 100;
        });

        const barStyle = computed(() => {
            const barStyle: Partial<CSSProperties> = {
                width: unwrapRef(width) + 0.5 + "px",
                height: unwrapRef(height) + 0.5 + "px"
            };
            switch (unref(direction)) {
                case Direction.Up:
                    barStyle.clipPath = `inset(${normalizedProgress.value}% -1px -1px -1px)`;
                    barStyle.width = unwrapRef(width) + 1 + "px";
                    break;
                case Direction.Down:
                    barStyle.clipPath = `inset(-1px -1px ${normalizedProgress.value}% -1px)`;
                    barStyle.width = unwrapRef(width) + 1 + "px";
                    break;
                case Direction.Right:
                    barStyle.clipPath = `inset(-1px ${normalizedProgress.value}% -1px -1px)`;
                    break;
                case Direction.Left:
                    barStyle.clipPath = `inset(-1px -1px -1px ${normalizedProgress.value} + '%)`;
                    break;
                case Direction.Default:
                    barStyle.clipPath = "inset(-1px 50% -1px -1px)";
                    break;
            }
            return barStyle;
        });

        const component = computeOptionalComponent(display);

        return {
            normalizedProgress,
            barStyle,
            component,
            unref,
            Visibility
        };
    }
});
</script>

<style scoped>
.bar {
    position: relative;
    display: table;
    overflow: hidden;
    border-radius: 10px;
    padding-bottom: 1px;
}

.overlayTextContainer {
    position: absolute;
    top: 0;
    border-radius: 10px;
    vertical-align: middle;
    display: flex;
    justify-content: center;
    z-index: 3;
}

.overlayText {
    z-index: 6;
}

.border {
    border: 2px solid;
    border-radius: 10px;
    border-color: var(--foreground);
    overflow: hidden;
}

.border:not(.overlayTextContainer) {
    margin: -1px 0 -1px -1px;
}

.fill {
    position: absolute;
    background-color: var(--foreground);
    overflow: hidden;
    padding: 2px 1px;
    margin-left: -0.5px;
    transition-duration: 0.2s;
    z-index: 2;
}
</style>
