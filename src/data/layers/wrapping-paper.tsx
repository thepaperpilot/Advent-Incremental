import Spacer from "components/layout/Spacer.vue";
import { createBar, GenericBar } from "features/bars/bar";
import { RepeatableOptions, createRepeatable, GenericRepeatable } from "features/repeatable";
import { createClickable } from "features/clickables/clickable";
import { jsx, JSXFunction, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createLayer, layers } from "game/layers";
import player from "game/player";
import { createCostRequirement, displayRequirements, requirementsMet } from "game/requirements";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, Ref, unref, watchEffect } from "vue";
import { main } from "../projEntry";
import { default as dyes, type enumColor } from "./dyes";
import elves from "./elves";
import packing from "./packing";
import toys from "./toys";

const id = "wrappingPaper";
const day = 15;

const basePrimaryCost = 1e5;
const baseSecondaryCost = 1e2;
const basePrimaryRatio = 1.5;
const baseSecondaryRatio = 1.2;

interface WrappingPaper {
    name: string;
    buyable: GenericRepeatable;
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
    const color = "gold";

    const createWrappingPaper = (options: WrappingPaperOptions & Partial<RepeatableOptions>) => {
        const buyable: GenericRepeatable = createRepeatable(() => {
            return {
                requirements: (Object.entries(options.ratio) as [enumColor, Scaling][]).map(
                    ([color, ratio]) => {
                        return createCostRequirement(() => ({
                            resource: dyes.dyes[color as enumColor].amount,
                            cost: () =>
                                Decimal.mul(
                                    ratio.base,
                                    Decimal.pow(ratio.exponent, buyable.amount.value)
                                ),
                            requiresPay: false
                        }));
                    }
                ),
                style: () => ({
                    background: requirementsMet(buyable.requirements)
                        ? options.background
                        : "#545454",
                    minWidth: "200px",
                    boxShadow:
                        "0 3px 0 #00000022 inset, 3px 0 0 #00000022 inset, 0 0 3px #00000022 inset, 0 0 0 3px #00000022 inset",
                    border: "none"
                }),
                display: {
                    title: options.name,
                    description: `Create ${options.name}`,
                    effectDisplay: jsx(() => (
                        <>
                            {options.listedBoosts.map(({ desc }) => {
                                return render(jsx(() => <div>{unref(desc)}</div>));
                            })}
                        </>
                    ))
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
                        x${format(unref(boosts.jazzy1))} to auto-smelting speed
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
    const packingBoost = computed(() =>
        packing.packingMilestones.wrappingPaperBoost.earned.value ? 2 : 1
    );
    const boosts = {
        christmas1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.add(wrappingPaper.christmas.buyable.amount.value, 1).mul(
                      packingBoost.value
                  )
        ), // Probably not the best way to do this, but it works
        rainbow1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.pow(2, wrappingPaper.rainbow.buyable.amount.value).mul(packingBoost.value)
        ),
        jazzy1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.add(wrappingPaper.jazzy.buyable.amount.value, 1).mul(packingBoost.value)
        ),
        sunshine1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.add(wrappingPaper.sunshine.buyable.amount.value, 1).mul(
                      packingBoost.value
                  )
        ),
        ocean1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.pow(1.5, wrappingPaper.ocean.buyable.amount.value).mul(packingBoost.value)
        ),
        beach1: computed(() =>
            main.isMastery.value
                ? 1
                : Decimal.add(wrappingPaper.beach.buyable.amount.value, 1)
                      .log10()
                      .add(1)
                      .mul(packingBoost.value)
                      .pow(toys.milestones.milestone3.earned.value ? 1.6 : 1)
        )
    };
    const wrappingPaperSum = createResource(
        computed(() =>
            Object.values(wrappingPaper)
                .map(paper => paper.buyable.amount.value)
                .reduce(Decimal.add, 0)
        ),
        "Total Wrapping Paper"
    );

    const unlockDyeElfMilestone = createMilestone(() => ({
        display: {
            requirement: "80 Total Wrapping Paper",
            effectDisplay: "Unlock a new elf to help with dyes"
        },
        shouldEarn: () => Decimal.gte(wrappingPaperSum.value, 80),
        onComplete() {
            main.days[3].recentlyUpdated.value = true;
        }
    }));

    const masteryReq = computed(() =>
        Decimal.add(main.masteredDays.value, 1).times(20).add(140).ceil()
    );

    const enterMasteryButton = createClickable(() => ({
        display: () => ({
            title: `${main.isMastery.value ? "Stop Decorating" : "Begin Decorating"} ${
                Object.values(layers).find(
                    layer =>
                        unref((layer as any).mastered) === false &&
                        !["Elves", "Management"].includes(unref(layer?.name ?? ""))
                )?.name
            }`,
            description: jsx(() => {
                return (
                    <>
                        <br />
                        Decorating brings you to a separate version of each day that only allows
                        layers that are decorated or being decorated to work. These days will have a
                        new decoration effect that applies outside of decorating as well.
                        <br />
                        You can safely start and stop decorating without losing progress
                        {main.isMastery.value ? null : (
                            <>
                                <br />
                                <br />
                                Requires {formatWhole(masteryReq.value)} total wrapping paper
                            </>
                        )}
                    </>
                );
            })
        }),
        visibility: () => showIf(main.day.value === day),
        canClick() {
            return main.isMastery.value || Decimal.gte(wrappingPaperSum.value, masteryReq.value);
        },
        onClick() {
            if (!unref(enterMasteryButton.canClick)) {
                return;
            }
            main.toggleMastery();
            const layer = main.currentlyMastering.value?.id ?? "trees";
            if (!player.tabs.includes(layer)) {
                main.openDay(layer);
            }
            if (layer === "paper") {
                // Purchase first 6 elves
                elves.elves.cuttersElf.bought.value = true;
                elves.elves.plantersElf.bought.value = true;
                elves.elves.expandersElf.bought.value = true;
                elves.elves.heatedCuttersElf.bought.value = true;
                elves.elves.heatedPlantersElf.bought.value = true;
                elves.elves.fertilizerElf.bought.value = true;
            }
        },
        style: {
            width: "300px",
            minHeight: "160px"
        }
    }));

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `animation: 15s wrapping-paper-bar linear infinite`,
        textStyle: `color: var(--feature-foreground)`,
        progress: () => (main.day.value === day ? Decimal.div(main.masteredDays.value, 6) : 1),
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {main.masteredDays.value}
                    /6 days decorated
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(main.masteredDays.value, 6) &&
            main.showLoreModal.value === false
        ) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        display: jsx(() => {
            return (
                <div style="width: 620px">
                    <div>
                        {main.day.value === day
                            ? `Decorate 6 previous days to complete the day`
                            : `${name} Complete!`}
                    </div>
                    {render(dayProgress)}
                    <Spacer />
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
                    {render(unlockDyeElfMilestone)}
                </div>
            );
        }),
        wrappingPaper,
        boosts,
        unlockDyeElfMilestone,
        minWidth: 700
    };
});

export default layer;
