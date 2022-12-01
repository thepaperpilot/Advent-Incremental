/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, trackTotal } from "features/resources/resource";
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
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { joinJSX, render, renderRow } from "util/vue";
import { computed, watchEffect } from "vue";

const id = "trees";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Trees";
    const color = "#4BDC13";

    const logs = createResource<DecimalSource>(0, "logs");
    const totalLogs = trackTotal(logs);
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

    const manualCutUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 100,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Sharper Fingers",
            description: "Cut trees twice as fast"
        }
    }));
    const manualPlantUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 100,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Greener Fingers",
            description: "Plant trees twice as fast"
        }
    }));
    const manualCutUpgrade3 = createUpgrade(() => ({
        resource: logs,
        cost: 300,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Knives",
            description:
                "Each time you manually chop trees, gain 1s of automatic tree chopping production"
        }
    }));
    const manualPlantUpgrade3 = createUpgrade(() => ({
        resource: logs,
        cost: 300,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Spades",
            description:
                "Each time you manually plant trees, gain 1s of automatic tree planting production"
        }
    }));
    const researchUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 1000,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Research II",
            description: "Get 25% more logs from each tree cut down and unlock repeatable purchases"
        }
    }));
    const row2Upgrades = [
        manualCutUpgrade2,
        manualPlantUpgrade2,
        manualCutUpgrade3,
        manualPlantUpgrade3,
        researchUpgrade2
    ];

    const manualCuttingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Wooden Fingers",
            enabled: manualCutUpgrade1.bought
        })),
        createAdditiveModifier(() => ({
            addend: computedAutoCuttingAmount,
            description: "Smart Knives",
            enabled: manualCutUpgrade3.bought
        }))
    ]);
    const computedManualCuttingAmount = computed(() => manualCuttingAmount.apply(1));
    const manualCuttingCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 0.5,
            description: "Sharper Fingers",
            enabled: manualCutUpgrade2.bought
        }))
    ]);
    const computedManualCuttingCooldown = computed(() => manualCuttingCooldown.apply(1));

    const autoCuttingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Automated Knives",
            enabled: autoCutUpgrade1.bought
        }))
    ]);
    const computedAutoCuttingAmount = computed(() => autoCuttingAmount.apply(0));

    const manualPlantingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Leafy Fingers",
            enabled: manualPlantUpgrade1.bought
        })),
        createAdditiveModifier(() => ({
            addend: computedAutoPlantingAmount,
            description: "Smart Spades",
            enabled: manualPlantUpgrade3.bought
        }))
    ]);
    const computedManualPlantingAmount = computed(() => manualPlantingAmount.apply(1));
    const manualPlantingCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 0.5,
            description: "Greener Fingers",
            enabled: manualPlantUpgrade2.bought
        }))
    ]);
    const computedManualPlantingCooldown = computed(() => manualPlantingCooldown.apply(1));

    const autoPlantingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Automated Spade",
            enabled: autoPlantUpgrade1.bought
        }))
    ]);
    const computedAutoPlantingAmount = computed(() => autoPlantingAmount.apply(0));

    const logGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 1.25,
            description: "Research I",
            enabled: researchUpgrade1.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.25,
            description: "Research II",
            enabled: researchUpgrade2.bought
        }))
    ]);

    const manualCutProgress = persistent<DecimalSource>(0);
    const manualCutProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        baseStyle: "margin-top: 0",
        fillStyle: "margin-top: 0; transition-duration: 0s",
        progress: () => Decimal.div(manualCutProgress.value, computedManualCuttingCooldown.value)
    }));
    const cutTree = createClickable(() => ({
        display: {
            title: "Cut trees",
            description: jsx(() => (
                <>
                    Cut down up to {formatWhole(computedManualCuttingAmount.value)} tree
                    {Decimal.eq(computedManualCuttingAmount.value, 1) ? "" : "s"} at once!
                    <br />
                    {render(manualCutProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () =>
            Decimal.gt(trees.value, 0) &&
            Decimal.gte(manualCutProgress.value, computedManualCuttingCooldown.value),
        onClick() {
            const amount = Decimal.min(trees.value, computedManualCuttingAmount.value);
            trees.value = Decimal.sub(trees.value, amount);
            logs.value = Decimal.add(logs.value, logGain.apply(amount));
            saplings.value = Decimal.add(saplings.value, amount);
            manualCutProgress.value = 0;
        }
    }));
    addTooltip(cutTree, {
        display: jsx(() =>
            joinJSX(
                [
                    createModifierSection("Trees", "", manualCuttingAmount, 1, "/click"),
                    createModifierSection("Cooldown", "", manualCuttingCooldown, 1, "s")
                ],
                <br />
            )
        ),
        direction: Direction.Down,
        style: "width: 400px; text-align: left"
    });

    const manualPlantProgress = persistent<DecimalSource>(0);
    const manualPlantProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        baseStyle: "margin-top: 0",
        fillStyle: "margin-top: 0; transition-duration: 0s",
        progress: () => Decimal.div(manualPlantProgress.value, computedManualPlantingCooldown.value)
    }));
    const plantTree = createClickable(() => ({
        display: {
            title: "Plant trees",
            description: jsx(() => (
                <>
                    Plant up to {formatWhole(computedManualPlantingAmount.value)} tree
                    {Decimal.eq(computedManualPlantingAmount.value, 1) ? "" : "s"} at once!
                    <br />
                    {render(manualPlantProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () =>
            Decimal.gt(saplings.value, 0) &&
            Decimal.gte(manualPlantProgress.value, computedManualPlantingCooldown.value),
        onClick() {
            const amount = Decimal.min(saplings.value, computedManualPlantingAmount.value);
            trees.value = Decimal.add(trees.value, amount);
            saplings.value = Decimal.sub(saplings.value, amount);
            manualPlantProgress.value = 0;
        }
    }));
    addTooltip(plantTree, {
        display: jsx(() =>
            joinJSX(
                [
                    createModifierSection("Trees", "", manualPlantingAmount, 1, "/click"),
                    createModifierSection("Cooldown", "", manualPlantingCooldown, 1, "s")
                ],
                <br />
            )
        ),
        direction: Direction.Down,
        style: "width: 400px; text-align: left"
    });

    watchEffect(() => {
        if (main.day.value === 1 && Decimal.gte(totalLogs.value, 1e6)) {
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

        if (Decimal.gte(manualCutProgress.value, computedManualCuttingCooldown.value)) {
            manualCutProgress.value = computedManualCuttingCooldown.value;
        } else {
            manualCutProgress.value = Decimal.add(manualCutProgress.value, diff);
        }
        if (Decimal.gte(manualPlantProgress.value, computedManualPlantingCooldown.value)) {
            manualPlantProgress.value = computedManualPlantingCooldown.value;
        } else {
            manualPlantProgress.value = Decimal.add(manualPlantProgress.value, diff);
        }

        const amountCut = Decimal.min(
            trees.value,
            Decimal.times(computedAutoCuttingAmount.value, diff)
        );
        trees.value = Decimal.sub(trees.value, amountCut);
        logs.value = Decimal.add(logs.value, logGain.apply(amountCut));
        saplings.value = Decimal.add(saplings.value, amountCut);

        const amountPlanted = Decimal.min(
            saplings.value,
            Decimal.times(computedAutoPlantingAmount.value, diff)
        );
        trees.value = Decimal.add(trees.value, amountPlanted);
        saplings.value = Decimal.sub(saplings.value, amountPlanted);
    });

    return {
        name,
        color,
        logs,
        totalLogs,
        trees,
        saplings,
        cutTree,
        plantTree,
        row1Upgrades,
        row2Upgrades,
        manualCutProgress,
        manualPlantProgress,
        minWidth: 700,
        display: jsx(() => (
            <>
                <Tooltip
                    display={jsx(() => createModifierSection("Log Gain", "", logGain))}
                    direction={Direction.Down}
                    style="width: 400px; text-align: left"
                >
                    <MainDisplay resource={logs} color={color} style="margin-bottom: 0" />
                </Tooltip>
                <MainDisplay resource={saplings} color="green" style="margin-bottom: 0" />
                <MainDisplay resource={trees} color="green" style="margin-bottom: 0" />
                <br />
                {Decimal.gt(computedAutoCuttingAmount.value, 0) ? (
                    <>
                        <Tooltip
                            display={jsx(() =>
                                createModifierSection("Trees", "", autoCuttingAmount, 0, "/s")
                            )}
                            direction={Direction.Down}
                            style="width: 400px; text-align: left"
                        >
                            You cut down {format(computedAutoCuttingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                {Decimal.gt(computedAutoPlantingAmount.value, 0) ? (
                    <>
                        <Tooltip
                            display={jsx(() =>
                                createModifierSection("Trees", "", autoPlantingAmount, 0, "/s")
                            )}
                            direction={Direction.Down}
                            style="width: 400px; text-align: left"
                        >
                            You plant {format(computedAutoPlantingAmount.value)} trees/s
                        </Tooltip>
                        <br />
                    </>
                ) : null}
                <Spacer />
                {renderRow(cutTree, plantTree)}
                <div>Tip: You can hold down on actions to perform them automatically</div>
                <Spacer />
                {renderRow(...row1Upgrades)}
                {renderRow(...row2Upgrades)}
            </>
        ))
    };
});

export default layer;
