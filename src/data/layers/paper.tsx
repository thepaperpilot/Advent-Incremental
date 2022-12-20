/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { BuyableOptions, createBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatSmall, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { render, renderCol, renderGrid } from "util/vue";
import { computed, ComputedRef, ref, unref } from "vue";
import cloth from "./cloth";
import coal from "./coal";
import dyes from "./dyes";
import elves, { ElfBuyable } from "./elves";
import management from "./management";
import plastic from "./plastic";
import ribbon from "./ribbon";
import trees from "./trees";
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
        style: "width: 600px; min-height: unset",
        visibility: () => showIf(!main.isMastery.value || masteryEffectActive.value)
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
                        {formatSmall(Decimal.pow(0.95, buyable.totalAmount.value))}x price scaling,{" "}
                        {format(Decimal.div(buyable.totalAmount.value, 10).add(1))}x auto-purchase
                        speed
                    </>
                )),
                showAmount: false
            },
            resource: noPersist(paper),
            cost() {
                let v = buyable.amount.value;
                if (options.elfName === "Star" && Decimal.gte(v, 10))
                    v = Decimal.pow(10, Decimal.div(v, 10));
                if (options.elfName === "Star" || options.elfName === "Bell") v = Decimal.pow(v, 2);
                if (Decimal.gte(v, 100)) v = Decimal.pow(v, 2).div(100);
                if (Decimal.gte(v, 10000)) v = Decimal.pow(v, 2).div(10000);
                v = Decimal.pow(0.95, paperBook.totalAmount.value).times(v);
                let scaling = 5;
                if (management.elfTraining.paperElfTraining.milestones[2].earned.value) {
                    scaling--;
                }
                let cost = Decimal.pow(scaling, v).times(10);
                if (["Peppermint", "Twinkle", "Cocoa", "Frosty"].includes(options.elfName)) {
                    cost = cost.mul(1e31);
                }
                if (management.elfTraining.paperElfTraining.milestones[0].earned.value) {
                    cost = Decimal.div(cost, sumBooks.value.max(1));
                }
                if (bookUpgrade.bought.value) {
                    cost = cost.div(10);
                }
                return cost;
            },
            inverseCost(x: DecimalSource) {
                if (bookUpgrade.bought.value) {
                    x = Decimal.mul(x, 10);
                }
                if (management.elfTraining.paperElfTraining.milestones[0].earned.value) {
                    x = Decimal.mul(x, sumBooks.value.max(1));
                }

                let scaling = 5;
                if (management.elfTraining.paperElfTraining.milestones[2].earned.value) {
                    scaling--;
                }

                let v = Decimal.div(x, 10);
                if (["Peppermint", "Twinkle", "Cocoa", "Frosty"].includes(options.elfName)) {
                    v = v.div(1e31);
                }
                v = v.log(scaling);

                v = v.div(Decimal.pow(0.95, paperBook.totalAmount.value));
                if (Decimal.gte(v, 10000)) v = Decimal.mul(v, 10000).root(2);
                if (Decimal.gte(v, 100)) v = Decimal.mul(v, 100).root(2);
                if (options.elfName === "Star" || options.elfName === "Bell")
                    v = Decimal.root(v, 2);
                if (options.elfName === "Star" && Decimal.gte(v, 10)) v = v.log10().mul(10);
                return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
            },
            style: "width: 600px",
            freeLevels: computed(() =>
                management.elfTraining.paperElfTraining.milestones[4].earned.value &&
                Decimal.gte(
                    Object.values(management.elfTraining).find(
                        training => training.name === options.elfName
                    )?.level.value ?? 0,
                    5
                ) &&
                ![
                    "Star",
                    "Bell",
                    "Gingersnap",
                    "Peppermint",
                    "Twinkle",
                    "Cocoa",
                    "Frosty"
                ].includes(options.elfName)
                    ? 5
                    : 0
            ),
            totalAmount: computed(() => Decimal.add(buyable.amount.value, buyable.freeLevels.value))
        })) as ElfBuyable & {
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
        buyableName: "Books",
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
        visibility: () => showIf(elves.elves.coalDrillElf.bought.value)
    });
    const heavyDrillBook = createBook({
        name: "Deep in the Earth",
        elfName: "Frosty",
        buyableName: "Oil Drills",
        visibility: () => showIf(elves.elves.heavyDrillElf.bought.value)
    });
    const oilBook = createBook({
        name: "Burning the Midnight Oil",
        elfName: "Cocoa",
        buyableName: "Oil-Consuming Machines",
        visibility: () => showIf(elves.elves.oilElf.bought.value)
    });
    const metalBook = createBook({
        name: "Physical Metallurgy",
        elfName: "Twinkle",
        buyableName: "Metal Machines",
        visibility: () => showIf(elves.elves.metalElf.bought.value)
    });
    const primaryDyeBook = createBook({
        name: "Arts and Crafts",
        elfName: "Carol",
        buyableName: "Primary Dyes",
        visibility: () => showIf(elves.elves.dyeElf.bought.value)
    });
    const secondaryDyeBook = createBook({
        name: "Natural Dyeing",
        elfName: "Carol",
        buyableName: "Secondary Dyes",
        visibility: () =>
            showIf(elves.elves.dyeElf.bought.value && ribbon.milestones.dyeBook.earned.value)
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
        primaryDyeBook,
        secondaryDyeBook
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
    const ashUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e36,
        visibility: () =>
            showIf(management.elfTraining.heavyDrillElfTraining.milestones[4].earned.value),
        display: {
            title: "Paper Burning",
            description: "Paper adds to ash gain after all other modifiers"
        }
    })) as GenericUpgrade;
    const bookUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e38,
        visibility: () =>
            showIf(management.elfTraining.heavyDrillElfTraining.milestones[4].earned.value),
        display: {
            title: "Book Cheapener",
            description: "Books are less expensive"
        }
    }));
    const treeUpgrade = createUpgrade(() => ({
        resource: noPersist(paper),
        cost: 1e40,
        visibility: () =>
            showIf(management.elfTraining.heavyDrillElfTraining.milestones[4].earned.value),
        display: {
            title: "Un-Processing",
            description: "Log gain is raised to the ^1.05"
        }
    }));
    const upgrades2 = { ashUpgrade, bookUpgrade, treeUpgrade };
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
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 0,
            description: "Coal Decoration",
            enabled: masteryEffectActive
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;
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
        masteryGoal: 5e7,
        name,
        day,
        background: color,
        textColor: "var(--feature-foreground)",
        modal: {
            show: showModifiersModal,
            display: modifiersModal
        }
    });

    const mastery = {
        paper: persistent<DecimalSource>(0),
        totalPaper: persistent<DecimalSource>(0),
        books: {
            cuttersBook: { amount: persistent<DecimalSource>(0) },
            plantersBook: { amount: persistent<DecimalSource>(0) },
            expandersBook: { amount: persistent<DecimalSource>(0) },
            heatedCuttersBook: { amount: persistent<DecimalSource>(0) },
            heatedPlantersBook: { amount: persistent<DecimalSource>(0) },
            fertilizerBook: { amount: persistent<DecimalSource>(0) },
            smallFireBook: { amount: persistent<DecimalSource>(0) },
            bonfireBook: { amount: persistent<DecimalSource>(0) },
            kilnBook: { amount: persistent<DecimalSource>(0) },
            paperBook: { amount: persistent<DecimalSource>(0) },
            boxBook: { amount: persistent<DecimalSource>(0) },
            clothBook: { amount: persistent<DecimalSource>(0) },
            coalDrillBook: { amount: persistent<DecimalSource>(0) },
            heavyDrillBook: { amount: persistent<DecimalSource>(0) },
            oilBook: { amount: persistent<DecimalSource>(0) },
            metalBook: { amount: persistent<DecimalSource>(0) },
            primaryDyeBook: { amount: persistent<DecimalSource>(0) },
            secondaryDyeBook: { amount: persistent<DecimalSource>(0) }
        },
        upgrades: {
            clothUpgrade: { bought: persistent<boolean>(false) },
            drillingUpgrade: { bought: persistent<boolean>(false) },
            oilUpgrade: { bought: persistent<boolean>(false) }
        },
        upgrades2: {
            ashUpgrade: { bought: persistent<boolean>(false) },
            bookUpgrade: { bought: persistent<boolean>(false) },
            treeUpgrade: { bought: persistent<boolean>(false) }
        }
    };
    const mastered = persistent<boolean>(false);
    const masteryEffectActive = computed(
        () => mastered.value || main.currentlyMastering.value?.name === name
    );

    return {
        name,
        day,
        color,
        paper,
        totalPaper,
        paperConversion,
        books,
        upgrades,
        upgrades2,
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
                            Pulp no longer requires ash
                        </div>
                        <Spacer />
                    </>
                ) : null}
                <MainDisplay resource={paper} color={color} style="margin-bottom: 0" />
                <Spacer />
                {!main.isMastery.value || masteryEffectActive.value ? (
                    <>
                        {render(makePaper)}
                        <Spacer />
                        {renderGrid(Object.values(upgrades), Object.values(upgrades2))}
                        <Spacer />
                        {renderCol(...Object.values(books))}
                    </>
                ) : null}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {format(paper.value)} {paper.displayName}
                </span>
            </div>
        )),
        mastery,
        mastered
    };
});

export default layer;
