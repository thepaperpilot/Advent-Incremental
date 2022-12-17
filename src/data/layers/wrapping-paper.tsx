import { BuyableOptions, createBuyable, GenericBuyable } from "features/buyable";
import { jsx, JSXFunction, showIf } from "features/feature";
import { createResource, Resource } from "features/resources/resource";
import { createLayer } from "game/layers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import MainDisplay from "features/resources/MainDisplay.vue";
import { render, renderRow } from "util/vue";
import { default as dyes, type enumColor } from "./dyes";
import { BaseTransition, computed, Ref, ref, unref } from "vue";
import Spacer from "components/layout/Spacer.vue";
import { Computable } from "util/computed";
import { format } from "util/bignum";
import {
    createCollapsibleModifierSections,
    setUpDailyProgressTracker,
    createCollapsibleMilestones
} from "data/common";
import Modal from "components/Modal.vue";
import { createMilestone } from "features/milestones/milestone";
import { createClickable } from "features/clickables/clickable";
import { main } from "../projEntry";
import player from "game/player";

const id = "wrappingPaper";
const day = 15;

const basePrimaryCost = 1e5;
const baseSecondaryCost = 1e2;
const basePrimaryRatio = 1.5;
const baseSecondaryRatio = 1.2;

interface WrappingPaper {
    name: string;
    buyable: GenericBuyable;
    display: JSXFunction;
}

interface Scaling {
    base: DecimalSource;
    exponent: DecimalSource;
}

interface WrappingPaperOptions {
    ratio: {
        [key in enumColor]?: Scaling;
    };
    name: string;
    id: string;
    background: string;
    listedBoosts: {
        desc: Ref<string>;
    }[];
}

