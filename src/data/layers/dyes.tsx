/**
 * @module
 * @hidden
 */
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import Sqrt from "components/math/Sqrt.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { RepeatableOptions, createRepeatable } from "features/repeatable";
import { jsx, JSXFunction, showIf, Visibility } from "features/feature";
import { createHotkey, GenericHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { Computable, convertComputable } from "util/computed";
import { render, renderCol, renderRow } from "util/vue";
import { computed, ComputedRef, ref, Ref, unref } from "vue";
import { main } from "../projEntry";
import boxes from "./boxes";
import cloth from "./cloth";
import coal from "./coal";
import { ElfBuyable } from "./elves";
import management from "./management";
import oil from "./oil";
import paper from "./paper";
import trees from "./trees";
import toys from "./toys";
import factory from "./factory";
import reindeer from "./reindeer";
import routing from "./routing";
import packing from "./packing";
import {
    createBooleanRequirement,
    createCostRequirement,
    requirementsMet
} from "game/requirements";

interface Dye {
    name: string;
    amount: Resource<DecimalSource>;
    buyable: ElfBuyable;
    toGenerate: WithRequired<Modifier, "description" | "revert">;
    computedToGenerate: ComputedRef<DecimalSource>;
    display: JSXFunction;
    hotkey: GenericHotkey;
}

type DyeUpg =
    | "blueDyeUpg"
    | "redDyeUpg"
    | "yellowDyeUpg"
    | "yellowDyeUpg2"
    | "redDyeUpg2"
    | "blueDyeUpg2"
    | "coalUpg";

export type enumColor =
    | "red"
    | "green"
    | "blue"
    | "yellow"
    | "purple"
    | "orange"
    | "black"
    | "white";

const id = "dyes";
const day = 11;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Dyes";
    const color = "#D4D4F4";

    const masteryEffectActive = computed(
        () => mastered.value || main.currentlyMastering.value?.name === name
    );

    const primaryDyes = createResource(
        computed(() =>
            Decimal.min(dyes.red.amount.value, dyes.yellow.amount.value).min(dyes.blue.amount.value)
        ),
        "red, yellow, and blue dye"
    );

    function createDye(
        options: {
            name: string;
            color: string;
            shadowColor?: string;
            key: string;
            costs: () => {
                base: Ref<DecimalSource> | DecimalSource;
                root?: Ref<DecimalSource> | DecimalSource;
                res: Resource<DecimalSource>;
            }[];
            listedBoosts: {
                visible: Ref<boolean> | boolean;
                desc: Ref<string>;
            }[];
            dyesToReset: {
                name: string;
                reset: VoidFunction;
            }[];
        } & Partial<RepeatableOptions>
    ): Dye {
        const amount = createResource(
            computed(() =>
                Decimal.add(buyable.amount.value, 1)
                    .mul(buyable.amount.value)
                    .div(2)
                    .mul(computedToGenerate.value)
            ),
            options.name
        );

        const toGenerate = createSequentialModifier(() => {
            const modifiers = [
                createAdditiveModifier(() => ({
                    addend: () => Decimal.add(buyable.amount.value, 1),
                    description: `${options.name} Chambers`
                }))
            ];
            if (options.color === "yellow") {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier() {
                            return Decimal.add(dyes.red.amount.value, 1).log10().add(1).pow(0.75);
                        },
                        description: "Dye Synergy I",
                        enabled: oil.row3Upgrades[0].bought
                    }))
                );
            }
            if (options.color === "red") {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier() {
                            return Decimal.add(dyes.blue.amount.value, 1).log10().add(1);
                        },
                        description: "Dye Synergy II",
                        enabled: oil.row3Upgrades[3].bought
                    }))
                );
            }
            if (["red", "yellow"].includes(options.color)) {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier: boosts.orange1,
                        description: "Orange Dye Boost 1"
                    }))
                );
            }
            if (["yellow", "blue"].includes(options.color)) {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier: boosts.green1,
                        description: "Green Dye Boost 1"
                    }))
                );
            }
            if (["red", "blue"].includes(options.color)) {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier: boosts.purple1,
                        description: "Purple Dye Boost 1"
                    }))
                );
            }
            if (["red", "yellow", "blue"].includes(options.color)) {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier: 2,
                        description: "Wetter Dyes",
                        enabled: upgrades.yellowDyeUpg.bought
                    })),
                    createMultiplicativeModifier(() => ({
                        multiplier: () => Decimal.add(cloth.cloth.value, Math.E).ln(),
                        description: "Gingersnap Level 1",
                        enabled: management.elfTraining.clothElfTraining.milestones[0].earned
                    })),
                    createMultiplicativeModifier(() => ({
                        multiplier: 2,
                        description: "Carol Level 1",
                        enabled: management.elfTraining.dyeElfTraining.milestones[0].earned
                    })),
                    createMultiplicativeModifier(() => ({
                        multiplier: 5,
                        description: "977,000,000 Presents Packed",
                        enabled: packing.packingMilestones.primaryDyeBoost.earned
                    }))
                );
            }
            if (["orange", "green", "purple"].includes(options.color)) {
                modifiers.push(
                    createMultiplicativeModifier(() => ({
                        multiplier: 2,
                        description: "Carol Level 2",
                        enabled: management.elfTraining.dyeElfTraining.milestones[1].earned
                    }))
                );
            }
            modifiers.push(
                createMultiplicativeModifier(() => ({
                    multiplier: 2,
                    description: "Gingersnap Level 3",
                    enabled: management.elfTraining.clothElfTraining.milestones[2].earned
                }))
            );
            modifiers.push(
                createMultiplicativeModifier(() => ({
                    multiplier: 2,
                    description: "Carry dye in boxes",
                    enabled: boxes.row3Upgrades.dyeUpgrade.bought
                }))
            );
            modifiers.push(reindeer.reindeer.rudolph.modifier);
            modifiers.push(
                createMultiplicativeModifier(() => ({
                    multiplier: () =>
                        Object.values(factory.components).reduce(
                            (x, y) => y + (x.type == "dye" ? 1 : 0),
                            1
                        ) as number,
                    description: "300,000 Cities Solved",
                    enabled: routing.metaMilestones[4].earned
                }))
            );
            return modifiers;
        }) as WithRequired<Modifier, "description" | "revert">;
        const computedToGenerate = computed(() => toGenerate.apply(0));

        let dyeBook: ElfBuyable & {
            resource: Resource;
            freeLevels: ComputedRef<DecimalSource>;
            totalAmount: ComputedRef<DecimalSource>;
        };
        switch (options.color) {
            case "red":
            case "yellow":
            case "blue":
            case "black":
            case "white":
                dyeBook = paper.books.primaryDyeBook;
                break;
            case "orange":
            case "green":
            case "purple":
                dyeBook = paper.books.secondaryDyeBook;
                break;
        }

        const buyable: ElfBuyable = createRepeatable(() => {
            const costs = options.costs();
            return {
                ...options,
                style: () => ({
                    backgroundColor: requirementsMet(buyable.requirements) ? color : "#545454",
                    minWidth: "200px"
                }),
                display: {
                    title: jsx(() => (
                        <h3>
                            {options.name} Chambers <HotkeyVue hotkey={hotkey} />
                        </h3>
                    )),
                    description: jsx(() => (
                        <>
                            Create {format(computedToGenerate.value)} {options.name}
                            {options.dyesToReset.length > 0
                                ? ", but reset " +
                                  options.dyesToReset.map(dye => dye.name).join(", ")
                                : ""}
                            .
                        </>
                    )),
                    effectDisplay: jsx(() => (
                        <span class="white-space: pre-wrap">
                            Currently:{" "}
                            {options.listedBoosts
                                .filter(b => unref(b.visible))
                                .map(b => render(jsx(() => <div>{unref(b.desc)}</div>)))}
                        </span>
                    ))
                },
                // Doesn't actually get used due to custom inverseCost function
                resource: amount,
                requirements: [
                    ...costs.map(c =>
                        createCostRequirement(() => ({
                            resource: createResource(
                                computed(() =>
                                    Decimal.div(c.res.value, unref(c.base)).root(unref(c.root ?? 1))
                                ),
                                c.res.displayName
                            ),
                            cost() {
                                let v = buyable.amount.value;
                                if (Decimal.gte(v, 25)) v = Decimal.pow(v, 2).div(20); // intentional price jump #2
                                if (Decimal.gte(v, 10)) v = Decimal.pow(v, 2).div(5); // intentional price jump
                                if (Decimal.gte(v, 3125)) v = Decimal.pow(v, 2).div(3125);
                                v = Decimal.mul(v, Decimal.pow(0.95, dyeBook.totalAmount.value));
                                return Decimal.div(v, 10).plus(1);
                            }
                        }))
                    ),
                    createBooleanRequirement(() => !main.isMastery.value)
                ],
                inverseCostPre(x: DecimalSource) {
                    let v = Decimal.sub(x, 1).mul(10);
                    v = v.div(Decimal.pow(0.95, dyeBook.totalAmount.value));
                    if (Decimal.gte(v, 3125)) v = Decimal.mul(v, 3125).root(2);
                    if (Decimal.gte(v, 10)) v = Decimal.mul(v, 5).root(2);
                    if (Decimal.gte(v, 25)) v = Decimal.mul(v, 20).root(2);
                    return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
                },
                inverseCost() {
                    if (unref(buyable.visibility) != Visibility.Visible) return Decimal.dZero;
                    return unref(costs).reduce(
                        (pre, c) =>
                            Decimal.min(
                                this.inverseCostPre(
                                    Decimal.div(c.res.value, unref(c.base)).root(unref(c.root ?? 1))
                                ),
                                pre
                            ),
                        Decimal.dInf
                    );
                },
                onPurchase() {
                    buyable.amount.value = Decimal.add(buyable.amount.value, -1);
                    let buyMax = false;
                    switch (options.color) {
                        case "red":
                        case "yellow":
                        case "blue":
                            buyMax =
                                management.elfTraining.dyeElfTraining.milestones[2].earned.value;
                            break;
                        case "orange":
                        case "green":
                        case "purple":
                            buyMax =
                                management.elfTraining.dyeElfTraining.milestones[4].earned.value;
                            break;
                    }

                    if (buyMax) {
                        const buyAmount = this.inverseCost().sub(this.amount.value).plus(1);
                        if (buyAmount.lte(0)) return;
                        buyable.amount.value = Decimal.add(buyable.amount.value, buyAmount);
                    } else {
                        buyable.amount.value = Decimal.add(buyable.amount.value, 1);
                    }
                    if (!management.elfTraining.dyeElfTraining.milestones[3].earned.value) {
                        options.dyesToReset.forEach(dye => dye.reset());
                    }
                }
            };
        });

        const hotkey = createHotkey(() => ({
            key: options.key,
            description: `${options.name} Chambers`,
            onPress: () => {
                if (unref(buyable.canClick)) buyable.onClick();
            },
            enabled: noPersist(main.days[day - 1].opened)
        }));

        const visibility = convertComputable(options.visibility ?? Visibility.Visible);

        return {
            name: options.name,
            amount,
            buyable,
            hotkey,
            toGenerate,
            computedToGenerate,
            display: jsx(() =>
                unref(visibility) === Visibility.Visible ? (
                    <MainDisplay
                        resource={amount}
                        color={options.color}
                        shadowColor={options.shadowColor ?? options.color}
                        style="margin: 0; width: 200px; width: 180px; padding: 10px;"
                        sticky={false}
                    />
                ) : (
                    ""
                )
            )
        };
    }

    const dyes: Record<enumColor, Dye> = {
        red: createDye({
            name: "Red Dye",
            color: "red",
            key: "r",
            costs: () => [
                {
                    base: "2e18",
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => (upgrades.yellowDyeUpg2.bought.value ? "2.5e5" : "5e5")),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(
                        () =>
                            `+${format(
                                boosts.red1.value
                            )} effective Oil Pumps (does not impact coal consumption)`
                    )
                },
                {
                    visible: masteryEffectActive,
                    desc: computed(() => `x${format(boosts.red2.value)} drill power`)
                }
            ],
            dyesToReset: []
        }),
        yellow: createDye({
            name: "Yellow Dye",
            color: "yellow",
            key: "y",
            costs: () => [
                {
                    base: "1e18",
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => (upgrades.yellowDyeUpg2.bought.value ? "5e5" : "1e6")),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `x${format(boosts.yellow1.value)} Paper \& Plastic gain`)
                },
                {
                    visible: masteryEffectActive,
                    desc: computed(() => `x${format(boosts.yellow2.value)} cloth actions`)
                }
            ],
            dyesToReset: []
        }),
        blue: createDye({
            name: "Blue Dye",
            color: "blue",
            shadowColor: "lightblue",
            key: "u",
            costs: () => [
                {
                    base: "5e17",
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => (upgrades.yellowDyeUpg2.bought.value ? "1e6" : "2e6")),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(
                        () =>
                            `+${formatWhole(
                                boosts.blue1.value
                            )} forest size (after all other modifiers)`
                    )
                },
                {
                    visible: masteryEffectActive,
                    desc: computed(() => `/${format(boosts.blue2.value)} plastic buyables cost`)
                }
            ],
            dyesToReset: []
        }),
        black: createDye({
            name: "Black Dye",
            color: "black",
            key: "a",
            costs: () => [
                {
                    base: "1e60",
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => (upgrades.yellowDyeUpg2.bought.value ? "1e17" : "2e17")),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `*${format(boosts.black1.value)} oil gain.`)
                }
            ],
            dyesToReset: [],
            visibility: () => showIf(toys.milestones.milestone2.earned.value)
        }),
        white: createDye({
            name: "White Dye",
            color: "white",
            key: "q",
            costs: () => [
                {
                    base: "1e60",
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => (upgrades.yellowDyeUpg2.bought.value ? "1e17" : "2e17")),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `*${format(boosts.white1.value)} plastic gain.`)
                }
            ],
            dyesToReset: [],
            visibility: () => showIf(factory.upgrades[2][2].bought.value)
        }),
        orange: createDye({
            name: "Orange Dye",
            color: "orange",
            key: "o",
            costs: () => [
                {
                    base: 15,
                    root: 2,
                    res: dyes.red.amount
                },
                {
                    base: 10,
                    root: 2,
                    res: dyes.yellow.amount
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `x${format(boosts.orange1.value)} Red and Yellow Dye gain`)
                },
                {
                    visible: true,
                    desc: computed(() => `/${format(boosts.orange2.value)} Box buyable costs.`)
                }
            ],
            dyesToReset: [
                {
                    name: "Red Dye",
                    reset() {
                        dyes.red.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Yellow Dye",
                    reset() {
                        dyes.yellow.buyable.amount.value = 0;
                    }
                }
            ]
        }),
        green: createDye({
            name: "Green Dye",
            color: "green",
            key: "g",
            costs: () => [
                {
                    base: 15,
                    root: 2,
                    res: dyes.yellow.amount
                },
                {
                    base: 10,
                    root: 2,
                    res: dyes.blue.amount
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `x${format(boosts.green1.value)} Yellow and Blue Dye gain`)
                },
                {
                    visible: true,
                    desc: computed(
                        () =>
                            `+${formatWhole(
                                Decimal.sub(boosts.green2.value, 1).times(100)
                            )}% Kiln synergy effect.`
                    )
                }
            ],
            dyesToReset: [
                {
                    name: "Yellow Dye",
                    reset() {
                        dyes.yellow.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Blue Dye",
                    reset() {
                        dyes.blue.buyable.amount.value = 0;
                    }
                }
            ]
        }),
        purple: createDye({
            name: "Purple Dye",
            color: "purple",
            key: "e",
            costs: () => [
                {
                    base: 15,
                    root: 2,
                    res: dyes.blue.amount
                },
                {
                    base: 10,
                    root: 2,
                    res: dyes.red.amount
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `x${format(boosts.purple1.value)} Red and Blue Dye gain`)
                },
                {
                    visible: true,
                    desc: computed(
                        () => `x${format(boosts.purple2.value)} Smelting Speed and Ore Purity`
                    )
                }
            ],
            dyesToReset: [
                {
                    name: "Blue Dye",
                    reset() {
                        dyes.blue.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Red Dye",
                    reset() {
                        dyes.red.buyable.amount.value = 0;
                    }
                }
            ]
        })
    };

    const boosts = {
        red1: computed(() =>
            Decimal.pow(
                Decimal.add(dyes.red.amount.value, 1).log2().plus(1).log2().div(2),
                upgrades.blueDyeUpg2.bought.value ? 1.5 : 1
            )
        ),
        red2: computed(() =>
            Decimal.pow(
                Decimal.add(dyes.red.amount.value, 1).log2().plus(1),
                upgrades.blueDyeUpg2.bought.value ? 1.5 : 1
            )
        ),
        yellow1: computed(() => Decimal.add(dyes.yellow.amount.value, 1).log2().plus(1)),
        yellow2: computed(() => Decimal.add(dyes.yellow.amount.value, 1).log2().plus(1).times(3)),
        blue1: computed(() => Decimal.add(dyes.blue.amount.value, 1).log2().sqrt().times(5e6)),
        blue2: computed(() => Decimal.add(dyes.blue.amount.value, 1).log2().plus(1).pow(2)),

        orange1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.orange.amount.value, 1).log2().sqrt())
                .pow(upgrades.coalUpg.bought.value ? 1.2 : 1)
                .pow(management.elfTraining.clothElfTraining.milestones[3].earned.value ? 1.1 : 1)
        ),
        orange2: computed(() =>
            Decimal.add(dyes.orange.amount.value, 1)
                .log2()
                .plus(1)
                .mul(packing.packingMilestones.secondaryDyeBoost.earned.value ? 2 : 1)
                .pow(oil.row3Upgrades[1].bought.value ? 2.5 : 1)
        ),
        green1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.green.amount.value, 1).log2().sqrt())
                .pow(upgrades.coalUpg.bought.value ? 1.2 : 1)
                .pow(management.elfTraining.clothElfTraining.milestones[3].earned.value ? 1.1 : 1)
        ),
        green2: computed(() =>
            Decimal.add(dyes.green.amount.value, 1)
                .log2()
                .plus(1)
                .mul(packing.packingMilestones.secondaryDyeBoost.earned.value ? 2 : 1)
                .pow(upgrades.coalUpg.bought.value ? 2 : 1)
        ),
        purple1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.purple.amount.value, 1).log2().sqrt())
                .pow(upgrades.coalUpg.bought.value ? 1.2 : 1)
                .pow(management.elfTraining.clothElfTraining.milestones[3].earned.value ? 1.1 : 1)
        ),
        purple2: computed(() =>
            Decimal.add(dyes.purple.amount.value, 1)
                .log2()
                .plus(1)
                .mul(packing.packingMilestones.secondaryDyeBoost.earned.value ? 2 : 1)
        ),
        black1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.black.amount.value, 1).log2().sqrt())
                .pow(upgrades.coalUpg.bought.value ? 1.2 : 1)
                .pow(management.elfTraining.clothElfTraining.milestones[3].earned.value ? 1.1 : 1)
        ),
        white1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.white.amount.value, 1).log2().sqrt())
                .pow(upgrades.coalUpg.bought.value ? 1.2 : 1)
                .pow(management.elfTraining.clothElfTraining.milestones[3].earned.value ? 1.1 : 1)
        )
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Red Dye Creation",
            modifier: dyes.red.toGenerate,
            base: 0
        },
        {
            title: "Yellow Dye Creation",
            modifier: dyes.yellow.toGenerate,
            base: 0
        },
        {
            title: "Blue Dye Creation",
            modifier: dyes.blue.toGenerate,
            base: 0
        },
        {
            title: "Black Dye Creation",
            modifier: dyes.black.toGenerate,
            base: 0
        },
        {
            title: "White Dye Creation",
            modifier: dyes.white.toGenerate,
            base: 0
        },
        {
            title: "Orange Dye Creation",
            modifier: dyes.orange.toGenerate,
            base: 0
        },
        {
            title: "Green Dye Creation",
            modifier: dyes.green.toGenerate,
            base: 0
        },
        {
            title: "Purple Dye Creation",
            modifier: dyes.purple.toGenerate,
            base: 0
        }
    ]);

    const upgrades: Record<DyeUpg, GenericUpgrade> = {
        blueDyeUpg: createUpgrade(() => ({
            visibility: () =>
                showIf(
                    Decimal.add(dyes.orange.amount.value, dyes.green.amount.value)
                        .add(dyes.purple.amount.value)
                        .gte(1) || upgrades.blueDyeUpg.bought.value
                ),
            display: {
                title: "Is Blue Dye just Water?",
                description: jsx(() => (
                    <>
                        Multiply Log gain by log<sub>10</sub>(Auto Cutting Amount)+1.
                    </>
                ))
            },
            requirements: createCostRequirement(() => ({
                cost: 1000,
                resource: dyes.blue.amount
            })),
            onPurchase() {
                dyes.blue.buyable.amount.value = 0;
            }
        })),
        redDyeUpg: createUpgrade(() => ({
            visibility: () =>
                showIf(
                    Decimal.add(dyes.orange.amount.value, dyes.green.amount.value)
                        .add(dyes.purple.amount.value)
                        .gte(10) || upgrades.redDyeUpg.bought.value
                ),
            display: {
                title: "Glistening Paint",
                description: jsx(() => (
                    <>
                        Multiply Ore Purity by log<sub>10</sub>(Cloth)+1.
                    </>
                ))
            },
            requirements: createCostRequirement(() => ({
                cost: 1500,
                resource: dyes.red.amount
            })),
            onPurchase() {
                dyes.red.buyable.amount.value = 0;
            }
        })),
        yellowDyeUpg: createUpgrade(() => ({
            visibility: () =>
                showIf(
                    Decimal.add(dyes.orange.amount.value, dyes.green.amount.value)
                        .add(dyes.purple.amount.value)
                        .gte(100) || upgrades.yellowDyeUpg.bought.value
                ),
            display: {
                title: "Wetter Dyes",
                description: "Double Red, Yellow, and Blue Dye gain."
            },
            requirements: createCostRequirement(() => ({
                cost: 2000,
                resource: dyes.yellow.amount
            }))
        })),
        yellowDyeUpg2: createUpgrade(() => ({
            visibility: () => showIf(upgrades.yellowDyeUpg.bought.value),
            display: {
                title: "Golden Wash",
                description: "Halve the Oil cost of Red, Yellow, and Blue Dyes."
            },
            requirements: createCostRequirement(() => ({
                cost: 5000,
                resource: dyes.yellow.amount
            })),
            onPurchase() {
                dyes.yellow.buyable.amount.value = 0;
            }
        })),
        redDyeUpg2: createUpgrade(() => ({
            visibility: () => showIf(upgrades.redDyeUpg.bought.value),
            display: {
                title: "De Louvre",
                description: jsx(() => (
                    <>
                        Multiply Smelting Speed by <Sqrt>Refineries+1</Sqrt>.
                    </>
                ))
            },
            requirements: createCostRequirement(() => ({
                cost: 6000,
                resource: dyes.red.amount
            })),
            onPurchase() {
                dyes.red.buyable.amount.value = 0;
            }
        })),
        blueDyeUpg2: createUpgrade(() => ({
            visibility: () => showIf(upgrades.blueDyeUpg.bought.value),
            display: {
                title: "Hydrophobia",
                description: "Raise Red Dye's effect ^1.5."
            },
            requirements: createCostRequirement(() => ({
                cost: 7500,
                resource: dyes.blue.amount
            })),
            onPurchase() {
                dyes.blue.buyable.amount.value = 0;
            }
        })),
        coalUpg: createUpgrade(() => ({
            visibility: () =>
                showIf(
                    upgrades.blueDyeUpg2.bought.value &&
                        upgrades.redDyeUpg2.bought.value &&
                        upgrades.yellowDyeUpg2.bought.value
                ),
            display: {
                title: "Denser Spectrum",
                description:
                    "Orange, Green, and Purple Dyes' first effect is raised ^1.2, and Green Dye's second effect is squared."
            },
            requirements: createCostRequirement(() => ({
                cost: "5e30",
                resource: coal.coal
            }))
        }))
    };

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

    const dyeSum = createResource<DecimalSource>(
        computed(() =>
            Object.values(dyes).reduce<DecimalSource>((a, c) => Decimal.add(a, c.amount.value), 0)
        ),
        "Sum of Dyes"
    );
    const secondaryDyeSum = computed(() =>
        [dyes.orange, dyes.green, dyes.purple].reduce(
            (acc, curr) => acc.add(curr.amount.value),
            new Decimal(0)
        )
    );

    const { total: totalDyeSum, trackerDisplay } = setUpDailyProgressTracker({
        resource: dyeSum,
        goal: 6e4,
        name,
        day,
        background: color,
        textColor: "var(--feature-foreground)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        },
        ignoreTotal: true
    });

    const mastery = {
        dyes: {
            red: {
                buyable: { amount: persistent<DecimalSource>(0) }
            },
            green: {
                buyable: { amount: persistent<DecimalSource>(0) }
            },
            blue: {
                buyable: { amount: persistent<DecimalSource>(0) }
            },
            yellow: {
                buyable: { amount: persistent<DecimalSource>(0) }
            },
            purple: {
                buyable: { amount: persistent<DecimalSource>(0) }
            },
            orange: {
                buyable: { amount: persistent<DecimalSource>(0) }
            }
        },
        upgrades: {
            blueDyeUpg: { bought: persistent<boolean>(false) },
            redDyeUpg: { bought: persistent<boolean>(false) },
            yellowDyeUpg: { bought: persistent<boolean>(false) },
            yellowDyeUpg2: { bought: persistent<boolean>(false) },
            redDyeUpg2: { bought: persistent<boolean>(false) },
            blueDyeUpg2: { bought: persistent<boolean>(false) },
            coalUpg: { bought: persistent<boolean>(false) }
        }
    };
    const mastered = persistent<boolean>(false);

    return {
        name,
        day,
        color,
        dyes,
        dyeSum,
        boosts,
        totalDyeSum,
        primaryDyes,
        secondaryDyeSum,
        minWidth: 700,
        generalTabCollapsed,
        upgrades,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                {masteryEffectActive.value ? (
                    <>
                        <div class="decoration-effect ribbon">
                            Decoration effect:
                            <br />
                            Each primary dye gains a second effect
                        </div>
                        <Spacer />
                    </>
                ) : null}
                <div style="width: 620px">
                    {renderRow(dyes.black.display, dyes.white.display)}
                    {renderRow(dyes.black.buyable, dyes.white.buyable)}
                    <Spacer />
                    {renderRow(dyes.red.display, dyes.yellow.display, dyes.blue.display)}
                    {renderRow(dyes.red.buyable, dyes.yellow.buyable, dyes.blue.buyable)}
                    <Spacer />
                    {renderRow(dyes.orange.display, dyes.green.display, dyes.purple.display)}
                    {renderRow(dyes.orange.buyable, dyes.green.buyable, dyes.purple.buyable)}
                </div>
                <Spacer />
                <div class="row" style="vertical-align: top">
                    {renderCol(upgrades.redDyeUpg, upgrades.redDyeUpg2)}
                    {renderCol(upgrades.yellowDyeUpg, upgrades.yellowDyeUpg2)}
                    {renderCol(upgrades.blueDyeUpg, upgrades.blueDyeUpg2)}
                </div>
                {render(upgrades.coalUpg)}
            </>
        )),
        mastery,
        mastered,
        masteryEffectActive
    };
});

export default layer;
