/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { jsx } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource, format } from "util/bignum";
import { render } from "util/vue";
import { ref } from "vue";

const id = "reindeer";
const day = 21;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Reindeer";
    const color = "brown";

    const food = createResource<DecimalSource>(0, "reindeer food");

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

    const { total: totalFood, trackerDisplay } = setUpDailyProgressTracker({
        resource: food,
        goal: 1e3,
        name,
        day,
        background: color,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        day,
        color,
        food,
        totalFood,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay resource={food} />
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {format(food.value)} {food.displayName}
                </span>
            </div>
        ))
    };
});

export default layer;
