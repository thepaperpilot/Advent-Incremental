import { isArray } from "@vue/shared";
import SpacerVue from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import MainDisplayVue from "features/resources/MainDisplay.vue";
import { createResource, trackBest, trackTotal, Resource } from "features/resources/resource";
import { createLayer, BaseLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, ComputedRef, ref, unref } from "vue";
import metal from "./metal";
import oil from "./oil";
import { createCollapsibleMilestones } from "data/common"
import { globalBus } from "game/events";
import { createUpgrade } from "features/upgrades/upgrade";
import { ElfBuyable } from "./elves";
import management from "./management";
import paper from "./paper";
import ModalVue from "components/Modal.vue";

const id = "packing"
const day = 24;

const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Packing the Sleigh";
    const color = "lightblue";

    const packedPresents = createResource<DecimalSource>(0, "packed presents");
    const bestPresents = trackBest(packedPresents);
    const totalPresents = trackTotal(packedPresents);
    const totalPresentsResource = createResource<DecimalSource>(computed(() => totalPresents.value), "total packed presents");

    const sledSpace = 64e6;
    const packingResets = persistent<number>(0);

    const resetPacking = createClickable(() => ({
        display: {
            description: "Do it all again, but better"
        },
        visibility: () => showIf(Decimal.lt(packedPresents.value, 8e9) && Decimal.lte(remainingSize.value, 0)),
        onClick() {
            packedPresents.value = 0;
            packingResets.value++;
        }
    }))

    const packingProgress = persistent<DecimalSource>(0);
    const packingProgressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        fillStyle: {
            animation: "15s packing-bar linear infinite",
        },
        progress: () => packingProgress.value
    }))
    const packPresent = createClickable(() => ({
        display: {
            description: jsx(() => (
                <>
                    <h3>
                        Pack a present
                    </h3><br />
                    {render(packingProgressBar)}
                </>
            ))
        },
        visibility: () => showIf(Decimal.gt(remainingSize.value, 0)),
        canClick: () => Decimal.gte(packingProgress.value, 1),
        onClick() {
            if (Decimal.lt(packingProgress.value, 1)) {
                return;
            }
            packedPresents.value = Decimal.add(packedPresents.value, 1);
            packingProgress.value = 0;
        }
    }));

    const packingDensity = computed(() => {
        switch(packingResets.value) {
            default: return 0.6;
            case 1: return 0.7;
            case 2: return 0.85;
            case 3: return 1;
        }
    });

    const packedPresentsSize = computed(() => Decimal.times(packedPresents.value, 0.008).dividedBy(packingDensity.value));
    const currentMaxPresents = computed(() => Decimal.times(sledSpace, packingDensity.value).div(0.008));
    const remainingSize = computed(() => Decimal.sub(sledSpace, packedPresentsSize.value));

    const elfPackingSpeed = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.5, packingResets.value),
            description: "Better Organization",
            enabled: () => packingResets.value >= 1
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Jingle Level 1",
            enabled: management.elfTraining.packingElfTraining.milestones[0].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(helpers.elf.amount.value, 0.1).plus(1),
            description: "Jingle Level 2",
            enabled: management.elfTraining.packingElfTraining.milestones[1].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => 1 + Object.values(packingMilestones).filter(milestone => milestone.earned).length,
            description: "Jingle Level 3",
            enabled: management.elfTraining.packingElfTraining.milestones[2].earned
        }))
    ]);
    const computedElfPackingSpeed = computed(() => elfPackingSpeed.apply(1));

    const loaderPackingSpeed = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(0.5, packingResets.value),
            description: "Better Organization",
            enabled: () => packingResets.value >= 1
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Jingle Level 1",
            enabled: management.elfTraining.packingElfTraining.milestones[4].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(helpers.elf.amount.value, 0.1).plus(1),
            description: "Jingle Level 2",
            enabled: management.elfTraining.packingElfTraining.milestones[4].earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => 1 + Object.values(packingMilestones).filter(milestone => milestone.earned).length,
            description: "Jingle Level 3",
            enabled: management.elfTraining.packingElfTraining.milestones[4].earned
        }))
    ]);
    const computedLoaderPackingSpeed = computed(() => loaderPackingSpeed.apply(1000));
    const helpers = {
        elf: createBuyable(() => ({
            visibility: () => showIf(Decimal.gte(totalPresents.value, 10)),
            cost() {
                let v = this.amount.value;
                v = Decimal.pow(0.95, paper.books.packingBook.totalAmount.value).times(v);
                return Decimal.pow(1.2, v).times(10).floor()
            },
            inverseCost(cost: DecimalSource) {
                let amount = Decimal.div(cost, 10).log(1.2);
                amount = amount.div(Decimal.pow(0.95, paper.books.packingBook.totalAmount.value));
                return Decimal.isNaN(amount) ? Decimal.dZero : amount.floor().max(0);
            },
            resource: totalPresentsResource,
            display: jsx(() => (
                <>
                    <div><h3>Hire an elf assistant</h3></div>
                    Packs {format(computedElfPackingSpeed.value)} presents per second
                    <div><br />
                    Amount: {formatWhole(helpers.elf.amount.value)}</div>
                    <div><br />
                    Currently packing {format(Decimal.times(helpers.elf.amount.value, computedElfPackingSpeed.value))} presents per second</div>
                    <div>Requires: {formatWhole(unref(helpers.elf.cost!))} {helpers.elf.resource!.displayName}</div>
                </>
            )),
            style: {
                width: "200px"
            }
        })),
        loader: createBuyable(() => ({
            visibility: () => showIf(upgrades.loaderUnlock.bought.value),
            metalCost: computed(() => Decimal.pow(1.2, helpers.loader.amount.value).times(1e70) ),
            oilCost: computed(() => Decimal.pow(1.2, helpers.loader.amount.value).times(1e25) ),
            canPurchase(this: GenericBuyable & {metalCost: ComputedRef<DecimalSource>, oilCost: ComputedRef<DecimalSource>}) {
                return Decimal.gte(metal.metal.value, this.metalCost.value)
                    && Decimal.gte(oil.oil.value, this.oilCost.value)
            },
            inverseCost() {
                let metalAmount = Decimal.div(metal.metal.value, 1e40).log(1.5);
                let oilAmount = Decimal.div(oil.oil.value, 1e20).log(1.5);
                if (Decimal.isNaN(metalAmount) || Decimal.isNaN(oilAmount)) return Decimal.dZero;
                return Decimal.min(metalAmount, oilAmount).floor().max(0);
            },
            display: jsx(() => (
                <>
                    <div><h3>Build a loader</h3></div>
                    Loads {format(computedLoaderPackingSpeed.value)} presents per second
                    <div><br />
                    Amount: {formatWhole(helpers.loader.amount.value)}</div>
                    <div><br />
                    Currently packing {format(Decimal.times(helpers.loader.amount.value, computedLoaderPackingSpeed.value))} persents per second</div>
                    <div>
                        Cost: {displayCost(metal.metal, helpers.loader.metalCost.value, metal.metal.displayName)},
                        {displayCost(oil.oil, helpers.loader.oilCost.value, oil.oil.displayName)}</div>
                </>
            )),
            style: {
                width: "200px"
            }
        }))
    } as {
        elf: ElfBuyable,
        loader: ElfBuyable & {metalCost: ComputedRef<DecimalSource>, oilCost: ComputedRef<DecimalSource>}
    };

    const upgrades = {
        packingElf: createUpgrade(() => ({
            display: {
                title: "An Elf's Elf",
                description: "Hire an Elf to help you hire more Elves"
            },
            cost: 1000,
            resource: totalPresentsResource,
            style: {
                width: "200px"
            }/*,
            onPurchase () {
                main.days[3].recentlyUpdated.value = true;
            }*/
        })),
        loaderUnlock: createUpgrade(() => ({
            display: {
                title: "Heavy Machinery",
                description: "Those construction vehicles you have from building the workshop should be useful for loading presents too"
            },
            cost: 100000,
            resource: totalPresentsResource,
            style: {
                width: "200px"
            }
        }))
    }

    const packingMilestones: Record<string, GenericMilestone> = {
        logBoost: createMilestone(() => ({
            display: {
                requirement: `25 ${packedPresents.displayName}`,
                effectDisplay: "Trees size is raised to the 1.25th power"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 25)
        })),
        boxBoost: createMilestone(() => ({
            display: {
                requirement: `120 ${packedPresents.displayName}`,
                effectDisplay: "Create 10% more boxes"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 120),
            visibility: () => showIf(packingMilestones.logBoost.earned.value)
        })),
        clothBoost: createMilestone(() => ({
            display: {
                requirement: `600 ${packedPresents.displayName}`,
                effectDisplay: "Sheep grow 10x as much wool"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 600),
            visibility: () => showIf(packingMilestones.boxBoost.earned.value)
        })),
        oilBoost: createMilestone(() => ({
            display: {
                requirement: `2,800 ${packedPresents.displayName}`,
                effectDisplay: "Triple drill power"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 2800),
            visibility: () => showIf(packingMilestones.clothBoost.earned.value)
        })),
        coalBoost: createMilestone(() => ({
            display: {
                requirement: `14,000 ${packedPresents.displayName}`,
                effectDisplay: "Coal producer costs grow half as fast"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 14000),
            visibility: () => showIf(packingMilestones.oilBoost.earned.value)
        })),
        metalBoost: createMilestone(() => ({
            display: {
                requirement: `69,200 ${packedPresents.displayName}`,
                effectDisplay: "Raise ore purity to the 1.5th power"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 69200),
            visibility: () => showIf(packingMilestones.coalBoost.earned.value)
        })),
        wrappingPaperBoost: createMilestone(() => ({
            display: {
                requirement: `340,000 ${packedPresents.displayName}`,
                effectDisplay: "Double the strength of wrapping paper bonuses"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 340000),
            visibility: () => showIf(packingMilestones.metalBoost.earned.value)
        })),
        oreBoost: createMilestone(() => ({
            display: {
                requirement: `1,670,000 ${packedPresents.displayName}`,
                effectDisplay: "Ore mining speed multiplies ore gain"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 1670000),
            visibility: () => showIf(packingMilestones.wrappingPaperBoost.earned.value)
        })),
        ribbonBoost: createMilestone(() => ({
            display: {
                requirement: `8,230,000 ${packedPresents.displayName}`,
                effectDisplay: "Halve ribbon cost"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 8230000),
            visibility: () => showIf(packingMilestones.oreBoost.earned.value)
        })),
        secondaryDyeBoost: createMilestone(() => ({
            display: {
                requirement: `40,400,000 ${packedPresents.displayName}`,
                effectDisplay: "Double the second effect of each secondary dye"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 40400000),
            visibility: () => showIf(packingMilestones.ribbonBoost.earned.value)
        })),
        paperBoost: createMilestone(() => ({
            display: {
                requirement: `199,000,000 ${packedPresents.displayName}`,
                effectDisplay: "Produce 10x as much paper"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 199000000),
            visibility: () => showIf(packingMilestones.secondaryDyeBoost.earned.value)
        })),
        primaryDyeBoost: createMilestone(() => ({
            display: {
                requirement: `977,000,000 ${packedPresents.displayName}`,
                effectDisplay: "Quintuple primary dye gain"
            },
            shouldEarn: () => Decimal.gte(packedPresents.value, 977000000),
            visibility: () => showIf(packingMilestones.paperBoost.earned.value)
        })),
        // todo: something
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(packingMilestones);

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Elf Packing Speed",
            modifier: elfPackingSpeed,
            base: 1
        },
        {
            title: "Loader Packing Speed",
            modifier: loaderPackingSpeed,
            base: 1000
        }
    ]);
    const showModifiersModal = ref(false);
    const modifiersModal = jsx(() => (
        <ModalVue
            modelValue={showModifiersModal.value}
            onUpdate:modelValue={(value: boolean) => (showModifiersModal.value = value)}
            v-slots={{
                header: () => <h2>{name} Modifiers</h2>,
                body: generalTab
            }}
        />
    ));

    const { trackerDisplay } = setUpDailyProgressTracker({
        resource: packedPresents,
        ignoreTotal: true,
        goal: 8e9,
        name,
        day,
        background: {
            gradient: "packing-bar",
            duration: "15s"
        },
        textColor: "var(--bought)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        if (Decimal.gte(packingProgress.value, 1)) {
            packingProgress.value = 1;
        }
        else {
            packingProgress.value = Decimal.add(packingProgress.value, diff);
            if (packPresent.isHolding.value) {
                packPresent.onClick();
            }
        }

        if (Decimal.lt(remainingSize.value, 0)) {
            return;
        }
        packedPresents.value = Decimal.add(
            Decimal.times(helpers.elf.amount.value, computedElfPackingSpeed.value),
            Decimal.times(helpers.loader.amount.value, computedLoaderPackingSpeed.value)
        ).times(diff).plus(packedPresents.value).min(currentMaxPresents.value);
    });

    return {
        name,
        day,
        color,
        packedPresents,
        bestPresents,
        totalPresents,
        packingResets,
        packingProgress,
        helpers,
        upgrades,
        packingMilestones,
        collapseMilestones,
        generalTabCollapsed,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <SpacerVue />
                <MainDisplayVue resource={packedPresents} color={color}/>
                <SpacerVue />
                {render(resetPacking)}
                {render(packPresent)}
                <SpacerVue />
                {renderRow(...Object.values(helpers))}
                <SpacerVue />
                {renderRow(...Object.values(upgrades))}
                <SpacerVue />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (<div>{name} <span class="desc">{formatWhole(packedPresents.value)} {packedPresents.displayName}</span></div>))
    };
});

export default layer;

function displayCost(
    res: Resource<DecimalSource> | Resource<DecimalSource>[],
    cost: DecimalSource,
    label: string
) {
    const affordable = (isArray(res) ? res : [res]).every(res => Decimal.gte(res.value, cost));
    return (
        <span class={affordable ? "" : "unaffordable"}>
            {format(cost)} {label}
        </span>
    );
}