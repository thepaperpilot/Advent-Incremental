/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { main } from "data/projEntry";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { addTooltip } from "features/tooltips/tooltip";
import Tooltip from "features/tooltips/Tooltip.vue";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createModifierSection,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { renderRow } from "util/vue";
import { computed, watchEffect } from "vue";

const id = "trees";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Trees";
    const color = "#4BDC13";

    const logs = createResource<DecimalSource>(0, "logs");
    const trees = createResource<DecimalSource>(10, "trees");
    const saplings = createResource<DecimalSource>(0, "saplings");

    const manualCutUpgrade1 = createUpgrade(() => ({
        resource: logs,
        cost: 10,
        display: {
            title: "Wooden Fingers",
            description: "Cut down an additional tree per click"
        }
    }));
    const manualPlantUpgrade1 = createUpgrade(() => ({
        resource: saplings,
        cost: 10,
        display: {
            title: "Leafy Fingers",
            description: "Plant an additional tree per click"
        }
    }));
    const autoCutUpgrade1 = createUpgrade(() => ({
        resource: logs,
        cost: 25,
        display: {
            title: "Automated Knives",
            description: "Cut down a tree every second"
        }
    }));
    const autoPlantUpgrade1 = createUpgrade(() => ({
        resource: saplings,
        cost: 25,
        display: {
            title: "Automated Spade",
            description: "Plant a tree every second"
        }
    }));
    const researchUpgrade1 = createUpgrade(() => ({
        resource: logs,
        cost: 100,
        display: {
            title: "Research I",
            description: "Get 25% more logs from each tree cut down and unlock more upgrades"
        }
    }));
    const row1Upgrades = [
        manualCutUpgrade1,
        manualPlantUpgrade1,
        autoCutUpgrade1,
        autoPlantUpgrade1,
        researchUpgrade1
    ];

    const manualCuttingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Wooden Fingers",
            enabled: manualCutUpgrade1.bought
        }))
    ]);
    const manualComputedCuttingAmount = computed(() => manualCuttingAmount.apply(1));

    const autoCuttingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Automated Knives",
            enabled: autoCutUpgrade1.bought
        }))
    ]);
    const autoComputedCuttingAmount = computed(() => autoCuttingAmount.apply(0));

    const manualPlantingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Leafy Fingers",
            enabled: manualPlantUpgrade1.bought
        }))
    ]);
    const manualComputedPlantingAmount = computed(() => manualPlantingAmount.apply(1));

    const autoPlantingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Automated Spade",
            enabled: autoPlantUpgrade1.bought
        }))
    ]);
    const autoComputedPlantingAmount = computed(() => autoPlantingAmount.apply(0));

    const logGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 1.25,
            description: "Research I",
            enabled: researchUpgrade1.bought
        }))
    ]);

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
            const amount = Decimal.min(trees.value, manualComputedCuttingAmount.value);
            trees.value = Decimal.sub(trees.value, amount);
            logs.value = Decimal.add(logs.value, logGain.apply(amount));
            saplings.value = Decimal.add(saplings.value, amount);
        }
    }));
    addTooltip(cutTree, {
        display: jsx(() => createModifierSection("Modifiers", "", manualCuttingAmount, 1)),
        direction: Direction.Down,
        style: "width: 400px; text-align: left"
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
            const amount = Decimal.min(saplings.value, manualComputedPlantingAmount.value);
            trees.value = Decimal.add(trees.value, amount);
            saplings.value = Decimal.sub(saplings.value, amount);
        }
    }));
    addTooltip(plantTree, {
        display: jsx(() => createModifierSection("Modifiers", "", manualPlantingAmount, 1)),
        direction: Direction.Down,
        style: "width: 400px; text-align: left"
    });

    watchEffect(() => {
        if (main.day.value === 1 && false) {
            main.loreTitle.value = "Day complete!";
            main.loreBody.value =
                "Santa looks at all the wood you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!";
            main.day.value = 2;
        }
    });

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, 1)) {
            return;
        }

        const amountCut = Decimal.min(
            trees.value,
            Decimal.times(autoComputedCuttingAmount.value, diff)
        );
        trees.value = Decimal.sub(trees.value, amountCut);
        logs.value = Decimal.add(logs.value, logGain.apply(amountCut));
        saplings.value = Decimal.add(saplings.value, amountCut);

        const amountPlanted = Decimal.min(
            saplings.value,
            Decimal.times(autoComputedPlantingAmount.value, diff)
        );
        trees.value = Decimal.add(trees.value, amountPlanted);
        saplings.value = Decimal.sub(saplings.value, amountPlanted);
    });

    return {
        name,
        color,
        logs,
        trees,
        saplings,
        cutTree,
        plantTree,
        row1Upgrades,
        minWidth: 700,
        display: jsx(() => (
            <>
                <MainDisplay resource={logs} color={color} style="margin-bottom: 0" />
                <MainDisplay resource={saplings} color="green" style="margin-bottom: 0" />
                <MainDisplay resource={trees} color="green" style="margin-bottom: 0" />
                <br />
                {Decimal.gt(autoComputedCuttingAmount.value, 0) ? (
                    <>
                        <Tooltip
                            display={jsx(() =>
                                createModifierSection("Modifiers", "", autoCuttingAmount)
                            )}
                            direction={Direction.Down}
                            style="width: 400px; text-align: left"
                        >
                            You cut down {format(autoComputedCuttingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                {Decimal.gt(autoComputedPlantingAmount.value, 0) ? (
                    <>
                        <Tooltip
                            display={jsx(() =>
                                createModifierSection("Modifiers", "", autoPlantingAmount)
                            )}
                            direction={Direction.Down}
                            style="width: 400px; text-align: left"
                        >
                            You plant {format(autoComputedPlantingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                <Spacer />
                {renderRow(cutTree, plantTree)}
                <Spacer />
                {renderRow(...row1Upgrades)}
            </>
        ))
    };
});

export default layer;
