/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import {
    createCollapsibleMilestones,
    createCollapsibleModifierSections,
    setUpDailyProgressTracker
} from "data/common";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createSequentialModifier } from "game/modifiers";
import { noPersist } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ref } from "vue";
import cloth from "./cloth";
import dyes from "./dyes";
import metal from "./metal";
import plastic from "./plastic";
import trees from "./trees";
import workshop from "./workshop";

const id = "toys";
const day = 17;

const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Toys";
    const color = "cornflowerblue";

    const clothes = createResource<DecimalSource>(0, "clothes");
    const woodenBlocks = createResource<DecimalSource>(0, " wooden blocks");
    const trucks = createResource<DecimalSource>(0, "trucks");
    const toyGain = createSequentialModifier(() => []);
    const toySum = createResource(
        computed(() => Decimal.add(clothes.value, woodenBlocks.value).add(trucks.value)),
        "toys"
    );

    const clothesCost = computed(() => {
        let clothFactor = Decimal.add(1, clothesBuyable.amount.value);
        if (milestones.milestone1.earned.value) {
            clothFactor = clothFactor.div(
                Decimal.div(workshop.foundationProgress.value, 100).floor()
            );
        }
        return {
            cloth: clothFactor.mul(1e13),
            dye: clothFactor.mul(2e14)
        };
    });
    const clothesBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Clothes</h3>

                <div>Click this buyable to make some clothes!</div>

                <div>You have {formatWhole(clothes.value)} clothes.</div>

                <div>
                    Costs{" "}
                    <span
                        class={
                            Decimal.lt(cloth.cloth.value, clothesCost.value.cloth)
                                ? "unaffordable"
                                : ""
                        }
                    >
                        {format(clothesCost.value.cloth)} cloth
                    </span>{" "}
                    and requires{" "}
                    <span
                        class={
                            [dyes.dyes.red, dyes.dyes.yellow, dyes.dyes.blue].some(d =>
                                Decimal.lt(d.amount.value, clothesCost.value.dye)
                            )
                                ? "unaffordable"
                                : ""
                        }
                    >
                        {format(clothesCost.value.dye)} of red, yellow, and blue dye
                    </span>
                </div>
            </>
        )),
        canPurchase(): boolean {
            return (
                clothesCost.value.cloth.lte(cloth.cloth.value) &&
                clothesCost.value.dye.lte(dyes.dyes.blue.amount.value) &&
                clothesCost.value.dye.lte(dyes.dyes.red.amount.value) &&
                clothesCost.value.dye.lte(dyes.dyes.yellow.amount.value)
            );
        },
        onPurchase() {
            cloth.cloth.value = Decimal.sub(cloth.cloth.value, clothesCost.value.cloth);
            this.amount.value = Decimal.add(this.amount.value, 1);
            clothes.value = Decimal.add(clothes.value, 1);
        }
    })) as GenericBuyable;
    const woodenBlocksCost = computed(() => {
        let woodFactor = Decimal.add(1, woodenBlocksBuyable.amount.value).pow(5);
        if (milestones.milestone1.earned.value) {
            woodFactor = woodFactor.div(
                Decimal.div(workshop.foundationProgress.value, 100).floor()
            );
        }
        return {
            wood: woodFactor.mul(1e63)
        };
    });
    const woodenBlocksBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Wooden Blocks</h3>

                <div>Click this buyable to make some wooden blocks!</div>

                <div>You have {formatWhole(woodenBlocks.value)} wooden blocks.</div>

                <div>Costs {format(woodenBlocksCost.value.wood)} logs</div>
            </>
        )),
        canPurchase(): boolean {
            return woodenBlocksCost.value.wood.lte(trees.logs.value);
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, woodenBlocksCost.value.wood);
            this.amount.value = Decimal.add(this.amount.value, 1);
            woodenBlocks.value = Decimal.add(woodenBlocks.value, 1);
        }
    })) as GenericBuyable;
    const trucksCost = computed(() => {
        let factor = Decimal.add(1, trucksBuyable.amount.value).pow(3);
        let plasticFactor = Decimal.add(1, trucksBuyable.amount.value);
        if (milestones.milestone1.earned.value) {
            factor = factor.div(Decimal.div(workshop.foundationProgress.value, 100).floor());
            plasticFactor = plasticFactor.div(
                Decimal.div(workshop.foundationProgress.value, 100).floor()
            );
        }
        return {
            metal: factor.mul(1e43),
            plastic: plasticFactor.mul(1e14)
        };
    });
    const trucksBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Trucks</h3>

                <div>Click this buyable to make some trucks!</div>

                <div>You have {formatWhole(trucks.value)} trucks.</div>

                <div>
                    Costs{" "}
                    <span
                        class={
                            Decimal.lt(metal.metal.value, trucksCost.value.metal)
                                ? "unaffordable"
                                : ""
                        }
                    >
                        {format(trucksCost.value.metal)} metal
                    </span>{" "}
                    and{" "}
                    <span
                        class={
                            Decimal.lt(plastic.plastic.value, trucksCost.value.plastic)
                                ? "unaffordable"
                                : ""
                        }
                    >
                        {format(trucksCost.value.plastic)} plastic
                    </span>
                </div>
            </>
        )),
        canPurchase(): boolean {
            return (
                trucksCost.value.metal.lte(metal.metal.value) &&
                trucksCost.value.plastic.lte(plastic.plastic.value)
            );
        },
        onPurchase() {
            metal.metal.value = Decimal.sub(metal.metal.value, trucksCost.value.metal);
            plastic.plastic.value = Decimal.sub(plastic.plastic.value, trucksCost.value.plastic);
            this.amount.value = Decimal.add(this.amount.value, 1);
            trucks.value = Decimal.add(trucks.value, 1);
        }
    })) as GenericBuyable;
    const buyables = [clothesBuyable, woodenBlocksBuyable, trucksBuyable];
    const trucksUpgrade1 = createUpgrade(() => ({
        resource: noPersist(trucks),
        cost: 10,
        display: {
            title: "Load logs onto trucks",
            description: "Log gain is doubled."
        }
    }));
    const clothesUpgrade1 = createUpgrade(() => ({
        resource: noPersist(clothes),
        cost: 30,
        display: {
            title: "Give elves clothes to wear",
            description:
                "Multiply ore per mining operation and auto-smelt purity by the number of clothes you have."
        }
    }));

    const woodenBlocksUpgrade1 = createUpgrade(() => ({
        resource: noPersist(woodenBlocks),
        cost: 15,
        display: {
            title: "Build wooden towers",
            description: "You can now build 2 extra tall workshops!"
        }
    }));
    const row1Upgrades = [trucksUpgrade1, clothesUpgrade1, woodenBlocksUpgrade1];
    const milestone1 = createMilestone(() => ({
        display: {
            requirement: "10 toys",
            effectDisplay:
                "The cost of making toys is divided by the number of complete workshops you have"
        },
        shouldEarn: () => Decimal.gte(toySum.value, 10)
    }));
    const milestone2 = createMilestone(() => ({
        display: {
            requirement: "100 toys",
            effectDisplay: "Unlock black dyes"
        },
        shouldEarn: () => Decimal.gte(toySum.value, 100),
        visibility: () => showIf(milestone1.earned.value)
    }));

    const milestone3 = createMilestone(() => ({
        display: {
            requirement: "200 toys",
            effectDisplay: "Beach wrapping paper is much more powerful"
        },
        shouldEarn: () => Decimal.gte(toySum.value, 200),
        visibility: () => showIf(milestone2.earned.value)
    }));
    const milestone4 = createMilestone(() => ({
        display: {
            requirement: "350 toys",
            effectDisplay: "Gain 50x oil and plastic"
        },
        shouldEarn: () => Decimal.gte(toySum.value, 350),
        visibility: () => showIf(milestone3.earned.value)
    }));
    const milestones = { milestone1, milestone2, milestone3, milestone4 };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: `Toy Gain`,
            modifier: toyGain,
            base: 1,
            visible: true
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

    const { total: totalToys, trackerDisplay } = setUpDailyProgressTracker({
        resource: toySum,
        goal: 500,
        name,
        day,
        textColor: "var(--feature-foreground)",
        background: {
            gradient: "toys-bar",
            duration: "15s"
        },
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        day,
        color,
        clothes,
        woodenBlocks,
        trucks,
        toySum,
        totalToys,
        buyables,
        row1Upgrades,
        milestones,
        generalTabCollapsed,
        collapseMilestones,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay
                    resource={clothes}
                    color="lightblue"
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={woodenBlocks}
                    color="cornflowerblue"
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={trucks}
                    color="cadetblue"
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <Spacer />
                {renderRow(...buyables)}
                <Spacer />
                {renderGrid(row1Upgrades)}
                <Spacer />
                <div>You have {formatWhole(toySum.value)} toys</div>
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} <span class="desc">{formatWhole(toySum.value)} total toys</span>
            </div>
        ))
    };
});

export default layer;
