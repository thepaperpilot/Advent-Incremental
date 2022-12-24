/**
 * @module
 * @hidden
 */
import { isArray } from "@vue/shared";
import Toggle from "components/fields/Toggle.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { GenericBuyable } from "features/buyable";
import { ClickableOptions } from "features/clickables/clickable";
import { jsx, showIf, Visibility } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { createReset } from "features/reset";
import { Resource } from "features/resources/resource";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { Computable, convertComputable } from "util/computed";
import { render, renderGrid } from "util/vue";
import { computed, ComputedRef, ref, Ref, unref, watchEffect } from "vue";
import boxes from "./boxes";
import cloth from "./cloth";
import coal from "./coal";
import management from "./management";
import metal from "./metal";
import oil from "./oil";
import paper from "./paper";
import plastic from "./plastic";
import trees from "./trees";
import workshop from "./workshop";
import wrappingPaper from "./wrapping-paper";
import dyes, { enumColor } from "./dyes";
import ribbon from "./ribbon";
import letters from "./letters";
import packing from "./packing";

export interface ElfBuyable extends GenericBuyable {
    /** The inverse function of the cost formula, used to calculate the maximum amount that can be bought by elves. */
    inverseCost: (x?: DecimalSource) => DecimalSource;
}

const id = "elves";
const day = 4;

