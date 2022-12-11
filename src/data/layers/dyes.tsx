/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Sqrt from "components/math/Sqrt.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { BuyableOptions, createBuyable, GenericBuyable } from "features/buyable";
import { jsx, JSXFunction, showIf, Visibility } from "features/feature";
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
import { NonPersistent, noPersist, Persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { Computable, convertComputable } from "util/computed";
import { render, renderCol, renderRow } from "util/vue";
import { computed, ComputedRef, ref, Ref, unref } from "vue";
import coal from "./coal";
import oil from "./oil";
import trees from "./trees";

interface Dye {
    name: string;
    amount: Resource<DecimalSource> &
        Persistent<DecimalSource> & { [NonPersistent]: Resource<DecimalSource> };
    buyable: GenericBuyable;
    toGenerate: WithRequired<Modifier, "description" | "revert">;
    computedToGenerate: ComputedRef<DecimalSource>;
    display: JSXFunction;
}

type DyeUpg =
    | "blueDyeUpg"
    | "redDyeUpg"
    | "yellowDyeUpg"
    | "yellowDyeUpg2"
    | "redDyeUpg2"
    | "blueDyeUpg2"
    | "coalUpg";

const id = "dyes";
const day = 11;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Dyes";
    const color = "#D4D4F4";

    function createDye(
        options: {
            name: string;
            color: string;
            costs: Computable<
                {
                    base: Ref<DecimalSource> | DecimalSource;
                    root?: Ref<DecimalSource> | DecimalSource;
                    res: Resource<DecimalSource>;
                }[]
            >;
            listedBoosts: {
                visible: Ref<boolean> | boolean;
                desc: Ref<string>;
            }[];
            dyesToReset: {
                name: string;
                reset: VoidFunction;
            }[];
        } & Partial<BuyableOptions>
    ): Dye {
        const amount = createResource<DecimalSource>(0, options.name);

        const toGenerate = createSequentialModifier(() => [
            createAdditiveModifier(() => ({
                addend: () => Decimal.add(buyable.amount.value, 1),
                description: `${options.name} Chambers`
            })),
            createMultiplicativeModifier(() => ({
                multiplier: boosts.orange1,
                description: "Orange Dye Boost 1",
                enabled: options.color == "red" || options.color == "yellow"
            })),
            createMultiplicativeModifier(() => ({
                multiplier: boosts.green1,
                description: "Green Dye Boost 1",
                enabled: options.color == "yellow" || options.color == "blue"
            })),
            createMultiplicativeModifier(() => ({
                multiplier: boosts.purple1,
                description: "Purple Dye Boost 1",
                enabled: options.color == "red" || options.color == "blue"
            })),
            createMultiplicativeModifier(() => ({
                multiplier: 2,
                description: "Wetter Dyes",
                enabled: () =>
                    upgrades.yellowDyeUpg.bought.value &&
                    (options.color == "red" || options.color == "yellow" || options.color == "blue")
            }))
        ]) as WithRequired<Modifier, "description" | "revert">;
        const computedToGenerate = computed(() => toGenerate.apply(0));

        const buyable: GenericBuyable = createBuyable(() => {
            const costs = convertComputable(options.costs);
            return {
                ...options,
                style: () => ({
                    backgroundColor: unref(buyable.canPurchase) ? color : "#545454",
                    minWidth: "200px"
                }),
                display: jsx(() => {
                    return (
                        <span>
                            <h3>{options.name} Chambers</h3>
                            <br />
                            Create {format(computedToGenerate.value)} {options.name}
                            {options.dyesToReset.length > 0
                                ? ", but reset " +
                                  options.dyesToReset.map(dye => dye.name).join(", ")
                                : ""}
                            .
                            <br />
                            <br />
                            <span class="white-space: pre-wrap">
                                Currently:{" "}
                                {options.listedBoosts
                                    .filter(b => unref(b.visible))
                                    .map(b => render(jsx(() => <div>{unref(b.desc)}</div>)))}
                            </span>
                            <br />
                            <div>
                                Cost:{" "}
                                {unref(costs).map(c =>
                                    render(
                                        jsx(() => (
                                            <div>
                                                {format(
                                                    unref(
                                                        Decimal.pow(
                                                            unref(buyable.cost) ?? Decimal.dInf,
                                                            unref(c.root ?? 1)
                                                        ).times(unref(c.base))
                                                    )
                                                )}{" "}
                                                {c.res.displayName}
                                                <br />
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </span>
                    );
                }),
                cost() {
                    let v = buyable.amount.value;
                    if (Decimal.gte(v, 25)) v = Decimal.pow(v, 2).div(20); // intentional price jump #2
                    if (Decimal.gte(v, 10)) v = Decimal.pow(v, 2).div(5); // intentional price jump
                    return Decimal.div(v, 10).plus(1);
                },
                canPurchase: computed((cost?: DecimalSource) => {
                    if (unref(buyable.visibility) != Visibility.Visible) return false;
                    const trueCost = cost ?? unref(buyable.cost) ?? Decimal.dInf;
                    return unref(costs).every(c =>
                        Decimal.div(c.res.value, unref(c.base))
                            .root(unref(c.root ?? 1))
                            .gte(trueCost)
                    );
                }),
                onPurchase(cost?: DecimalSource) {
                    const trueCost = cost ?? unref(buyable.cost) ?? Decimal.dInf;
                    unref(costs).forEach(c => {
                        c.res.value = Decimal.sub(
                            c.res.value,
                            Decimal.pow(trueCost, unref(c.root ?? 1)).times(unref(c.base))
                        );
                    });

                    amount.value = Decimal.add(amount.value, computedToGenerate.value);
                    buyable.amount.value = Decimal.add(buyable.amount.value, 1);

                    options.dyesToReset.forEach(dye => dye.reset());
                }
            };
        });

        return {
            name: options.name,
            amount,
            buyable,
            toGenerate,
            computedToGenerate,
            display: jsx(() => (
                <MainDisplay
                    resource={amount}
                    color={options.color}
                    style="margin: 0; width: 200px; width: 180px; padding: 10px;"
                    sticky={false}
                />
            ))
        };
    }

    const dyes: Record<"red" | "yellow" | "blue" | "orange" | "green" | "purple", Dye> = {
        red: createDye({
            name: "Red Dye",
            color: "red",
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
                }
            ],
            dyesToReset: []
        }),
        yellow: createDye({
            name: "Yellow Dye",
            color: "yellow",
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
                }
            ],
            dyesToReset: []
        }),
        blue: createDye({
            name: "Blue Dye",
            color: "blue",
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
                            )} forest size (after all other modifiers).`
                    )
                }
            ],
            dyesToReset: []
        }),
        orange: createDye({
            name: "Orange Dye",
            color: "orange",
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
                        dyes.red.amount.value = 0;
                        dyes.red.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Yellow Dye",
                    reset() {
                        dyes.yellow.amount.value = 0;
                        dyes.yellow.buyable.amount.value = 0;
                    }
                }
            ]
        }),
        green: createDye({
            name: "Green Dye",
            color: "green",
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
                            `x${formatWhole(
                                Decimal.sub(boosts.green2.value, 1).times(100)
                            )}% Kiln synergy effect.`
                    )
                }
            ],
            dyesToReset: [
                {
                    name: "Yellow Dye",
                    reset() {
                        dyes.yellow.amount.value = 0;
                        dyes.yellow.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Blue Dye",
                    reset() {
                        dyes.blue.amount.value = 0;
                        dyes.blue.buyable.amount.value = 0;
                    }
                }
            ]
        }),
        purple: createDye({
            name: "Purple Dye",
            color: "purple",
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
                        dyes.blue.amount.value = 0;
                        dyes.blue.buyable.amount.value = 0;
                    }
                },
                {
                    name: "Red Dye",
                    reset() {
                        dyes.red.amount.value = 0;
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
        yellow1: computed(() => Decimal.add(dyes.yellow.amount.value, 1).log2().plus(1)),
        blue1: computed(() => Decimal.add(dyes.blue.amount.value, 1).log2().sqrt().times(5e6)),

        orange1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.orange.amount.value, 1).log2().sqrt()).pow(
                upgrades.coalUpg.bought.value ? 1.2 : 1
            )
        ),
        orange2: computed(() => Decimal.add(dyes.orange.amount.value, 1).log2().plus(1)),
        green1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.green.amount.value, 1).log2().sqrt()).pow(
                upgrades.coalUpg.bought.value ? 1.2 : 1
            )
        ),
        green2: computed(() =>
            Decimal.add(dyes.green.amount.value, 1)
                .log2()
                .plus(1)
                .pow(upgrades.coalUpg.bought.value ? 2 : 1)
        ),
        purple1: computed(() =>
            Decimal.pow(2, Decimal.add(dyes.purple.amount.value, 1).log2().sqrt()).pow(
                upgrades.coalUpg.bought.value ? 1.2 : 1
            )
        ),
        purple2: computed(() => Decimal.add(dyes.purple.amount.value, 1).log2().plus(1))
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
            cost: 1000,
            resource: noPersist(dyes.blue.amount),
            onPurchase() {
                dyes.blue.amount.value = 0;
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
            cost: 1500,
            resource: noPersist(dyes.red.amount),
            onPurchase() {
                dyes.red.amount.value = 0;
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
                description: "Double Red, Yellow, and Blue Dye gain, but reset their amounts."
            },
            cost: 2000,
            resource: noPersist(dyes.yellow.amount),
            onPurchase() {
                dyes.red.amount.value = 0;
                dyes.red.buyable.amount.value = 0;

                dyes.yellow.amount.value = 0;
                dyes.yellow.buyable.amount.value = 0;

                dyes.blue.amount.value = 0;
                dyes.blue.buyable.amount.value = 0;
            }
        })),
        yellowDyeUpg2: createUpgrade(() => ({
            visibility: () => showIf(upgrades.yellowDyeUpg.bought.value),
            display: {
                title: "Golden Wash",
                description: "Halve the Oil cost of Red, Yellow, and Blue Dyes."
            },
            cost: 5000,
            resource: noPersist(dyes.yellow.amount),
            onPurchase() {
                dyes.yellow.amount.value = 0;
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
            cost: 6000,
            resource: noPersist(dyes.red.amount),
            onPurchase() {
                dyes.red.amount.value = 0;
                dyes.red.buyable.amount.value = 0;
            }
        })),
        blueDyeUpg2: createUpgrade(() => ({
            visibility: () => showIf(upgrades.blueDyeUpg.bought.value),
            display: {
                title: "Hydrophobia",
                description: "Raise Red Dye's effect ^1.5."
            },
            cost: 7500,
            resource: noPersist(dyes.blue.amount),
            onPurchase() {
                dyes.blue.amount.value = 0;
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
                    "Orange, Green, and Purple Dyes' first effect is raised ^1.2, and Green Dye's second effect is squared. Buying this resets Red, Yellow, and Blue Dyes."
            },
            cost: "5e30",
            resource: coal.coal,
            onPurchase() {
                dyes.red.amount.value = 0;
                dyes.red.buyable.amount.value = 0;

                dyes.yellow.amount.value = 0;
                dyes.yellow.buyable.amount.value = 0;

                dyes.blue.amount.value = 0;
                dyes.blue.buyable.amount.value = 0;
            }
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

    const { total: totalDyeSum, trackerDisplay } = setUpDailyProgressTracker({
        resource: dyeSum,
        goal: 6e4,
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

    return {
        name,
        color,
        dyes,
        dyeSum,
        boosts,
        totalDyeSum,
        minWidth: 700,
        generalTabCollapsed,
        upgrades,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <div style="width: 620px">
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
        ))
    };
});

export default layer;
