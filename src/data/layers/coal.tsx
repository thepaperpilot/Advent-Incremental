/**
 * @module
 * @hidden
 */
import Column from "components/layout/Column.vue";
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import {
    changeActiveBuyables,
    createCollapsibleModifierSections,
    setUpDailyProgressTracker
} from "data/common";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { jsx, JSXFunction, showIf, StyleValue, Visibility } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { createUpgrade, Upgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ref, unref } from "vue";
import boxes from "./boxes";
import cloth from "./cloth";
import elves, { ElfBuyable } from "./elves";
import metal from "./metal";
import oil from "./oil";
import paper from "./paper";
import trees from "./trees";
import dyes from "./dyes";
import management from "./management";
import wrappingPaper from "./wrapping-paper";
import plastic from "./plastic";

interface BetterFertilizerUpgOptions {
    canAfford: () => boolean;
    onPurchase: VoidFunction;
    display: JSXFunction;
    style: StyleValue;
    visibility: () => Visibility;
}
interface UnlockKilnUpgOptions {
    resource: Resource;
    cost: DecimalSource;
    display: {
        title: string;
        description: string;
    };
    style: StyleValue;
    visibility: () => Visibility;
}
interface EfficientSmeltherUpgOptions {
    resource: Resource;
    cost: DecimalSource;
    display: {
        title: string;
        description: string;
    };
    style: StyleValue;
    visibility: () => Visibility;
}

