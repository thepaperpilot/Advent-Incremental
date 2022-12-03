/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import MainDisplay from "features/resources/MainDisplay.vue";
import Row from "components/layout/Row.vue";
import Column from "components/layout/Column.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createResource, trackTotal } from "features/resources/resource";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ref, unref, watch, watchEffect } from "vue";
import trees from "./trees";
import { createAdditiveModifier, createExponentialModifier, createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { createUpgrade } from "features/upgrades/upgrade";
import player from "game/player";
import elves from "./elves";

const id = "coal";
const day = 3;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Coal";
    const colorCoal = "#151716";
    const colorAsh = "#B2BeB5";
    const colorText = "var(--foreground)"

    const coal = createResource<DecimalSource>(0, "coal");
    const totalCoal = trackTotal(coal);
    const ash = createResource<DecimalSource>(0, "ash");

    const totalCoalGoal = 1e7;

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorCoal}`,
        progress: () =>
            main.day.value === day
                ? Decimal.log10(totalCoal.value).div(Math.log10(totalCoalGoal))
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {formatWhole(totalCoal.value)}/{formatWhole(totalCoalGoal)}
                </>
            ) : (
                ""
            )
        )
    }));

    const activeFires = persistent<DecimalSource>(0);
    const fireLogs = computed(() => Decimal.times(activeFires.value, 1000));
    const fireCoal = computed(() => Decimal.times(activeFires.value, 0.1));
    const fireAsh = computed(() => Decimal.times(activeFires.value, 50));
    const buildFire = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            return Decimal.times(buildBonfire.amount.value, 10).plus(this.amount.value).pow(1.5).times(1e4);
        },
        display: jsx(() => <>
            <h3>Small Fire</h3><br/>
            Burn 1000 logs for 0.1 coal and 50 ash<br/>
            <br/>
            Currently:<br/>
            -{format(fireLogs.value)} logs/sec<br/>
            +{format(fireCoal.value)} coal/sec<br/>
            +{format(fireAsh.value)} ash/sec<br/>
            <br/>
            Cost: {formatWhole(unref(buildFire.cost!))} {buildFire.resource!.displayName}
        </>),
        onPurchase() { activeFires.value = Decimal.add(activeFires.value, 1); },
        style: {
            color: colorText,
            width: "160px"
        }
    })) as GenericBuyable;
    const minFire = createClickable(() => ({
        display: '0',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeFires.value, 0); },
        onClick() { activeFires.value = 0; }
    }));
    const removeFire = createClickable(() => ({
        display: '-',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeFires.value, 0); },
        onClick() { activeFires.value = Decimal.sub(activeFires.value, 1); }
    }));
    const addFire = createClickable(() => ({
        display: '+',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeFires.value, buildFire.amount.value); },
        onClick() { activeFires.value = Decimal.add(activeFires.value, 1); }
    }));
    const maxFire = createClickable(() => ({
        display: 'Max',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeFires.value, buildFire.amount.value); },
        onClick() { activeFires.value = buildFire.amount.value; }
    }));

    const fireResource = createResource(buildFire.amount, "small fires");
    const activeBonfires = persistent<DecimalSource>(0);
    const bonfireLogs = computed(() => Decimal.times(activeBonfires.value, 10000));
    const bonfireCoal = computed(() => Decimal.times(activeBonfires.value, 10));
    const bonfireAsh = computed(() => Decimal.times(activeBonfires.value, 1000));
    const buildBonfire = createBuyable(() => ({
        resource: fireResource,
        cost: 10,
        display: jsx(() => <>
            <h3>Bonfire</h3><br/>
            Burn 10,000 logs for 10 coal and 1000 ash<br/>
            <br/>
            Currently:<br/>
            -{format(bonfireLogs.value)} logs/sec<br/>
            +{format(bonfireCoal.value)} coal/sec<br/>
            +{format(bonfireAsh.value)} ash/sec<br/>
            <br/>
            Cost: {formatWhole(unref(buildBonfire.cost!))} {buildBonfire.resource!.displayName}
        </>),
        onPurchase(cost) {
            activeFires.value = Decimal.sub(activeFires.value, cost!).max(0);
            activeBonfires.value = Decimal.add(activeBonfires.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        }
    })) as GenericBuyable;
    const minBonfire = createClickable(() => ({
        display: '0',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeBonfires.value, 0); },
        onClick() { activeBonfires.value = 0; }
    }));
    const removeBonfire = createClickable(() => ({
        display: '-',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeBonfires.value, 0); },
        onClick() { activeBonfires.value = Decimal.sub(activeBonfires.value, 1); }
    }));
    const addBonfire = createClickable(() => ({
        display: '+',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeBonfires.value, buildBonfire.amount.value); },
        onClick() { activeBonfires.value = Decimal.add(activeBonfires.value, 1); }
    }));
    const maxBonfire = createClickable(() => ({
        display: 'Max',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeBonfires.value, buildBonfire.amount.value); },
        onClick() { activeBonfires.value = buildBonfire.amount.value; }
    }));

    const activeKilns = persistent<DecimalSource>(0);
    const kilnLogs = computed(() => Decimal.times(activeKilns.value, 1e6));
    const kilnCoal = computed(() => Decimal.times(activeKilns.value, 1e4));
    const kilnAsh = computed(() => Decimal.times(activeKilns.value, 1e4));
    const buildKiln = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            return Decimal.pow(1.1, this.amount.value).times(1e7);
        },
        display: jsx(() => <>
            <h3>Charcoal Kiln</h3><br/>
            Burn 1,000,000 logs for 10,000 coal and 10,000 ash<br/>
            <br/>
            Currently:<br/>
            -{format(kilnLogs.value)} logs/sec<br/>
            +{format(kilnCoal.value)} coal/sec<br/>
            +{format(kilnAsh.value)} ash/sec<br/>
            <br/>
            Cost: {formatWhole(unref(buildKiln.cost!))} {buildKiln.resource!.displayName}
        </>),
        onPurchase() {
            activeKilns.value = Decimal.add(activeKilns.value, 1);
        },
        style: {
            color: colorText,
            width: "160px"
        }
    })) as GenericBuyable;
    const minKiln = createClickable(() => ({
        display: '0',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeKilns.value, 0); },
        onClick() { activeKilns.value = 0; }
    }));
    const removeKiln = createClickable(() => ({
        display: '-',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.gt(activeKilns.value, 0); },
        onClick() { activeKilns.value = Decimal.sub(activeKilns.value, 1); }
    }));
    const addKiln = createClickable(() => ({
        display: '+',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeKilns.value, buildKiln.amount.value); },
        onClick() { activeKilns.value = Decimal.add(activeKilns.value, 1); }
    }));
    const maxKiln = createClickable(() => ({
        display: 'Max',
        style: { minHeight: "20px", width: "40px", color: colorText },
        canClick() { return Decimal.lt(activeKilns.value, buildKiln.amount.value); },
        onClick() { activeKilns.value = buildKiln.amount.value; }
    }));

    const warmerCutters = createUpgrade(() => ({
        resource: coal,
        cost: 5,
        display: {
            title: "Warmer Cutters",
            description: "Cut down twice as many trees/s"
        },
        style: { color: colorText }
    }));
    const warmerPlanters = createUpgrade(() => ({
        resource: coal,
        cost: 5,
        display: {
            title: "Warmer Planters",
            description: "Plant twice as many trees/s"
        },
        style: { color: colorText }
    }));
    const basicFertilizer = createUpgrade(() => ({
        resource: ash,
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
        onPurchase() { fireResource.value = Decimal.add(fireResource.value, this.cost); },
        style: { color: colorText }
    }));
    const row1upgrades = [
        warmerCutters,
        warmerPlanters,
        basicFertilizer,
        unlockBonfire
    ];

    const dedicatedCutters = createUpgrade(() => ({
        resource: coal,
        cost: 250,
        display: {
            title: "Dedicated Cutter Heaters",
            description: "Double the bonus from Heated Cutters"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const dedicatedPlanters = createUpgrade(() => ({
        resource: coal,
        cost: 250,
        display: {
            title: "Dedicated Planter Heaters",
            description: "Double the bonus from Heated Planters"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const betterFertilizer = createUpgrade(() => ({
        canAfford() {
            return Decimal.gte(trees.logs.value, 1e5)
                && Decimal.gte(ash.value, 1e5);
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, 1e5);
            ash.value = Decimal.sub(ash.value, 1e5);
        },
        display: jsx(() => <>
            <h3>Mulched Soil</h3><br/>
            Double the bonus from Fertilized Soil<br/>
            <br/>
            Cost: {formatWhole(1e5)} {trees.logs.displayName}<br/>
            {formatWhole(1e5)} {ash.displayName}
        </>),
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const unlockKiln = createUpgrade(() => ({
        resource: trees.logs,
        cost: 1e7,
        display: {
            title: "Efficient Fires",
            description: "Move the fires underground to keep the coal from turning to ash"
        },
        style: { color: colorText },
        visibility: () => showIf(unlockBonfire.bought.value)
    }));
    const row2upgrades = [
        dedicatedCutters,
        dedicatedPlanters,
        betterFertilizer,
        unlockKiln
    ];

    const heatedCutters = createBuyable(() => ({
        resource: coal,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            return Decimal.add(v, 1).pow(2.5).times(10);
        },
        display: {
            title: "Heated Cutters",
            description: "Even warmer cutters cut down trees faster",
            effectDisplay: jsx(() => <>
                Cutters cut down trees {format(computedHeatedCutterEffect.value)}x faster
            </>)
        },
        style: { color: colorText },
        visibility: () => showIf(warmerCutters.bought.value)
    })) as GenericBuyable;
    const heatedPlanters = createBuyable(() => ({
        resource: coal,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            return Decimal.add(v, 1).pow(2.5).times(10);
        },
        display: {
            title: "Heated Planters",
            description: "Even warmer planters plant trees faster",
            effectDisplay: jsx(() => <>
                Planters plant trees {format(computedHeatedPlanterEffect.value)}x faster
            </>)
        },
        style: { color: colorText },
        visibility: () => showIf(warmerPlanters.bought.value)
    })) as GenericBuyable;
    const moreFertilizer = createBuyable(() => ({
        resource: ash,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 50)) v = Decimal.pow(v, 2).div(50);
            if (Decimal.gte(v, 200)) v = Decimal.pow(v, 2).div(200);
            if (Decimal.gte(v, 2e6)) v = Decimal.pow(v, 2).div(2e6);
            return Decimal.add(v, 1).pow(1.5).times(50000);
        },
        display: {
            title: "Fertilized Soil",
            description: "More fertilizer helps trees grow bigger",
            effectDisplay: jsx(() => <>
                Trees give {format(computedFertilizerEffect.value)}x more logs
            </>)
        },
        style: { color: colorText },
        visibility: () => showIf(basicFertilizer.bought.value)
    })) as GenericBuyable;
    const row3buyables = [
        heatedCutters,
        heatedPlanters,
        moreFertilizer
    ]

    const heatedCutterEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return Decimal.times(heatedCutters.amount.value, 0.25); },
            description: "Heated Cutters",
            enabled() { return Decimal.gt(heatedCutters.amount.value, 0); }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Dedicated Cutter Heaters",
            enabled: dedicatedCutters.bought
        }))
    ]);
    const computedHeatedCutterEffect = computed(() => heatedCutterEffect.apply(1));
    
    const heatedPlanterEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return Decimal.times(heatedPlanters.amount.value, 0.25); },
            description: "Heated Planters",
            enabled() { return Decimal.gt(heatedPlanters.amount.value, 0); }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Dedicated Planter Heaters",
            enabled: dedicatedPlanters.bought
        }))
    ]);
    const computedHeatedPlanterEffect = computed(() => heatedPlanterEffect.apply(1));

    const fertilizerEffect = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return Decimal.times(moreFertilizer.amount.value, 0.25); },
            description: "Fertilized Soil",
            enabled() { return Decimal.gt(moreFertilizer.amount.value, 0); }
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Mulched Soil",
            enabled: betterFertilizer.bought
        }))
    ]);
    const computedFertilizerEffect = computed(() => fertilizerEffect.apply(1));

    const coalGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return fireCoal.value; },
            description: "Small Fires",
            enabled() { return Decimal.gt(activeFires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return bonfireCoal.value; },
            description: "Bonfires",
            enabled() { return Decimal.gt(activeBonfires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return kilnCoal.value; },
            description: "Charcoal Kilns",
            enabled() { return Decimal.gt(activeKilns.value, 0); }
        })),
        createExponentialModifier(() => ({
            exponent: 1.25,
            description: "3 Elves Trained",
            enabled: elves.milestones[2].earned
        }))
    ]);
    const computedCoalGain = computed(() => coalGain.apply(0));

    const ashGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return fireAsh.value; },
            description: "Small Fires",
            enabled() { return Decimal.gt(activeFires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return bonfireAsh.value; },
            description: "Bonfires",
            enabled() { return Decimal.gt(activeBonfires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return kilnAsh.value; },
            description: "Charcoal Kilns",
            enabled() { return Decimal.gt(activeKilns.value, 0); }
        }))
    ]);
    const computedAshGain = computed(() => ashGain.apply(0));

    const logConsumption = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend() { return Decimal.negate(fireLogs.value); },
            description: "Small Fires",
            enabled() { return Decimal.gt(activeFires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return Decimal.negate(bonfireLogs.value); },
            description: "Bonfires",
            enabled() { return Decimal.gt(activeBonfires.value, 0); }
        })),
        createAdditiveModifier(() => ({
            addend() { return Decimal.negate(kilnLogs.value); },
            description: "Charcoal Kilns",
            enabled() { return Decimal.gt(activeKilns.value, 0); }
        }))
    ]);
    const computedLogConsumption = computed(() => logConsumption.apply(0));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Log Consumption",
            modifier: logConsumption,
            base: 0,
            visible() { return Decimal.gt(activeFires.value, 0) || Decimal.gt(activeBonfires.value, 0) || Decimal.gt(activeKilns.value, 0); }
        },
        {
            title: "Coal Gain",
            modifier: coalGain,
            base: 0,
            visible() { return Decimal.gt(activeFires.value, 0) || Decimal.gt(activeBonfires.value, 0) || Decimal.gt(activeKilns.value, 0); }
        },
        {
            title: "Ash Gain",
            modifier: ashGain,
            base: 0,
            visible() { return Decimal.gt(activeFires.value, 0) || Decimal.gt(activeBonfires.value, 0) || Decimal.gt(activeKilns.value, 0); }
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
        trees.logs.value = Decimal.times(diff, computedLogConsumption.value).plus(trees.logs.value);
        coal.value = Decimal.times(diff, computedCoalGain.value).plus(coal.value);
        ash.value = Decimal.times(diff, computedAshGain.value).plus(ash.value);
    });

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(totalCoal.value, totalCoalGoal)) {
            main.loreTitle.value = "Day complete!";
            main.loreBody.value =
                "Santa looks at all the coal you've gathered and tells you you've done well! He says you should take the rest of the day off so you're refreshed for tomorrow's work. Good Job!";
            main.day.value = day + 1;
            main.minimized.value = false;
            player.devSpeed = 0;
        }
    });

    return {
        name,
        color: colorCoal,
        coal,
        totalCoal,
        ash,
        activeFires,
        buildFire,
        activeBonfires,
        buildBonfire,
        activeKilns,
        buildKiln,
        warmerCutters,
        warmerPlanters,
        basicFertilizer,
        unlockBonfire,
        dedicatedCutters,
        dedicatedPlanters,
        betterFertilizer,
        unlockKiln,
        heatedCutters,
        heatedPlanters,
        moreFertilizer,
        computedHeatedCutterEffect,
        computedHeatedPlanterEffect,
        computedFertilizerEffect,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Reach ${formatWhole(totalCoalGoal)} ${coal.displayName} to complete the day`
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
                <MainDisplay
                    resource={coal}
                    color={colorCoal}
                    style="margin-bottom: 0"
                    effectDisplay={
                        undefined
                    }
                />
                <Spacer />
                <MainDisplay
                    resource={ash}
                    color={colorAsh}
                    style="margin-bottom: 0"
                    effectDisplay={
                        undefined
                    }
                />
                <Spacer />
                <Row>
                    <Column>
                        {render(buildFire)}
                        <div>{formatWhole(activeFires.value)}/{formatWhole(buildFire.amount.value)}</div>
                        {renderRow(minFire, removeFire, addFire, maxFire)}
                    </Column>
                    { unlockBonfire.bought.value ? <>
                        <Spacer />
                        <Column>
                            {render(buildBonfire)}
                            <div>{formatWhole(activeBonfires.value)}/{formatWhole(buildBonfire.amount.value)}</div>
                            {renderRow(minBonfire, removeBonfire, addBonfire, maxBonfire)}
                        </Column>
                        </> : undefined
                    }
                    { unlockKiln.bought.value ? <>
                        <Spacer />
                        <Column>
                            {render(buildKiln)}
                            <div>{formatWhole(activeKilns.value)}/{formatWhole(buildKiln.amount.value)}</div>
                            {renderRow(minKiln, removeKiln, addKiln, maxKiln)}
                        </Column>
                        </> : undefined
                    }
                </Row>
                <Spacer />
                {renderRow(...row1upgrades)}
                {renderRow(...row2upgrades)}
                {renderRow(...row3buyables)}
            </>
        ))
    };
});

export default layer;
