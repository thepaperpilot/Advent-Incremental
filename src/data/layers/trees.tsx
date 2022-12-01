/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import Resource from "features/resources/Resource.vue";
import { addTooltip } from "features/tooltips/tooltip";
import Tooltip from "features/tooltips/Tooltip.vue";
import { BaseLayer, createLayer } from "game/layers";
import { createModifierSection, createSequentialModifier } from "game/modifiers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { renderRow } from "util/vue";
import { computed } from "vue";

const id = "trees";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Trees";
    const color = "#4BDC13";

    const logs = createResource<DecimalSource>(0, "logs");
    const trees = createResource<DecimalSource>(1e6, "trees");
    const saplings = createResource<DecimalSource>(0, "saplings");

    const manualCuttingAmount = createSequentialModifier(() => []);
    const manualComputedCuttingAmount = computed(() => manualCuttingAmount.apply(1));
    const manualCuttingAmountDisplay = createModifierSection("Modifiers", "", manualCuttingAmount);

    const autoCuttingAmount = createSequentialModifier(() => []);
    const autoComputedCuttingAmount = computed(() => autoCuttingAmount.apply(0));
    const autoCuttingAmountDisplay = createModifierSection("Modifiers", "", autoCuttingAmount);

    const manualPlantingAmount = createSequentialModifier(() => []);
    const manualComputedPlantingAmount = computed(() => manualPlantingAmount.apply(1));
    const manualPlantingAmountDisplay = createModifierSection(
        "Modifiers",
        "",
        manualPlantingAmount
    );

    const autoPlantingAmount = createSequentialModifier(() => []);
    const autoComputedPlantingAmount = computed(() => autoPlantingAmount.apply(0));
    const autoPlantingAmountDisplay = createModifierSection("Modifiers", "", autoPlantingAmount);

    const cutTree = createClickable(() => ({
        display: {
            title: "Cut trees",
            description: jsx(() => (
                <>
                    Cut down up to {formatWhole(manualComputedCuttingAmount.value)} tree
                    {Decimal.eq(manualComputedCuttingAmount.value, 1) ? "" : "s"} at once!
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () => Decimal.gt(trees.value, 0),
        onClick() {
            trees.value = Decimal.sub(trees.value, 1);
            logs.value = Decimal.add(logs.value, 1);
            saplings.value = Decimal.add(saplings.value, 1);
        }
    }));
    addTooltip(cutTree, {
        display: jsx(() => manualCuttingAmountDisplay)
    });

    const plantTree = createClickable(() => ({
        display: {
            title: "Plant trees",
            description: jsx(() => (
                <>
                    Plant up to {formatWhole(manualComputedPlantingAmount.value)} tree
                    {Decimal.eq(manualComputedPlantingAmount.value, 1) ? "" : "s"} at once!
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () => Decimal.gt(saplings.value, 0),
        onClick() {
            trees.value = Decimal.add(trees.value, 1);
            saplings.value = Decimal.sub(saplings.value, 1);
        }
    }));
    addTooltip(cutTree, {
        display: jsx(() => manualPlantingAmountDisplay)
    });

    return {
        name,
        color,
        logs,
        trees,
        saplings,
        cutTree,
        plantTree,
        display: jsx(() => (
            <>
                <MainDisplay resource={logs} color={color} style="margin-bottom: 0" />
                <MainDisplay resource={saplings} color="green" style="margin-bottom: 0" />
                <MainDisplay resource={trees} color="green" style="margin-bottom: 0" />
                <br />
                {Decimal.gt(autoComputedCuttingAmount.value, 0) ? (
                    <>
                        <Tooltip display={jsx(() => autoCuttingAmountDisplay)}>
                            You cut down {format(autoComputedCuttingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                {Decimal.gt(autoComputedPlantingAmount.value, 0) ? (
                    <>
                        <Tooltip display={jsx(() => autoPlantingAmountDisplay)}>
                            You plant {format(autoComputedPlantingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                <Spacer />
                {renderRow(cutTree, plantTree)}
            </>
        ))
    };
});

export default layer;
