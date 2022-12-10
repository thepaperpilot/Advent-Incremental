/**
 * @module
 * @hidden
 */
import Modal from "components/Modal.vue";
import MainDisplay from "features/resources/MainDisplay.vue";
import Spacer from "components/layout/Spacer.vue";
import { BuyableOptions, GenericBuyable, createBuyable } from "features/buyable";
import { jsx, JSXFunction, Visibility } from "features/feature";
import { createResource, Resource } from "features/resources/resource";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { computed, ComputedRef, ref, Ref, unref } from "vue";
import trees from "./trees";
import oil from "./oil";
import { coerceComponent, render, renderCol, renderRow } from "util/vue";
import { setUpDailyProgressTracker, createCollapsibleModifierSections } from "data/common";
import { createAdditiveModifier, createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { WithRequired } from "util/common";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { createLazyProxy } from "util/proxies";
import coal from "./coal";

interface Dye {
    name: string,
    amount: Resource<DecimalSource>,
    buyable: GenericBuyable,
    toGenerate: WithRequired<Modifier, "description" | "revert">,
    computedToGenerate: ComputedRef<DecimalSource>,
    display: JSXFunction
}

type DyeUpg = "blueDyeUpg" | "redDyeUpg" | "yellowDyeUpg" | "yellowDyeUpg2" | "redDyeUpg2" | "blueDyeUpg2" | "coalUpg"

const id = "dyes";
const day = 11;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Dyes";
    const color = "#D4D4F4";

    function createDye(
        optionsFunc: () => { 
            name: string; 
            color: string; 
            costs: { 
                base: Ref<DecimalSource> | DecimalSource; 
                root?: Ref<DecimalSource> | DecimalSource, 
                res: Resource<DecimalSource>
            }[]; 
            listedBoosts: { 
                visible: Ref<boolean> | boolean, 
                desc: Ref<string> 
            }[];
            dyesToReset: {
                name: string,
                reset: VoidFunction
            }[]
        } & Partial<BuyableOptions>
    ): Dye {
        return createLazyProxy(() => {
            const options = optionsFunc();

            const amount = createResource<DecimalSource>(0, optionsFunc().name);
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
                    enabled: () => upgrades.yellowDyeUpg.bought.value && options.color == "red" || options.color == "yellow" || options.color == "blue"
                }))
            ]) as WithRequired<Modifier, "description" | "revert">;
            const computedToGenerate = computed(() => toGenerate.apply(0));
    
            const buyable: GenericBuyable = createBuyable(() => ({
                ...options,
                style: () => ({ backgroundColor: unref(buyable.canPurchase) ? color : "#545454", minWidth: "200px" }),
                display: jsx(() => {
                    return (
                        <span>
                            <h3>{options.name} Chambers</h3>
                            <br/>
                            Create {format(computedToGenerate.value)} {options.name}{options.dyesToReset.length > 0 ? ", but reset " + options.dyesToReset.map(dye => dye.name).join(", ") : ""}.
                            <br/>
                            <span class="white-space: pre-wrap">
                                Currently: {options.listedBoosts.filter(b => unref(b.visible)).map(b => render(jsx(() => <div>{unref(b.desc)}</div>)))}
                            </span>
                            <div>
                                Cost: {options.costs.map(c => render(jsx(() => 
                                    <div>
                                        {format(unref(Decimal.pow(unref(buyable.cost) ?? Decimal.dInf, unref(c.root ?? 1)).times(unref(c.base))))}
                                        {" "}{c.res.displayName}<br/>
                                    </div>)))}
                            </div>
                        </span>
                    );
                }),
                cost() {
                    let v = buyable.amount.value;
                    if (Decimal.gte(v, 25)) v = Decimal.pow(v, 2).div(20) // intentional price jump #2
                    if (Decimal.gte(v, 10)) v = Decimal.pow(v, 2).div(5); // intentional price jump
                    return Decimal.div(v, 10).plus(1);
                },
                canPurchase: computed((cost?: DecimalSource) => {
                    if (unref(buyable.visibility) != Visibility.Visible) return false;
                    const trueCost = cost ?? unref(buyable.cost) ?? Decimal.dInf;
                    return options.costs.every(c => Decimal.div(c.res.value, unref(c.base)).root(unref(c.root ?? 1)).gte(trueCost));
                }),
                onPurchase(cost?: DecimalSource) {
                    const trueCost = cost ?? unref(buyable.cost) ?? Decimal.dInf;
                    options.costs.forEach(c => {
                        c.res.value = Decimal.sub(c.res.value, Decimal.pow(trueCost, unref(c.root ?? 1)).times(unref(c.base)));
                    });
    
                    amount.value = Decimal.add(amount.value, computedToGenerate.value);
                    buyable.amount.value = Decimal.add(buyable.amount.value, 1);
                    
                    options.dyesToReset.forEach(dye => dye.reset());
                }
            }));

            return {
                name: options.name,
                amount,
                buyable,
                toGenerate,
                computedToGenerate,
                display: jsx(() => (
                    <div class="col" style="max-width: 200px">
                        <MainDisplay resource={amount} color={options.color} style="margin-bottom: 0" />
                        <Spacer />
                        {render(buyable)}
                    </div>
                ))
            }
        })
    }

    const dyes: Record<"red" | "yellow" | "blue" | "orange" | "green" | "purple", Dye> = {
        red: createDye(() => ({
            name: "Red Dye",
            color: "red",
            costs: [
                {
                    base: '2e18',
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => upgrades.yellowDyeUpg2.bought.value ? '2.5e5' : '5e5'),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `Increase effective Oil Pumps by ${format(boosts.red1.value)} (does not impact coal consumption)`)
                }
            ],
            dyesToReset: [],
        })),
        yellow: createDye(() => ({
            name: "Yellow Dye",
            color: "yellow",
            costs: [
                {
                    base: '1e18',
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => upgrades.yellowDyeUpg2.bought.value ? '5e5' : '1e6'),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `Multiply Paper \& Plastic gain by ${format(boosts.yellow1.value)}`)
                }
            ],
            dyesToReset: [],
        })),
        blue: createDye(() => ({
            name: "Blue Dye",
            color: "blue",
            costs: [
                {
                    base: '5e17',
                    root: 5,
                    res: trees.logs
                },
                {
                    base: computed(() => upgrades.yellowDyeUpg2.bought.value ? '1e6' : '2e6'),
                    root: 2,
                    res: oil.oil
                }
            ],
            listedBoosts: [
                {
                    visible: true,
                    desc: computed(() => `Add ${formatWhole(boosts.blue1.value)} trees to the forest (after all other modifiers).`)
                }
            ],
            dyesToReset: [],
        })),
        orange: createDye(() => ({
            name: "Orange Dye",
            color: "orange",
            costs: [
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
                    desc: computed(() => `Multiply Red and Yellow Dye gain by ${format(boosts.orange1.value)}`)
                },
                {
                    visible: true,
                    desc: computed(() => `Divide Box buyable costs by ${format(boosts.orange2.value)}.`)
                }
            ],
            dyesToReset: [{
                name: "Red Dye",
                reset() {
                    dyes.red.amount.value = 0;
                    dyes.red.buyable.amount.value = 0;
                }
            }, {
                name: "Yellow Dye",
                reset() {
                    dyes.yellow.amount.value = 0;
                    dyes.yellow.buyable.amount.value = 0;
                }
            }],
        })),
        green: createDye(() => ({
            name: "Green Dye",
            color: "green",
            costs: [
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
                    desc: computed(() => `Multiply Yellow and Blue Dye gain by ${format(boosts.green1.value)}`)
                },
                {
                    visible: true,
                    desc: computed(() => `Kiln synergy to Coal and Ash gain is ${formatWhole(Decimal.sub(boosts.green2.value, 1).times(100))}% stronger.`)
                }
            ],
            dyesToReset: [{
                name: "Yellow Dye",
                reset() {
                    dyes.yellow.amount.value = 0;
                    dyes.yellow.buyable.amount.value = 0;
                }
            },{
                name: "Blue Dye",
                reset() {
                    dyes.blue.amount.value = 0;
                    dyes.blue.buyable.amount.value = 0;
                }
            }],
        })),
        purple: createDye(() => ({
            name: "Purple Dye",
            color: "purple",
            costs: [
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
                    desc: computed(() => `Multiply Red and Blue Dye gain by ${format(boosts.purple1.value)}`)
                },
                {
                    visible: true,
                    desc: computed(() => `Multiply Smelting Speed and Ore Purity by ${format(boosts.purple2.value)}`)
                }
            ],
            dyesToReset: [{
                name: "Blue Dye",
                reset() {
                    dyes.blue.amount.value = 0;
                    dyes.blue.buyable.amount.value = 0;
                }
            }, {
                name: "Red Dye",
                reset() {
                    dyes.red.amount.value = 0;
                    dyes.red.buyable.amount.value = 0;
                }
            }],
        }))
    };

    const boosts = {
        red1: computed(() => Decimal.pow(Decimal.add(dyes.red.amount.value, 1).log2().plus(1).log2().div(2), upgrades.blueDyeUpg2.bought.value ? 1.5 : 1)),
        yellow1: computed(() => Decimal.add(dyes.yellow.amount.value, 1).log2().plus(1)),
        blue1: computed(() => Decimal.add(dyes.blue.amount.value, 1).log2().sqrt().times(5e6)),

        orange1: computed(() => Decimal.pow(2, Decimal.add(dyes.orange.amount.value, 1).log2().sqrt()).pow(upgrades.coalUpg.bought.value ? 1.2 : 1)),
        orange2: computed(() => Decimal.add(dyes.orange.amount.value, 1).log2().plus(1)),
        green1: computed(() => Decimal.pow(2, Decimal.add(dyes.green.amount.value, 1).log2().sqrt()).pow(upgrades.coalUpg.bought.value ? 1.2 : 1)),
        green2: computed(() => Decimal.add(dyes.green.amount.value, 1).log2().plus(1).pow(upgrades.coalUpg.bought.value ? 2 : 1)),
        purple1: computed(() => Decimal.pow(2, Decimal.add(dyes.purple.amount.value, 1).log2().sqrt()).pow(upgrades.coalUpg.bought.value ? 1.2 : 1)),
        purple2: computed(() => Decimal.add(dyes.purple.amount.value, 1).log2().plus(1)),
    }

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
            visibility: () => (Decimal.add(dyes.orange.amount.value, dyes.green.amount.value).add(dyes.purple.amount.value).gte(1) || upgrades.blueDyeUpg.bought.value) ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Is Blue Dye just Water?",
                description: "Multiply Log gain by log(Auto Cutting Amount)+1."
            },
            cost: 1000,
            resource: dyes.blue.amount,
            onPurchase() {
                dyes.blue.amount.value = 0;
                dyes.blue.buyable.amount.value = 0;
            }
        })),
        redDyeUpg: createUpgrade(() => ({
            visibility: () => (Decimal.add(dyes.orange.amount.value, dyes.green.amount.value).add(dyes.purple.amount.value).gte(10) || upgrades.redDyeUpg.bought.value) ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Glistening Paint",
                description: "Multiply Ore Purity by log(Cloth)+1."
            },
            cost: 1500,
            resource: dyes.red.amount,
            onPurchase() {
                dyes.red.amount.value = 0;
                dyes.red.buyable.amount.value = 0;
            }
        })),
        yellowDyeUpg: createUpgrade(() => ({
            visibility: () => (Decimal.add(dyes.orange.amount.value, dyes.green.amount.value).add(dyes.purple.amount.value).gte(100) || upgrades.yellowDyeUpg.bought.value) ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Wetter Dyes",
                description: "Double Red, Yellow, and Blue Dye gain, but reset their amounts."
            },
            cost: 2000,
            resource: dyes.yellow.amount,
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
            visibility: () => upgrades.yellowDyeUpg.bought.value ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Golden Wash",
                description: "Halve the Oil cost of Red, Yellow, and Blue Dyes."
            },
            cost: 5000,
            resource: dyes.yellow.amount,
            onPurchase() {
                dyes.yellow.amount.value = 0;
                dyes.yellow.buyable.amount.value = 0;
            }
        })),
        redDyeUpg2: createUpgrade(() => ({
            visibility: () => upgrades.redDyeUpg.bought.value ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "De Louvre",
                description: "Multiply Smelting Speed by sqrt(Refineries+1)"
            },
            cost: 6000,
            resource: dyes.red.amount,
            onPurchase() {
                dyes.red.amount.value = 0;
                dyes.red.buyable.amount.value = 0;
            }
        })),
        blueDyeUpg2: createUpgrade(() => ({
            visibility: () => upgrades.blueDyeUpg.bought.value ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Hydrophobia",
                description: "Raise Red Dye's effect ^1.5."
            },
            cost: 7500,
            resource: dyes.blue.amount,
            onPurchase() {
                dyes.blue.amount.value = 0;
                dyes.blue.buyable.amount.value = 0;
            }
        })),
        coalUpg: createUpgrade(() => ({
            visibility: () => (upgrades.blueDyeUpg2.bought.value && upgrades.redDyeUpg2.bought.value && upgrades.yellowDyeUpg2.bought.value) ? Visibility.Visible : Visibility.Hidden,
            display: {
                title: "Denser Spectrum",
                description: "Orange, Green, and Purple Dyes' first effect is raised ^1.2, and Green Dye's second effect is squared."
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
    }

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

    const dyeSum = createResource<DecimalSource>(computed(() => Object.values(dyes).reduce<DecimalSource>((a,c) => Decimal.add(a, c.amount.value), 0)), "Sum of Dyes");

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
                {renderRow(dyes.red.display, dyes.yellow.display, dyes.blue.display)}
                <Spacer />
                {renderRow(dyes.orange.display, dyes.green.display, dyes.purple.display)}
                <Spacer />
                {renderRow(upgrades.redDyeUpg, upgrades.yellowDyeUpg, upgrades.blueDyeUpg)}
                {renderRow(upgrades.redDyeUpg2, upgrades.yellowDyeUpg2, upgrades.blueDyeUpg2)}
                {render(upgrades.coalUpg)}
            </>
        ))
    }
});

export default layer;