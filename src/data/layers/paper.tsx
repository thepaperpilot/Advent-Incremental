/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { BuyableOptions, createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { noPersist } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { render, renderCol, renderRow } from "util/vue";
import { computed, ComputedRef, ref, unref } from "vue";
import cloth from "./cloth";
import coal from "./coal";
import elves from "./elves";
import plastic from "./plastic";
import trees from "./trees";
import dyes from "./dyes";
import management from "./management";
import workshop from "./workshop";
import wrappingPaper from "./wrapping-paper";

const id = "paper";
const day = 5;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Paper";
    const color = "#E8DCB8";

    const paper = createResource<DecimalSource>(0, "paper");

    const pulp = createResource<DecimalSource>(
        computed(() =>
            Decimal.min(
                Decimal.div(trees.logs.value, 1e9),
                Decimal.div(coal.ash.value, computedAshCost.value)
            )
        ),
        "pulp"
    );

    const paperConversion = createCumulativeConversion(() => ({
        scaling: createPolynomialScaling(1, 1.2),
        baseResource: pulp,
        gainResource: noPersist(paper),
        roundUpCost: true,
        spend(gain, cost) {
            trees.logs.value = Decimal.sub(trees.logs.value, Decimal.times(cost, 1e9));
            coal.ash.value = Decimal.sub(
                coal.ash.value,
                Decimal.times(cost, computedAshCost.value)
            );
        },
        gainModifier: paperGain
    }));

    const makePaper = createClickable(() => ({
        display: jsx(() => {
            const cost = Decimal.gte(paperConversion.actualGain.value, 1)
                ? paperConversion.currentAt.value
                : paperConversion.nextAt.value;
            return (
                <>
                    <span style="font-size: large">
                        Create {formatWhole(paperConversion.currentGain.value)} {paper.displayName}
                    </span>
                    <br />
                    <span style="font-size: large">
                        Cost: {displayResource(trees.logs, cost)} {pulp.displayName} (
                        {formatWhole(Decimal.times(cost, 1e9))} {trees.logs.displayName};{" "}
                        {formatWhole(Decimal.times(cost, computedAshCost.value))}{" "}
                        {coal.ash.displayName})
                    </span>
                </>
            );
        }),
        canClick: () => Decimal.gte(paperConversion.actualGain.value, 1),
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            paperConversion.convert();
        },
        style: "width: 600px; min-height: unset"
    }));

    function createBook(
        options: { name: string; elfName: string; buyableName: string } & Partial<BuyableOptions>
    ) {
        const buyable = createBuyable(() => ({
            ...options,
            display: {
                title: options.name,
                description: `Print a copy of "${options.name}", which ${options.elfName} will use to improve their skills! Each copy printed will reduce the "${options.buyableName}" price scaling by 0.95x and make ${options.elfName} purchase +10% faster!`,
                effectDisplay: jsx(() => (
                    <>
                        {format(Decimal.pow(0.95, buyable.totalAmount.value))}x price scaling,{" "}
                        {format(Decimal.div(buyable.totalAmount.value, 10).add(1))}x auto-purchase
                        speed
                    </>
                )),
                showAmount: false
            },
            resource: noPersist(paper),
            cost() {
                let v = this.amount.value;
                if (options.elfName === "Star" || options.elfName === "Bell") v = Decimal.pow(v, 2);
                if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
                if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
                v = Decimal.pow(0.95, paperBook.totalAmount.value).times(v);
                let scaling = 5;
                if (management.elfTraining.paperElfTraining.milestones[0].earned.value) {
                    scaling--;
                }
                let cost = Decimal.pow(scaling, v).times(10);
                if (management.elfTraining.paperElfTraining.milestones[0].earned.value) {
                    cost = Decimal.div(cost, sumBooks.value.max(1));
                }
                return cost;
            },
            style: "width: 600px",
            freeLevels: computed(() =>
                management.elfTraining.paperElfTraining.milestones[4].earned.value
                    ? Decimal.times(5, management.level5Elves.value)
                    : 0
            ),
            totalAmount: computed(() => Decimal.add(buyable.amount.value, buyable.freeLevels.value))
        })) as GenericBuyable & {
            resource: Resource;
            freeLevels: ComputedRef<DecimalSource>;
            totalAmount: ComputedRef<DecimalSource>;
        };
        return buyable;
    }

    const cuttersBook = createBook({
        name: "Now You're Logging!",
        elfName: "Holly",
        buyableName: "Generic Cutters"
    });
    const plantersBook = createBook({
        name: "The Man Who Planted Trees",
        elfName: "Ivy",
        buyableName: "Generic Planters"
    });
    const expandersBook = createBook({
        name: "Logjam",
        elfName: "Hope",
        buyableName: "Expand Forest"
    });
    const heatedCuttersBook = createBook({
        name: "Fahrenheit 451",
        elfName: "Jack",
        buyableName: "Heated Cutters"
    });
    const heatedPlantersBook = createBook({
        name: "Tillamook Burn Country",
        elfName: "Mary",
        buyableName: "Heated Planters"
    });
    const fertilizerBook = createBook({
        name: "The Garden Tree's Handbook",
        elfName: "Noel",
        buyableName: "Fertilized Soil"
    });
    const smallFireBook = createBook({
        name: "Firestarter",
        elfName: "Joy",
        buyableName: "Small Fire",
        visibility: () => showIf(elves.elves.smallFireElf.bought.value)
    });
    const bonfireBook = createBook({
        name: "An Arsonist's Guide to Writer's Homes in New England",
        elfName: "Faith",
        buyableName: "Bonfire",
        visibility: () => showIf(elves.elves.bonfireElf.bought.value)
    });
    const kilnBook = createBook({
        name: "Little Fires Everywhere",
        elfName: "Snowball",
        buyableName: "Kiln",
        visibility: () => showIf(elves.elves.kilnElf.bought.value)
    });
    const paperBook = createBook({
        name: "The Book Thief",
        elfName: "Star",
        buyableName: "Paper Buyables",
        visibility: () => showIf(elves.elves.paperElf.bought.value)
    });
    const boxBook = createBook({
        name: "Not a box",
        elfName: "Bell",
        buyableName: "Box Buyables",
        visibility: () => showIf(elves.elves.boxElf.bought.value)
    });
    const clothBook = createBook({
        name: "Fuzzy Bee and Friends",
        elfName: "Gingersnap",
        buyableName: "Cloth Buyables",
        visibility: () => showIf(elves.elves.clothElf.bought.value)
    });
    const coalDrillBook = createBook({
        name: "Drills and Mills",
        elfName: "Peppermint",
        buyableName: "Coal Drill",
        visibility: () =>
            showIf(management.elfTraining.expandersElfTraining.milestones[3].earned.value)
    });
    const heavyDrillBook = createBook({
        name: "Deep in the Earth",
        elfName: "Frosty",
        buyableName: "Oil Drills",
        visibility: () =>
            showIf(management.elfTraining.fertilizerElfTraining.milestones[4].earned.value)
    });
    const oilBook = createBook({
        name: "Burning the Midnight Oil",
        elfName: "Cocoa",
        buyableName: "Oil-Consuming Machines",
        visibility: () =>
            showIf(management.elfTraining.heatedCutterElfTraining.milestones[4].earned.value)
    });
    const metalBook = createBook({
        name: "Physical Metallurgy",
        elfName: "Twinkle",
        buyableName: "Metal Buyables",
        visibility: () =>
            showIf(management.elfTraining.expandersElfTraining.milestones[4].earned.value)
    });
    const dyeBook = createBook({
        name: "Arts and Crafts",
        elfName: "Carol",
        buyableName: "Dye Buyables",
        visibility: () => showIf(elves.elves.dyeElf.bought.value)
    });
    const books = {
        cuttersBook,
        plantersBook,
        expandersBook,
        heatedCuttersBook,
        heatedPlantersBook,
        fertilizerBook,
        smallFireBook,
        bonfireBook,
        kilnBook,
        paperBook,
        boxBook,
        clothBook,
        coalDrillBook,
        heavyDrillBook,
        oilBook,
        metalBook,
        dyeBook
    };
    const sumBooks = computed(() =>
        Object.values(books).reduce((acc, curr) => acc.add(curr.amount.value), new Decimal(0))
    );

    const clothUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e8,
        visibility: () => showIf(plastic.upgrades.paperTools.bought.value),
        display: {
            title: "Shepherding for Dummies",
            description: "Double effectiveness of all cloth actions"
        }
    }));
    const drillingUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e9,
        visibility: () => showIf(plastic.upgrades.paperTools.bought.value),
        display: {
            title: "Guide to drilling",
            description: "Double drilling power"
        }
    }));
    const oilUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e10,
        visibility: () => showIf(plastic.upgrades.paperTools.bought.value),
        display: {
            title: "Oil and where to find it",
            description: "Double oil gain"
        }
    }));
    const upgrades = { clothUpgrade, drillingUpgrade, oilUpgrade };

    const paperGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholar's shoes",
            enabled: cloth.paperUpgrades.paperUpgrade1.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholar's slacks",
            enabled: cloth.paperUpgrades.paperUpgrade2.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholar's jacket",
            enabled: cloth.paperUpgrades.paperUpgrade3.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 10,
            description: "Felt Elbow Pads",
            enabled: cloth.paperUpgrades.paperUpgrade4.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: dyes.boosts.yellow1,
            description: "Yellow Dye Boost 1",
            enabled: () => Decimal.gte(dyes.dyes.yellow.amount.value, 1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "1000% Foundation Completed",
            enabled: workshop.milestones.extraExpansionMilestone5.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: wrappingPaper.boosts.sunshine1,
            description: "Sunshine Wrapping Paper",
            enabled: () => Decimal.gte(wrappingPaper.boosts.sunshine1.value, 2)
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
    const ashCost = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 0.1,
            description: "Star Level 2",
            enabled: management.elfTraining.paperElfTraining.milestones[1].earned
        }))
    ]);
    const computedAshCost = computed(() => ashCost.apply(1e6));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Paper Gain",
            modifier: paperGain,
            base: 1
        },
        {
            title: "Ash Cost",
            modifier: ashCost,
            base: 1e6,
            unit: " ash/pulp"
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

        paper.value = Decimal.times(diff, plastic.buyables.passivePaper.amount.value)
            .times(paperConversion.currentGain.value)
            .div(100)
            .add(paper.value);
    });

    const { total: totalPaper, trackerDisplay } = setUpDailyProgressTracker({
        resource: paper,
        goal: 5e3,
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
        day,
        color,
        paper,
        totalPaper,
        paperConversion,
        books,
        upgrades,
        generalTabCollapsed,
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay resource={paper} color={color} style="margin-bottom: 0" />
                <Spacer />
                {render(makePaper)}
                <Spacer />
                {renderRow(...Object.values(upgrades))}
                <Spacer />
                {renderCol(...Object.values(books))}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(paper.value)} {paper.displayName}
            </div>
        ))
    };
});

export default layer;