const id = "coal";
const day = 3;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Coal";
    const colorCoal = "#151716";
    const colorAsh = "#B2BeB5";
    const colorText = "var(--foreground)";

    const coal = createResource<DecimalSource>(0, "coal");
    const ash = createResource<DecimalSource>(0, "ash");

    const activeFires = persistent<DecimalSource>(0);
    const fireLogs = computed(() => Decimal.times(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 1000));
    const fireCoal = computed(() => Decimal.times(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0.1));
    const fireAsh = computed(() => {
        let gain = Decimal.times(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 50);
        if (management.elfTraining.smallfireElfTraining.milestones[0].earned.value) {
            gain = gain.times(5);
        }
        return gain;
    });
    const buildFire = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            let v = Decimal.times(buildBonfire.amount.value, unref(buildBonfire.cost!)).plus(
                this.amount.value
            );
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
            v = Decimal.pow(0.95, paper.books.smallFireBook.totalAmount.value).times(v);
            return v.pow(1.5).times(1e4);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 1e4).root(1.5);
            v = v.div(Decimal.pow(0.95, paper.books.smallFireBook.totalAmount.value));
            if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
            v = v.sub(Decimal.times(buildBonfire.amount.value, unref(buildBonfire.cost!)));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Small Fire</h3>
                <br />
                Burn 1000 logs for 0.1 coal and 50 ash
                <br />
                <br />
                Currently:
                <br />-{format(fireLogs.value)} logs/sec
                <br />+{format(fireCoal.value)} coal/sec
                <br />+{format(fireAsh.value)} ash/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildFire.cost!))} {buildFire.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeFires.value = Decimal.add(activeFires.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        }
    })) as ElfBuyable & { resource: Resource };

    const {
        min: minFire,
        max: maxFire,
        add: addFire,
        remove: removeFire
    } = changeActiveBuyables({
        active: activeFires,
        buyable: buildFire
    });
    const fireResource = createResource(buildFire.amount, "small fires");

    const activeBonfires = persistent<DecimalSource>(0);
    const bonfireLogs = computed(() => Decimal.times(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 10000));
    const bonfireCoal = computed(() => {
        let gain = Decimal.times(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 10);
        if (management.elfTraining.bonfireElfTraining.milestones[0].earned.value) {
            gain = gain.times(5);
        }
        return gain;
    });
    const bonfireAsh = computed(() => {
        let gain = Decimal.times(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 1000);
        if (management.elfTraining.bonfireElfTraining.milestones[0].earned.value) {
            gain = gain.times(5);
        }
        return gain;
    });
    const buildBonfire = createBuyable(() => ({
        resource: fireResource,
        cost() {
            return Decimal.pow(0.95, paper.books.bonfireBook.totalAmount.value).times(10);
        },
        inverseCost(x: DecimalSource) {
            return Decimal.div(
                x,
                Decimal.pow(0.95, paper.books.bonfireBook.totalAmount.value).times(10)
            ).floor();
        },
        display: jsx(() => (
            <>
                <h3>Bonfire</h3>
                <br />
                Burn 10,000 logs for 10 coal and 1000 ash
                <br />
                <br />
                Currently:
                <br />-{format(bonfireLogs.value)} logs/sec
                <br />+{format(bonfireCoal.value)} coal/sec
                <br />+{format(bonfireAsh.value)} ash/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildBonfire.cost!))} {buildBonfire.resource!.displayName}
            </>
        )),
        onPurchase(cost) {
            activeFires.value = Decimal.sub(activeFires.value, cost!).max(0);
            activeBonfires.value = Decimal.add(activeBonfires.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        },
        visibility: () => showIf(unlockBonfire.bought.value)
    })) as ElfBuyable & { resource: Resource };
    const {
        min: minBonfire,
        max: maxBonfire,
        add: addBonfire,
        remove: removeBonfire
    } = changeActiveBuyables({
        buyable: buildBonfire,
        active: activeBonfires
    });
    const activeKilns = persistent<DecimalSource>(0);
    const kilnLogs = computed(() => Decimal.times(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 1e6));
    const kilnCoal = computed(() => {
        let gain = Decimal.times(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 1e4);
        if (management.elfTraining.kilnElfTraining.milestones[0].earned.value) {
            gain = gain.times(5);
        }
        return gain;
    });
    const kilnAsh = computed(() => {
        let gain = Decimal.times(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 1e4);
        if (management.elfTraining.kilnElfTraining.milestones[0].earned.value) {
            gain = gain.times(5);
        }
        return gain;
    });
    const buildKiln = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
            v = Decimal.pow(0.95, paper.books.kilnBook.totalAmount.value).times(v);
            return Decimal.pow(1.1, v).times(1e7);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 1e7).log(1.1);
            v = v.div(Decimal.pow(0.95, paper.books.kilnBook.totalAmount.value));
            if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Charcoal Kiln</h3>
                <br />
                Burn 1,000,000 logs for 10,000 coal and 10,000 ash
                <br />
                <br />
                Currently:
                <br />-{format(kilnLogs.value)} logs/sec
                <br />+{format(kilnCoal.value)} coal/sec
                <br />+{format(kilnAsh.value)} ash/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildKiln.cost!))} {buildKiln.resource!.displayName}
            </>
        )),
        onPurchase() {
            activeKilns.value = Decimal.add(activeKilns.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        },
        visibility: () => showIf(unlockKiln.bought.value)
    })) as ElfBuyable & { resource: Resource };
    const {
        min: minKiln,
        max: maxKiln,
        add: addKiln,
        remove: removeKiln
    } = changeActiveBuyables({
        buyable: buildKiln,
        active: activeKilns
    });
    const activeDrills = persistent<DecimalSource>(0);
    const drillCoal = computed(() =>
        Decimal.times(
            Decimal.pow(main.isMastery.value ? mastery.activeDrills.value : activeDrills.value, oil.row2Upgrades[1].bought.value ? 2 : 1),
            5e7
        )
            .times(metal.efficientDrill.bought.value ? 2 : 1)
            .times(management.elfTraining.smallfireElfTraining.milestones[2].earned.value ? 2 : 1)
            .times(management.elfTraining.bonfireElfTraining.milestones[2].earned.value ? 2 : 1)
            .times(management.elfTraining.kilnElfTraining.milestones[2].earned.value ? 2 : 1)
    );
    const buildDrill = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
            v = Decimal.pow(0.95, paper.books.coalDrillBook.totalAmount.value).times(v);
            let cost = Decimal.pow(1.15, v).times(10);
            if (management.elfTraining.fertilizerElfTraining.milestones[2].earned.value) {
                cost = cost.div(Decimal.add(trees.totalLogs.value, Math.E).ln());
            }
            if (management.elfTraining.coalDrillElfTraining.milestones[2].earned.value) {
                cost = cost.div(10);
            }
            return cost;
        },
        inverseCost(x: DecimalSource) {
            if (management.elfTraining.coalDrillElfTraining.milestones[2].earned.value) {
                x = Decimal.mul(x, 10);
            }
            if (management.elfTraining.fertilizerElfTraining.milestones[2].earned.value) {
                x = Decimal.mul(x, Decimal.add(trees.totalLogs.value, Math.E).ln());
            }
            let v = Decimal.div(x, 10).log(1.15);
            v = v.div(Decimal.pow(0.95, paper.books.coalDrillBook.totalAmount.value));
            if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
            if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: jsx(() => (
            <>
                <h3>Coal Drill</h3>
                <br />
                Dig through the ground to find 50,000,000 coal
                <br />
                <br />
                Currently:
                <br />+{format(drillCoal.value)} coal/sec
                <br />
                <br />
                Cost: {formatWhole(unref(buildDrill.cost!))} {buildDrill.resource.displayName}
            </>
        )),
        onPurchase() {
            activeDrills.value = Decimal.add(activeDrills.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        },
        visibility: () => showIf(metal.coalDrill.bought.value)
    })) as ElfBuyable & { resource: Resource };
    const {
        max: maxDrill,
        min: minDrill,
        add: addDrill,
        remove: removeDrill
    } = changeActiveBuyables({
        buyable: buildDrill,
        active: activeDrills
    });

    const warmerCutters = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 5,
        display: {
            title: "Warmer Cutters",
            description: "Cut down twice as many trees/s"
        },
        style: { color: colorText }
    }));
    const warmerPlanters = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 5,
        display: {
            title: "Warmer Planters",
            description: "Plant twice as many trees/s"
        },
        style: { color: colorText }
    }));
    const basicFertilizer = createUpgrade(() => ({
        resource: noPersist(ash),
        cost: 5000,
        display: {
            title: "Ashy Soil",
            description: "Trees give 25% more logs"
        },
        style: { color: colorText }
    }));
    const unlockBonfire = createUpgrade(() => ({
        resource: fireResource,
        cost: 10,
        display: {
            title: "Bigger Fires",
            description: "Put all those fires together into a larger blaze"
        },
        onPurchase() {
            fireResource.value = Decimal.add(fireResource.value, this.cost);
        },
        style: { color: colorText }
    }));
    const row1upgrades = [warmerCutters, warmerPlanters, basicFertilizer, unlockBonfire];

    const dedicatedCutters = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 250,
        display: {
            title: "Dedicated Cutter Heaters",
            description: "Double the bonus from Heated Cutters"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const dedicatedPlanters = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 250,
        display: {
            title: "Dedicated Planter Heaters",
            description: "Double the bonus from Heated Planters"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const betterFertilizer: Upgrade<BetterFertilizerUpgOptions> = createUpgrade(() => ({
        canAfford() {
            return Decimal.gte(trees.logs.value, 1e5) && Decimal.gte(ash.value, 1e5);
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, 1e5);
            ash.value = Decimal.sub(ash.value, 1e5);
        },
        display: jsx(() => (
            <>
                <h3>Mulched Soil</h3>
                <br />
                Double the bonus from Fertilized Soil
                <br />
                <br />
                Cost: {formatWhole(1e5)} {trees.logs.displayName}
                <br />
                {formatWhole(1e5)} {ash.displayName}
            </>
        )),
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));

    const unlockKiln: Upgrade<UnlockKilnUpgOptions> = createUpgrade(() => ({
        resource: trees.logs,
        cost: 1e7,
        display: {
            title: "Efficient Fires",
            description: "Move the fires underground to keep the coal from turning to ash"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const row2upgrades = [dedicatedCutters, dedicatedPlanters, betterFertilizer, unlockKiln];

    const efficientSmelther: Upgrade<EfficientSmeltherUpgOptions> = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 1e19,
        display: {
            title: "Efficient Crucibles",
            description: "Double auto smelting speed and triple metal gain from auto smelting"
        },
        style: { color: colorText },
        visibility: () => showIf(oil.depthMilestones[4].earned.value)
    }));
    const arsonistAssistance = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 1e45,
        display: {
            title: "Arsonist Assistance",
            description: "Every elf at or above level 5 doubles ash gain"
        },
        style: { color: colorText },
        visibility: () =>
            showIf(management.elfTraining.coalDrillElfTraining.milestones[3].earned.value)
    }));
    const refinedCoal = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 1e50,
        display: {
            title: "Refined Coal",
            description: "Refineries boost coal gain"
        },
        style: { color: colorText },
        visibility: () =>
            showIf(management.elfTraining.coalDrillElfTraining.milestones[3].earned.value)
    }));
    const coloredFire = createUpgrade(() => ({
        resource: noPersist(coal),
        cost: 1e55,
        display: {
            title: "Colored Fire",
            description: "Green dye also affects small fire synergy"
        },
        style: { color: colorText },
        visibility: () =>
            showIf(management.elfTraining.coalDrillElfTraining.milestones[3].earned.value)
    }));
    const row3upgrades = [efficientSmelther, arsonistAssistance, refinedCoal, coloredFire];

    const heatedCutters = createBuyable(() => ({
        resource: noPersist(coal),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            v = Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value).times(v);
            if (management.elfTraining.heatedCutterElfTraining.milestones[0].earned.value) {
                v = Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value).times(v);
            }
            v = v.div(wrappingPaper.boosts.rainbow1.value);
            return Decimal.add(v, 1).pow(2.5).times(10);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 10).root(2.5).sub(1);
            v = v.mul(wrappingPaper.boosts.rainbow1.value);
            if (management.elfTraining.heatedCutterElfTraining.milestones[0].earned.value) {
                v = v.div(Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value));
            }
            v = v.div(Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value));
            if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
            if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Heated Cutters",
            description: "Even warmer cutters cut down trees faster",
            effectDisplay: jsx(() => (
                <>Cutters cut down trees {format(computedHeatedCutterEffect.value)}x faster</>
            ))
        },
        style: { color: colorText },
        visibility: () => showIf(warmerCutters.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const heatedPlanters = createBuyable(() => ({
        resource: noPersist(coal),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            v = Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value).times(v);
            if (management.elfTraining.heatedPlanterElfTraining.milestones[0].earned.value) {
                v = Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value).times(v);
            }
            v = v.div(wrappingPaper.boosts.rainbow1.value);
            return Decimal.add(v, 1).pow(2.5).times(10);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 10).root(2.5).sub(1);
            v = v.mul(wrappingPaper.boosts.rainbow1.value);
            if (management.elfTraining.heatedPlanterElfTraining.milestones[0].earned.value) {
                v = v.div(Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value));
            }
            v = v.div(Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value));
            if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
            if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Heated Planters",
            description: "Even warmer planters plant trees faster",
            effectDisplay: jsx(() => (
                <>Planters plant trees {format(computedHeatedPlanterEffect.value)}x faster</>
            ))
        },
        style: { color: colorText },
        visibility: () => showIf(warmerPlanters.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const moreFertilizer = createBuyable(() => ({
        resource: noPersist(ash),
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            v = Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value).times(v);
            if (management.elfTraining.fertilizerElfTraining.milestones[1].earned.value) {
                v = Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value).times(v);
            }
            v = v.div(wrappingPaper.boosts.rainbow1.value);
            return Decimal.add(v, 1).pow(1.5).times(50000);
        },
        inverseCost(x: DecimalSource) {
            let v = Decimal.div(x, 50000).root(1.5).sub(1);
            v = v.mul(wrappingPaper.boosts.rainbow1.value);
            if (management.elfTraining.fertilizerElfTraining.milestones[0].earned.value) {
                v = v.div(Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value));
            }
            v = v.div(Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value));
            if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
            if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
            if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        display: {
            title: "Fertilized Soil",
            description: "More fertilizer helps trees grow bigger",
            effectDisplay: jsx(() => (
                <>Trees give {format(computedFertilizerEffect.value)}x more logs</>
            ))
        },
        style: { color: colorText },
        visibility: () => showIf(basicFertilizer.bought.value)
    })) as ElfBuyable & { display: { title: string }; resource: Resource };
    const row3buyables = [heatedCutters, heatedPlanters, moreFertilizer];

    const heatedCutterEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.times(main.isMastery.value ? mastery.heatedCutters.amount.value : heatedCutters.amount.value, 0.25);
            },
            description: "Heated Cutters",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.heatedCutters.amount.value : heatedCutters.amount.value, 0);
            }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Dedicated Cutter Heaters",
            enabled: () => main.isMastery.value ? mastery.dedicatedCutters.bought.value : dedicatedCutters.bought.value
        }))
    ]);
    const computedHeatedCutterEffect = computed(() => heatedCutterEffect.apply(1));

    const heatedPlanterEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.times(main.isMastery.value ? mastery.heatedPlanters.amount.value : heatedPlanters.amount.value, 0.25);
            },
            description: "Heated Planters",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.heatedPlanters.amount.value : heatedPlanters.amount.value, 0);
            }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Dedicated Planter Heaters",
            enabled: () => main.isMastery.value ? mastery.dedicatedPlanters.bought.value : dedicatedPlanters.bought.value
        }))
    ]);
    const computedHeatedPlanterEffect = computed(() => heatedPlanterEffect.apply(1));

    const fertilizerEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.times(main.isMastery.value ? mastery.moreFertilizer.amount.value : moreFertilizer.amount.value, 0.25);
            },
            description: "Fertilized Soil",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.moreFertilizer.amount.value : moreFertilizer.amount.value, 0);
            }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Mulched Soil",
            enabled: () => main.isMastery.value ? mastery.betterFertilizer.bought.value : betterFertilizer.bought.value
        }))
    ]);
    const computedFertilizerEffect = computed(() => fertilizerEffect.apply(1));

    const coalGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return fireCoal.value;
            },
            description: "Small Fires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return bonfireCoal.value;
            },
            description: "Bonfires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return  kilnCoal.value;
            },
            description: "Charcoal Kilns",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return drillCoal.value;
            },
            description: "Coal Drills",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeDrills.value : activeDrills.value, 0);
            }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry coal in boxes",
            enabled: boxes.upgrades.coalUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(boxes.buyables.coalBoxesBuyable.amount.value, 2).add(1),
            description: "Carry more coal",
            enabled: boxes.upgrades.coalUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => {
                let v = main.isMastery.value ? mastery.buildFire.amount.value : buildFire.amount.value;
                if (management.elfTraining.smallfireElfTraining.milestones[0].earned.value) {
                    v = Decimal.div(buildBonfire.amount.value, 10).add(v);
                }
                let multi = Decimal.div(v, 10000).add(1);
                if (coloredFire.bought.value) {
                    multi = Decimal.add(multi, dyes.dyes.green.amount.value);
                }
                return multi;
            },
            description: "Small Fires Synergy",
            enabled: elves.elves.smallFireElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(main.isMastery.value ? mastery.buildBonfire.amount.value : buildBonfire.amount.value, 1000).add(1),
            description: "Bonfires Synergy",
            enabled: elves.elves.bonfireElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.div(main.isMastery.value ? mastery.buildKiln.amount.value : buildKiln.amount.value, 100).times(dyes.boosts.green2.value).add(1),
            description: "Kiln Synergy",
            enabled: elves.elves.kilnElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Mining overalls",
            enabled: cloth.metalUpgrades.metalUpgrade2.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 3,
            description: "Mining helmet",
            enabled: cloth.metalUpgrades.metalUpgrade3.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Felt-Gripped Pick",
            enabled: cloth.metalUpgrades.metalUpgrade4.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "12 Elves Trained",
            enabled: elves.milestones[11].earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.25,
            description: "3 Elves Trained",
            enabled: elves.milestones[2].earned,
            supportLowNumbers: true
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.mul(oil.depth.value, 0.25)
                    .pow(
                        management.elfTraining.coalDrillElfTraining.milestones[4].earned.value
                            ? 1.5
                            : 1
                    )
                    .add(1),
            description: "5m Well Depth",
            enabled: oil.depthMilestones[0].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: oil.extractorCoal,
            description: "Heavy Extractor",
            enabled: () => Decimal.gt(oil.activeExtractor.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.add(coal.value, 1).log10().add(1).sqrt(),
            description: "Peppermint Level 2",
            enabled: () => management.elfTraining.coalDrillElfTraining.milestones[1].earned.value && !main.isMastery.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.add(plastic.buildRefinery.amount.value, 1).sqrt(),
            description: "Refined Coal",
            enabled: refinedCoal.bought
        })),
        createExponentialModifier(() => ({
            exponent: 1.05,
            description: "Jack Level 2",
            enabled: () => management.elfTraining.heatedCutterElfTraining.milestones[1].earned.value && !main.isMastery.value
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
    const computedCoalGain = computed(() => coalGain.apply(0));

    const ashGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return fireAsh.value;
            },
            description: "Small Fires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return bonfireAsh.value;
            },
            description: "Bonfires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return kilnAsh.value;
            },
            description: "Charcoal Kilns",
            enabled() {
                return Decimal.gt(activeKilns.value, 0);
            }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Carry ash in boxes",
            enabled: boxes.upgrades.ashUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(boxes.buyables.ashBoxesBuyable.amount.value, 2).add(1),
            description: "Carry more ash",
            enabled: boxes.upgrades.ashUpgrade.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => {
                let v = main.isMastery.value ? mastery.buildFire.amount.value : buildFire.amount.value;
                if (management.elfTraining.smallfireElfTraining.milestones[0].earned.value) {
                    v = Decimal.div(buildBonfire.amount.value, 100).add(v);
                }
                return Decimal.div(v, 1000).add(1);
            },
            description: "Small Fires Synergy",
            enabled: elves.elves.smallFireElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(main.isMastery.value ? mastery.buildBonfire.amount.value : buildBonfire.amount.value, 1000).add(1),
            description: "Bonfires Synergy",
            enabled: elves.elves.bonfireElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.div(main.isMastery.value ? mastery.buildKiln.amount.value : buildKiln.amount.value, 100).times(dyes.boosts.green2.value).add(1),
            description: "Kiln Synergy",
            enabled: elves.elves.kilnElf.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Mining boots",
            enabled: cloth.metalUpgrades.metalUpgrade1.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(2, management.level5Elves.value),
            description: "Arson Assistance",
            enabled: arsonistAssistance.bought
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Joy Level 2",
            enabled: () => management.elfTraining.smallfireElfTraining.milestones[1].earned.value && !main.isMastery.value
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Faith Level 2",
            enabled: () => management.elfTraining.bonfireElfTraining.milestones[1].earned.value && !main.isMastery.value
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Snowball Level 2",
            enabled: () => management.elfTraining.kilnElfTraining.milestones[1].earned.value && !main.isMastery.value
        })),
        createAdditiveModifier(() => ({
            addend: paper.paper,
            description: "Paper Burning",
            enabled: paper.upgrades2.ashUpgrade.bought
        }))
    ]);
    const computedAshGain = computed(() => ashGain.apply(0));

    const logConsumption = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.negate(fireLogs.value);
            },
            description: "Small Fires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.negate(bonfireLogs.value);
            },
            description: "Bonfires",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0);
            }
        })),
        createAdditiveModifier(() => ({
            addend() {
                return Decimal.negate(kilnLogs.value);
            },
            description: "Charcoal Kilns",
            enabled() {
                return Decimal.gt(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 0);
            }
        }))
    ]);
    const computedLogConsumption = computed(() => logConsumption.apply(0));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Log Consumption",
            modifier: logConsumption,
            base: 0,
            visible() {
                return (
                    Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 0)
                );
            }
        },
        {
            title: "Coal Gain",
            modifier: coalGain,
            base: 0,
            visible() {
                return (
                    Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 0)
                );
            }
        },
        {
            title: "Ash Gain",
            modifier: ashGain,
            base: 0,
            visible() {
                return (
                    Decimal.gt(main.isMastery.value ? mastery.activeFires.value : activeFires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value, 0) ||
                    Decimal.gt(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value, 0)
                );
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

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        if (Decimal.times(diff, computedLogConsumption.value).negate().gt(trees.logs.value)) {
            return;
        }
        if (main.isMastery.value) {
            trees.mastery.logs.value = Decimal.times(diff, computedLogConsumption.value).plus(trees.mastery.logs.value);
            mastery.coal.value = Decimal.times(diff, computedCoalGain.value).plus(mastery.coal.value);
            mastery.ash.value = Decimal.times(diff, computedAshGain.value).plus(mastery.ash.value);
            mastery.activeFires.value = Decimal.max(mastery.activeFires.value, 0);
        } else {
            trees.logs.value = Decimal.times(diff, computedLogConsumption.value).plus(trees.logs.value);
            coal.value = Decimal.times(diff, computedCoalGain.value).plus(coal.value);
            ash.value = Decimal.times(diff, computedAshGain.value).plus(ash.value);
            activeFires.value = Decimal.max(activeFires.value, 0);
        }
    });

    const { total: totalCoal, trackerDisplay } = setUpDailyProgressTracker({
        resource: coal,
        goal: 1e7,
        name,
        day,
        color: colorCoal,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    const mastery = (() => {
        const activeFires = persistent<DecimalSource>(0);
        const activeBonfires = persistent<DecimalSource>(0);
        const activeKilns = persistent<DecimalSource>(0);

        const coal = createResource<DecimalSource>(0,"coal");
        const ash = createResource<DecimalSource>(0,"ash");

        const buildFire = createBuyable(() => ({
            resource: trees.mastery.logs,
            cost() {
                let v = Decimal.times(buildBonfire.amount.value, unref(buildBonfire.cost!)).plus(
                    this.amount.value
                );
                if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
                if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
                v = Decimal.pow(0.95, paper.books.smallFireBook.totalAmount.value).times(v);
                return v.pow(1.5).times(1e4);
            },
            inverseCost(x: DecimalSource) {
                let v = Decimal.div(x, 1e4).root(1.5);
                v = v.div(Decimal.pow(0.95, paper.books.smallFireBook.totalAmount.value));
                if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
                if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
                v = v.sub(Decimal.times(buildBonfire.amount.value, unref(buildBonfire.cost!)));
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: jsx(() => (
                <>
                    <h3>Small Fire</h3>
                    <br />
                    Burn 1000 logs for 0.1 coal and 50 ash
                    <br />
                    <br />
                    Currently:
                    <br />-{format(fireLogs.value)} logs/sec
                    <br />+{format(fireCoal.value)} coal/sec
                    <br />+{format(fireAsh.value)} ash/sec
                    <br />
                    <br />
                    Cost: {formatWhole(unref(buildFire.cost!))} {buildFire.resource!.displayName}
                </>
            )),
            onPurchase() {
                activeFires.value = Decimal.add(activeFires.value, 1);
            },
            style: {
                color: colorText,
                width: "160px"
            }
        })) as ElfBuyable & { resource: Resource };
        const {
            min: minFire,
            max: maxFire,
            add: addFire,
            remove: removeFire
        } = changeActiveBuyables({
            active: activeFires,
            buyable: buildFire
        });
        const fireResource = createResource(buildFire.amount, "small fires");

        const buildBonfire = createBuyable(() => ({
            resource: fireResource,
            cost() {
                return Decimal.pow(0.95, paper.books.bonfireBook.totalAmount.value).times(10);
            },
            inverseCost(x: DecimalSource) {
                return Decimal.div(
                    x,
                    Decimal.pow(0.95, paper.books.bonfireBook.totalAmount.value).times(10)
                ).floor();
            },
            display: jsx(() => (
                <>
                    <h3>Bonfire</h3>
                    <br />
                    Burn 10,000 logs for 10 coal and 1000 ash
                    <br />
                    <br />
                    Currently:
                    <br />-{format(bonfireLogs.value)} logs/sec
                    <br />+{format(bonfireCoal.value)} coal/sec
                    <br />+{format(bonfireAsh.value)} ash/sec
                    <br />
                    <br />
                    Cost: {formatWhole(unref(buildBonfire.cost!))} {buildBonfire.resource!.displayName}
                </>
            )),
            onPurchase(cost) {
                activeFires.value = Decimal.sub(activeFires.value, cost!).max(0);
                activeBonfires.value = Decimal.add(activeBonfires.value, 1);
            },
            style: {
                color: colorText,
                width: "160px"
            },
            visibility: () => showIf(unlockBonfire.bought.value)
        })) as ElfBuyable & { resource: Resource };
        const {
            min: minBonfire,
            max: maxBonfire,
            add: addBonfire,
            remove: removeBonfire
        } = changeActiveBuyables({
            buyable: buildBonfire,
            active: activeBonfires
        });

        const buildKiln = createBuyable(() => ({
            resource: trees.mastery.logs,
            cost() {
                let v = this.amount.value;
                if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
                if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
                v = Decimal.pow(0.95, paper.books.kilnBook.totalAmount.value).times(v);
                return Decimal.pow(1.1, v).times(1e7);
            },
            inverseCost(x: DecimalSource) {
                let v = Decimal.div(x, 1e7).log(1.1);
                v = v.div(Decimal.pow(0.95, paper.books.kilnBook.totalAmount.value));
                if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
                if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: jsx(() => (
                <>
                    <h3>Charcoal Kiln</h3>
                    <br />
                    Burn 1,000,000 logs for 10,000 coal and 10,000 ash
                    <br />
                    <br />
                    Currently:
                    <br />-{format(kilnLogs.value)} logs/sec
                    <br />+{format(kilnCoal.value)} coal/sec
                    <br />+{format(kilnAsh.value)} ash/sec
                    <br />
                    <br />
                    Cost: {formatWhole(unref(buildKiln.cost!))} {buildKiln.resource!.displayName}
                </>
            )),
            onPurchase() {
                activeKilns.value = Decimal.add(activeKilns.value, 1);
            },
            style: {
                color: colorText,
                width: "160px"
            },
            visibility: () => showIf(unlockKiln.bought.value)
        })) as ElfBuyable & { resource: Resource };
        const {
            min: minKiln,
            max: maxKiln,
            add: addKiln,
            remove: removeKiln
        } = changeActiveBuyables({
            buyable: buildKiln,
            active: activeKilns
        });
        const warmerCutters = createUpgrade(() => ({
            resource: noPersist(coal),
            cost: 5,
            display: {
                title: "Warmer Cutters",
                description: "Cut down twice as many trees/s"
            },
            style: { color: colorText }
        }));
        const warmerPlanters = createUpgrade(() => ({
            resource: noPersist(coal),
            cost: 5,
            display: {
                title: "Warmer Planters",
                description: "Plant twice as many trees/s"
            },
            style: { color: colorText }
        }));
        const basicFertilizer = createUpgrade(() => ({
            resource: noPersist(ash),
            cost: 5000,
            display: {
                title: "Ashy Soil",
                description: "Trees give 25% more logs"
            },
            style: { color: colorText }
        }));
        const unlockBonfire = createUpgrade(() => ({
            resource: fireResource,
            cost: 10,
            display: {
                title: "Bigger Fires",
                description: "Put all those fires together into a larger blaze"
            },
            onPurchase() {
                fireResource.value = Decimal.add(fireResource.value, this.cost);
            },
            style: { color: colorText }
        }));
        const row1upgrades = [warmerCutters, warmerPlanters, basicFertilizer, unlockBonfire];
    
        const dedicatedCutters = createUpgrade(() => ({
            resource: noPersist(coal),
            cost: 250,
            display: {
                title: "Dedicated Cutter Heaters",
                description: "Double the bonus from Heated Cutters"
            },
            style: { color: colorText },
            visibility: () => showIf(unlockBonfire.bought.value)
        }));
        const dedicatedPlanters = createUpgrade(() => ({
            resource: noPersist(coal),
            cost: 250,
            display: {
                title: "Dedicated Planter Heaters",
                description: "Double the bonus from Heated Planters"
            },
            style: { color: colorText },
            visibility: () => showIf(unlockBonfire.bought.value)
        }));
        const betterFertilizer: Upgrade<BetterFertilizerUpgOptions> = createUpgrade(() => ({
            canAfford() {
                return Decimal.gte(trees.logs.value, 1e5) && Decimal.gte(ash.value, 1e5);
            },
            onPurchase() {
                trees.logs.value = Decimal.sub(trees.logs.value, 1e5);
                ash.value = Decimal.sub(ash.value, 1e5);
            },
            display: jsx(() => (
                <>
                    <h3>Mulched Soil</h3>
                    <br />
                    Double the bonus from Fertilized Soil
                    <br />
                    <br />
                    Cost: {formatWhole(1e5)} {trees.logs.displayName}
                    <br />
                    {formatWhole(1e5)} {ash.displayName}
                </>
            )),
            style: { color: colorText },
            visibility: () => showIf(unlockBonfire.bought.value)
        }));
    
        const unlockKiln: Upgrade<UnlockKilnUpgOptions> = createUpgrade(() => ({
            resource: trees.logs,
            cost: 1e7,
            display: {
                title: "Efficient Fires",
                description: "Move the fires underground to keep the coal from turning to ash"
            },
            style: { color: colorText },
            visibility: () => showIf(unlockBonfire.bought.value)
        }));
        const row2upgrades = [dedicatedCutters, dedicatedPlanters, betterFertilizer, unlockKiln];
    
        const efficientSmelther: Upgrade<EfficientSmeltherUpgOptions> = createUpgrade(() => ({
            resource: noPersist(coal),
            cost: 1e19,
            display: {
                title: "Efficient Crucibles",
                description: "Double auto smelting speed and triple metal gain from auto smelting"
            },
            style: { color: colorText },
            visibility: () => showIf(oil.depthMilestones[4].earned.value)
        }));
        const row3upgrades = [efficientSmelther];
        const buildDrill = createBuyable(() => ({
            resource: metal.metal,
            cost() {
                let v = this.amount.value;
                if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
                if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
                v = Decimal.pow(0.95, paper.books.coalDrillBook.totalAmount.value).times(v);
                let cost = Decimal.pow(1.15, v).times(10);
                if (management.elfTraining.fertilizerElfTraining.milestones[2].earned.value) {
                    cost = cost.div(Decimal.add(trees.totalLogs.value, Math.E).ln());
                }
                if (management.elfTraining.coalDrillElfTraining.milestones[2].earned.value) {
                    cost = cost.div(10);
                }
                return cost;
            },
            inverseCost(x: DecimalSource) {
                if (management.elfTraining.coalDrillElfTraining.milestones[2].earned.value) {
                    x = Decimal.mul(x, 10);
                }
                if (management.elfTraining.fertilizerElfTraining.milestones[2].earned.value) {
                    x = Decimal.mul(x, Decimal.add(trees.totalLogs.value, Math.E).ln());
                }
                let v = Decimal.div(x, 10).log(1.15);
                v = v.div(Decimal.pow(0.95, paper.books.coalDrillBook.totalAmount.value));
                if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
                if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: jsx(() => (
                <>
                    <h3>Coal Drill</h3>
                    <br />
                    Dig through the ground to find 50,000,000 coal
                    <br />
                    <br />
                    Currently:
                    <br />+{format(drillCoal.value)} coal/sec
                    <br />
                    <br />
                    Cost: {formatWhole(unref(buildDrill.cost!))} {buildDrill.resource.displayName}
                </>
            )),
            onPurchase() {
                activeDrills.value = Decimal.add(activeDrills.value, 1);
            },
            style: {
                color: colorText,
                width: "160px"
            },
            visibility: () => showIf(metal.coalDrill.bought.value)
        })) as ElfBuyable & { resource: Resource };
        const activeDrills = persistent<DecimalSource>(0)
        const {
            max: maxDrill,
            min: minDrill,
            add: addDrill,
            remove: removeDrill
        } = changeActiveBuyables({
            buyable: buildDrill,
            active: activeDrills
        });
        const heatedCutters = createBuyable(() => ({
            resource: noPersist(coal),
            cost() {
                let v = this.amount.value;
                if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
                if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
                if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
                v = Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value).times(v);
                if (management.elfTraining.heatedCutterElfTraining.milestones[0].earned.value) {
                    v = Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value).times(v);
                }
                v = v.div(wrappingPaper.boosts.rainbow1.value);
                return Decimal.add(v, 1).pow(2.5).times(10);
            },
            inverseCost(x: DecimalSource) {
                let v = Decimal.div(x, 10).root(2.5).sub(1);
                v = v.mul(wrappingPaper.boosts.rainbow1.value);
                if (management.elfTraining.heatedCutterElfTraining.milestones[0].earned.value) {
                    v = v.div(Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value));
                }
                v = v.div(Decimal.pow(0.95, paper.books.heatedCuttersBook.totalAmount.value));
                if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
                if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
                if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: {
                title: "Heated Cutters",
                description: "Even warmer cutters cut down trees faster",
                effectDisplay: jsx(() => (
                    <>Cutters cut down trees {format(computedHeatedCutterEffect.value)}x faster</>
                ))
            },
            style: { color: colorText },
            visibility: () => showIf(warmerCutters.bought.value)
        })) as ElfBuyable & { display: { title: string }; resource: Resource };
        const heatedPlanters = createBuyable(() => ({
            resource: noPersist(coal),
            cost() {
                let v = this.amount.value;
                if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
                if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
                if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
                v = Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value).times(v);
                if (management.elfTraining.heatedPlanterElfTraining.milestones[0].earned.value) {
                    v = Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value).times(v);
                }
                v = v.div(wrappingPaper.boosts.rainbow1.value);
                return Decimal.add(v, 1).pow(2.5).times(10);
            },
            inverseCost(x: DecimalSource) {
                let v = Decimal.div(x, 10).root(2.5).sub(1);
                v = v.mul(wrappingPaper.boosts.rainbow1.value);
                if (management.elfTraining.heatedPlanterElfTraining.milestones[0].earned.value) {
                    v = v.div(Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value));
                }
                v = v.div(Decimal.pow(0.95, paper.books.heatedPlantersBook.totalAmount.value));
                if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
                if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
                if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: {
                title: "Heated Planters",
                description: "Even warmer planters plant trees faster",
                effectDisplay: jsx(() => (
                    <>Planters plant trees {format(computedHeatedPlanterEffect.value)}x faster</>
                ))
            },
            style: { color: colorText },
            visibility: () => showIf(warmerPlanters.bought.value)
        })) as ElfBuyable & { display: { title: string }; resource: Resource };
        const moreFertilizer = createBuyable(() => ({
            resource: noPersist(ash),
            cost() {
                let v = this.amount.value;
                if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
                if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
                if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
                v = Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value).times(v);
                if (management.elfTraining.fertilizerElfTraining.milestones[1].earned.value) {
                    v = Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value).times(v);
                }
                v = v.div(wrappingPaper.boosts.rainbow1.value);
                return Decimal.add(v, 1).pow(1.5).times(50000);
            },
            inverseCost(x: DecimalSource) {
                let v = Decimal.div(x, 50000).root(1.5).sub(1);
                v = v.mul(wrappingPaper.boosts.rainbow1.value);
                if (management.elfTraining.fertilizerElfTraining.milestones[0].earned.value) {
                    v = v.div(Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value));
                }
                v = v.div(Decimal.pow(0.95, paper.books.fertilizerBook.totalAmount.value));
                if (Decimal.gte(v, 2e6)) v = Decimal.mul(v, 2e6).root(2);
                if (Decimal.gte(v, 200)) v = Decimal.mul(v, 200).root(2);
                if (Decimal.gte(v, 50)) v = Decimal.mul(v, 50).root(2);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            display: {
                title: "Fertilized Soil",
                description: "More fertilizer helps trees grow bigger",
                effectDisplay: jsx(() => (
                    <>Trees give {format(computedFertilizerEffect.value)}x more logs</>
                ))
            },
            style: { color: colorText },
            visibility: () => showIf(basicFertilizer.bought.value)
        })) as ElfBuyable & { display: { title: string }; resource: Resource };
        const row3buyables = [heatedCutters, heatedPlanters, moreFertilizer];
        return {
            buildFire,
            activeFires,
            buildBonfire,
            activeBonfires,
            buildKiln,
            activeKilns,
            minFire,
            maxFire,
            addFire,
            removeFire,
            minBonfire,
            maxBonfire,
            addBonfire,
            removeBonfire,
            minKiln,
            maxKiln,
            addKiln,
            removeKiln,
            row1upgrades,
            row2upgrades,
            row3upgrades,
            unlockBonfire,
            unlockKiln,
            dedicatedCutters,
            dedicatedPlanters,
            betterFertilizer,
            efficientSmelther,
            warmerCutters,
            warmerPlanters,
            basicFertilizer,
            activeDrills,
            buildDrill,
            minDrill,
            maxDrill,
            addDrill,
            removeDrill,
            coal,
            ash,
            heatedCutters,
            heatedPlanters,
            moreFertilizer,
            row3buyables,
        }
    })()

    return {
        name,
        color: colorCoal,
        coal,
        totalCoal,
        computedCoalGain,
        ash,
        activeFires,
        buildFire,
        activeBonfires,
        buildBonfire,
        activeKilns,
        buildKiln,
        activeDrills,
        buildDrill,
        warmerCutters,
        warmerPlanters,
        basicFertilizer,
        unlockBonfire,
        dedicatedCutters,
        dedicatedPlanters,
        betterFertilizer,
        unlockKiln,
        efficientSmelther,
        arsonistAssistance,
        refinedCoal,
        coloredFire,
        heatedCutters,
        heatedPlanters,
        moreFertilizer,
        computedHeatedCutterEffect,
        computedHeatedPlanterEffect,
        computedFertilizerEffect,
        generalTabCollapsed,
        minWidth: 700,
        mastery,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay
                    resource={main.isMastery.value ? mastery.coal : coal}
                    color={colorCoal}
                    style={{ marginBottom: 0 }}
                    resourceStyle={{ textShadow: "grey 0px 0px 10px" }}
                    effectDisplay={
                        Decimal.gt(computedCoalGain.value, 0)
                            ? `+${format(computedCoalGain.value)}/s`
                            : undefined
                    }
                />
                <Spacer />
                <MainDisplay
                    resource={main.isMastery.value ? mastery.ash : ash}
                    color={colorAsh}
                    style="margin-bottom: 0"
                    effectDisplay={
                        Decimal.gt(computedAshGain.value, 0)
                            ? `+${format(computedAshGain.value)}/s`
                            : undefined
                    }
                />
                <Spacer />
                <Row>
                    <Column>
                        {render(main.isMastery.value ? mastery.buildFire : buildFire)}
                        <div>
                            {formatWhole(Decimal.floor(main.isMastery ? mastery.activeFires.value : activeFires.value))}/
                            {formatWhole(Decimal.floor(main.isMastery ? mastery.buildFire.amount.value : buildFire.amount.value))}
                        </div>
                        {renderRow(... main.isMastery.value ? [mastery.minFire, mastery.removeFire, mastery.addFire, mastery.maxFire] : [minFire, removeFire, addFire, maxFire])}
                    </Column>
                    {(main.isMastery.value ? mastery.unlockBonfire.bought.value : unlockBonfire.bought.value) ? (
                        <>
                            <Spacer />
                            <Column>
                                {render(buildBonfire)}
                                <div>
                                    {formatWhole(main.isMastery.value ? mastery.activeBonfires.value : activeBonfires.value)}/
                                    {formatWhole(main.isMastery.value ? mastery.buildBonfire.amount.value : buildBonfire.amount.value)}
                                </div>
                                {renderRow(...main.isMastery.value ? [mastery.minBonfire, mastery.removeBonfire, mastery.addBonfire, mastery.maxBonfire] : [minBonfire, removeBonfire, addBonfire, maxBonfire] )}
                            </Column>
                        </>
                    ) : undefined}
                    {(main.isMastery.value ? mastery.unlockKiln.bought.value : unlockKiln.bought.value) ? (
                        <>
                            <Spacer />
                            <Column>
                                {render(main.isMastery.value ? mastery.buildKiln : buildKiln)}
                                <div>
                                    {formatWhole(main.isMastery.value ? mastery.activeKilns.value : activeKilns.value)}/
                                    {formatWhole(main.isMastery.value ? mastery.buildKiln.amount.value : buildKiln.amount.value)}
                                </div>
                                {renderRow(...main.isMastery.value ? [mastery.minKiln, mastery.removeKiln, mastery.addKiln, mastery.maxKiln] : [minKiln, removeKiln, addKiln, maxKiln])}
                            </Column>
                        </>
                    ) : undefined}
                    {metal.coalDrill.bought.value ? (
                        <>
                            <Spacer />
                            <Column>
                                {render(main.isMastery.value ? mastery.buildDrill : buildDrill)}
                                <div>
                                    {formatWhole(main.isMastery.value ? mastery.activeDrills.value : activeDrills.value)}/
                                    {formatWhole(main.isMastery.value ? mastery.buildDrill.amount.value : buildDrill.amount.value)}
                                </div>
                                {renderRow(...main.isMastery.value ? [mastery.minDrill, mastery.removeDrill, mastery.addDrill, mastery.maxDrill] : [minDrill, removeDrill, addDrill, maxDrill])}
                            </Column>
                        </>
                    ) : undefined}
                </Row>
                <Spacer />
                {renderGrid(...main.isMastery.value ? [mastery.row1upgrades, mastery.row2upgrades, mastery.row3upgrades] : [row1upgrades, row2upgrades, row3upgrades] )}
                {renderRow(...main.isMastery.value ? mastery.row3buyables : row3buyables)}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(main.isMastery.value ? mastery.coal.value : coal.value)} {coal.displayName}
            </div>
        ))
    };
});

export default layer;
