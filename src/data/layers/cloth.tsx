/**
 * @module
 * @hidden
 */
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createAdditiveModifier, createSequentialModifier } from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import { formatWhole } from "util/break_eternity";
import { Direction } from "util/common";
import { render, renderCol, renderRow } from "util/vue";
import { computed, ref } from "vue";
import metal from "./metal";
import paper from "./paper";
import trees from "./trees";

const id = "cloth";
const day = 8;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Cloth";
    const color = "white";

    const cloth = createResource<DecimalSource>(0, "cloth");
    const wool = createResource<DecimalSource>(0, "wool");
    const sheep = createResource<DecimalSource>(10, "sheep");

    const breedingProgress = persistent<DecimalSource>(0);
    const breedingProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: 0",
        fillStyle: "margin-top: 0; transition-duration: 0s; background: black",
        progress: () => Decimal.div(breedingProgress.value, computedBreedingCooldown.value)
    }));
    const breeding = createClickable(() => ({
        display: {
            title: "Breed sheep",
            description: jsx(() => (
                <>
                    Breed {formatWhole(Decimal.floor(computedSheepGain.value))} sheep
                    <br />
                    {render(breedingProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () => Decimal.gte(breedingProgress.value, computedBreedingCooldown.value),
        onClick() {
            if (Decimal.lt(breedingProgress.value, computedBreedingCooldown.value)) {
                return;
            }
            const amount = Decimal.floor(computedSheepGain.value);
            sheep.value = Decimal.add(sheep.value, amount);
            breedingProgress.value = 0;
        }
    }));

    const shearingProgress = persistent<DecimalSource>(0);
    const shearingProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: 0",
        fillStyle: "margin-top: 0; transition-duration: 0s; background: black",
        progress: () => Decimal.div(shearingProgress.value, computedShearingCooldown.value)
    }));
    const shearing = createClickable(() => ({
        display: {
            title: "Shear sheep",
            description: jsx(() => (
                <>
                    Shear up to {formatWhole(Decimal.floor(computedShearingAmount.value))} sheep
                    <br />
                    {render(shearingProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () => Decimal.gte(shearingProgress.value, computedShearingCooldown.value),
        onClick() {
            if (Decimal.lt(shearingProgress.value, computedShearingCooldown.value)) {
                return;
            }
            const amount = Decimal.min(sheep.value, computedShearingAmount.value).floor();
            wool.value = Decimal.add(wool.value, amount);
            shearingProgress.value = 0;
        }
    }));

    const spinningProgress = persistent<DecimalSource>(0);
    const spinningProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        borderStyle: "border-color: black",
        baseStyle: "margin-top: 0",
        fillStyle: "margin-top: 0; transition-duration: 0s; background: black",
        progress: () => Decimal.div(spinningProgress.value, computedSpinningCooldown.value)
    }));
    const spinning = createClickable(() => ({
        display: {
            title: "Spinning wool",
            description: jsx(() => (
                <>
                    Spin {formatWhole(Decimal.floor(computedSpinningAmount.value))} wool
                    <br />
                    {render(spinningProgressBar)}
                </>
            ))
        },
        style: {
            minHeight: "80px"
        },
        canClick: () => Decimal.gte(spinningProgress.value, computedSpinningCooldown.value),
        onClick() {
            if (Decimal.lt(spinningProgress.value, computedSpinningCooldown.value)) {
                return;
            }
            const amount = Decimal.min(wool.value, computedSpinningAmount.value).floor();
            cloth.value = Decimal.add(cloth.value, amount);
            wool.value = Decimal.sub(wool.value, amount);
            spinningProgress.value = 0;
        }
    }));

    const breedSheepHK = createHotkey(() => ({
        key: "b",
        description: 'Press the "Breed Sheep" button',
        onPress: () => {
            if (breeding.canClick.value) breeding.onClick();
        }
    }));

    const shearSheepHK = createHotkey(() => ({
        key: "h", // For some reason, "shift+s" doesn't work properly
        description: 'Press the "Shear Sheep" button',
        onPress: () => {
            if (shearing.canClick.value) shearing.onClick();
        }
    }));

    const spinWoolHK = createHotkey(() => ({
        key: "s",
        description: 'Press the "Spin Wool" button',
        onPress: () => {
            if (spinning.canClick.value) spinning.onClick();
        }
    }));

    const buildPens = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            return Decimal.pow(1.5, v).times(1e14);
        },
        display: {
            title: "Build more pens",
            description: "Breed +1 sheep at once"
        }
    }));

    const betterShears = createBuyable(() => ({
        resource: metal.metal,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            return Decimal.pow(1.4, v).times(10000);
        },
        display: {
            title: "Make stronger shears",
            description: "Shear +1 sheep at once"
        }
    }));

    const fasterSpinning = createBuyable(() => ({
        resource: paper.paper,
        cost() {
            let v = this.amount.value;
            if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
            return Decimal.pow(1.3, v).times(1000000);
        },
        display: {
            title: "Learn how to spin",
            description: "Spin +1 wool at once"
        }
    }));

    const treesUpgrade1 = createUpgrade(() => ({
        resource: noPersist(cloth),
        cost: 100,
        display: {
            title: "Lumberjack Boots",
            description: "Quadruple log gain"
        }
    }));
    const treesUpgrade2 = createUpgrade(() => ({
        resource: noPersist(wool),
        cost: 150,
        visibility: () => showIf(treesUpgrade1.bought.value),
        display: {
            title: "Lumberjack Jeans",
            description: "Quadruple trees cut"
        }
    }));
    const treesUpgrade3 = createUpgrade(() => ({
        resource: noPersist(sheep),
        cost: 200,
        visibility: () => showIf(treesUpgrade2.bought.value),
        display: {
            title: "Lumberjack Plaid",
            description: "Quadruple trees planted"
        }
    }));
    const treesUpgrades = { treesUpgrade3, treesUpgrade2, treesUpgrade1 };

    const metalUpgrade1 = createUpgrade(() => ({
        resource: noPersist(cloth),
        cost: 150,
        display: {
            title: "Mining boots",
            description: "Quadruple ash gain"
        }
    }));
    const metalUpgrade2 = createUpgrade(() => ({
        resource: noPersist(wool),
        cost: 225,
        visibility: () => showIf(metalUpgrade1.bought.value),
        display: {
            title: "Mining overalls",
            description: "Double coal gain"
        }
    }));
    const metalUpgrade3 = createUpgrade(() => ({
        resource: noPersist(sheep),
        cost: 300,
        visibility: () => showIf(metalUpgrade2.bought.value),
        display: {
            title: "Mining helmet",
            description: "Triple coal gain"
        }
    }));
    const metalUpgrades = { metalUpgrade3, metalUpgrade2, metalUpgrade1 };

    const paperUpgrade1 = createUpgrade(() => ({
        resource: noPersist(cloth),
        cost: 200,
        display: {
            title: "Scholar's shoes",
            description: "Double paper gain"
        }
    }));
    const paperUpgrade2 = createUpgrade(() => ({
        resource: noPersist(wool),
        cost: 200,
        visibility: () => showIf(paperUpgrade1.bought.value),
        display: {
            title: "Scholar's slacks",
            description: "Double paper gain"
        }
    }));
    const paperUpgrade3 = createUpgrade(() => ({
        resource: noPersist(sheep),
        cost: 400,
        visibility: () => showIf(paperUpgrade2.bought.value),
        display: {
            title: "Scholar's jacket",
            description: "Double paper gain"
        }
    }));
    const paperUpgrades = { paperUpgrade3, paperUpgrade2, paperUpgrade1 };

    const sheepGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: buildPens.amount,
            description: "Build more pens"
        }))
    ]);
    const computedSheepGain = computed(() => sheepGain.apply(1));
    const breedingCooldown = createSequentialModifier(() => []);
    const computedBreedingCooldown = computed(() => breedingCooldown.apply(1));

    const shearingAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: betterShears.amount,
            description: "Make stronger shears"
        }))
    ]);
    const computedShearingAmount = computed(() => shearingAmount.apply(1));
    const shearingCooldown = createSequentialModifier(() => []);
    const computedShearingCooldown = computed(() => shearingCooldown.apply(1));

    const spinningAmount = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: fasterSpinning.amount,
            description: "Learn how to spin"
        }))
    ]);
    const computedSpinningAmount = computed(() => spinningAmount.apply(1));
    const spinningCooldown = createSequentialModifier(() => []);
    const computedSpinningCooldown = computed(() => spinningCooldown.apply(1));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Sheep Gain",
            modifier: sheepGain,
            base: 1
        },
        {
            title: "Sheep Breeding Cooldown",
            modifier: breedingCooldown,
            base: 1,
            visible: false,
            unit: "s"
        },
        {
            title: "Shearing Amount",
            modifier: shearingAmount,
            base: 1
        },
        {
            title: "Shearing Cooldown",
            modifier: shearingCooldown,
            base: 1,
            visible: false,
            unit: "s"
        },
        {
            title: "Spinning Amount",
            modifier: spinningAmount,
            base: 1
        },
        {
            title: "Spinning Cooldown",
            modifier: spinningCooldown,
            base: 1,
            visible: false,
            unit: "s"
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

        if (Decimal.gte(breedingProgress.value, computedBreedingCooldown.value)) {
            breedingProgress.value = computedBreedingCooldown.value;
        } else {
            breedingProgress.value = Decimal.add(breedingProgress.value, diff);
            if (breeding.isHolding.value) {
                breeding.onClick();
            }
        }

        if (Decimal.gte(shearingProgress.value, computedShearingCooldown.value)) {
            shearingProgress.value = computedShearingCooldown.value;
        } else {
            shearingProgress.value = Decimal.add(shearingProgress.value, diff);
            if (shearing.isHolding.value) {
                shearing.onClick();
            }
        }

        if (Decimal.gte(spinningProgress.value, computedSpinningCooldown.value)) {
            spinningProgress.value = computedSpinningCooldown.value;
        } else {
            spinningProgress.value = Decimal.add(spinningProgress.value, diff);
            if (spinning.isHolding.value) {
                spinning.onClick();
            }
        }
    });

    const { total: totalCloth, trackerDisplay } = setUpDailyProgressTracker({
        resource: cloth,
        goal: 1e3,
        name,
        day,
        color,
        textColor: "var(--feature-foreground)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        color,
        cloth,
        totalCloth,
        wool,
        sheep,
        buildPens,
        betterShears,
        fasterSpinning,
        treesUpgrades,
        metalUpgrades,
        paperUpgrades,
        generalTabCollapsed,
        breedingProgress,
        shearingProgress,
        spinningProgress,
        breedSheepHK,
        shearSheepHK,
        spinWoolHK,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay resource={cloth} style="margin-bottom: 0" />
                <MainDisplay resource={wool} style="margin-bottom: 0" />
                <MainDisplay resource={sheep} style="margin-bottom: 0" />
                {renderRow(breeding, shearing, spinning)}
                {renderRow(buildPens, betterShears, fasterSpinning)}
                <Spacer />
                <Row>
                    {renderCol(...Object.values(treesUpgrades))}
                    {renderCol(...Object.values(metalUpgrades))}
                    {renderCol(...Object.values(paperUpgrades))}
                </Row>
            </>
        ))
    };
});

export default layer;
