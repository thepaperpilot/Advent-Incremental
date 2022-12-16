import Modal from "components/Modal.vue";
import Spacer from "components/layout/Spacer.vue";
import Row from "components/layout/Row.vue";
import Column from "components/layout/Column.vue";
import MainDisplay from "features/resources/MainDisplay.vue";
import Sqrt from "components/math/Sqrt.vue";

import {
    createCollapsibleModifierSections,
    createCollapsibleMilestones,
    setUpDailyProgressTracker,
    changeActiveBuyables
} from "data/common";
import { jsx, showIf } from "features/feature";
import { createResource, Resource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource } from "lib/break_eternity";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ComputedRef, ref, unref } from "vue";
import { noPersist, persistent } from "game/persistence";
import { createBuyable, GenericBuyable } from "features/buyable";
import { format, formatWhole } from "util/break_eternity";
import metal from "./metal";
import {
    createSequentialModifier,
    createAdditiveModifier,
    createMultiplicativeModifier,
    Modifier
} from "game/modifiers";
import { main } from "data/projEntry";
import { globalBus } from "game/events";
import coal from "./coal";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import { formatGain, formatSmall } from "util/bignum";
import plastic from "./plastic";
import paper from "./paper";
import dyes from "./dyes";
import management from "./management";
import workshop from "./workshop";
import { WithRequired } from "util/common";
import { ElfBuyable } from "./elves";

