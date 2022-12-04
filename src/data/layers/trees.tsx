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
import { createHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, trackTotal } from "features/resources/resource";
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
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ref, watchEffect } from "vue";
import coal from "./coal";
import elves from "./elves";
import workshop from "./workshop";

const id = "trees";
const day = 1;

// how much to prioritize this' income
// vs the previous ones
const SMOOTHING_FACTOR = 0.5;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Trees";
    const colorBright = "#4BDC13";
    const colorDark = "green";

    const logs = createResource<DecimalSource>(0, "logs");
    const totalLogs = trackTotal(logs);
    // Think of saplings as spent trees
    const saplings = createResource<DecimalSource>(0, "saplings");

    const totalLogGoal = 1e4;
    const ema = ref<DecimalSource>(0);

    const totalTrees = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(expandingForestBuyable.amount.value, 10),
            description: "Expand Forest",
            enabled: researchUpgrade2.bought
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(workshop.foundationProgress.value, 2),
            description: "75% Foundation Completed",
            enabled: workshop.milestones.morePlantsMilestone1.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "5 Elves Trained",
            enabled: elves.milestones[4].earned
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
    const trees = createResource(
        computed(() => Decimal.sub(totalTrees.apply(10), saplings.value)),
        "trees"
    );

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
        cost: 40,
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
        cost: 50,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Sharper Fingers",
            description: "Manually cut trees twice as often"
        }
    }));
    const manualPlantUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 50,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Greener Fingers",
            description: "Manually Plant trees twice as often"
        }
    }));
    const manualCutUpgrade3 = createUpgrade(() => ({
        resource: logs,
        cost: 150,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Knives",
            description:
                "Each time you manually chop trees, gain 1s of automatic tree chopping production"
        }
    }));
    const manualPlantUpgrade3 = createUpgrade(() => ({
        resource: logs,
        cost: 150,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Spades",
            description:
                "Each time you manually plant trees, gain 1s of automatic tree planting production"
        }
    }));
    const researchUpgrade2 = createUpgrade(() => ({
        resource: logs,
        cost: 300,
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
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            return Decimal.times(100, v).add(200);
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
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            return Decimal.times(100, v).add(200);
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
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            if (Decimal.gte(v, 1e5)) v = Decimal.pow(v, 2).div(1e5);
            return Decimal.pow(Decimal.add(v, 1), 1.5).times(500);
        },
        display: {
            title: "Expand Forest",
            description: "Add 10 trees to the forest"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    }));
    const row1Buyables = [autoCuttingBuyable1, autoPlantingBuyable1, expandingForestBuyable];

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () =>
            main.day.value === day
                ? Decimal.log10(totalLogs.value).div(Math.log10(totalLogGoal))
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(totalLogs.value)}/{formatWhole(totalLogGoal)}
                </>
            ) : (
                ""
            )
        )
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.5, elves.totalElves.value),
            description: "1 Elf Trained",
            enabled: elves.milestones[0].earned
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
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(workshop.foundationProgress.value, 5).floor(),
            description: "10% Foundation Completed",
            enabled: workshop.milestones.autoCutMilestone1.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "30% Foundation Completed",
            enabled: workshop.milestones.autoCutMilestone2.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Warmer Cutters",
            enabled: coal.warmerCutters.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: coal.computedHeatedCutterEffect,
            description: "Heated Cutters",
            enabled: () => Decimal.gt(coal.heatedCutters.amount.value, 0)
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.5, elves.totalElves.value),
            description: "1 Elf Trained",
            enabled: elves.milestones[0].earned
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
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(workshop.foundationProgress.value, 10).floor(),
            description: "20% Foundation Completed",
            enabled: workshop.milestones.autoPlantMilestone1.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "40% Foundation Completed",
            enabled: workshop.milestones.autoPlantMilestone2.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Warmer Planters",
            enabled: coal.warmerPlanters.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: coal.computedHeatedPlanterEffect,
            description: "Heated Planters",
            enabled: () => Decimal.gt(coal.heatedPlanters.amount.value, 0)
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(workshop.foundationProgress.value, 20).add(1),
            description: "1% Foundation Completed",
            enabled: workshop.milestones.logGainMilestone1.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "50% Foundation Completed",
            enabled: workshop.milestones.logGainMilestone2.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.25,
            description: "Ashy Soil",
            enabled: coal.basicFertilizer.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: coal.computedFertilizerEffect,
            description: "Fertilized Soil",
            enabled: () => Decimal.gt(coal.moreFertilizer.amount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "4 Elves Trained",
            enabled: elves.milestones[3].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "100% Foundation Completed",
            enabled: workshop.milestones.logGainMilestone3.earned
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
                    Cut down up to {formatWhole(Decimal.floor(computedManualCuttingAmount.value))}{" "}
                    tree
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
            Decimal.gte(trees.value, 1) &&
            Decimal.gte(manualCutProgress.value, computedManualCuttingCooldown.value),
        onClick() {
            if (Decimal.lt(manualCutProgress.value, computedManualCuttingCooldown.value)) {
                return;
            }
            const amount = Decimal.floor(
                Decimal.min(
                    trees.value,
                    Decimal.times(
                        computedManualCuttingAmount.value,
                        Decimal.div(
                            manualCutProgress.value,
                            computedManualCuttingCooldown.value
                        ).floor()
                    )
                )
            );
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
                    Plant up to {formatWhole(Decimal.floor(computedManualPlantingAmount.value))}{" "}
                    tree
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
            Decimal.gte(saplings.value, 1) &&
            Decimal.gte(manualPlantProgress.value, computedManualPlantingCooldown.value),
        onClick() {
            if (Decimal.lt(manualPlantProgress.value, computedManualPlantingCooldown.value)) {
                return;
            }
            const amount = Decimal.floor(
                Decimal.min(
                    saplings.value,
                    Decimal.times(
                        computedManualPlantingAmount.value,
                        Decimal.div(
                            manualPlantProgress.value,
                            computedManualPlantingCooldown.value
                        ).floor()
                    )
                )
            );
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
            title: "Manual Cutting Cooldown",
            modifier: manualCuttingCooldown,
            base: 1,
            visible: manualCutUpgrade1.bought,
            unit: "s"
        },
        {
            title: "Manual Planting Amount",
            modifier: manualPlantingAmount,
            base: 1,
            visible: manualPlantUpgrade1.bought,
            unit: "/click"
        },
        {
            title: "Manual Planting Cooldown",
            modifier: manualPlantingCooldown,
            base: 1,
            visible: manualPlantUpgrade1.bought,
            unit: "s"
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
        },
        {
            title: `Forest Size`,
            modifier: totalTrees,
            base: 10,
            visible: researchUpgrade2.bought
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
        const logsGained = logGain.apply(amountCut);

        const effectiveLogsGained = Decimal.div(logsGained, diff);
        ema.value = Decimal.mul(effectiveLogsGained, SMOOTHING_FACTOR).add(
            Decimal.mul(ema.value, Decimal.dOne.sub(SMOOTHING_FACTOR))
        );

        logs.value = Decimal.add(logs.value, logsGained);
        saplings.value = Decimal.add(saplings.value, amountCut);

        const amountPlanted = Decimal.min(
            saplings.value,
            Decimal.times(computedAutoPlantingAmount.value, diff)
        );
        saplings.value = Decimal.sub(saplings.value, amountPlanted);
    });

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(totalLogs.value, totalLogGoal)) {
            main.completeDay();
        }
    });

    const netSaplingGain = computed(() =>
        Decimal.sub(computedAutoCuttingAmount.value, computedAutoPlantingAmount.value)
    );
    const netTreeGain = computed(() =>
        Decimal.sub(computedAutoPlantingAmount.value, computedAutoCuttingAmount.value)
    );

    const cutTreeHK = createHotkey(() => ({
        key: "c",
        description: 'Press the "Cut trees" button.',
        onPress: () => {
            if (cutTree.canClick.value) cutTree.onClick();
        }
    }));
    const plantTreeHK = createHotkey(() => ({
        key: "p",
        description: 'Press the "Plant trees" button.',
        onPress: () => {
            if (plantTree.canClick.value) plantTree.onClick();
        }
    }));

    return {
        name,
        color: colorBright,
        logs,
        totalLogs,
        trees,
        saplings,
        cutTree,
        plantTree,
        cutTreeHK,
        plantTreeHK,
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
                    {main.day.value === day
                        ? `Reach ${formatWhole(1e4)} ${logs.displayName} to complete the day`
                        : `${name} Complete!`}{" "}
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
                    color={colorBright}
                    style="margin-bottom: 0"
                    effectDisplay={
                        Decimal.gt(computedAutoCuttingAmount.value, 0)
                            ? `expected: +${format(
                                  logGain.apply(computedAutoCuttingAmount.value)
                              )}/s, average: +${format(ema.value)}/s (${format(
                                  Decimal.div(
                                      ema.value,
                                      logGain.apply(computedAutoCuttingAmount.value)
                                  ).mul(100)
                              )}% efficent)`
                            : undefined
                    }
                />
                <MainDisplay
                    resource={saplings}
                    color={colorDark}
                    style="margin-bottom: 0"
                    effectDisplay={
                        {
                            [-1]: `${formatWhole(netSaplingGain.value)}/s`,
                            0: undefined,
                            1: `+${formatWhole(netSaplingGain.value)}/s`
                        }[Decimal.compare(netSaplingGain.value, 0)]
                    }
                />
                <MainDisplay
                    resource={trees}
                    color={colorDark}
                    style="margin-bottom: 0"
                    effectDisplay={
                        {
                            [-1]: `${formatWhole(netTreeGain.value)}/s`,
                            0: undefined,
                            1: `+${formatWhole(netTreeGain.value)}/s`
                        }[Decimal.compare(netTreeGain.value, 0)]
                    }
                />
                <Spacer />
                {renderRow(cutTree, plantTree)}
                <div>Tip: You can hold down on actions to perform them automatically</div>
                <div>
                    Note: your average log gain will be equal to your expected log gain if you have
                    enough trees to support your chopping
                </div>
                <Spacer />
                {renderRow(...row1Upgrades)}
                {renderRow(...row2Upgrades)}
                {renderRow(...row1Buyables)}
            </>
        ))
    };
});

export default layer;