const layer = createLayer(id, () => {
    const name = "Wrapping Paper";
    const color = "gold"; // todo: change

    const createWrappingPaper = (options: WrappingPaperOptions & Partial<BuyableOptions>) => {
        const getCost: Computable<
            {
                resource: Resource;
                cost: DecimalSource;
            }[]
        > = computed(() => {
            const dyeCosts = [];
            for (const [color, ratio] of Object.entries(options.ratio)) {
                dyeCosts.push({
                    resource: dyes.dyes[color as enumColor].amount,
                    cost: Decimal.mul(ratio.base, Decimal.pow(ratio.exponent, buyable.amount.value))
                });
            }
            return dyeCosts;
        });
        const buyable: GenericBuyable = createBuyable(() => {
            return {
                style: () => ({
                    background: unref(buyable.canPurchase) ? options.background : "#545454",
                    minWidth: "200px",
                    boxShadow:
                        "0 3px 0 #00000022 inset, 3px 0 0 #00000022 inset, 0 0 3px #00000022 inset, 0 0 0 3px #00000022 inset",
                    border: "none"
                }),
                display: jsx(() => {
                    return (
                        <span>
                            <h3>{options.name}</h3>
                            <br />
                            Create {options.name}.
                            <br />
                            Requirement:{" "}
                            {getCost.value.map(({ resource, cost }) => {
                                return render(
                                    jsx(() => (
                                        <div>
                                            {format(cost)} {resource.displayName} <br />
                                        </div>
                                    ))
                                );
                            })}
                            <br />
                            Currently:{" "}
                            {options.listedBoosts.map(({ desc }) => {
                                return render(jsx(() => <div>{unref(desc)}</div>));
                            })}
                        </span>
                    );
                }),
                canPurchase() {
                    for (const { resource, cost } of getCost.value) {
                        if (Decimal.lt(resource.value, cost)) return false;
                    }
                    return true;
                },
                onPurchase() {
                    buyable.amount.value = Decimal.add(buyable.amount.value, 1);
                    // todo: stuff
                }
            };
        });
        const resource = createResource(buyable.amount, options.name);
        return {
            resource,
            buyable,
            name: options.name,
            display: jsx(() => {
                return (
                    <MainDisplay
                        resource={resource}
                        style="margin: 0; width: 200px; width: 180px; padding: 10px;"
                        sticky={false}
                    />
                );
            })
        };
    };
    const wrappingPaper: Record<string, WrappingPaper> = {
        christmas: createWrappingPaper({
            name: "Christmas Wrapping Paper",
            id: "christmas",
            ratio: {
                red: { base: basePrimaryCost * 3, exponent: basePrimaryRatio },
                green: { base: baseSecondaryCost * 3, exponent: baseSecondaryRatio }
            },
            background:
                "linear-gradient(225deg, rgba(255,76,76,1) 10.8%, rgba(255,255,255,1) 11.1%, rgba(255,255,255,1) 21.9%, rgba(65,255,95,1) 22.2%, rgba(65,255,95,1) 33.0%, rgba(255,255,255,1) 33.3%, rgba(255,255,255,1) 44.1%, rgba(255,76,76,1) 44.4%, rgba(255,76,76,1) 55.2%, rgba(255,255,255,1) 55.5%, rgba(255,255,255,1) 66.3%, rgba(65,255,95,1) 66.6%, rgba(65,255,95,1) 77.4%, rgba(255,255,255,1) 77.7%, rgba(255,255,255,1) 88.5%, rgba(255,76,76,1) 88.8%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        x${format(unref(boosts.christmas1))} to wood production
                    `
                    )
                }
            ]
        }),
        rainbow: createWrappingPaper({
            name: "Rainbow Wrapping Paper",
            id: "rainbow",
            ratio: {
                red: { base: basePrimaryCost, exponent: basePrimaryRatio + 0.2 },
                green: { base: baseSecondaryCost, exponent: baseSecondaryRatio + 0.1 },
                blue: { base: basePrimaryCost, exponent: basePrimaryRatio + 0.2 },
                yellow: { base: basePrimaryCost, exponent: basePrimaryRatio + 0.2 },
                purple: { base: baseSecondaryCost, exponent: baseSecondaryRatio + 0.1 },
                orange: { base: baseSecondaryCost, exponent: baseSecondaryRatio + 0.1 }
            },
            background:
                "linear-gradient(135deg, rgba(255,0,0,1) 0%, rgba(255,0,0,1) 2%, rgba(255,155,0,1) 14%, rgba(255,155,0,1) 18%, rgba(255,254,0,1) 31%, rgba(255,254,0,1) 35%, rgba(100,244,61,1) 48%, rgba(100,244,61,1) 52%, rgba(70,218,234,1) 64%, rgba(70,218,234,1) 68%, rgba(205,0,210,1) 81%, rgba(205,0,210,1) 85%, rgba(255,0,0,1) 98%, rgba(255,0,0,1) 100%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        /${format(unref(boosts.rainbow1))} to coal buyable cost
                    `
                    )
                }
            ]
        }),
        jazzy: createWrappingPaper({
            name: "Jazzy Wrapping Paper",
            id: "jazzy",
            ratio: {
                purple: { base: baseSecondaryCost * 3, exponent: baseSecondaryRatio },
                orange: { base: baseSecondaryCost * 3, exponent: baseSecondaryRatio }
            },
            background:
                "linear-gradient(90deg, rgba(255,177,0,1) 10.8%, rgba(189,69,255,1) 11.1%, rgba(189,69,255,1) 21.9%, rgba(255,177,0,1) 22.2%, rgba(255,177,0,1) 33.0%, rgba(189,69,255,1) 33.3%, rgba(189,69,255,1) 44.1%, rgba(255,177,0,1) 44.4%, rgba(255,177,0,1) 55.2%, rgba(189,69,255,1) 55.5%, rgba(189,69,255,1) 66.3%, rgba(255,177,0,1) 66.6%, rgba(255,177,0,1) 77.4%, rgba(189,69,255,1) 77.7%, rgba(189,69,255,1) 88.5%, rgba(255,177,0,1) 88.8%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        -${format(unref(boosts.jazzy1))} to elf cost scaling
                        `
                    )
                }
            ]
        }),
        sunshine: createWrappingPaper({
            name: "Sunshine Wrapping Paper",
            id: "sunshine",
            ratio: {
                red: { base: basePrimaryCost * 2, exponent: basePrimaryRatio + 0.1 },
                yellow: { base: basePrimaryCost * 2, exponent: basePrimaryRatio + 0.1 },
                orange: { base: baseSecondaryCost * 2, exponent: baseSecondaryRatio + 0.05 }
            },
            background:
                "radial-gradient(circle, rgba(238,250,0,1) 16%, rgba(250,157,0,1) 50%, rgba(255,76,76,1) 83%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        x${format(unref(boosts.sunshine1))} to paper production
                        `
                    )
                }
            ]
        }),
        ocean: createWrappingPaper({
            name: "Ocean Wrapping Paper",
            id: "ocean",
            ratio: {
                blue: { base: basePrimaryCost * 2, exponent: basePrimaryRatio + 0.1 },
                green: { base: baseSecondaryCost * 2, exponent: baseSecondaryRatio + 0.05 },
                purple: { base: baseSecondaryCost * 2, exponent: baseSecondaryRatio + 0.05 }
            },
            background:
                "linear-gradient(20deg, rgba(0,183,250,0.6) 8%, rgba(0,223,62,0.6) 12%, rgba(0,183,250,0.6) 17%, rgba(0,183,250,0.6) 27%, rgba(124,109,230,0.6) 38%, rgba(0,183,250,0.6) 46%, rgba(0,183,250,0.6) 50%, rgba(0,223,62,0.6) 53%, rgba(0,183,250,0.6) 60%, rgba(124,109,230,0.6) 67%, rgba(0,183,250,0.6) 73%, rgba(0,183,250,0.6) 84%, rgba(0,223,62,0.6) 88%, rgba(0,183,250,0.6) 91%), linear-gradient(340deg, rgba(0,183,250,0.6) 8%, rgba(0,223,62,0.6) 12%, rgba(0,183,250,0.6) 17%, rgba(0,183,250,0.6) 27%, rgba(124,109,230,0.6) 38%, rgba(0,183,250,0.6) 46%, rgba(0,183,250,0.6) 50%, rgba(0,223,62,0.6) 53%, rgba(0,183,250,0.6) 60%, rgba(124,109,230,0.6) 67%, rgba(0,183,250,0.6) 73%, rgba(0,183,250,0.6) 84%, rgba(0,223,62,0.6) 88%, rgba(0,183,250,0.6) 91%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        /${format(unref(boosts.ocean1))} to box buyable cost
                        `
                    )
                }
            ]
        }),
        beach: createWrappingPaper({
            name: "Beach Wrapping Paper",
            id: "beach",
            ratio: {
                yellow: { base: basePrimaryCost * 3, exponent: basePrimaryRatio },
                blue: { base: basePrimaryCost * 3, exponent: basePrimaryRatio }
            },
            background:
                "radial-gradient(circle at 80% 10%, rgba(255,255,76,1) 8%, rgba(0,0,0,0) 21%), linear-gradient(180deg, rgba(0,255,246,1) 60%, rgba(0,255,246,0) 61%), linear-gradient(215deg, rgba(0,93,255,0) 0%, rgba(0,93,255,0) 66%, rgba(255,255,76,1) 68%), linear-gradient(180deg, rgba(0,0,0,0) 68%, rgba(0,93,255,1) 70%), linear-gradient(205deg, rgba(0,255,246,1) 0%, rgba(0,255,246,1) 100%)",
            listedBoosts: [
                {
                    desc: computed(
                        () => `
                        /${format(unref(boosts.beach1))} to workshop cost
                        `
                    )
                }
            ]
        })
    };
    const boosts = {
        christmas1: computed(() => Decimal.add(wrappingPaper.christmas.buyable.amount.value, 1)), // Probably not the best way to do this, but it works
        rainbow1: computed(() => Decimal.pow(2, wrappingPaper.rainbow.buyable.amount.value)),
        jazzy1: computed(() =>
            Decimal.ln(
                Decimal.add(Decimal.ln(Decimal.add(wrappingPaper.jazzy.buyable.amount.value, 1)), 1)
            )
        ),
        sunshine1: computed(() => Decimal.add(wrappingPaper.sunshine.buyable.amount.value, 1)),
        ocean1: computed(() => Decimal.pow(1.5, wrappingPaper.ocean.buyable.amount.value)),
        beach1: computed(() => Decimal.add(wrappingPaper.beach.buyable.amount.value, 1))
    };
    const wrappingPaperSum = createResource(
        computed(() =>
            Object.values(wrappingPaper)
                .map(paper => paper.buyable.amount.value)
                .reduce(Decimal.add, 0)
        ),
        "Total Wrapping Paper"
    );
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

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => []);

    const { total: totalWrappingPaper, trackerDisplay } = setUpDailyProgressTracker({
        resource: wrappingPaperSum,
        goal: 1e20,
        name,
        day,
        color,
        textColor: "var(--feature-foreground)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        },
        ignoreTotal: true
    });

    const milestoneCosts = [6, 12, 18, 24, 30, 36]; // change

    const primaryBoostMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[0] + " Total Wrapping Paper",
            effectDisplay: "Double primary colour dye gain"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[0]),
        visibility: () => showIf(true)
    }));
    const secondaryBoostMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[1] + " Total Wrapping Paper",
            effectDisplay: "Double secondary colour dye gain"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[1]),
        visibility: () => showIf(primaryBoostMilestone.earned.value)
    }));
    const buyMaxPrimaryMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[2] + " Total Wrapping Paper",
            effectDisplay: "Buy maximum primary colour dyes"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[2]),
        visibility: () => showIf(secondaryBoostMilestone.earned.value)
    }));
    const secondaryNoResetMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[3] + " Total Wrapping Paper",
            effectDisplay: "Secondary colour dyes don't spend primary colour dyes"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[3]),
        visibility: () => showIf(buyMaxPrimaryMilestone.earned.value)
    }));
    const buyMaxSecondaryMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[4] + " Total Wrapping Paper",
            effectDisplay: "Buy maximum secondary colour dyes"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[4]),
        visibility: () => showIf(secondaryNoResetMilestone.earned.value)
    }));
    const unlockDyeElfMilestone = createMilestone(() => ({
        display: {
            requirement: milestoneCosts[5] + " Total Wrapping Paper",
            effectDisplay: "Unlock a new elf to help with dyes"
        },
        shouldEarn: () => Decimal.gte(totalWrappingPaper.value, milestoneCosts[5]),
        visibility: () => showIf(buyMaxSecondaryMilestone.earned.value)
    }));

    const milestones = {
        primaryBoost: primaryBoostMilestone,
        secondaryBoost: secondaryBoostMilestone,
        buyMaxPrimary: buyMaxPrimaryMilestone,
        secondaryNoReset: secondaryNoResetMilestone,
        buyMaxSecondary: buyMaxSecondaryMilestone,
        unlockDyeElf: unlockDyeElfMilestone
    };

    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const enterMasteryButton = createClickable(() => ({
        display: jsx(() => {
            return <>{main.isMastery.value ? "Stop Decorating" : "Begin Decoration"}</>;
        }),
        onClick() {
            main.toggleMastery();
            const layer = main.currentlyMastering.value?.id ?? "trees";
            if (!player.tabs.includes(layer)) {
                main.openDay(layer);
            }
        },
        style: {
            backgroundColor: "gold"
        }
    }));

    return {
        name,
        day,
        display: jsx(() => {
            return (
                <div style="width: 620px">
                    {render(trackerDisplay)}
                    <MainDisplay resource={wrappingPaperSum} />
                    {renderRow(
                        wrappingPaper.christmas.display,
                        wrappingPaper.rainbow.display,
                        wrappingPaper.jazzy.display
                    )}
                    {renderRow(
                        wrappingPaper.christmas.buyable,
                        wrappingPaper.rainbow.buyable,
                        wrappingPaper.jazzy.buyable
                    )}
                    <Spacer />
                    {renderRow(
                        wrappingPaper.sunshine.display,
                        wrappingPaper.ocean.display,
                        wrappingPaper.beach.display
                    )}
                    {renderRow(
                        wrappingPaper.sunshine.buyable,
                        wrappingPaper.ocean.buyable,
                        wrappingPaper.beach.buyable
                    )}
                    <Spacer />
                    {render(enterMasteryButton)}
                    <Spacer />
                    {milestonesDisplay()}
                </div>
            );
        }),
        wrappingPaper,
        totalWrappingPaper,
        generalTabCollapsed,
        boosts,
        milestones,
        collapseMilestones,
        minWidth: 700
    };
});

export default layer;