const id = "oil";
const day = 9;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Oil";
    const color = "#000000";
    const colorText = "var(--foreground)";

    const oil = createResource<DecimalSource>(0, "oil");
    const depth = createResource<DecimalSource>(0, "depth");
    const drillProgress = persistent<DecimalSource>(0);
    const drillProgressReq = computed(() =>
        Decimal.lt(depth.value, 990)
            ? Decimal.add(10, depth.value)
            : Decimal.pow(1.001, Decimal.sub(depth.value, 990)).mul(1000)
    );

    function checkDrillProgress() {
        if (Decimal.lt(depth.value, 990)) {
            const amt = Decimal.min(
                Decimal.affordArithmeticSeries(drillProgress.value, 10, 1, depth.value),
                Decimal.sub(990, depth.value)
            );
            const cost = Decimal.sumArithmeticSeries(amt, 10, 1, depth.value);
            drillProgress.value = Decimal.sub(drillProgress.value, cost);
            depth.value = Decimal.add(depth.value, amt);
        }
        if (Decimal.gte(depth.value, 990)) {
            const amt = Decimal.affordGeometricSeries(
                drillProgress.value,
                1000,
                1.001,
                Decimal.sub(depth.value, 990)
            );
            const cost = Decimal.sumGeometricSeries(
                amt,
                1000,
                1.001,
                Decimal.sub(depth.value, 990)
            );
            drillProgress.value = Decimal.sub(drillProgress.value, cost);
            depth.value = Decimal.add(depth.value, amt);
        }
    }

    const activeHeavy = persistent<DecimalSource>(0);
    const heavyCoal = computed(() =>
        Decimal.times(
            Decimal.pow(activeHeavy.value, heavy2Power.value).pow(
                management.elfTraining.coalDrillElfTraining.milestones[0].earned.value ? 2.5 : 2
            ),
            1e14
        )
    );
    const heavyPower = computed(() =>
        Decimal.times(Decimal.pow(activeHeavy.value, heavy2Power.value), 1)
    );
    const buildHeavy = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 4).div(100 ** 3);
            v = Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value).times(v);
            return Decimal.pow(1.3, v).times(2.5e4);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 2.5e4).log(1.3);
            v = v.div(Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value));
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100 ** 3).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Heavy Drill</h3>
                <br />
                A large drill specialized at deep mining.
                <br />
                Consumes 1e14*(Heavy Drills amount)
                <sup>
                    {management.elfTraining.coalDrillElfTraining.milestones[0].earned.value
                        ? 2.5
                        : 2}
                </sup>{" "}
                coal/sec for (Heavy Drills amount) drill power.
                <br />
                <br />
                Currently:
                <br />-{format(heavyCoal.value)} coal/sec
                <br />+{format(heavyPower.value)} drill power
                <br />
                <br />
                Cost: {formatWhole(unref(buildHeavy.cost!))} {buildHeavy.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeHeavy.value = Decimal.add(activeHeavy.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };
    const {
        min: minHeavy,
        max: maxHeavy,
        add: addHeavy,
        remove: removeHeavy
    } = changeActiveBuyables({
        buyable: buildHeavy,
        active: activeHeavy
    });
    const activeHeavy2 = persistent<DecimalSource>(0);
    const heavy2Power = computed(() => {
        let power = Decimal.add(activeHeavy2.value, Math.E);
        if (management.elfTraining.heavyDrillElfTraining.milestones[3].earned.value) {
            power = power.log(2.5);
        } else {
            power = power.ln();
        }
        return power;
    });
    const buildHeavy2 = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 4).div(50 ** 3);
            v = Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value).times(v);
            return Decimal.pow(2, v).times(1e5);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 1e5).log(2);
            v = v.div(Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value));
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50 ** 3).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Heavy Drill Drill</h3>
                <br />
                Attach extra drills to Heavy Drills to make them faster
                <br />
                Raise amount of effective Heavy Drills by ^
                {management.elfTraining.heavyDrillElfTraining.milestones[3].earned.value ? (
                    <>
                        log<sub>2.5</sub>
                    </>
                ) : (
                    <>ln</>
                )}
                (Heavy Drill Drill amount + e).
                <br />
                (also affects coal consumption).
                <br />
                <br />
                Currently:
                <br />^{format(heavy2Power.value)} Heavy Drill amount
                <br />
                <br />
                Cost: {formatWhole(unref(buildHeavy2.cost!))} {buildHeavy2.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeHeavy2.value = Decimal.add(activeHeavy2.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };
    const {
        min: minHeavy2,
        max: maxHeavy2,
        add: addHeavy2,
        remove: removeHeavy2
    } = changeActiveBuyables({
        buyable: buildHeavy2,
        active: activeHeavy2
    });

    const activeExtractor = persistent<DecimalSource>(0);
    const extractorPower = computed(() => Decimal.pow(1 / 3, activeExtractor.value));
    const extractorCoal = computed(() => Decimal.pow(2, activeExtractor.value));
    const extractorOre = computed(() => Decimal.pow(1.2, activeExtractor.value));
    const buildExtractor = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 10)) v = Decimal.pow(v, 4).div(10 ** 3);
            v = Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value).times(v);
            return Decimal.pow(8, v).times(2e5);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 2e5).log(8);
            v = v.div(Decimal.pow(0.95, paper.books.heavyDrillBook.totalAmount.value));
            if (Decimal.gte(v, 10)) v = Decimal.mul(v, 10 ** 3).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Heavy Extractor</h3>
                <br />
                Attach extractors to the drill to mine coal and ore, but with a price.
                <br />
                Divides drill power by 3 to multiply coal gain by 2 and ore gain by 1.2.
                <br />
                <br />
                Currently:
                <br />×{formatSmall(extractorPower.value)} drill power
                <br />×{format(extractorCoal.value)} coal/sec
                <br />×{format(extractorOre.value)} ore/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildExtractor.cost!))}{" "}
                {buildExtractor.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeExtractor.value = Decimal.add(activeExtractor.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };
    const {
        min: minExtractor,
        max: maxExtractor,
        add: addExtractor,
        remove: removeExtractor
    } = changeActiveBuyables({
        buyable: buildExtractor,
        active: activeExtractor
    });

    const activePump = persistent<DecimalSource>(0);
    const pumpCoal = computed(() =>
        Decimal.pow(row2Upgrades[3].bought.value ? 4 : 5, activePump.value)
    );
    const pumpOil = computed(() =>
        Decimal.add(activePump.value, computedExtraOilPumps.value)
            .pow(2)
            .mul(activeHeavy.value)
            .mul(Decimal.add(activeHeavy2.value, 1))
            .mul(activeExtractor.value)
            .mul(
                Decimal.pow(
                    depth.value,
                    management.elfTraining.oilElfTraining.milestones[0].earned.value ? 1.2 : 1
                )
            )
            .div(1e5)
    );
    const buildPump = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 10)) v = Decimal.pow(v, 4).div(10 ** 3);
            v = Decimal.pow(0.95, paper.books.oilBook.totalAmount.value).times(v);
            let price = Decimal.pow(16, v).times(2e6);
            if (row2Upgrades[4].bought.value) {
                price = price.div(Decimal.add(totalOil.value, 1).root(6));
            }
            if (management.elfTraining.heavyDrillElfTraining.milestones[1].earned.value) {
                price = price.div(10);
            }
            return price;
        },
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.heavyDrillElfTraining.milestones[1].earned.value) {
                x = Decimal.mul(x, 10);
            }
            if (row2Upgrades[4].bought.value) {
                x = Decimal.mul(x, Decimal.add(totalOil.value, 1).root(6));
            }
            let v = Decimal.div(x, 2e6).log(16);
            v = v.div(Decimal.pow(0.95, paper.books.oilBook.totalAmount.value));
            if (Decimal.gte(v, 10)) v = Decimal.mul(v, 10 ** 3).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Oil Pump</h3>
                <br />
                Pump that oil from the ground.
                <br />
                Gain oil based on the number of Heavy buildings active and well depth, but coal
                usage is multiplied by {row2Upgrades[3].bought.value ? 4 : 5}×.
                <br />
                <br />
                Currently:
                <br />×{format(pumpCoal.value)} coal usage
                <br />+{format(pumpOil.value)} oil/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildPump.cost!))} {buildPump.resource!.displayName}
            </>
        )),
        onPurchase() {
            activePump.value = Decimal.add(activePump.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };
    const {
        max: maxPump,
        min: minPump,
        add: addPump,
        remove: removePump
    } = changeActiveBuyables({
        buyable: buildPump,
        active: activePump
    });

    const activeBurner = persistent<DecimalSource>(0);
    const effectiveBurners = computed(() => {
        let burners = activeBurner.value;
        if (management.elfTraining.heavyDrillElfTraining.milestones[2].earned.value) {
            burners = Decimal.pow(burners, 1.5);
        }
        return burners;
    });
    const burnerOil = computed(() => Decimal.pow(effectiveBurners.value, 2));
    const burnerCoal = computed(() => Decimal.pow(effectiveBurners.value, 3).mul(1e19));
    const burnerMetal = computed(() => Decimal.add(effectiveBurners.value, 1));
    const buildBurner = createBuyable(() => ({
        resource: noPersist(oil),
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 4).div(100 ** 3);
            v = Decimal.pow(0.95, paper.books.oilBook.totalAmount.value).times(v);
            return Decimal.pow(2, v).times(50);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 50).log(2);
            v = v.div(Decimal.pow(0.95, paper.books.oilBook.totalAmount.value));
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100 ** 3).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Oil Burner</h3>
                <br />
                Burn oil as fuel.
                <br />
                (Oil Burner Amount)<sup>2</sup> unit of oil can give 1e19*(Oil Burner Amount)
                <sup>3</sup> units of coal.
                <br />
                <br />
                Currently:
                <br />-{format(burnerOil.value)} oil/sec
                <br />-{format(burnerCoal.value)} coal consumption
                {row2Upgrades[2].bought.value ? (
                    <>
                        <br />×{format(burnerMetal.value)} to auto smelting multi
                    </>
                ) : (
                    ""
                )}
                <br />
                <br />
                Cost: {formatWhole(unref(buildBurner.cost!))} {buildBurner.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeBurner.value = Decimal.add(activeBurner.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };
    const {
        max: maxBurner,
        min: minBurner,
        add: addBurner,
        remove: removeBurner
    } = changeActiveBuyables({
        buyable: buildBurner,
        active: activeBurner
    });

    const activeSmelter = persistent<DecimalSource>(0);
    const smelterOil = computed(() => Decimal.pow(activeSmelter.value, 2).mul(100));
    const smelterMetal = computed(() => Decimal.add(activeSmelter.value, 1));
    const buildSmelter = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = new Decimal(this.amount.value);
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 1e4)) v = Decimal.pow(v, 2).div(1e4);
            v = Decimal.pow(0.95, paper.books.oilBook.totalAmount.value).times(v);
            let price = Decimal.pow(10, v).times(1e7);
            if (row2Upgrades[4].bought.value)
                price = price.div(Decimal.add(totalOil.value, 1).root(6));
            return price;
        },
        inverseCost(x: DecimalSource) {
            if (row2Upgrades[4].bought.value) {
                x = Decimal.mul(x, Decimal.add(totalOil.value, 1).root(6));
            }
            let v = Decimal.div(x, 1e7).log(10);
            v = v.div(Decimal.pow(0.95, paper.books.oilBook.totalAmount.value));
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(4);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Oil Smelter</h3>
                <br />
                Use oil as a crucible fuel.
                <br />
                Burn 100*(Oil Smelter amount)<sup>2</sup> oil to smelt +100% faster.
                <br />
                <br />
                Currently:
                <br />-{format(smelterOil.value)} oil/sec
                <br />×{format(smelterMetal.value)} smelting speed
                <br />
                <br />
                Cost: {formatWhole(unref(buildSmelter.cost!))} {buildSmelter.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeSmelter.value = Decimal.add(activeSmelter.value, 1);
        },
        style: {
            color: colorText,
            width: "160px",
            flexGrow: 1
        }
    })) as ElfBuyable & { resource: Resource };

    const {
        max: maxSmelter,
        min: minSmelter,
        add: addSmelter,
        remove: removeSmelter
    } = changeActiveBuyables({
        buyable: buildSmelter,
        active: activeSmelter
    });

    // --------------------------------------------------------------------------- Milestones

    const depthMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "5m Well Depth",
                effectDisplay:
                    "Gain 25% more coal for each metre of well depth (after the 3 elf milestone)."
            },
            shouldEarn: () => Decimal.gte(depth.value, 5)
        })),
        createMilestone(() => ({
            display: {
                requirement: "10m Well Depth",
                effectDisplay: "Drill too slow? Unlock some drill upgrades!"
            },
            shouldEarn: () => Decimal.gte(depth.value, 10),
            visibility: () => showIf(depthMilestones[0].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "25m Well Depth",
                effectDisplay: "Gain 5% more ore for each metre of well depth."
            },
            shouldEarn: () => Decimal.gte(depth.value, 25),
            visibility: () => showIf(depthMilestones[1].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "60m Well Depth",
                effectDisplay: "Drill still too slow? Try unlocking another drill!"
            },
            shouldEarn: () => Decimal.gte(depth.value, 60),
            visibility: () => showIf(depthMilestones[2].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "150m Well Depth",
                effectDisplay:
                    "It appears that coal and metal appear a lot more when you go this deep! Unlock an upgrade apiece for coal and metal!"
            },
            shouldEarn: () => Decimal.gte(depth.value, 150),
            visibility: () => showIf(depthMilestones[3].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "350m Well Depth",
                effectDisplay:
                    "There is even more coal and metal than you thought. Why don't you utilize your heavy drill to mine them? Unlock a new drill upgrade!"
            },
            shouldEarn: () => Decimal.gte(depth.value, 350),
            visibility: () => showIf(depthMilestones[4].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "1,000m Well Depth",
                effectDisplay:
                    "You've finally found oil! Maybe it's time to make those oil useful! Unfortunately extracting them would use more coal, and also it's becoming much harder to mine deeper due to the thermal heat and pressure."
            },
            shouldEarn: () => Decimal.gte(depth.value, 1000),
            visibility: () => showIf(Decimal.gte(depth.value, 1000))
        })),
        createMilestone(() => ({
            display: {
                requirement: "3,000m Well Depth",
                effectDisplay: "You found a large oil spot! Double oil gain!"
            },
            shouldEarn: () => Decimal.gte(depth.value, 3000),
            visibility: () => showIf(Decimal.gte(depth.value, 2000))
        }))
    ] as Record<number, GenericMilestone>;

    const { collapseMilestones: collapsedDepthMilestones, display: depthMilestonesDisplay } =
        createCollapsibleMilestones(depthMilestones);

    const oilMilestones = [
        createMilestone(() => ({
            display: {
                requirement: "100 total oil",
                effectDisplay:
                    "Hmm, these oil pumps are really expensive. Maybe you should find a way to solve this problem... maybe you can use oil as fuel instead of coal?"
            },
            shouldEarn: () => Decimal.gte(totalOil.value, 100)
        })),
        createMilestone(() => ({
            display: {
                requirement: "500 total oil",
                effectDisplay: "Unlocks oil upgrades! These can be bought with oil."
            },
            shouldEarn: () => Decimal.gte(totalOil.value, 500),
            visibility: () => showIf(oilMilestones[0].earned.value)
        })),
        createMilestone(() => ({
            display: {
                requirement: "10,000 total oil",
                effectDisplay:
                    "Wow, this is really bright when you burn it. Maybe it can be helpful to use them to smelt metal?"
            },
            shouldEarn: () => Decimal.gte(totalOil.value, 10000),
            visibility: () => showIf(oilMilestones[1].earned.value)
        }))
    ] as Record<number, GenericMilestone>;

    const { collapseMilestones: collapsedOilMilestones, display: oilMilestonesDisplay } =
        createCollapsibleMilestones(oilMilestones);

    // --------------------------------------------------------------------------- Upgrades

    const row1Upgrades: GenericUpgrade[] = [
        createUpgrade(() => ({
            resource: coal.coal,
            cost: 1e18,
            display: {
                title: "Coal Drill Synergy",
                description: "Increase drill power by +4% per Coal Drill owned.",
                effectDisplay: jsx(() => <>x{format(row1UpgradeEffects[0].value)}</>)
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: metal.metal,
            cost: 150000,
            display: {
                title: "Metal Drill Synergy",
                description: "Increase drill power by +4% per Metal Drill owned.",
                effectDisplay: jsx(() => <>x{format(row1UpgradeEffects[1].value)}</>)
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: coal.coal,
            cost: 1e20,
            display: {
                title: "Coal Drill Upgrade",
                description: "Increase drill power by +6% per OoM of coal owned.",
                effectDisplay: jsx(() => <>x{format(row1UpgradeEffects[2].value)}</>)
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: metal.metal,
            cost: 1500000,
            display: {
                title: "Metal Drill Upgrade",
                description: "Increase drill power by +10% per OoM of metal ingot owned.",
                effectDisplay: jsx(() => <>x{format(row1UpgradeEffects[3].value)}</>)
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 100,
            display: {
                title: "Drill Oil",
                description: "Increase previous upgrades' effect by +0.1% per Heavy Drill owned.",
                effectDisplay: jsx(() => (
                    <>+{format(Decimal.mul(row1UpgradeEffects[4].value, 100))}%</>
                ))
            },
            style: { color: colorText }
        }))
    ];
    const row1UpgradeEffects: ComputedRef<DecimalSource>[] = [
        computed(() =>
            Decimal.mul(
                coal.buildDrill.amount.value,
                Decimal.add(0.04, computedUpgradeBonus.value)
            ).add(1)
        ),
        computed(() =>
            Decimal.mul(
                metal.oreDrill.amount.value,
                Decimal.add(0.04, computedUpgradeBonus.value)
            ).add(1)
        ),
        computed(() =>
            Decimal.mul(
                Decimal.max(coal.coal.value, 1).log10().floor(),
                Decimal.add(0.06, computedUpgradeBonus.value)
            ).add(1)
        ),
        computed(() =>
            Decimal.mul(
                Decimal.max(metal.metal.value, 1).log10().floor(),
                Decimal.add(0.1, computedUpgradeBonus.value)
            ).add(1)
        ),
        computed(() => Decimal.mul(buildHeavy.amount.value, 0.001))
    ];

    const row2Upgrades = [
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 100,
            display: {
                title: "Oil the Oil Pump",
                description: "Double oil gain."
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 500,
            display: {
                title: "Oil the Metal Drills",
                description:
                    "Double ore mining speed and square the coal drill amount in its effect."
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1500,
            display: {
                title: "Blaster Burner",
                description: "The Oil Burner can now increase your auto smelting multi."
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 25000,
            display: {
                title: "Oil Integration",
                description: "Reduce Oil Pump's coal consumption multipler from 5 to 4"
            },
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 50000,
            display: {
                title: "Be One with the Oil",
                description: jsx(() => (
                    <>
                        Divide metal ingot prices of oil buildings by <sup>6</sup>
                        <Sqrt>total oil + 1</Sqrt>
                    </>
                ))
            },
            style: { color: colorText }
        }))
    ];
    const row3Upgrades = [
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1e13,
            display: {
                title: "Dye Synergy I",
                description: "Red dye boosts yellow dye gain *(log(x)^0.75)"
            },
            visibility: () =>
                showIf(management.elfTraining.oilElfTraining.milestones[4].earned.value),
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1e14,
            display: {
                title: "Orange-colored boxes",
                description: "Orange dye's 2nd effect is raised to the 2.5"
            },
            visibility: () =>
                showIf(management.elfTraining.oilElfTraining.milestones[4].earned.value),
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1e15,
            display: {
                title: "Colorful Focus",
                description: "Sum of secondary dyes increases max focus multiplier by cbrt(x)"
            },
            visibility: () =>
                showIf(management.elfTraining.oilElfTraining.milestones[4].earned.value),
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1e16,
            display: {
                title: "Dye Synergy II",
                description: "Blue dye boosts red dye gain *log(x)"
            },
            visibility: () =>
                showIf(management.elfTraining.oilElfTraining.milestones[4].earned.value),
            style: { color: colorText }
        })),
        createUpgrade(() => ({
            resource: noPersist(oil),
            cost: 1e17,
            display: {
                title: "The Ultimate Metal Dye",
                description: "Sum of primary dyes boosts auto smelt speed"
            },
            visibility: () =>
                showIf(management.elfTraining.oilElfTraining.milestones[4].earned.value),
            style: { color: colorText }
        }))
    ];
    const coalConsumption = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.negate(heavyCoal.value),
            description: "Heavy Drill",
            enabled: () => Decimal.gt(activeHeavy.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: pumpCoal,
            description: "Oil Pump",
            enabled: () => Decimal.gt(activePump.value, 0)
        })),
        createAdditiveModifier(() => ({
            addend: computedOilSubstitution,
            description: "Oil to Coal Substitution",
            enabled: () => Decimal.gt(computedOilSubstitution.value, 0)
        }))
    ]);
    const computedCoalConsumption = computed(() => coalConsumption.apply(0));
    const drillPower = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: heavyPower,
            description: "Heavy Drill",
            enabled: () => Decimal.gt(activeHeavy.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: extractorPower,
            description: "Heavy Extractor",
            enabled: () => Decimal.gt(activeExtractor.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: row1UpgradeEffects[0],
            description: "Coal Drill Synergy",
            enabled: row1Upgrades[0].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: row1UpgradeEffects[1],
            description: "Metal Drill Synergy",
            enabled: row1Upgrades[1].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: row1UpgradeEffects[2],
            description: "Coal Drill Upgrade",
            enabled: row1Upgrades[2].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: row1UpgradeEffects[3],
            description: "Metal Drill Upgrade",
            enabled: row1Upgrades[3].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Guide to drilling",
            enabled: paper.upgrades.drillingUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(totalOil.value, 1).log10().add(1),
            description: "Cocoa Level 2",
            enabled: () => management.elfTraining.oilElfTraining.milestones[1].earned.value && !main.isMastery.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Cocoa Level 3",
            enabled: () => management.elfTraining.oilElfTraining.milestones[2].earned.value && !main.isMastery.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => coalEffectiveness.value,
            description: "Effectiveness",
            enabled: () => Decimal.lt(coalEffectiveness.value, 1)
        }))
    ]);
    const computedDrillPower = computed(() => drillPower.apply(0));

    const upgradeBonus = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: row1UpgradeEffects[4],
            description: "Drill Oil",
            enabled: row1Upgrades[4].bought
        }))
    ]);
    const computedUpgradeBonus = computed(() => upgradeBonus.apply(0));

    const oilSpeed = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: pumpOil,
            description: "Oil Pump",
            enabled: () => Decimal.gt(activePump.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Oil the Oil Pump",
            enabled: row2Upgrades[0].bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "3000m Well Depth",
            enabled: depthMilestones[7].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Oil and where to find it",
            enabled: paper.upgrades.oilUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => coalEffectiveness.value,
            description: "Effectiveness",
            enabled: () => Decimal.lt(coalEffectiveness.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.div(workshop.foundationProgress.value, 10).floor().div(10).add(1),
            description: "600% Foundation Completed",
            enabled: workshop.milestones.extraExpansionMilestone3.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.sqrt(management.totalElfLevels.value),
            description: "Jack Level 4",
            enabled: () => management.elfTraining.heatedCutterElfTraining.milestones[3].earned.value && !main.isMastery.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(buildHeavy2.amount.value, 1).sqrt(),
            description: "Faith Level 4",
            enabled: () => management.elfTraining.bonfireElfTraining.milestones[3].earned.value && !main.isMastery.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Cocoa Level 3",
            enabled: () => management.elfTraining.oilElfTraining.milestones[2].earned.value && !main.isMastery.value
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
    const computedOilSpeed = computed(() => oilSpeed.apply(0));

    const oilConsumption = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.negate(burnerOil.value),
            description: "Oil Burner",
            enabled: () => Decimal.gt(activeBurner.value, 0)
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.negate(smelterOil.value),
            description: "Oil Smelter",
            enabled: () => Decimal.gt(activeSmelter.value, 0)
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.negate(plastic.oilCost.value),
            description: "Oil Refinery",
            enabled: () => Decimal.gt(plastic.activeRefinery.value, 0)
        }))
    ]);
    const computedOilConsumption = computed(() => oilConsumption.apply(0));

    const oilSubstitution = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: burnerCoal,
            description: "Oil Burner",
            enabled: () => Decimal.gt(activeBurner.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => oilEffectiveness.value,
            description: "Effectiveness",
            enabled: () => Decimal.lt(oilEffectiveness.value, 1)
        }))
    ]);
    const computedOilSubstitution = computed(() => oilSubstitution.apply(0));

    const extraOilPumps = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: dyes.boosts.red1,
            description: "Red Dye Boost 1",
            enabled: () => Decimal.gte(dyes.dyes.red.amount.value, 1)
        }))
    ]);
    const computedExtraOilPumps = computed(() => extraOilPumps.apply(0));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Coal Consumption",
            modifier: coalConsumption,
            unit: "/s",
            base: 0
        },
        {
            title: "Drill Power",
            modifier: drillPower,
            base: 0
        },
        {
            title: "Upgrade Bonus",
            modifier: upgradeBonus,
            base: 0,
            visible() {
                return Decimal.gt(computedUpgradeBonus.value, 0);
            }
        },
        {
            title: "Oil Speed",
            modifier: oilSpeed,
            unit: "/s",
            base: 0,
            visible() {
                return Decimal.gt(computedOilSpeed.value, 0);
            }
        },
        {
            title: "Oil Consumption",
            modifier: oilConsumption,
            unit: "/s",
            base: 0,
            visible() {
                return Decimal.lt(computedOilConsumption.value, 0);
            }
        },
        {
            title: "Oil to Coal Substitution",
            modifier: oilSubstitution,
            unit: "/s",
            base: 0,
            visible() {
                return Decimal.gt(computedOilSubstitution.value, 0);
            }
        },
        {
            title: "Extra Oil Pumps",
            modifier: extraOilPumps,
            base: 0,
            visible() {
                return Decimal.gt(computedExtraOilPumps.value, 0);
            }
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

    const coalEffectiveness = ref<DecimalSource>(Decimal.dOne);
    const oilEffectiveness = ref<DecimalSource>(Decimal.dOne);
    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        const coalCost = Decimal.negate(computedCoalConsumption.value);
        if (Decimal.gt(coalCost, 0)) {
            coalEffectiveness.value = Decimal.min(Decimal.div(coal.coal.value, coalCost), 1);
            coal.coal.value = Decimal.sub(
                coal.coal.value,
                Decimal.mul(coalCost, coalEffectiveness.value).mul(diff)
            );
        } else {
            coalEffectiveness.value = Decimal.dOne;
        }
        drillProgress.value = Decimal.add(
            drillProgress.value,
            Decimal.mul(computedDrillPower.value, diff)
        );
        oil.value = Decimal.add(oil.value, Decimal.mul(computedOilSpeed.value, diff));
        checkDrillProgress();

        const oilCost = Decimal.negate(computedOilConsumption.value);
        if (Decimal.gt(oilCost, 0)) {
            oilEffectiveness.value = Decimal.min(Decimal.div(oil.value, oilCost), 1);
            oil.value = Decimal.sub(
                oil.value,
                Decimal.mul(oilCost, oilEffectiveness.value).mul(diff)
            ).max(0);
        } else {
            oilEffectiveness.value = Decimal.dOne;
        }
    });

    const { total: totalOil, trackerDisplay } = setUpDailyProgressTracker({
        resource: oil,
        goal: 250000,
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

        oil,
        totalOil,
        depth,
        drillProgress,

        activeHeavy,
        buildHeavy,
        activeHeavy2,
        buildHeavy2,
        activeExtractor,
        buildExtractor,
        activePump,
        buildPump,
        activeBurner,
        effectiveBurners,
        buildBurner,
        activeSmelter,
        buildSmelter,

        extractorCoal,
        extractorOre,

        coalEffectiveness,
        oilEffectiveness,

        depthMilestones,
        collapsedDepthMilestones,

        row1Upgrades,
        row2Upgrades,
        row3Upgrades,

        minWidth: 700,

        oilMilestones,
        collapsedOilMilestones,

        generalTabCollapsed,
        display: jsx(() => {
            const upgrades: GenericUpgrade[][] = [];

            if (depthMilestones[1].earned.value) {
                upgrades.push(row1Upgrades);
            }
            if (oilMilestones[1].earned.value) {
                upgrades.push(row2Upgrades);
            }
            if (management.elfTraining.oilElfTraining.milestones[4].earned.value) {
                upgrades.push(row3Upgrades);
            }
            return (
                <>
                    {render(trackerDisplay)}
                    <Spacer />
                    {Decimal.lt(coalEffectiveness.value, 1) ? (
                        <div>
                            Coal efficiency: {format(Decimal.mul(coalEffectiveness.value, 100))}%
                        </div>
                    ) : null}
                    {Decimal.lt(oilEffectiveness.value, 1) ? (
                        <div>
                            Oil efficiency: {format(Decimal.mul(oilEffectiveness.value, 100))}%
                        </div>
                    ) : null}
                    <MainDisplay
                        resource={oil}
                        color={color}
                        resourceStyle={{ textShadow: "grey 0px 0px 10px" }}
                        sticky={true}
                        productionDisplay={jsx(() => (
                            <>
                                {Decimal.lt(depth.value, 1000) ? (
                                    "Reach 1000m to start gaining oil"
                                ) : (
                                    <>
                                        {formatGain(
                                            Decimal.add(
                                                computedOilSpeed.value,
                                                computedOilConsumption.value
                                            )
                                        )}
                                    </>
                                )}
                            </>
                        ))}
                    />
                    {Decimal.eq(computedOilSpeed.value, 0) ? (
                        <>
                            (Need at least 1 Oil Pump, 1 Heavy Drill and 1 Heavy Extractor active to
                            gain oil)
                            <br />
                        </>
                    ) : (
                        ""
                    )}
                    <Row>
                        {depthMilestones[6].earned.value ? (
                            <Column>
                                {render(buildPump)}
                                <div>
                                    {formatWhole(Decimal.floor(activePump.value))}/
                                    {formatWhole(Decimal.floor(buildPump.amount.value))}
                                </div>
                                {renderRow(minPump, removePump, addPump, maxPump)}
                            </Column>
                        ) : null}
                        {oilMilestones[0].earned.value ? (
                            <Column>
                                {render(buildBurner)}
                                <div>
                                    {formatWhole(Decimal.floor(activeBurner.value))}/
                                    {formatWhole(Decimal.floor(buildBurner.amount.value))}
                                </div>
                                {renderRow(minBurner, removeBurner, addBurner, maxBurner)}
                            </Column>
                        ) : null}
                        {oilMilestones[2].earned.value ? (
                            <Column>
                                {render(buildSmelter)}
                                <div>
                                    {formatWhole(Decimal.floor(activeSmelter.value))}/
                                    {formatWhole(Decimal.floor(buildSmelter.amount.value))}
                                </div>
                                {renderRow(minSmelter, removeSmelter, addSmelter, maxSmelter)}
                            </Column>
                        ) : null}
                    </Row>
                    <br />
                    <div>
                        <span>The well is </span>
                        <h2 style={`color: #6f767f; text-shadow: 0 0 10px #6f767f`}>
                            {formatWhole(depth.value)}
                        </h2>
                        m deep
                        <br />
                        Next at {format(
                            Decimal.sub(drillProgressReq.value, drillProgress.value)
                        )}{" "}
                        drill power seconds
                    </div>
                    <div>
                        <span>Your drill power is </span>
                        <h2 style={`color: #6f767f; text-shadow: 0 0 10px #6f767f`}>
                            {format(computedDrillPower.value)}
                        </h2>
                    </div>
                    <Spacer />
                    <Row>
                        <Column>
                            {render(buildHeavy)}
                            <div>
                                {formatWhole(Decimal.floor(activeHeavy.value))}/
                                {formatWhole(Decimal.floor(buildHeavy.amount.value))}
                            </div>
                            {renderRow(minHeavy, removeHeavy, addHeavy, maxHeavy)}
                        </Column>
                        {depthMilestones[3].earned.value ? (
                            <Column>
                                {render(buildHeavy2)}
                                <div>
                                    {formatWhole(Decimal.floor(activeHeavy2.value))}/
                                    {formatWhole(Decimal.floor(buildHeavy2.amount.value))}
                                </div>
                                {renderRow(minHeavy2, removeHeavy2, addHeavy2, maxHeavy2)}
                            </Column>
                        ) : null}
                        {depthMilestones[5].earned.value ? (
                            <Column>
                                {render(buildExtractor)}
                                <div>
                                    {formatWhole(Decimal.floor(activeExtractor.value))}/
                                    {formatWhole(Decimal.floor(buildExtractor.amount.value))}
                                </div>
                                {renderRow(
                                    minExtractor,
                                    removeExtractor,
                                    addExtractor,
                                    maxExtractor
                                )}
                            </Column>
                        ) : null}
                    </Row>
                    <Spacer />
                    {renderGrid(...upgrades)}
                    <Spacer />
                    {depthMilestonesDisplay()}
                    {Decimal.gte(totalOil.value, 50) ? oilMilestonesDisplay() : ""}
                </>
            );
        }),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(oil.value)} {oil.displayName}
            </div>
        ))
    };
});

export default layer;
