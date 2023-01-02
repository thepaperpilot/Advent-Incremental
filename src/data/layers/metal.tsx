import Toggle from "components/fields/Toggle.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { createBar } from "features/bars/bar";
import { createBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource, trackBest } from "features/resources/resource";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource } from "lib/break_eternity";
import { format, formatGain, formatLimit, formatWhole } from "util/break_eternity";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ref, unref } from "vue";
import { main } from "../projEntry";
import boxes from "./boxes";
import cloth from "./cloth";
import coal from "./coal";
import dyes from "./dyes";
import { ElfBuyable } from "./elves";
import letters from "./letters";
import management from "./management";
import oil from "./oil";
import paper from "./paper";
import plastic from "./plastic";
import workshop from "./workshop";
import wrappingPaper from "./wrapping-paper";
import toys from "./toys";
import reindeer from "./reindeer";
import sleigh from "./sleigh";
import factory from "./factory";
import routing from "./routing";
import packing from "./packing";
import { createCostRequirement } from "game/requirements";

const id = "metal";
const day = 7;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Metal";
    const color = "#888B8D";

    const metal = createResource<DecimalSource>(0, "metal ingots", undefined, true);
    const bestMetal = trackBest(metal);

    const ore = createResource<DecimalSource>(0, "ore");
    const bestOre = trackBest(ore);

    const lastOreGained = ref<DecimalSource>(0);
    const lastOreSmelted = ref<DecimalSource>(0);

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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: dyes.boosts.purple2,
            description: "Purple Dye Boost 2",
            enabled: () => Decimal.gte(dyes.dyes.purple.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(cloth.cloth.value, 1).log10().plus(1),
            description: "Glistening Paint",
            enabled: dyes.upgrades.redDyeUpg.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.div(workshop.foundationProgress.value, 10).floor().div(10).add(1),
            description: "400% Foundation Completed",
            enabled: workshop.milestones.extraExpansionMilestone2.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(oil.buildHeavy.amount.value, 1).sqrt(),
            description: "Joy Level 4",
            enabled: management.elfTraining.smallfireElfTraining.milestones[3].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(management.schools.amount.value, 1),
            description: "Twinkle Level 1",
            enabled: management.elfTraining.metalElfTraining.milestones[0].earned
        })),
        reindeer.reindeer.comet.modifier,
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Object.values(factory.components).reduce(
                    (x, y) => y + (x.type == "metal" ? 1 : 0),
                    1
                ) as number,
            description: "300,000 Cities Solved",
            enabled: routing.metaMilestones[4].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Mary Level 2",
            enabled: management.elfTraining.heatedPlanterElfTraining.milestones[1].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.2,
            description: "100% Sleigh Fixed",
            enabled: sleigh.milestones.milestone8.earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.5,
            description: "69,200 Presents Packed",
            enabled: packing.packingMilestones.metalBoost.earned
        }))
    ]);
    const computedOrePurity = computed(() => orePurity.apply(0.1));

    const autoSmeltSpeed = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(industrialCrucible.amount.value, 10),
            description: "Industrial Crucibles",
            enabled: () => Decimal.gte(industrialCrucible.amount.value, 1)
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Joy Level 5",
            enabled: management.elfTraining.smallfireElfTraining.milestones[4].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Faith Level 5",
            enabled: management.elfTraining.bonfireElfTraining.milestones[4].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Snowball Level 5",
            enabled: management.elfTraining.kilnElfTraining.milestones[4].earned
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: dyes.boosts.purple2,
            description: "Purple Dye Boost 2",
            enabled: () => Decimal.gte(dyes.dyes.purple.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(plastic.activeRefinery.value, 1).sqrt(),
            description: "De Louvre",
            enabled: dyes.upgrades.redDyeUpg2.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(management.totalElfExp.value, 1e6).add(1).sqrt(),
            description: "Mary Level 5",
            enabled: management.elfTraining.heatedPlanterElfTraining.milestones[4].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.pow(1.25, management.elfTraining.metalElfTraining.level.value),
            description: "Twinkle Level 2",
            enabled: management.elfTraining.metalElfTraining.milestones[1].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.add(dyes.dyes.red.amount.value, dyes.dyes.blue.amount.value)
                    .add(dyes.dyes.yellow.amount.value)
                    .add(1)
                    .log10(),
            description: "The Ultimate Metal Dye",
            enabled: oil.row3Upgrades[4].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: wrappingPaper.boosts.jazzy1,
            description: "Jazzy Wrapping Paper",
            enabled: computed(() => Decimal.gt(wrappingPaper.boosts.jazzy1.value, 1))
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "30% Sleigh Fixed",
            enabled: sleigh.milestones.milestone4.earned
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.sub(lastOreGained.value, lastOreSmelted.value).max(0),
            description: "Metal Decoration",
            enabled: masteryEffectActive
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
                Decimal.add(oil.effectiveBurners.value, 1).mul(oil.oilEffectiveness.value),
            description: "Oil Burner",
            enabled: oil.row2Upgrades[2].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 3,
            description: "Twinkle Level 3",
            enabled: management.elfTraining.metalElfTraining.milestones[2].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(industrialCrucible.amount.value, 1).sqrt(),
            description: "100,000 Letters Processed",
            enabled: letters.milestones.industrialCrucibleMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(toys.clothes.value, 1),
            description: "Give elves clothes to wear",
            enabled: toys.row1Upgrades[1].bought
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
            description: "Metal Drills",
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(dyes.dyes.blue.amount.value, 1).sqrt(),
            description: "1000 Letters Processed",
            enabled: letters.milestones.miningMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "30% Sleigh Fixed",
            enabled: sleigh.milestones.milestone4.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(toys.clothes.value, 1),
            description: "Give elves clothes to wear",
            enabled: toys.row1Upgrades[1].bought
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
            description: "Metal Drills",
            enabled: () => Decimal.gte(oreDrill.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Efficient Drills",
            enabled: efficientDrill.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Oil the Metal Drills",
            enabled: oil.row2Upgrades[1].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.pow(
                    2,
                    Object.values(letters.milestones).filter(m => m.earned.value).length
                ),
            description: "100 Letters Processed",
            enabled: letters.milestones.autoSmeltingMilestone.earned
        })),
        createAdditiveModifier(() => ({
            addend: () =>
                Decimal.sub(lastOreSmelted.value, lastOreGained.value)
                    .max(0)
                    .div(computedOreAmount.value),
            description: "Metal Decoration",
            enabled: masteryEffectActive
        }))
    ]);
    const computedOreSpeed = computed(() => oreSpeed.apply(Decimal.recip(maxOreProgress)));
    const oreProgress = persistent<DecimalSource>(0);
    const maxOreProgress = 10;
    const oreBar = createBar(() => ({
        width: 400,
        height: 25,
        direction: Direction.Right,
        fillStyle: { backgroundColor: color, transitionDuration: "0s" },
        progress: () => oreProgress.value
    }));

    const oreGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedOreAmount
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedOreSpeed
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedOreSpeed,
            description: "1,670,000 Presents Packed",
            enabled: packing.packingMilestones.oreBoost.earned
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
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost: 0.1
        })),
        display: {
            title: "A Simple Pickaxe",
            description:
                "Make a simple pickaxe to help mine faster.<br/><br/>Halve the time to mine more ore"
        }
    }));
    const doublePickaxe = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost: 0.1
        })),
        display: {
            title: "Double Pickaxe",
            description:
                "This is too slow. What if you swung two pickaxes at once?<br/><br/>Halve the time to mine ore, again"
        },
        visibility: () => showIf(doublePickaxe.bought.value)
    })) as GenericUpgrade;
    const crucible = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost: 1
        })),
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
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost: 0
        })),
        display: {
            title: "Coal Drilling",
            description:
                "These metal drills are pretty powerful, mining more ore than you can actually smelt. Could be worth making some to mine coal instead"
        },
        visibility: () =>
            showIf(
                Decimal.gte(oreDrill.amount.value, 1) &&
                    (coalDrill.bought.value ||
                        (main.days[7].opened.value as boolean) ||
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
        requirements: [
            createCostRequirement(() => ({
                resource: noPersist(metal),
                cost: 50
            })),
            createCostRequirement(() => ({
                resource: coal.coal,
                cost: 1e11
            }))
        ],
        display: {
            title: "Industrial Furnace",
            description: `Moving smelting out of the open air and into a dedicated furnace should make efficiency even better. Double metal gained per ore`
        }
    }));
    const efficientDrill = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost: 100000
        })),
        display: {
            title: "Efficient Drills",
            description: `Use metal and a bunch of R&D to make drilling stuff faster. Double coal and ore mining speed.`
        },
        visibility: () => showIf(oil.depthMilestones[4].earned.value)
    }));

    const oreDrill = createBuyable(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost() {
                let v = new Decimal(oreDrill.amount.value);
                v = Decimal.pow(0.95, paper.books.metalBook.totalAmount.value).times(v);
                let cost = Decimal.pow(1.15, v).times(10);
                if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                    cost = Decimal.div(cost, Decimal.add(oil.depth.value, 1).sqrt());
                }
                if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                    cost = Decimal.div(cost, 10);
                }
                return cost;
            }
        })),
        resource: noPersist(metal),
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                x = Decimal.mul(x, 10);
            }
            if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                x = Decimal.mul(x, Decimal.add(oil.depth.value, 1).sqrt());
            }
            let v = Decimal.div(x, 10).log(1.15);
            v = v.div(Decimal.pow(0.95, paper.books.metalBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Metal Drill",
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
    })) as ElfBuyable;
    const industrialCrucible = createBuyable(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(metal),
            cost() {
                let v = new Decimal(industrialCrucible.amount.value);
                v = Decimal.pow(0.95, paper.books.metalBook.totalAmount.value).times(v);
                let cost = Decimal.pow(1.15, Decimal.times(v, 10)).times(10);
                if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                    cost = Decimal.div(cost, Decimal.add(oil.depth.value, 1).sqrt());
                }
                if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                    cost = Decimal.div(cost, 10);
                }
                return cost;
            }
        })),
        resource: noPersist(metal),
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                x = Decimal.mul(x, 10);
            }
            if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                x = Decimal.mul(x, Decimal.add(oil.depth.value, 1).sqrt());
            }
            let v = Decimal.div(x, 10).log(1.15).div(10);
            v = v.div(Decimal.pow(0.95, paper.books.metalBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
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
    })) as ElfBuyable;
    const autoSmeltEnabled = persistent<boolean>(true);
    const hotterForge = createBuyable(() => ({
        requirements: createCostRequirement(() => ({
            resource: coal.coal,
            cost() {
                let v = new Decimal(hotterForge.amount.value);
                v = Decimal.pow(0.95, paper.books.metalBook.totalAmount.value).times(v);
                let cost = Decimal.pow(10, v).times(1e12);
                if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                    cost = Decimal.div(cost, Decimal.add(oil.depth.value, 1).sqrt());
                }
                if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                    cost = Decimal.div(cost, 10);
                }
                return cost;
            }
        })),
        resource: coal.coal,
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.metalElfTraining.milestones[3].earned.value) {
                x = Decimal.mul(x, 10);
            }
            if (management.elfTraining.metalElfTraining.milestones[4].earned.value) {
                x = Decimal.mul(x, Decimal.add(oil.depth.value, 1).sqrt());
            }
            let v = Decimal.div(x, 1e12).log(10);
            v = v.div(Decimal.pow(0.95, paper.books.metalBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
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
    })) as ElfBuyable;
    const hotterForgeEffect = computed(() => Decimal.times(hotterForge.amount.value, 0.25));

    globalBus.on("update", diff => {
        if (
            Decimal.lt(main.day.value, day) ||
            (main.isMastery.value &&
                !mastered.value &&
                main.currentlyMastering.value?.name !== name)
        ) {
            return;
        }

        const oreGained = Decimal.sub(
            Decimal.times(computedOreSpeed.value, computedOreAmount.value),
            Decimal.sub(lastOreSmelted.value, lastOreGained.value).max(0)
        );
        const oreSmelted = Decimal.sub(
            computedAutoSmeltSpeed.value,
            Decimal.sub(lastOreGained.value, lastOreSmelted.value).max(0)
        );
        lastOreGained.value = Decimal.isNaN(oreGained) ? 0 : oreGained;
        lastOreSmelted.value = Decimal.isNaN(oreSmelted) ? 0 : oreSmelted;

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
                return Decimal.gt(industrialCrucible.amount.value, 0) || masteryEffectActive.value;
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
        background: color,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    const mastery = {
        ore: persistent<DecimalSource>(0),
        bestOre: persistent<DecimalSource>(0),
        oreProgress: persistent<DecimalSource>(0),
        metal: persistent<DecimalSource>(0),
        bestMetal: persistent<DecimalSource>(0),
        totalMetal: persistent<DecimalSource>(0),
        simplePickaxe: { bought: persistent<boolean>(false) },
        doublePickaxe: { bought: persistent<boolean>(false) },
        crucible: { bought: persistent<boolean>(false) },
        coalDrill: { bought: persistent<boolean>(false) },
        industrialFurnace: { bought: persistent<boolean>(false) },
        efficientDrill: { bought: persistent<boolean>(false) },
        oreDrill: { amount: persistent<DecimalSource>(0) },
        industrialCrucible: { amount: persistent<DecimalSource>(0) },
        hotterForge: { amount: persistent<DecimalSource>(0) }
    };
    const mastered = persistent<boolean>(false);
    const masteryEffectActive = computed(
        () => mastered.value || main.currentlyMastering.value?.name === name
    );

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
                {masteryEffectActive.value ? (
                    <>
                        <div class="decoration-effect">
                            Decoration effect:
                            <br />
                            The lesser of ore mining amount x speed and auto smelting speed is
                            increased to match the greater, and Twinkle buys max
                        </div>
                        <Spacer />
                    </>
                ) : null}
                <MainDisplay
                    resource={metal}
                    color={color}
                    style="margin-bottom: 0"
                    sticky={false}
                    productionDisplay={jsx(() => (
                        <>
                            {autoSmeltEnabled.value &&
                            (Decimal.gte(industrialCrucible.amount.value, 1) ||
                                masteryEffectActive.value)
                                ? masteryEffectActive.value
                                    ? formatGain(
                                          Decimal.mul(
                                              computedOrePurity.value,
                                              computedOrePurity.value
                                          ).mul(computedAutoSmeltSpeed.value)
                                      )
                                    : `+${formatLimit(
                                          [
                                              [computedAutoSmeltSpeed.value, "smelting speed"],
                                              [computedOreGain.value, "ore gain"],
                                              [
                                                  Decimal.div(
                                                      coal.computedCoalGain.value,
                                                      coalCost
                                                  ),
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
                {Decimal.gte(industrialCrucible.amount.value, 1) || masteryEffectActive.value ? (
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
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {format(metal.value)} {metal.displayName}
                </span>
            </div>
        )),
        mastery,
        mastered,
        masteryEffectActive
    };
});

export default layer;
