/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { jsx } from "features/feature";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import Decimal from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { ref, watchEffect } from "vue";

const id = "workshop";
const day = 2;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Workshop";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () => 0
    }));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => []);
    const showModifiersModal = ref(false);
    const modifiersModal = jsx(() => (
        <Modal
            modelValue={showModifiersModal.value}
            onUpdate:modelValue={(value: boolean) => (showModifiersModal.value = value)}
            v-slots={{
                header: () => <h2>{name} Modifiers</h2>,
                body: generalTab
            }}
        />
    ));

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }
    });

    watchEffect(() => {
        if (main.day.value === day && false) {
            main.loreTitle.value = "Day complete!";
            main.loreBody.value = "";
            main.day.value = day + 1;
            main.minimized.value = false;
        }
    });

    return {
        name,
        day,
        color,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day ? `Reach ??? to complete the day` : `Day Complete!`} -{" "}
                    <button
                        class="button"
                        style="display: inline-block;"
                        onClick={() => (showModifiersModal.value = true)}
                    >
                        Check Modifiers
                    </button>
                </div>
                {render(dayProgress)}
                {render(modifiersModal)}
                <Spacer />
            </>
        ))
    };
});

export default layer;
