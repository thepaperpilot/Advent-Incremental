/**
 * @module
 * @hidden
 */
import Toggle from "components/fields/Toggle.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { GenericBuyable } from "features/buyable";
import { ClickableOptions } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
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
import { render, renderRow } from "util/vue";
import { computed, ref, Ref, unref, watchEffect } from "vue";
import boxes from "./boxes";
import coal from "./coal";
import paper from "./paper";
import trees from "./trees";
import workshop from "./workshop";

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
            multiplier: () => Decimal.times(paper.books.cuttersBook.amount.value, 0.1).add(1),
            description: "Now You're Logging!",
            enabled: () => Decimal.gt(paper.books.cuttersBook.amount.value, 0)
        }))
    ]);
    const planterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.plantersBook.amount.value, 0.1).add(1),
            description: "The Man Who Planted Trees",
            enabled: () => Decimal.gt(paper.books.plantersBook.amount.value, 0)
        }))
    ]);
    const expanderCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.expandersBook.amount.value, 0.1).add(1),
            description: "Logjam",
            enabled: () => Decimal.gt(paper.books.expandersBook.amount.value, 0)
        }))
    ]);
    const heatedCutterCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.heatedCuttersBook.amount.value, 0.1).add(1),
            description: "Fahrenheit 451",
            enabled: () => Decimal.gt(paper.books.heatedCuttersBook.amount.value, 0)
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
                Decimal.times(paper.books.heatedPlantersBook.amount.value, 0.1).add(1),
            description: "Tillamook Burn Country",
            enabled: () => Decimal.gt(paper.books.heatedPlantersBook.amount.value, 0)
        }))
    ]);
    const fertilizerCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.fertilizerBook.amount.value, 0.1).add(1),
            description: "The Garden Tree's Handbook",
            enabled: () => Decimal.gt(paper.books.fertilizerBook.amount.value, 0)
        }))
    ]);
    const smallFireCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.smallFireBook.amount.value, 0.1).add(1),
            description: "Firestarter",
            enabled: () => Decimal.gt(paper.books.smallFireBook.amount.value, 0)
        }))
    ]);
    const bonfireCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.bonfireBook.amount.value, 0.1).add(1),
            description: "An Arsonist's Guide to Writer's Homes in New England",
            enabled: () => Decimal.gt(paper.books.bonfireBook.amount.value, 0)
        }))
    ]);
    const kilnCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(paper.books.kilnBook.amount.value, 0.1).add(1),
            description: "Little Fires Everywhere",
            enabled: () => Decimal.gt(paper.books.kilnBook.amount.value, 0)
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

    function createElf(
        options: {
            name: string;
            description: string;
            buyable: GenericBuyable & { resource: Resource };
            cooldownModifier: Modifier;
            customCost?: (amount: DecimalSource) => DecimalSource;
            hasToggle?: boolean;
            toggleDesc?: string;
            onAutoPurchase?: VoidFunction;
            onPurchase?: VoidFunction; // Will get overriden by the custom onpurchase, but that's fine
            canBuy?: Computable<boolean>;
        } & Partial<ClickableOptions>
    ) {
        const trainingCost = computed(() => Decimal.pow(4, totalElves.value).times(1e6));
        const buyProgress = persistent<DecimalSource>(0);
        const toggle = options.hasToggle ? persistent<boolean>(false) : ref(true);

        const computedAutoBuyCooldown = computed(() => options.cooldownModifier.apply(10));

        const isActive = convertComputable(options.canBuy ?? true);

        function update(diff: number) {
            if (upgrade.bought.value && unref(isActive)) {
                buyProgress.value = Decimal.add(buyProgress.value, diff);
                const cooldown = Decimal.recip(computedAutoBuyCooldown.value);
                while (Decimal.gte(buyProgress.value, cooldown)) {
                    if (
                        options.customCost == undefined
                            ? unref(options.buyable.canPurchase)
                            : Decimal.gte(
                                  options.buyable.resource.value,
                                  options.customCost(options.buyable.amount.value)
                              )
                    ) {
                        options.buyable.amount.value = Decimal.add(options.buyable.amount.value, 1);
                        buyProgress.value = Decimal.sub(buyProgress.value, cooldown);
                        options.onAutoPurchase?.();
                    } else {
                        buyProgress.value = cooldown;
                        break;
                    }
                }
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
                display: () => ({
                    title: options.name,
                    description: jsx(() => (
                        <>
                            {options.description}
                            {upgrade.bought.value ? null : (
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
                    elfReset.reset();
                }
            };
        }) as GenericUpgrade & {
            buyProgress: Ref<number>;
            update: (diff: number) => void;
            toggle: Ref<boolean>;
        };
        return upgrade;
    }

    const cuttersElf = createElf({
        name: "Holly",
        description:
            "Holly will automatically purchase cutters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[0],
        cooldownModifier: cutterCooldown
    });
    const plantersElf = createElf({
        name: "Ivy",
        description:
            "Ivy will automatically purchase planters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[1],
        cooldownModifier: planterCooldown
    });
    const expandersElf = createElf({
        name: "Hope",
        description:
            "Hope will automatically purchase forest expanders you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[2],
        cooldownModifier: expanderCooldown
    });
    const treesElves = [cuttersElf, plantersElf, expandersElf];
    const heatedCuttersElf = createElf({
        name: "Jack",
        description:
            "Jack will automatically purchase heated cutters you can afford, without actually spending any coal.",
        buyable: coal.heatedCutters,
        cooldownModifier: heatedCutterCooldown
    });
    const heatedPlantersElf = createElf({
        name: "Mary",
        description:
            "Mary will automatically purchase heated planters you can afford, without actually spending any coal.",
        buyable: coal.heatedPlanters,
        cooldownModifier: heatedPlanterCooldown
    });
    const fertilizerElf = createElf({
        name: "Noel",
        description:
            "Noel will automatically purchase fertilized soil you can afford, without actually spending any ash.",
        buyable: coal.moreFertilizer,
        cooldownModifier: fertilizerCooldown
    });
    const coalElves = [heatedCuttersElf, heatedPlantersElf, fertilizerElf];
    const smallFireElf = createElf({
        name: "Joy",
        description:
            "Joy will automatically purchase small fires you can afford, without actually spending any logs. You can toggle whether or not to enable the purchased small fires automatically. Small fires will start giving a boost to ash and coal gain.",
        buyable: coal.buildFire,
        cooldownModifier: smallFireCooldown,
        visibility: () => showIf(boxes.upgrades.logsUpgrade.bought.value),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased small fires",
        onAutoPurchase() {
            if (smallFireElf.toggle.value && this.buyable.canPurchase) {
                coal.activeFires.value = Decimal.add(coal.activeFires.value, 1);
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
        visibility: () => showIf(boxes.upgrades.ashUpgrade.bought.value),
        hasToggle: true,
        toggleDesc: "Activate auto-purchased bonfires",
        onAutoPurchase() {
            if (bonfireElf.toggle.value && this.buyable.canPurchase) {
                coal.activeBonfires.value = Decimal.add(coal.activeBonfires.value, 1);
                coal.buildFire.amount.value = Decimal.sub(
                    coal.buildFire.amount.value,
                    unref(this.buyable.cost!)
                );
                coal.activeFires.value = Decimal.sub(
                    coal.activeFires.value,
                    unref(this.buyable.cost!)
                );
            }
        },
        onPurchase() {
            main.days[4].recentlyUpdated.value = true;
        },
        canBuy: coal.unlockBonfire.bought
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
        onAutoPurchase() {
            if (kilnElf.toggle.value && this.buyable.canPurchase) {
                coal.activeKilns.value = Decimal.add(coal.activeKilns.value, 1);
            }
        },
        onPurchase() {
            main.days[4].recentlyUpdated.value = true;
        },
        canBuy: coal.unlockKiln.bought
    });
    const fireElves = [smallFireElf, bonfireElf, kilnElf];
    const elves = {
        cuttersElf,
        plantersElf,
        expandersElf,
        heatedCuttersElf,
        heatedPlantersElf,
        fertilizerElf,
        smallFireElf,
        bonfireElf,
        kilnElf
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
        treeUpgradesMilestone
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
        treeUpgradesMilestone
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

    return {
        name,
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
                    {renderRow(...treesElves)}
                    {renderRow(...coalElves)}
                    {renderRow(...fireElves)}
                </div>
                {milestonesDisplay()}
            </>
        ))
    };
});

export default layer;
