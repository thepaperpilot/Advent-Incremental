/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, trackTotal } from "features/resources/resource";
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
import { computed, ref, watchEffect } from "vue";

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
        resource: logs,
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
        resource: logs,
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
            description: "Trees give 25% more logs, and unlock more upgrades"
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
            description: "Manually cut trees twice as often"
        }
    }));
    const manualPlantUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 100,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Greener Fingers",
            description: "Manually Plant trees twice as often"
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
            description: "Trees give 25% more logs, and unlock repeatable purchases"
        }
    }));
    const row2Upgrades = [
        manualCutUpgrade2,
        manualPlantUpgrade2,
        manualCutUpgrade3,
        manualPlantUpgrade3,
        researchUpgrade2
    ];

    const autoCuttingBuyable1 = createBuyable(() => ({
        resource: logs,
        cost() {
            return Decimal.times(100, this.amount.value).add(200);
        },
        display: {
            title: "Generic Cutters",
            description: "Each cutter cuts down 1 tree/s"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    }));
    const autoPlantingBuyable1 = createBuyable(() => ({
        resource: logs,
        cost() {
            return Decimal.times(100, this.amount.value).add(200);
        },
        display: {
            title: "Generic Planters",
            description: "Each planter plants 0.5 trees/s"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    }));
    const expandingForestBuyable = createBuyable(() => ({
        resource: logs,
        cost() {
            return Decimal.pow(Decimal.add(this.amount.value, 1), 1.5).times(500);
        },
        display: {
            title: "Expand Forest",
            description: "Add 10 trees to the forest"
        },
        visibility: () => showIf(researchUpgrade2.bought.value),
        onPurchase() {
            trees.value = Decimal.add(trees.value, 10);
        }
    }));
    const row1Buyables = [autoCuttingBuyable1, autoPlantingBuyable1, expandingForestBuyable];

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `color: ${color}`,
        progress: () => Decimal.log10(totalLogs.value).div(4)
    }));

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
        })),
        createAdditiveModifier(() => ({
            addend: autoCuttingBuyable1.amount,
            description: "Generic Cutters",
            enabled: researchUpgrade2.bought
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
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(autoPlantingBuyable1.amount.value, 2),
            description: "Generic Planters",
            enabled: researchUpgrade2.bought
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
                    Cut down up to {format(computedManualCuttingAmount.value, 1)} tree
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
            if (Decimal.lt(manualCutProgress.value, computedManualCuttingCooldown.value)) {
                return;
            }
            const amount = Decimal.min(
                trees.value,
                Decimal.times(
                    computedManualCuttingAmount.value,
                    Decimal.div(
                        manualCutProgress.value,
                        computedManualCuttingCooldown.value
                    ).floor()
                )
            );
            trees.value = Decimal.sub(trees.value, amount);
            logs.value = Decimal.add(logs.value, logGain.apply(amount));
            saplings.value = Decimal.add(saplings.value, amount);
            manualCutProgress.value = 0;
        }
    }));

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
                    Plant up to {format(computedManualPlantingAmount.value, 1)} tree
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
            if (Decimal.lt(manualPlantProgress.value, computedManualPlantingCooldown.value)) {
                return;
            }
            const amount = Decimal.min(
                saplings.value,
                Decimal.times(
                    computedManualPlantingAmount.value,
                    Decimal.div(
                        manualPlantProgress.value,
                        computedManualPlantingCooldown.value
                    ).floor()
                )
            );
            trees.value = Decimal.add(trees.value, amount);
            saplings.value = Decimal.sub(saplings.value, amount);
            manualPlantProgress.value = 0;
        }
    }));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Logs per Tree",
            modifier: logGain,
            base: 1,
            visible: researchUpgrade1.bought
        },
        {
            title: "Manual Cutting Amount",
            modifier: manualCuttingAmount,
            base: 1,
            visible: manualCutUpgrade1.bought,
            unit: "/click"
        },
        {
            title: "Manual Planting Amount",
            modifier: manualPlantingAmount,
            base: 1,
            visible: manualPlantUpgrade1.bought,
            unit: "/click"
        },
        {
            title: `Auto Cutting Amount`,
            modifier: autoCuttingAmount,
            base: 0,
            visible: autoCutUpgrade1.bought,
            unit: "/s"
        },
        {
            title: `Auto Planting Amount`,
            modifier: autoPlantingAmount,
            base: 0,
            visible: autoPlantUpgrade1.bought,
            unit: "/s"
        }
        // TODO show forest size modifier?
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
        if (Decimal.lt(main.day.value, 1)) {
            return;
        }

        if (Decimal.gte(manualCutProgress.value, computedManualCuttingCooldown.value)) {
            manualCutProgress.value = computedManualCuttingCooldown.value;
        } else {
            manualCutProgress.value = Decimal.add(manualCutProgress.value, diff);
            if (cutTree.isHolding.value) {
                cutTree.onClick();
            }
        }
        if (Decimal.gte(manualPlantProgress.value, computedManualPlantingCooldown.value)) {
            manualPlantProgress.value = computedManualPlantingCooldown.value;
        } else {
            manualPlantProgress.value = Decimal.add(manualPlantProgress.value, diff);
            if (plantTree.isHolding.value) {
                plantTree.onClick();
            }
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

    watchEffect(() => {
        if (main.day.value === 1 && Decimal.gte(totalLogs.value, 1e4)) {
            main.loreTitle.value = "Day complete!";
            main.loreBody.value =
                "Santa looks at all the wood you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!";
            main.day.value = 2;
            main.minimized.value = false;
        }
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
        row1Buyables,
        manualCutProgress,
        manualPlantProgress,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === 1
                        ? `Reach ${formatWhole(1e4)} ${logs.displayName} to complete the day`
                        : `Day Complete!`}{" "}
                    -{" "}
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
                <MainDisplay
                    resource={logs}
                    color={color}
                    style="margin-bottom: 0"
                    effectDisplay={
                        Decimal.gt(computedAutoCuttingAmount.value, 0)
                            ? `+${format(computedAutoCuttingAmount.value)}/s`
                            : undefined
                    }
                />
                <MainDisplay
                    resource={saplings}
                    color="green"
                    style="margin-bottom: 0"
                    effectDisplay={
                        Decimal.neq(
                            Decimal.sub(
                                computedAutoCuttingAmount.value,
                                computedAutoPlantingAmount.value
                            ),
                            0
                        )
                            ? `+${format(
                                  Decimal.sub(
                                      computedAutoCuttingAmount.value,
                                      computedAutoPlantingAmount.value
                                  )
                              )}/s`
                            : undefined
                    }
                />
                <MainDisplay
                    resource={trees}
                    color="green"
                    style="margin-bottom: 0"
                    effectDisplay={
                        Decimal.gt(computedAutoPlantingAmount.value, 0)
                            ? `+${format(computedAutoPlantingAmount.value)}/s`
                            : undefined
                    }
                />
                <Spacer />
                {renderRow(cutTree, plantTree)}
                <div>Tip: You can hold down on actions to perform them automatically</div>
                <Spacer />
                {renderRow(...row1Upgrades)}
                {renderRow(...row2Upgrades)}
                {renderRow(...row1Buyables)}
            </>
        ))
    };
});

export default layer;
