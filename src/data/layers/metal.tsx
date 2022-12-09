import Spacer from "components/layout/Spacer.vue";
import MainDisplay from "features/resources/MainDisplay.vue";
import Toggle from "components/fields/Toggle.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { jsx, showIf } from "features/feature";
import { createResource, trackBest } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource } from "lib/break_eternity";
import { render, renderRow } from "util/vue";
import { persistent } from "game/persistence";
import { globalBus } from "game/events";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { computed, ref, unref } from "vue";
import { createBar } from "features/bars/bar";
import { Direction } from "util/common";
import { format, formatGain, formatLimit, formatWhole } from "util/break_eternity";
import { createClickable } from "features/clickables/clickable";
import coal from "./coal";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { noPersist } from "game/persistence";
import { createBuyable, GenericBuyable } from "features/buyable";
import { main } from "../projEntry";
import oil from "./oil";
import boxes from "./boxes";

const id = "metal";
const day = 7;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Metal";
    const color = "#888B8D";

    const metal = createResource<DecimalSource>(0, "metal ingots", undefined, true);
    const bestMetal = trackBest(metal);

    const ore = createResource<DecimalSource>(0, "ore");
    const bestOre = trackBest(ore);

    const orePurity = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 5,
            description: "Crucible",
            enabled: crucible.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.5,
            description: "Industrial Crucible",
            enabled: () => Decimal.gte(industrialCrucible.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Industrial Furnace",
            enabled: industrialFurnace.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(hotterForgeEffect.value, 1),
            description: "Hotter Forges",
            enabled: () => Decimal.gte(hotterForge.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry metal in boxes",
            enabled: boxes.row2Upgrades.metalUpgrade.bought
        }))
    ]);
    const computedOrePurity = computed(() => orePurity.apply(0.1));

    const autoSmeltSpeed = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(industrialCrucible.amount.value, 10),
            description: "Industrial Crucibles",
            enabled: () => Decimal.gte(industrialCrucible.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Efficient Crucibles",
            enabled: coal.efficientSmelther.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.mul(oil.activeSmelter.value, oil.oilEffectiveness.value).add(1),
            description: "Oil Smelter",
            enabled: () => Decimal.gt(oil.activeSmelter.value, 0)
        }))
    ]);
    const computedAutoSmeltSpeed = computed(() => autoSmeltSpeed.apply(0));
    const autoSmeltMulti = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 3,
            description: "Efficient Crucibles",
            enabled: coal.efficientSmelther.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.add(oil.activeBurner.value, 1).mul(oil.oilEffectiveness.value),
            description: "Blaster Burner",
            enabled: oil.row2Upgrades[2].bought
        }))
    ]);
    const computedAutoSmeltMulti = computed(() => autoSmeltMulti.apply(1));

    const coalCost = 1e10;
    const smeltableOre = computed(() =>
        Decimal.min(ore.value, Decimal.div(coal.coal.value, coalCost)).floor().max(0)
    );

    const smeltOreButton = createClickable(() => ({
        display: jsx(() => {
            const cost = Decimal.gte(smeltableOre.value, 1)
                ? smeltableOre.value
                : Decimal.add(smeltableOre.value, 1);
            return (
                <>
                    <span style="font-size: large">
                        Smelt {format(Decimal.times(smeltableOre.value, computedOrePurity.value))}{" "}
                        {metal.displayName}
                    </span>
                    <br />
                    <span style="font-size: large">
                        Cost: {formatWhole(cost)} {ore.displayName};{" "}
                        {formatWhole(Decimal.times(cost, coalCost))} {coal.coal.displayName}
                    </span>
                </>
            );
        }),
        canClick: () => Decimal.gte(smeltableOre.value, 1),
        onClick() {
            if (!unref(this.canClick)) return;

            smeltOre(smeltableOre.value);
        },
        style: {
            width: "600px",
            minHeight: "unset"
        }
    }));
    function smeltOre(amount: DecimalSource, multi: DecimalSource = 1) {
        const [metalGain, oreConsumption, coalConsumption] = [
            Decimal.times(amount, computedOrePurity.value).times(multi),
            amount,
            Decimal.times(amount, coalCost)
        ];
        metal.value = Decimal.add(metal.value, metalGain);
        ore.value = Decimal.sub(ore.value, oreConsumption);
        coal.coal.value = Decimal.sub(coal.coal.value, coalConsumption);
    }

    const oreAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => oreDrill.amount.value,
            description: "Mining Drills",
            enabled: () => Decimal.gte(oreDrill.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.mul(oil.depth.value, 0.05).add(1),
            description: "25m Well Depth",
            enabled: oil.depthMilestones[2].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: oil.extractorOre,
            description: "Heavy Extractor",
            enabled: () => Decimal.gt(oil.activeExtractor.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry ore in boxes",
            enabled: boxes.row2Upgrades.oreUpgrade.bought
        }))
    ]);
    const computedOreAmount = computed(() => oreAmount.apply(1));
    const oreSpeed = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "A Simple Pickaxe",
            enabled: simplePickaxe.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Double Pickaxe",
            enabled: doublePickaxe.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2.5,
            description: "Mining Drills",
            enabled: () => Decimal.gte(oreDrill.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Efficient Drills",
            enabled: efficientDrill.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Oil the Mining Drills",
            enabled: oil.row2Upgrades[1].bought
        }))
    ]);
    const computedOreSpeed = computed(() => oreSpeed.apply(Decimal.recip(maxOreProgress)));
    const oreProgress = persistent<DecimalSource>(0);
    const maxOreProgress = 10;
    const oreBar = createBar(() => ({
        width: 400,
        height: 25,
        direction: Direction.Right,
        fillStyle: { backgroundColor: color },
        progress: () => oreProgress.value
    }));

    const oreGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedOreAmount
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedOreSpeed
        }))
    ]);
    const computedOreGain = computed(() => oreGain.apply(0));
    const netOreGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedOreGain
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.negate(computedAutoSmeltSpeed.value),
            enabled: autoSmeltEnabled
        }))
    ]);
    const computedNetOreGain = computed(() => netOreGain.apply(0));

    const simplePickaxe = createUpgrade(() => ({
        resource: noPersist(metal),
        cost: 0.1,
        display: {
            title: "A Simple Pickaxe",
            description:
                "Make a simple pickaxe to help mine faster.<br/><br/>Halve the time to mine more ore"
        }
    }));
    const doublePickaxe = createUpgrade(() => ({
        resource: noPersist(metal),
        cost: 0.1,
        display: {
            title: "Double Pickaxe",
            description:
                "This is too slow. What if you swung two pickaxes at once?<br/><br/>Halve the time to mine ore, again"
        },
        visibility: () => showIf(doublePickaxe.bought.value)
    })) as GenericUpgrade;
    const crucible = createUpgrade(() => ({
        resource: noPersist(metal),
        cost: 1,
        display: {
            title: "Crucible",
            description:
                "Smelting this all by hand is rather painful, and a lot of the metal is left in the slag. A small crucible should help a lot!<br/><br/>Increase the metal extracted per ore by 5x"
        },
        visibility: () =>
            showIf(
                crucible.bought.value ||
                    Decimal.div(bestOre.value, computedOrePurity.value).plus(bestMetal.value).gte(1)
            )
    })) as GenericUpgrade;
    const coalDrill = createUpgrade(() => ({
        resource: noPersist(metal),
        cost: 0,
        display: {
            title: "Coal Drilling",
            description:
                "These mining drills are pretty powerful, mining more ore than you can actually smelt. Could be worth making some to mine coal instead"
        },
        visibility: () =>
            showIf(
                Decimal.gte(oreDrill.amount.value, 1) &&
                    (coalDrill.bought.value ||
                        main.days[7].opened.value ||
                        Decimal.lt(
                            coal.computedCoalGain.value,
                            Decimal.times(computedOreAmount.value, computedOreSpeed.value).times(
                                coalCost
                            )
                        ))
            ),
        onPurchase() {
            main.days[2].recentlyUpdated.value = true;
        }
    })) as GenericUpgrade;
    const industrialFurnace = createUpgrade(() => ({
        canAfford() {
            return Decimal.gte(metal.value, 50) && Decimal.gte(coal.coal.value, 1e11);
        },
        onPurchase() {
            metal.value = Decimal.sub(metal.value, 50);
            coal.coal.value = Decimal.sub(coal.coal.value, 1e11);
        },
        display: {
            title: "Industrial Furnace",
            description: `Moving smelting out of the open air and into a dedicated furnace should make efficiency even better. Double metal gained per ore
            <br/>
            <br/>
            Cost: 50 ${metal.displayName}<br/>${format(1e11)} ${coal.coal.displayName}`
        }
    }));
    const efficientDrill = createUpgrade(() => ({
        resource: noPersist(metal),
        cost: 100000,
        display: {
            title: "Efficient Drills",
            description: `Use metal and a bunch of R&D to make drilling stuff faster. Double coal and ore mining speed.`
        },
        visibility: () => showIf(oil.depthMilestones[4].earned.value)
    }));

    const oreDrill = createBuyable(() => ({
        resource: noPersist(metal),
        cost() {
            return Decimal.pow(1.15, this.amount.value).times(10);
        },
        display: {
            title: "Mining Drill",
            description: "An automated machine to help you mine more ore, faster",
            effectDisplay: jsx(() => (
                <>
                    Mine 2.5x faster. Increase ore mining amount by{" "}
                    {formatWhole(oreDrill.amount.value)} ore per operation
                </>
            ))
        },
        visibility: () =>
            showIf(
                Decimal.gte(oreDrill.amount.value, 1) ||
                    Decimal.div(bestOre.value, computedOrePurity.value)
                        .plus(bestMetal.value)
                        .gte(10)
            ),
        style: { width: "200px" }
    })) as GenericBuyable;
    const industrialCrucible = createBuyable(() => ({
        resource: noPersist(metal),
        cost() {
            return Decimal.pow(1.15, Decimal.times(this.amount.value, 10)).times(10);
        },
        display: {
            title: "Industrial Crucible",
            description: "A giant automated crucible furnace, letting you smelt ore faster",
            effectDisplay: jsx(() => (
                <>
                    Automatically smelts{" "}
                    {formatWhole(Decimal.times(industrialCrucible.amount.value, 10))} ore per second
                </>
            ))
        },
        visibility: () =>
            showIf(
                Decimal.gte(industrialCrucible.amount.value, 1) ||
                    Decimal.gte(oreDrill.amount.value, 4) ||
                    Decimal.gte(bestOre.value, 50)
            ),
        style: { width: "200px" }
    })) as GenericBuyable;
    const autoSmeltEnabled = persistent<boolean>(true);
    const hotterForge = createBuyable(() => ({
        resource: coal.coal,
        cost() {
            return Decimal.pow(10, this.amount.value).times(1e12);
        },
        display: {
            title: "Hotter Forges",
            description:
                "More coal makes the fires burn hotter, getting just a little more metal out of each bit of ore",
            effectDisplay: jsx(() => (
                <>
                    Gain {formatWhole(Decimal.times(hotterForgeEffect.value, 100))}% more metal per
                    ore
                </>
            ))
        },
        visibility: () =>
            showIf(Decimal.gte(hotterForge.amount.value, 1) || industrialFurnace.bought.value),
        style: { width: "200px" }
    })) as GenericBuyable;
    const hotterForgeEffect = computed(() => Decimal.times(hotterForge.amount.value, 0.25));

    globalBus.on("update", diff => {
        oreProgress.value = Decimal.times(diff, computedOreSpeed.value).plus(oreProgress.value);
        const oreGain = oreProgress.value.trunc();
        oreProgress.value = oreProgress.value.minus(oreGain);
        ore.value = Decimal.add(ore.value, Decimal.times(oreGain, computedOreAmount.value));

        if (autoSmeltEnabled.value) {
            smeltOre(
                Decimal.min(smeltableOre.value, Decimal.times(computedAutoSmeltSpeed.value, diff)),
                computedAutoSmeltMulti.value
            );
        }
    });

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Auto Smelt Speed",
            modifier: autoSmeltSpeed,
            base: 0,
            unit: "/s",
            visible() {
                return Decimal.gt(industrialCrucible.amount.value, 0);
            }
        },
        {
            title: "Auto Smelt Multiplier",
            modifier: autoSmeltMulti,
            base: 1,
            visible() {
                return Decimal.gt(computedAutoSmeltMulti.value, 1);
            }
        },
        {
            title: "Metal per Ore",
            modifier: orePurity,
            base: 0.1
        },
        {
            title: "Ore per Mining Operation",
            modifier: oreAmount,
            base: 1
        },
        {
            title: "Mining Speed",
            modifier: oreSpeed,
            base: 0.1,
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

    const { total: totalMetal, trackerDisplay } = setUpDailyProgressTracker({
        resource: metal,
        goal: 25000,
        name,
        day,
        color,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        day,
        color,
        ore,
        bestOre,
        oreProgress,
        metal,
        bestMetal,
        totalMetal,
        simplePickaxe,
        doublePickaxe,
        crucible,
        coalDrill,
        industrialFurnace,
        efficientDrill,
        oreDrill,
        industrialCrucible,
        autoSmeltEnabled,
        hotterForge,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay
                    resource={metal}
                    color={color}
                    style="margin-bottom: 0"
                    sticky={false}
                    productionDisplay={jsx(() => (
                        <>
                            {autoSmeltEnabled.value &&
                            Decimal.gte(industrialCrucible.amount.value, 1)
                                ? `+${formatLimit(
                                      [
                                          [computedAutoSmeltSpeed.value, "smelting speed"],
                                          [computedOreGain.value, "ore gain"],
                                          [
                                              Decimal.div(coal.computedCoalGain.value, coalCost),
                                              "coal gain"
                                          ]
                                      ],
                                      "/s",
                                      Decimal.mul(
                                          computedOrePurity.value,
                                          computedAutoSmeltMulti.value
                                      )
                                  )}`
                                : undefined}
                        </>
                    ))}
                />
                <Spacer />
                {render(smeltOreButton)}
                {Decimal.gte(industrialCrucible.amount.value, 1) ? (
                    <div style={{ width: "150px" }}>
                        <Toggle
                            title="Auto Smelt"
                            modelValue={autoSmeltEnabled.value}
                            onUpdate:modelValue={(value: boolean) =>
                                (autoSmeltEnabled.value = value)
                            }
                        />
                    </div>
                ) : undefined}
                <Spacer />
                <MainDisplay
                    resource={ore}
                    color={color}
                    style="margin-bottom: 0"
                    sticky={false}
                    productionDisplay={jsx(() => (
                        <>{formatGain(computedNetOreGain.value)}</>
                    ))}
                />
                <Spacer />
                <div>
                    Currently mining {format(computedOreAmount.value)} ore every{" "}
                    {format(Decimal.recip(computedOreSpeed.value))} seconds
                </div>
                {render(oreBar)}
                <Spacer />
                {renderRow(
                    simplePickaxe,
                    doublePickaxe,
                    crucible,
                    coalDrill,
                    industrialFurnace,
                    efficientDrill
                )}
                {renderRow(oreDrill, industrialCrucible, hotterForge)}
            </>
        ))
    };
});

export default layer;
