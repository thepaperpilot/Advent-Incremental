/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatGain, formatLimit, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ref } from "vue";
import boxes from "./boxes";
import cloth from "./cloth";
import coal from "./coal";
import dyes from "./dyes";
import elves, { ElfBuyable } from "./elves";
import management from "./management";
import paper from "./paper";
import workshop from "./workshop";
import wrappingPaper from "./wrapping-paper";
const id = "toys";
const day = 17;

const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Toys";
    const colorBright = "#4BDC13";
    const colorDark = "green";

    const clothes = createResource<DecimalSource>(0, "clothes");
    const woodenBlocks = createResource<DecimalSource>(0, " wooden blocks");
    const trucks = createResource<DecimalSource>(0, "trucks");
    const toyGain = createSequentialModifier(() => [

    ]);
    const toySum = createResource(computed(() => Decimal.add(clothes.value, woodenBlocks.value).add(trucks.value)), "toy sum")
    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
                {
            title: `Toy Gain`,
            modifier: toyGain,
            base: 1,
            visible: true
        }
    ]);
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


    const { total: totalToys, trackerDisplay } = setUpDailyProgressTracker({
        resource: toySum,
        goal: 8e9,
        name,
        day,
        color: colorDark,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        day,
        color: colorBright,
        clothes,
        woodenBlocks,
        totalToys,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay
                    resource={clothes}
                    color={colorBright}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={woodenBlocks}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={trucks}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(toySum.value)} {"total toys"}
            </div>
        ))
    };
});

export default layer;