const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Elves";
    const colorBright = "red";
    const colorDark = "#911D21";

    const coalGoal = 1e9;

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () =>
            main.day.value === day
                ? Decimal.div(totalElves.value, 6)
                      .times(5 / 6)
                      .add(
                          Decimal.div(
                              Decimal.add(coal.coal.value, 1).log10(),
                              Decimal.log10(coalGoal)
                          )
                              .clamp(0, 1)
                              .div(6)
                      )
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                Decimal.lt(totalElves.value, 6) ? (
                    <>{formatWhole(totalElves.value)}/6 elves</>
                ) : (
                    <>
                        {formatWhole(coal.coal.value)}/{formatWhole(coalGoal)} coal
                    </>
                )
            ) : (
                ""
            )
        )
    })) as GenericBar;

    const elfReset = createReset(() => ({
        thingsToReset: [trees, workshop, coal],
        onReset() {
            const coalUpgrades = [
                "warmerCutters",
                "warmerPlanters",
                "basicFertilizer",
                "unlockBonfire",
                "dedicatedCutters",
                "dedicatedPlanters",
                "betterFertilizer",
                "unlockKiln",
                "efficientSmelther",
                "arsonistAssistance",
                "refinedCoal",
                "coloredFire"
            ];
            const upgradeValues = coalUpgrades.map(
                upg => ((coal as any)[upg] as GenericUpgrade).bought.value
            );
            setTimeout(() => {
                if (treeUpgradesMilestone.earned.value) {
                    trees.row1Upgrades.forEach(upg => (upg.bought.value = true));
                    trees.row2Upgrades.forEach(upg => (upg.bought.value = true));
                } else if (researchMilestone.earned.value) {
                    trees.row1Upgrades[4].bought.value = true;
                    trees.row2Upgrades[4].bought.value = true;
                }
                if (foundationMilestone.earned.value) {
                    workshop.foundationProgress.value = 100;
                }
                if (coalUpgradesMilestone.earned.value) {
                    coalUpgrades.forEach(
                        (upg, i) =>
                            (((coal as any)[upg] as GenericUpgrade).bought.value = upgradeValues[i])
                    );
                    coal.warmerCutters.bought.value = true;
                    coal.warmerPlanters.bought.value = true;
                    coal.basicFertilizer.bought.value = true;
                    coal.unlockBonfire.bought.value = true;
                    coal.dedicatedCutters.bought.value = true;
                    coal.dedicatedPlanters.bought.value = true;
                    coal.betterFertilizer.bought.value = true;
                    coal.unlockKiln.bought.value = true;
                    coal.efficientSmelther.bought.value = true;
                    coal.arsonistAssistance.bought.value = true;
                    coal.refinedCoal.bought.value = true;
                    coal.coloredFire.bought.value = true;
                }
            });
        }
    }));

    const cutterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.cuttersBook.totalAmount.value, 0.1).add(1),
            description: "Now You're Logging!",
            enabled: () => Decimal.gt(paper.books.cuttersBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const planterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.plantersBook.totalAmount.value, 0.1).add(1),
            description: "The Man Who Planted Trees",
            enabled: () => Decimal.gt(paper.books.plantersBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const expanderCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.expandersBook.totalAmount.value, 0.1).add(1),
            description: "Logjam",
            enabled: () => Decimal.gt(paper.books.expandersBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const heatedCutterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.heatedCuttersBook.totalAmount.value, 0.1).add(1),
            description: "Fahrenheit 451",
            enabled: () => Decimal.gt(paper.books.heatedCuttersBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const heatedPlanterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.heatedPlantersBook.totalAmount.value, 0.1).add(1),
            description: "Tillamook Burn Country",
            enabled: () => Decimal.gt(paper.books.heatedPlantersBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const fertilizerCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.fertilizerBook.totalAmount.value, 0.1).add(1),
            description: "The Garden Tree's Handbook",
            enabled: () => Decimal.gt(paper.books.fertilizerBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const smallFireCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.smallFireBook.totalAmount.value, 0.1).add(1),
            description: "Firestarter",
            enabled: () => Decimal.gt(paper.books.smallFireBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const bonfireCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.bonfireBook.totalAmount.value, 0.1).add(1),
            description: "An Arsonist's Guide to Writer's Homes in New England",
            enabled: () => Decimal.gt(paper.books.bonfireBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const kilnCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.kilnBook.totalAmount.value, 0.1).add(1),
            description: "Little Fires Everywhere",
            enabled: () => Decimal.gt(paper.books.kilnBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const paperCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.paperBook.totalAmount.value, 0.1).add(1),
            description: "The Book Thief",
            enabled: () => Decimal.gt(paper.books.paperBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const boxCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.boxBook.totalAmount.value, 0.1).add(1),
            description: "Not a box",
            enabled: () => Decimal.gt(paper.books.boxBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const clothCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.clothBook.totalAmount.value, 0.1).add(1),
            description: "Fuzzy Bee and Friends",
            enabled: () => Decimal.gt(paper.books.clothBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const coalDrillCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.coalDrillBook.totalAmount.value, 0.1).add(1),
            description: "Drills and Mills",
            enabled: () => Decimal.gt(paper.books.coalDrillBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const heavyDrillCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.heavyDrillBook.totalAmount.value, 0.1).add(1),
            description: "Deep in the Earth",
            enabled: () => Decimal.gt(paper.books.heavyDrillBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const oilCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.oilBook.totalAmount.value, 0.1).add(1),
            description: "Burning the Midnight Oil",
            enabled: () => Decimal.gt(paper.books.oilBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const metalCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.metalBook.totalAmount.value, 0.1).add(1),
            description: "Physical Metallurgy",
            enabled: () => Decimal.gt(paper.books.metalBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const dyeCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.times(paper.books.primaryDyeBook.totalAmount.value, 0.1).add(1),
            description: "Arts and Crafts",
            enabled: () => Decimal.gt(paper.books.primaryDyeBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const plasticCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.plasticBook.totalAmount.value, 0.1).add(1),
            description: "One Plastic Bag",
            enabled: () => Decimal.gt(paper.books.plasticBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);
    const packingCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.packingBook.totalAmount.value, 0.1).add(1),
            description: "The Tetris Effect",
            enabled: () => Decimal.gt(paper.books.packingBook.totalAmount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "10 Elves Trained",
            enabled: elvesMilestone2.earned
        }))
    ]);

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Holly Auto-Buy Frequency",
            modifier: cutterCooldown,
            base: 10,
            unit: "/s",
            visible: elves.cuttersElf.bought
        },
        {
            title: "Ivy Auto-Buy Frequency",
            modifier: planterCooldown,
            base: 10,
            unit: "/s",
            visible: elves.plantersElf.bought
        },
        {
            title: "Hope Auto-Buy Frequency",
            modifier: expanderCooldown,
            base: 10,
            unit: "/s",
            visible: elves.expandersElf.bought
        },
        {
            title: "Jack Auto-Buy Frequency",
            modifier: heatedCutterCooldown,
            base: 10,
            unit: "/s",
            visible: elves.heatedCuttersElf.bought
        },
        {
            title: "Mary Auto-Buy Frequency",
            modifier: heatedPlanterCooldown,
            base: 10,
            unit: "/s",
            visible: elves.heatedPlantersElf.bought
        },
        {
            title: "Noel Auto-Buy Frequency",
            modifier: fertilizerCooldown,
            base: 10,
            unit: "/s",
            visible: elves.fertilizerElf.bought
        },
        {
            title: "Joy Auto-Buy Frequency",
            modifier: smallFireCooldown,
            base: 10,
            unit: "/s",
            visible: elves.smallFireElf.bought
        },
        {
            title: "Faith Auto-Buy Frequency",
            modifier: bonfireCooldown,
            base: 10,
            unit: "/s",
            visible: elves.bonfireElf.bought
        },
        {
            title: "Snowball Auto-Buy Frequency",
            modifier: kilnCooldown,
            base: 10,
            unit: "/s",
            visible: elves.kilnElf.bought
        },
        {
            title: "Star Auto-Buy Frequency",
            modifier: paperCooldown,
            base: 10,
            unit: "/s",
            visible: elves.paperElf.bought
        },
        {
            title: "Bell Auto-Buy Frequency",
            modifier: boxCooldown,
            base: 10,
            unit: "/s",
            visible: elves.boxElf.bought
        },
        {
            title: "Gingersnap Auto-Buy Frequency",
            modifier: clothCooldown,
            base: 10,
            unit: "/s",
            visible: elves.clothElf.bought
        },
        {
            title: "Peppermint Auto-Buy Frequency",
            modifier: coalDrillCooldown,
            base: 10,
            unit: "/s",
            visible: () =>
                management.elfTraining.expandersElfTraining.milestones[3].earned.value ||
                letters.masteryEffectActive.value
        },
        {
            title: "Frosty Auto-Buy Frequency",
            modifier: heavyDrillCooldown,
            base: 10,
            unit: "/s",
            visible: () =>
                management.elfTraining.cutterElfTraining.milestones[4].earned.value ||
                letters.masteryEffectActive.value
        },
        {
            title: "Cocoa Auto-Buy Frequency",
            modifier: oilCooldown,
            base: 10,
            unit: "/s",
            visible: () =>
                management.elfTraining.heatedCutterElfTraining.milestones[4].earned.value ||
                letters.masteryEffectActive.value
        },
        {
            title: "Twinkle Auto-Buy Frequency",
            modifier: metalCooldown,
            base: 10,
            unit: "/s",
            visible: () =>
                management.elfTraining.fertilizerElfTraining.milestones[4].earned.value ||
                letters.masteryEffectActive.value
        },
        {
            title: "Carol Auto-Buy Frequency",
            modifier: dyeCooldown,
            base: 10,
            unit: "/s",
            visible: wrappingPaper.unlockDyeElfMilestone.earned.value && !main.isMastery.value
        },
        {
            title: "Tinsel Auto-Buy Frequency",
            modifier: plasticCooldown,
            base: 10,
            unit: "/s",
            visible: plastic.masteryEffectActive
        },
        {
            title: "Jingle Auto-Buy Frequency",
            modifier: packingCooldown,
            base: 10,
            unit: "/s",
            visible: packing.upgrades.packingElf.bought
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

    const trainingCost = computed(() => {
        let cost = Decimal.pow(4, totalElves.value).times(1e6);
        if (Decimal.gte(totalElves.value, 9)) {
            cost = Decimal.times(cost, 1e15);
        }
        if (Decimal.gte(totalElves.value, 12)) {
            cost = Decimal.times(cost, 1e15);
        }
        return cost;
    });

    function createElf(
        options: {
            name: string;
            description: string;
            buyable:
                | (ElfBuyable & { resource?: Resource })
                | (ElfBuyable & { resource?: Resource })[];
            cooldownModifier: Modifier;
            hasToggle?: boolean;
            toggleDesc?: string;
            onAutoPurchase?: (
                buyable: ElfBuyable & { resource?: Resource },
                amount: DecimalSource
            ) => void;
            onPurchase?: VoidFunction; // Will get overriden by the custom onpurchase, but that's fine
            canBuy?: Computable<boolean>;
            buyMax?: Computable<boolean>;
            independent?: Computable<boolean>; // Whether or not the cost is independent of the current buyable amount
        } & Partial<ClickableOptions>
    ) {
        const buyProgress = persistent<DecimalSource>(0);
        const amountOfTimesDone = persistent<number>(0);
        const toggle = options.hasToggle ? persistent<boolean>(false) : ref(true);

        const computedAutoBuyCooldown = computed(() => options.cooldownModifier.apply(10));

        const isActive = convertComputable(options.canBuy ?? true);
        const buyMax = convertComputable(options.buyMax ?? false);
        const independent = convertComputable(options.independent ?? false);

        function update(diff: number) {
            if (upgrade.bought.value && unref(isActive)) {
                buyProgress.value = Decimal.add(buyProgress.value, diff);

                const cooldown = Decimal.recip(computedAutoBuyCooldown.value);
                amountOfTimesDone.value += diff / cooldown.toNumber();

                let maxBuyAmount = Decimal.div(buyProgress.value, cooldown).floor();
                buyProgress.value = Decimal.sub(buyProgress.value, maxBuyAmount.mul(cooldown));

                if (unref(buyMax)) maxBuyAmount = Decimal.dInf;

                (isArray(options.buyable) ? options.buyable : [options.buyable]).forEach(
                    buyable => {
                        if (unref(buyable.visibility) !== Visibility.Visible) {
                            return;
                        }
                        const buyAmount = Decimal.min(
                            Decimal.sub(
                                buyable.inverseCost(buyable.resource?.value),
                                unref(independent) ? 0 : buyable.amount.value
                            ).add(1),
                            maxBuyAmount
                        );

                        if (buyAmount.lte(0)) return;

                        buyable.amount.value = Decimal.add(buyable.amount.value, buyAmount);
                        maxBuyAmount = Decimal.sub(maxBuyAmount, buyAmount);
                        options.onAutoPurchase?.(buyable, buyAmount);

                        if (maxBuyAmount.lte(0)) return;
                    }
                );
            }
        }

        const upgrade = createUpgrade(() => {
            return {
                ...options,
                // Don't duplicate buyable data
                buyable: undefined,
                toggle,
                buyProgress,
                update,
                resource: coal.coal,
                cost: trainingCost,
                computedAutoBuyCooldown,
                amountOfTimesDone,
                name: options.name,
                canAfford() {
                    return (
                        Decimal.gte(coal.coal.value, unref(trainingCost)) && !main.isMastery.value
                    );
                },
                display: () => ({
                    title: options.name,
                    description: jsx(() => (
                        <>
                            {options.description}
                            {upgrade.bought.value ||
                            ["Peppermint", "Twinkle", "Cocoa", "Frosty"].includes(
                                options.name
                            ) ? null : (
                                <>
                                    {" "}
                                    Training this elf will require resetting all your progress from
                                    days 1-3.
                                </>
                            )}
                            {upgrade.bought.value && options.hasToggle === true ? (
                                <>
                                    <Toggle
                                        title={options.toggleDesc}
                                        onUpdate:modelValue={value => (toggle.value = value)}
                                        modelValue={toggle.value}
                                    />
                                </>
                            ) : null}
                        </>
                    )),
                    showCost: !upgrade.bought.value
                }),
                style: "width: 190px",
                onPurchase() {
                    options.onPurchase?.();
                    if (
                        !["Peppermint", "Twinkle", "Cocoa", "Frosty", "Carol", "Jingle"].includes(
                            options.name
                        )
                    ) {
                        elfReset.reset();
                    }
                }
            };
        }) as GenericUpgrade & {
            buyProgress: Ref<DecimalSource>;
            update: (diff: number) => void;
            toggle: Ref<boolean>;
            name: string;
            computedAutoBuyCooldown: ComputedRef<DecimalSource>;
            amountOfTimesDone: Ref<number>;
        };
        return upgrade;
    }

    const cuttersElf = createElf({
        name: "Holly",
        description:
            "Holly will automatically purchase cutters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[0],
        cooldownModifier: cutterCooldown,
        buyMax: () => management.elfTraining.cutterElfTraining.milestones[1].earned.value
    });
    const plantersElf = createElf({
        name: "Ivy",
        description:
            "Ivy will automatically purchase planters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[1],
        cooldownModifier: planterCooldown,
        buyMax: () => management.elfTraining.planterElfTraining.milestones[1].earned.value
    });
    const expandersElf = createElf({
        name: "Hope",
        description:
            "Hope will automatically purchase forest expanders you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[2],
        cooldownModifier: expanderCooldown,
        buyMax: () => management.elfTraining.expandersElfTraining.milestones[1].earned.value
    });
    const treesElves = [cuttersElf, plantersElf, expandersElf];
    const heatedCuttersElf = createElf({
        name: "Jack",
        description:
            "Jack will automatically purchase heated cutters you can afford, without actually spending any coal.",
        buyable: coal.heatedCutters,
        cooldownModifier: heatedCutterCooldown,
        buyMax: () => management.elfTraining.heatedCutterElfTraining.milestones[2].earned.value
    });
    const heatedPlantersElf = createElf({
        name: "Mary",
        description:
            "Mary will automatically purchase heated planters you can afford, without actually spending any coal.",
        buyable: coal.heatedPlanters,
        cooldownModifier: heatedPlanterCooldown,
        buyMax: () => management.elfTraining.heatedPlanterElfTraining.milestones[2].earned.value
    });
    const fertilizerElf = createElf({
        name: "Noel",
        description:
            "Noel will automatically purchase fertilized soil you can afford, without actually spending any ash.",
        buyable: coal.moreFertilizer,
        cooldownModifier: fertilizerCooldown,
        buyMax: () => management.elfTraining.heatedPlanterElfTraining.milestones[2].earned.value
    });
    const coalElves = [heatedCuttersElf, heatedPlantersElf, fertilizerElf];
    const smallFireElf = createElf({
        name: "Joy",
        description:
            "Joy will automatically purchase small fires you can afford, without actually spending any logs. You can toggle whether or not to enable the purchased small fires automatically. Small fires will start giving a boost to ash and coal gain.",
        buyable: coal.buildFire,
        cooldownModifier: smallFireCooldown,
        buyMax: () => management.elfTraining.heatedCutterElfTraining.milestones[2].earned.value,
        visibility: () => showIf(boxes.upgrades.logsUpgrade.bought.value),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased small fires",
        onAutoPurchase(_, amount) {
            if (smallFireElf.toggle.value) {
                coal.activeFires.value = Decimal.add(coal.activeFires.value, amount);
            }
        },
        onPurchase() {
            main.days[4].recentlyUpdated.value = true;
        }
    });
    const bonfireElf = createElf({
        name: "Faith",
        description:
            "Faith will automatically purchase bonfires you can afford. You can toggle whether or not to enable the purchased bonfires automatically. Bonfires will start giving a boost to ash and coal gain.",
        buyable: coal.buildBonfire,
        cooldownModifier: bonfireCooldown,
        buyMax: () => management.elfTraining.heatedPlanterElfTraining.milestones[2].earned.value,
        visibility: () => showIf(boxes.upgrades.ashUpgrade.bought.value),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased bonfires",
        onAutoPurchase(buyable, amount) {
            const spent = Decimal.mul(unref(buyable.cost ?? 0), amount);
            coal.activeFires.value = Decimal.sub(coal.activeFires.value, spent).max(0);
            coal.buildFire.amount.value = Decimal.sub(coal.buildFire.amount.value, spent).max(0);
            if (bonfireElf.toggle.value) {
                coal.activeBonfires.value = Decimal.add(coal.activeBonfires.value, amount);
            }
        },
        onPurchase() {
            main.days[4].recentlyUpdated.value = true;
        },
        canBuy: coal.unlockBonfire.bought,
        independent: true
    });
    const kilnElf = createElf({
        name: "Snowball",
        description:
            "Snowball will automatically purchase kilns you can afford, without actually spending any logs. You can toggle whether or not to enable the purchased kilns automatically. Kilns will start giving a boost to ash and coal gain.",
        buyable: coal.buildKiln,
        cooldownModifier: kilnCooldown,
        visibility: () => showIf(boxes.upgrades.coalUpgrade.bought.value),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased kilns",
        onAutoPurchase(_, amount) {
            if (kilnElf.toggle.value) {
                coal.activeKilns.value = Decimal.add(coal.activeKilns.value, amount);
            }
        },
        onPurchase() {
            main.days[4].recentlyUpdated.value = true;
        },
        canBuy: coal.unlockKiln.bought
    });
    const fireElves = [smallFireElf, bonfireElf, kilnElf];
    const paperElf = createElf({
        name: "Star",
        description:
            "Star will automatically purchase all books you can afford, without actually spending any paper.",
        buyable: Object.values(paper.books),
        cooldownModifier: paperCooldown,
        visibility: () => showIf(plastic.elfUpgrades.paperElf.bought.value)
    });
    const boxElf = createElf({
        name: "Bell",
        description:
            "Bell will automatically purchase all box buyables you can afford, without actually spending any boxes.",
        buyable: [
            ...Object.values(boxes.buyables),
            ...Object.values(boxes.buyables2),
            ...Object.values(boxes.buyables3)
        ],
        cooldownModifier: boxCooldown,
        visibility: () => showIf(plastic.elfUpgrades.boxElf.bought.value)
    });
    const clothElf = createElf({
        name: "Gingersnap",
        description:
            "Gingersnap will automatically purchase all cloth buyables you can afford, without actually spending any resources.",
        buyable: [cloth.buildPens, cloth.betterShears, cloth.fasterSpinning],
        cooldownModifier: clothCooldown,
        visibility: () => showIf(plastic.elfUpgrades.clothElf.bought.value)
    });
    const plasticElves = [paperElf, boxElf, clothElf];
    const coalDrillElf = createElf({
        name: "Peppermint",
        description:
            "Peppermint will automatically purchase all coal drills you can afford, without actually spending any resources.",
        buyable: coal.buildDrill,
        cooldownModifier: coalDrillCooldown,
        visibility: () =>
            showIf(
                management.elfTraining.expandersElfTraining.milestones[3].earned.value ||
                    letters.masteryEffectActive.value
            ),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased coal drills",
        onAutoPurchase(_, amount) {
            if (coalDrillElf.toggle.value) {
                coal.activeDrills.value = Decimal.add(coal.activeDrills.value, amount);
            }
        }
    });
    const heavyDrillElf = createElf({
        name: "Frosty",
        description:
            "Frosty will automatically purchase all drill types in the oil section, without actually spending any resources.",
        buyable: [oil.buildHeavy, oil.buildHeavy2, oil.buildExtractor],
        cooldownModifier: heavyDrillCooldown,
        visibility: () =>
            showIf(
                management.elfTraining.cutterElfTraining.milestones[4].earned.value ||
                    letters.masteryEffectActive.value
            ),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased oil drills",
        onAutoPurchase(buyable, amount) {
            if (heavyDrillElf.toggle.value) {
                if (buyable === oil.buildHeavy) {
                    oil.activeHeavy.value = Decimal.add(oil.activeHeavy.value, amount);
                } else if (buyable === oil.buildHeavy2) {
                    oil.activeHeavy2.value = Decimal.add(oil.activeHeavy2.value, amount);
                } else if (buyable === oil.buildExtractor) {
                    oil.activeExtractor.value = Decimal.add(oil.activeExtractor.value, amount);
                }
            }
        }
    });
    const oilElf = createElf({
        name: "Cocoa",
        description:
            "Cocoa will automatically purchase all oil-using machines you can afford, without actually spending any resources.",
        buyable: [oil.buildPump, oil.buildBurner, oil.buildSmelter],
        cooldownModifier: oilCooldown,
        visibility: () =>
            showIf(
                management.elfTraining.heatedCutterElfTraining.milestones[4].earned.value ||
                    letters.masteryEffectActive.value
            ),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased oil-using machines",
        onAutoPurchase(buyable, amount) {
            if (heavyDrillElf.toggle.value) {
                if (buyable === oil.buildPump) {
                    oil.activePump.value = Decimal.add(oil.activePump.value, amount);
                } else if (buyable === oil.buildBurner) {
                    oil.activeBurner.value = Decimal.add(oil.activeBurner.value, amount);
                } else if (buyable === oil.buildSmelter) {
                    oil.activeSmelter.value = Decimal.add(oil.activeSmelter.value, amount);
                }
            }
        }
    });
    const managementElves = [coalDrillElf, heavyDrillElf, oilElf];
    const metalElf = createElf({
        name: "Twinkle",
        description:
            "Twinkle will automatically purchase all metal machines you can afford, without actually spending any resources.",
        buyable: [metal.oreDrill, metal.industrialCrucible, metal.hotterForge],
        cooldownModifier: metalCooldown,
        visibility: () =>
            showIf(
                management.elfTraining.fertilizerElfTraining.milestones[4].earned.value ||
                    letters.masteryEffectActive.value
            )
    });
    const managementElves2 = [metalElf];

    const dyeColors = Object.fromEntries(
        (["blue", "red", "yellow", "orange", "green", "purple"] as enumColor[]).map(color => [
            dyes.dyes[color].buyable.id,
            color
        ])
    ) as Record<string, enumColor>;
    const dyeElf = createElf({
        name: "Carol",
        description:
            "Carol will automatically purchase all primary dyes you can afford, without actually spending any resources.",
        buyable: Object.values(dyes.dyes).map(dye => dye.buyable),
        cooldownModifier: dyeCooldown, // Note: Buy max will be unlocked at this point
        visibility: () =>
            showIf(wrappingPaper.unlockDyeElfMilestone.earned.value && !main.isMastery.value),
        buyMax: () => management.elfTraining.dyeElfTraining.milestones[2].earned.value,
        onAutoPurchase(buyable, amount) {
            buyable.amount.value = Decimal.sub(buyable.amount.value, amount);
            if (["orange", "green", "purple"].includes(dyeColors[buyable.id])) {
                if (!ribbon.milestones.secondaryDyeElf.earned.value) {
                    return;
                }
            }
            buyable.amount.value = Decimal.add(buyable.amount.value, amount);
        }
    });
    const plasticElf = createElf({
        name: "Tinsel",
        description:
            "Tinsel will automatically purchase all plastic buyables you can afford, without actually spending any resources.",
        buyable: Object.values(plastic.buyables),
        cooldownModifier: plasticCooldown,
        visibility: () => showIf(plastic.masteryEffectActive.value),
        buyMax: () => management.elfTraining.plasticElfTraining.milestones[4].earned.value
    });
    const wrappingPaperElves = [dyeElf, plasticElf];

    const packingElf = createElf({
        name: "Jingle",
        description: "Jingle will automatically hire more elves to help out with packing the sleigh.",
        buyable: [packing.helpers.elf, packing.helpers.loader],
        cooldownModifier: packingCooldown,
        visibility: () => showIf(packing.upgrades.packingElf.bought.value),
        buyMax: true,
        onAutoPurchase(buyable, amount) {
            if (buyable === packing.helpers.loader && !management.elfTraining.packingElfTraining.milestones[3].earned.value) {
                buyable.amount.value = Decimal.sub(buyable.amount.value, amount);
            }
        }
    });
    const elves = {
        cuttersElf,
        plantersElf,
        expandersElf,
        heatedCuttersElf,
        heatedPlantersElf,
        fertilizerElf,
        smallFireElf,
        bonfireElf,
        kilnElf,
        paperElf,
        boxElf,
        clothElf,
        coalDrillElf,
        heavyDrillElf,
        oilElf,
        metalElf,
        dyeElf,
        plasticElf,
        packingElf
    };
    const totalElves = computed(() => Object.values(elves).filter(elf => elf.bought.value).length);

    const manualMilestone = createMilestone(() => ({
        display: {
            requirement: "1 Elf Trained",
            effectDisplay:
                "Manual cutting and planting can happen twice as often for each trained elf"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 1)
    }));
    const researchMilestone = createMilestone(() => ({
        display: {
            requirement: "2 Elves Trained",
            effectDisplay: "Research I & II aren't reset after training"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 2),
        visibility: () => showIf(manualMilestone.earned.value)
    }));
    const coalGainMilestone = createMilestone(() => ({
        display: {
            requirement: "3 Elves Trained",
            effectDisplay: "Coal gain is raised to the 1.25"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 3),
        visibility: () => showIf(researchMilestone.earned.value)
    }));
    const logGainMilestone = createMilestone(() => ({
        display: {
            requirement: "4 Elves Trained",
            effectDisplay: "Trees give twice as many logs"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 4),
        visibility: () => showIf(coalGainMilestone.earned.value)
    }));
    const forestMilestone = createMilestone(() => ({
        display: {
            requirement: "5 Elves Trained",
            effectDisplay: "Forest is twice as large"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 5),
        visibility: () => showIf(logGainMilestone.earned.value)
    }));
    const elvesMilestone = createMilestone(() => ({
        display: {
            requirement: "6 Elves Trained",
            effectDisplay: "Elves work twice as fast"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 6),
        visibility: () => showIf(forestMilestone.earned.value)
    }));
    const foundationMilestone = createMilestone(() => ({
        display: {
            requirement: "7 Elves Trained",
            effectDisplay: "Workshop Foundation starts at 100% complete after training"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 7),
        visibility: () => showIf(elvesMilestone.earned.value && main.day.value > 5)
    }));
    const forestMilestone2 = createMilestone(() => ({
        display: {
            requirement: "8 Elves Trained",
            effectDisplay: "Forest is twice as large (again)"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 8),
        visibility: () => showIf(foundationMilestone.earned.value)
    }));
    const treeUpgradesMilestone = createMilestone(() => ({
        display: {
            requirement: "9 Elves Trained",
            effectDisplay: "Trees upgrades aren't reset after training"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 9),
        visibility: () => showIf(forestMilestone2.earned.value)
    }));
    const elvesMilestone2 = createMilestone(() => ({
        display: {
            requirement: "10 Elves Trained",
            effectDisplay: "Elves work twice as fast (again)"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 10),
        visibility: () => showIf(main.day.value >= 10 && treeUpgradesMilestone.earned.value)
    }));
    const coalUpgradesMilestone = createMilestone(() => ({
        display: {
            requirement: "11 Elves Trained",
            effectDisplay: "Coal upgrades aren't reset after training"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 11),
        visibility: () => showIf(elvesMilestone2.earned.value)
    }));
    const coalGainMilestone2 = createMilestone(() => ({
        display: {
            requirement: "12 Elves Trained",
            effectDisplay: "Double coal gain"
        },
        shouldEarn: () => Decimal.gte(totalElves.value, 12),
        visibility: () => showIf(coalUpgradesMilestone.earned.value)
    }));
    // Gosh why did I make these as an array at first
    const milestones = [
        manualMilestone,
        researchMilestone,
        coalGainMilestone,
        logGainMilestone,
        forestMilestone,
        elvesMilestone,
        foundationMilestone,
        forestMilestone2,
        treeUpgradesMilestone,
        elvesMilestone2,
        coalUpgradesMilestone,
        coalGainMilestone2
    ];
    const milestonesDict = {
        manualMilestone,
        researchMilestone,
        coalGainMilestone,
        logGainMilestone,
        forestMilestone,
        elvesMilestone,
        foundationMilestone,
        forestMilestone2,
        treeUpgradesMilestone,
        elvesMilestone2,
        coalUpgradesMilestone,
        coalGainMilestone2
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestonesDict);

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        Object.values(elves).forEach(elf => elf.update(diff));
    });

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(totalElves.value, 6) &&
            Decimal.gte(coal.coal.value, coalGoal)
        ) {
            main.completeDay();
        }
    });

    const mastery = {
        elves: {
            cuttersElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            plantersElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            expandersElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            heatedCuttersElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            heatedPlantersElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            fertilizerElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            smallFireElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            bonfireElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            kilnElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            paperElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            boxElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            clothElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            coalDrillElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            heavyDrillElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            oilElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                toggle: persistent<boolean>(false),
                bought: persistent<boolean>(false)
            },
            metalElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            dyeElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            plasticElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOfTimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            },
            packingElf: {
                buyProgress: persistent<DecimalSource>(0),
                amountOftimesDone: persistent<number>(0),
                bought: persistent<boolean>(false)
            }
        },
        milestones: [
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) },
            { earned: persistent<boolean>(false) }
        ]
    };

    return {
        name,
        day,
        color: colorBright,
        elves,
        totalElves,
        milestones,
        collapseMilestones,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Reach ${formatWhole(6)} trained elves and ${formatWhole(coalGoal)} ${
                              coal.coal.displayName
                          } to complete the day`
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
                <div style="width: 600px">
                    {renderGrid(
                        treesElves,
                        coalElves,
                        fireElves,
                        plasticElves,
                        managementElves,
                        managementElves2.concat(wrappingPaperElves),
                        [packingElf]
                    )}
                </div>
                {milestonesDisplay()}
            </>
        )),
        mastery
    };
});

export default layer;
