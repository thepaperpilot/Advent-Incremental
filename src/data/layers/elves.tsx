/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { GenericBuyable } from "features/buyable";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { createReset } from "features/reset";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderCol, renderRow } from "util/vue";
import { computed, ref, Ref, unref, watchEffect } from "vue";
import coal from "./coal";
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
                if (researchMilestone.earned.value) {
                    trees.row1Upgrades[4].bought.value = true;
                    trees.row2Upgrades[4].bought.value = true;
                }
            });
        }
    }));

    function createElf(options: { name: string; description: string; buyable: GenericBuyable }) {
        const trainingCost = computed(() => Decimal.pow(4, totalElves.value).times(1e6));
        const buyProgress = persistent<DecimalSource>(0);

        function update(diff: number) {
            if (upgrade.bought.value) {
                buyProgress.value = Decimal.add(buyProgress.value, diff);
                const cooldown = Decimal.recip(computedAutoBuyCooldown.value);
                while (Decimal.gte(buyProgress.value, cooldown)) {
                    if (unref(options.buyable.canPurchase)) {
                        options.buyable.amount.value = Decimal.add(options.buyable.amount.value, 1);
                        buyProgress.value = cooldown.sub(0.1);
                    } else {
                        buyProgress.value = cooldown;
                        break;
                    }
                }
            }
        }

        const upgrade = createUpgrade(() => {
            return {
                buyProgress,
                update,
                resource: coal.coal,
                cost: trainingCost,
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
                        </>
                    )),
                    showCost: !upgrade.bought.value
                }),
                style: "width: 190px",
                onPurchase: elfReset.reset
            };
        }) as GenericUpgrade & { buyProgress: Ref<number>; update: (diff: number) => void };
        return upgrade;
    }

    const cuttersElf = createElf({
        name: "Holly",
        description:
            "Holly will automatically purchase cutters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[0]
    });
    const plantersElf = createElf({
        name: "Ivy",
        description:
            "Ivy will automatically purchase planters you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[1]
    });
    const expandersElf = createElf({
        name: "Hope",
        description:
            "Hope will automatically purchase forest expanders you can afford, without actually spending any logs.",
        buyable: trees.row1Buyables[2]
    });
    const treesElves = [cuttersElf, plantersElf, expandersElf];
    const heatedCuttersElf = createElf({
        name: "Jack",
        description:
            "Jack will automatically purchase heated cutters you can afford, without actually spending any coal.",
        buyable: coal.heatedCutters
    });
    const heatedPlantersElf = createElf({
        name: "Mary",
        description:
            "Mary will automatically purchase heated planters you can afford, without actually spending any coal.",
        buyable: coal.heatedPlanters
    });
    const fertilizerElf = createElf({
        name: "Noel",
        description:
            "Noel will automatically purchase fertilized soil you can afford, without actually spending any ash.",
        buyable: coal.moreFertilizer
    });
    const coalElves = [heatedCuttersElf, heatedPlantersElf, fertilizerElf];
    const elves = {
        cuttersElf,
        plantersElf,
        expandersElf,
        heatedCuttersElf,
        heatedPlantersElf,
        fertilizerElf
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
            effectDisplay: "Research I & II are't reset after training"
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
    const milestones = [
        manualMilestone,
        researchMilestone,
        coalGainMilestone,
        logGainMilestone,
        forestMilestone,
        elvesMilestone
    ];

    const autoBuyCooldown = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "6 Elves Trained",
            enabled: elvesMilestone.earned
        }))
    ]);
    const computedAutoBuyCooldown = computed(() => autoBuyCooldown.apply(0.1));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Elf Auto-Buy Frequency",
            modifier: autoBuyCooldown,
            base: 10,
            unit: "/s"
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

        Object.values(elves).forEach(elf => elf.update(diff));
    });

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(totalElves.value, 6) &&
            Decimal.gte(coal.coal.value, coalGoal)
        ) {
            main.loreTitle.value = "Day complete!";
            main.loreBody.value =
                "The workshop now hums with the bustling elves working everything. They can take it from here - you deserve a break after such a long day! Good Job!";
            main.day.value = day + 1;
            main.minimized.value = false;
            player.devSpeed = 0;
        }
    });

    return {
        name,
        color: colorBright,
        elves,
        totalElves,
        milestones,
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
                </div>
                {renderCol(...milestones)}
            </>
        ))
    };
});

export default layer;
