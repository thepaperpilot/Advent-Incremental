/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import {
    createCollapsibleMilestones,
    createCollapsibleModifierSections,
    setUpDailyProgressTracker
} from "data/common";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createMilestone } from "features/milestones/milestone";
import { createResource, Resource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
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
import Decimal, { DecimalSource, format, formatGain, formatLimit, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ref } from "vue";
import metal from "./metal";
import plastic from "./plastic";
import cloth from "./cloth";
import trees from "./trees";
import dyes from "./dyes";
import paper from "./paper";
import workshop from "./workshop";
const id = "toys";
const day = 17;

const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Toys";
    const colorBright = "#4BDC13";
    const colorDark = "green";

    const clothes = createResource<DecimalSource>(0, "clothes");
    const woodenBlocks = createResource<DecimalSource>(0, " wooden blocks");
    const trucks = createResource<DecimalSource>(0, "trucks");
    const toyGain = createSequentialModifier(() => [

    ]);
    const toySum = createResource(computed(() => Decimal.add(clothes.value, woodenBlocks.value).add(trucks.value)), "toys");
    
    const clothesCost = computed(() => {
        var clothFactor = Decimal.add(1,clothesBuyable.amount.value);
        if(milestones.milestone1.earned){
            clothFactor=clothFactor.div(Decimal.div(workshop.foundationProgress.value,100).floor())
        }
        return {
            cloth: clothFactor.mul(1e8),
            dye: clothFactor.mul(1e6)
        };
    });
    const clothesBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Clothes</h3>

                <div>
                    Click this buyable to make some clothes!
                </div>

                <div>
                    You have {formatWhole(clothes.value)} clothes.
                </div>
                
                    <div>
                    Costs {format(clothesCost.value.cloth)} cloth and requires {format(clothesCost.value.dye)} of red, yellow, and
                        blue dye
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
            clothes.value = this.amount.value
        },
    })) as GenericBuyable;
    const woodenBlocksCost = computed(() => {
        var woodFactor = Decimal.add(1,woodenBlocksBuyable.amount.value).pow(5);
        if(milestones.milestone1.earned){
            woodFactor=woodFactor.div(Decimal.div(workshop.foundationProgress.value,100).floor())
        }
        return {
            wood: woodFactor.mul(1e40)
        };
    });
    const woodenBlocksBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Wooden Blocks</h3>

                <div>
                    Click this buyable to make some wooden blocks!
                </div>

                <div>
                    You have {formatWhole(woodenBlocks.value)} wooden blocks.
                </div>
                
                    <div>
                    Costs {format(woodenBlocksCost.value.wood)} logs
                    </div>
            </>
        )),
        canPurchase(): boolean {
            return (
                woodenBlocksCost.value.wood.lte(trees.logs.value)
            );
        },
        onPurchase() {
            trees.logs.value = Decimal.sub(trees.logs.value, woodenBlocksCost.value.wood);
            this.amount.value = Decimal.add(this.amount.value, 1);
            woodenBlocks.value = this.amount.value
        },
    })) as GenericBuyable;
    const trucksCost = computed(() => {
        var factor = Decimal.add(1,trucksBuyable.amount.value).pow(3);
        var plasticFactor = Decimal.add(1,trucksBuyable.amount.value);
        if(milestones.milestone1.earned){
            factor=factor.div(Decimal.div(workshop.foundationProgress.value,100).floor())
            plasticFactor=plasticFactor.div(Decimal.div(workshop.foundationProgress.value,100).floor())
        }
        return {
            metal: factor.mul(1e25),
            plastic: plasticFactor.mul(1e10)

        };
    });
    const trucksBuyable = createBuyable(() => ({
        display: jsx(() => (
            <>
                <h3>Make Trucks</h3>

                <div>
                    Click this buyable to make some trucks!
                </div>

                <div>
                    You have {formatWhole(woodenBlocks.value)} wooden blocks.
                </div>
                
                    <div>
                    Costs {format(trucksCost.value.metal)} metal and {format(trucksCost.value.plastic)} plastic
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
            trucks.value = this.amount.value
        },
    })) as GenericBuyable;
    const buyables = [ clothesBuyable, woodenBlocksBuyable, trucksBuyable ];
    const milestone1 = createMilestone(() => ({
        display: {
            requirement: "10 toys",
            effectDisplay: "The number of complete workshops you have divides the cost to make toys."
        },
        shouldEarn: () => Decimal.gte(toySum.value, 10)
    }));
const milestones = {milestone1}
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

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        
    });


    const { total: totalToys, trackerDisplay } = setUpDailyProgressTracker({
        resource: toySum,
        goal: 8e9,
        name,
        day,
        color: colorDark,
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    return {
        name,
        day,
        color: colorBright,
        clothes,
        woodenBlocks,
        trucks,
        toySum,
        totalToys,
        buyables,
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
                    color={colorBright}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={woodenBlocks}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <MainDisplay
                    resource={trucks}
                    color={colorDark}
                    style="margin-bottom: 0"
                    productionDisplay={undefined}
                />
                <Spacer />
                {renderRow(...buyables)}
                <Spacer />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(toySum.value)} {"total toys"}
            </div>
        ))
    };
});

export default layer;
