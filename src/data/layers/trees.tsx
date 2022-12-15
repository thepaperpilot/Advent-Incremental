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
const id = "trees";
const day = 1;

// how much to prioritize this' income
// vs the previous ones
const SMOOTHING_FACTOR = 0.1;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Trees";
    const colorBright = "#4BDC13";
    const colorDark = "green";

    const logs = createResource<DecimalSource>(0, "logs");
    // Think of saplings as spent trees
    const saplings = createResource<DecimalSource>(0, "saplings");

    const ema = ref<DecimalSource>(0);

    const lastAutoCuttingAmount = ref<DecimalSource>(0);
    const lastAutoPlantedAmount = ref<DecimalSource>(0);

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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "8 Elves Trained",
            enabled: elves.milestones[7].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Lumberjack Boots",
            enabled: cloth.treesUpgrades.treesUpgrade1.bought
        })),
        createAdditiveModifier(() => ({
            addend: dyes.boosts.blue1,
            description: "Blue Dye Boost 1",
            enabled: () => Decimal.gte(dyes.dyes.blue.amount.value, 1)
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.pow(computedManualCuttingAmount.value, 0.99),
            description: "Hope Level 1",
            enabled: management.elfTraining.expandersElfTraining.milestones[0].earned
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
    const trees = createResource(
        computed(() => Decimal.sub(totalTrees.apply(10), saplings.value)),
        "trees"
    );
    const computedTotalTrees = computed(() => totalTrees.apply(10));

    const manualCutUpgrade1 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 10,
        display: {
            title: "Wooden Fingers",
            description: "Cut down an additional tree per click"
        }
    }));
    const manualPlantUpgrade1 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 10,
        display: {
            title: "Leafy Fingers",
            description: "Plant an additional tree per click"
        }
    }));
    const autoCutUpgrade1 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 25,
        display: {
            title: "Automated Knives",
            description: "Cut down a tree every second"
        }
    }));
    const autoPlantUpgrade1 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 25,
        display: {
            title: "Automated Spade",
            description: "Plant a tree every second"
        }
    }));
    const researchUpgrade1 = createUpgrade(() => ({
        resource: noPersist(logs),
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
        resource: noPersist(logs),
        cost: 50,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Sharper Fingers",
            description: "Manually cut trees twice as often"
        }
    }));
    const manualPlantUpgrade2 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 50,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Greener Fingers",
            description: "Manually Plant trees twice as often"
        }
    }));
    const manualCutUpgrade3 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 150,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Knives",
            description:
                "Each time you manually chop trees, gain 1s of automatic tree chopping production"
        }
    }));
    const manualPlantUpgrade3 = createUpgrade(() => ({
        resource: noPersist(logs),
        cost: 150,
        visibility: () => showIf(researchUpgrade1.bought.value),
        display: {
            title: "Smart Spades",
            description:
                "Each time you manually plant trees, gain 1s of automatic tree planting production"
        }
    }));
    const researchUpgrade2 = createUpgrade(() => ({
        resource: noPersist(logs),
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
        resource: noPersist(logs),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            if (Decimal.gte(v, 2e30)) v = Decimal.pow(v, 10).div(Decimal.pow(2e30, 9));
            v = Decimal.pow(0.95, paper.books.cuttersBook.totalAmount.value).times(v);
            return Decimal.times(100, v).add(200);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.sub(x, 200).div(100);
            v = v.div(Decimal.pow(0.95, paper.books.cuttersBook.totalAmount.value));
            if (Decimal.gte(v, 2e30)) v = Decimal.mul(v, Decimal.pow(2e30, 9)).root(10);
            if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
            if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Generic Cutters",
            description: "Each cutter cuts down 1 tree/s"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const autoPlantingBuyable1 = createBuyable(() => ({
        resource: noPersist(logs),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            if (Decimal.gte(v, 2e30)) v = Decimal.pow(v, 10).div(Decimal.pow(2e30, 9));
            v = Decimal.pow(0.95, paper.books.plantersBook.totalAmount.value).times(v);
            let cost = Decimal.times(100, v).add(200);
            if (management.elfTraining.planterElfTraining.milestones[3].earned.value) {
                cost = Decimal.div(cost, 10);
            }
            return cost;
        },
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.planterElfTraining.milestones[3].earned.value) {
                x = Decimal.mul(x, 10);
            }
            let v = Decimal.sub(x, 200).div(100);
            v = v.div(Decimal.pow(0.95, paper.books.plantersBook.totalAmount.value));
            if (Decimal.gte(v, 2e30)) v = Decimal.mul(v, Decimal.pow(2e30, 9)).root(10);
            if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
            if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Generic Planters",
            description: "Each planter plants 0.5 trees/s"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const expandingForestBuyable = createBuyable(() => ({
        resource: noPersist(logs),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            if (Decimal.gte(v, 1e5)) v = Decimal.pow(v, 2).div(1e5);
            if (Decimal.gte(v, 1e15)) v = Decimal.pow(v, 10).div(1e135);
            v = Decimal.pow(0.95, paper.books.expandersBook.totalAmount.value).times(v);
            return Decimal.pow(Decimal.add(v, 1), 1.5).times(500);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 500).root(1.5).sub(1);
            v = v.div(Decimal.pow(0.95, paper.books.expandersBook.totalAmount.value));
            if (Decimal.gte(v, 1e15)) v = Decimal.mul(v, 1e135).root(10);
            if (Decimal.gte(v, 1e5)) v = Decimal.mul(v, 1e5).root(2);
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Expand Forest",
            description: "Add 10 trees to the forest"
        },
        visibility: () => showIf(researchUpgrade2.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const row1Buyables = [autoCuttingBuyable1, autoPlantingBuyable1, expandingForestBuyable];

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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Lumberjack Jeans",
            enabled: cloth.treesUpgrades.treesUpgrade2.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, main.day.value),
            description: "Holly Level 4",
            enabled: management.elfTraining.cutterElfTraining.milestones[3].earned
        })),
        createAdditiveModifier(() => ({
            addend: () =>
                Decimal.sub(lastAutoPlantedAmount.value, lastAutoCuttingAmount.value).max(0),
            description: "Ivy Level 5",
            enabled: management.elfTraining.planterElfTraining.milestones[4].earned
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Lumberjack Plaid",
            enabled: cloth.treesUpgrades.treesUpgrade3.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Ivy Level 1",
            enabled: management.elfTraining.planterElfTraining.milestones[0].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(trees.value, 0.2).log10().pow_base(2),
            description: "Ivy Level 3",
            enabled: management.elfTraining.planterElfTraining.milestones[2].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Mary Level 4",
            enabled: management.elfTraining.heatedPlanterElfTraining.milestones[3].earned
        })),
        createAdditiveModifier(() => ({
            addend: () =>
                Decimal.sub(lastAutoCuttingAmount.value, lastAutoPlantedAmount.value).max(0),
            description: "Ivy Level 5",
            enabled: management.elfTraining.planterElfTraining.milestones[4].earned
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
            multiplier: () =>
                workshop.milestones.extraExpansionMilestone1.earned.value
                    ? Decimal.pow(1.02, workshop.foundationProgress.value)
                    : Decimal.div(workshop.foundationProgress.value, 20).add(1),
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
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry logs in boxes",
            enabled: boxes.upgrades.logsUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(boxes.buyables.logBoxesBuyable.amount.value, 2).add(1),
            description: "Carry more logs",
            enabled: boxes.upgrades.logsUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 10,
            description: "Felt-Gripped Axe",
            enabled: cloth.treesUpgrades.treesUpgrade4.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computed(() =>
                Decimal.add(computedAutoCuttingAmount.value, 1).log10().plus(1)
            ),
            description: "Is Blue Dye just Water?",
            enabled: dyes.upgrades.blueDyeUpg.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computed(() => Decimal.add(computedAutoCuttingAmount.value, 1).root(9)),
            description: "Holly Level 1",
            enabled: management.elfTraining.cutterElfTraining.milestones[0].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.sqrt(management.totalElfLevels.value),
            description: "Noel Level 1",
            enabled: management.elfTraining.fertilizerElfTraining.milestones[0].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: wrappingPaper.boosts.christmas1,
            description: "Christmas Wrapping Paper",
            enabled: computed(() => Decimal.gt(wrappingPaper.boosts.christmas1.value, 1))
        })),
        createExponentialModifier(() => ({
            exponent: 1.2,
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
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s",
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
            logs.value = Decimal.add(logs.value, Decimal.times(logGain.apply(1), amount));
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
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: -1px; transition-duration: 0s",
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

        const plantingAmount = Decimal.sub(
            computedAutoPlantingAmount.value,
            Decimal.sub(lastAutoCuttingAmount.value, lastAutoPlantedAmount.value).max(0)
        );
        const cuttingAmount = Decimal.sub(
            computedAutoCuttingAmount.value,
            Decimal.sub(lastAutoPlantedAmount.value, lastAutoCuttingAmount.value).max(0)
        );
        lastAutoPlantedAmount.value = Decimal.isNaN(plantingAmount) ? 0 : plantingAmount;
        lastAutoCuttingAmount.value = Decimal.isNaN(cuttingAmount) ? 0 : cuttingAmount;

        const amountCut = Decimal.min(
            trees.value,
            Decimal.times(computedAutoCuttingAmount.value, diff)
        );
        const logsGained = Decimal.mul(logGain.apply(1), amountCut);

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

    const { total: totalLogs, trackerDisplay } = setUpDailyProgressTracker({
        resource: logs,
        goal: 1e4,
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
        computedAutoCuttingAmount,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay
                    resource={logs}
                    color={colorBright}
                    style="margin-bottom: 0"
                    productionDisplay={
                        Decimal.gt(computedAutoCuttingAmount.value, 0)
                            ? `+${format(ema.value)}/s average<br/>equilibrium: +${formatLimit(
                                  [
                                      [computedAutoCuttingAmount.value, "cutting speed"],
                                      [computedAutoPlantingAmount.value, "planting speed"],
                                      [Decimal.mul(computedTotalTrees.value, 20), "forest cap"]
                                  ],
                                  "/s",
                                  logGain.apply(1)
                              )}`
                            : undefined
                    }
                />
                <MainDisplay
                    resource={saplings}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={formatGain(netSaplingGain.value)}
                />
                <MainDisplay
                    resource={trees}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={formatGain(netTreeGain.value)}
                />
                <Spacer />
                {renderRow(cutTree, plantTree)}
                <div>Tip: You can hold down on actions to perform them automatically</div>
                <Spacer />
                {renderGrid(row1Upgrades, row2Upgrades)}
                <Spacer />
                {renderRow(...row1Buyables)}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(logs.value)} {logs.displayName}
            </div>
        ))
    };
});

export default layer;
