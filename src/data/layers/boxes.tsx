/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections, setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { createUpgrade, GenericUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import {
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { isPersistent, noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { WithRequired } from "util/common";
import { render, renderGrid, renderRow } from "util/vue";
import { computed, ComputedRef, ref, unref } from "vue";
import dyes from "./dyes";
import elves, { ElfBuyable } from "./elves";
import management from "./management";
import paper from "./paper";
import plastic from "./plastic";
import trees from "./trees";
import workshop from "./workshop";
import wrappingPaper from "./wrapping-paper";

export type BoxesBuyable = ElfBuyable & {
    resource: Resource;
    freeLevels: ComputedRef<DecimalSource>;
    totalAmount: ComputedRef<Decimal>;
};

const id = "boxes";
const day = 6;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Boxes";
    const color = "#964B00";

    const boxes = createResource<DecimalSource>(0, "boxes");

    const boxGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "1000% Foundation Completed",
            enabled: workshop.milestones.extraExpansionMilestone5.earned
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Bell Level 2",
            enabled: management.elfTraining.boxElfTraining.milestones[1].earned
        }))
    ]) as WithRequired<Modifier, "description" | "revert">;

    const boxesConversion = createCumulativeConversion(() => ({
        scaling: createPolynomialScaling(1e10, 1),
        baseResource: trees.logs,
        gainResource: noPersist(boxes),
        roundUpCost: true,
        gainModifier: boxGain
    }));

    const makeBoxes = createClickable(() => ({
        display: jsx(() => {
            return (
                <>
                    <span style="font-size: large">
                        Create {formatWhole(boxesConversion.currentGain.value)} {boxes.displayName}
                    </span>
                    <br />
                    <span style="font-size: large">
                        Cost:{" "}
                        {displayResource(
                            trees.logs,
                            Decimal.gte(boxesConversion.actualGain.value, 1)
                                ? boxesConversion.currentAt.value
                                : boxesConversion.nextAt.value
                        )}{" "}
                        {trees.logs.displayName}
                    </span>
                </>
            );
        }),
        canClick: () => Decimal.gte(boxesConversion.actualGain.value, 1),
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            boxesConversion.convert();
        },
        style: "width: 600px; min-height: unset",
        visibility: () => showIf(!main.isMastery.value || masteryEffectActive.value)
    }));

    const logsUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry logs in boxes",
            description: "Double log gain and unlock a new elf for training"
        },
        onPurchase() {
            if (masteryEffectActive.value) {
                elves.elves.smallFireElf.bought.value = true;
            }
            main.days[3].recentlyUpdated.value = true;
        },
        resource: noPersist(boxes),
        cost: 100
    }));
    const ashUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry ash in boxes",
            description: "Double ash gain and unlock a new elf for training"
        },
        onPurchase() {
            if (masteryEffectActive.value) {
                elves.elves.bonfireElf.bought.value = true;
            }
            main.days[3].recentlyUpdated.value = true;
        },
        resource: noPersist(boxes),
        cost: 1000
    }));
    const coalUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry coal in boxes",
            description: "Double coal gain and unlock a new elf for training"
        },
        onPurchase() {
            if (masteryEffectActive.value) {
                elves.elves.kilnElf.bought.value = true;
            }
            main.days[3].recentlyUpdated.value = true;
        },
        resource: noPersist(boxes),
        cost: 4000
    }));
    const upgrades = { logsUpgrade, ashUpgrade, coalUpgrade };

    const oreUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e8,
        visibility: () => showIf(plastic.upgrades.boxTools.bought.value),
        display: {
            title: "Carry ore in boxes",
            description: "Double ore per mining op"
        }
    }));
    const metalUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e9,
        visibility: () => showIf(plastic.upgrades.boxTools.bought.value),
        display: {
            title: "Carry metal in boxes",
            description: "Double ore purity"
        }
    }));
    const plasticUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e10,
        visibility: () => showIf(plastic.upgrades.boxTools.bought.value),
        display: {
            title: "Carry plastic in boxes",
            description: "Double plastic gain"
        }
    }));
    const row2Upgrades = { oreUpgrade, metalUpgrade, plasticUpgrade };
    const clothUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e28,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry cloth in boxes",
            description: "Double all cloth actions"
        }
    })) as GenericUpgrade;
    const dyeUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e29,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry dye in boxes",
            description: "Double all dye gain but reset all dyes"
        },
        onPurchase() {
            (["red", "yellow", "blue", "orange", "green", "purple"] as const).forEach(dyeColor => {
                dyes.dyes[dyeColor].amount.value = 0;
                dyes.dyes[dyeColor].buyable.amount.value = 0;
                main.days[10].recentlyUpdated.value = true;
            });
        }
    })) as GenericUpgrade;
    const xpUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e30,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry experience in boxes???",
            description: "Double xp gain"
        }
    })) as GenericUpgrade;
    const row3Upgrades = { clothUpgrade, dyeUpgrade, xpUpgrade };
    const logBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more logs",
            description: jsx(() => (
                <>
                    Use boxes to carry even more logs, boosting their gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(logBoxesBuyable.amount.value)}
                        {Decimal.gt(logBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(logBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(logBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.totalAmount.value).times(v);
            let scaling = 3;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v)
                .times(100)
                .div(dyes.boosts.orange2.value)
                .div(wrappingPaper.boosts.ocean1.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 3;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, wrappingPaper.boosts.ocean1.value)
                .mul(dyes.boosts.orange2.value)
                .div(100)
                .log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(logsUpgrade.bought.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(ashBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(coalBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(logBoxesBuyable.amount.value, 2)
                    .sub(logBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(logBoxesBuyable.amount.value, logBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const ashBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more ash",
            description: jsx(() => (
                <>
                    Use boxes to carry even more ash, boosting its gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(ashBoxesBuyable.amount.value)}
                        {Decimal.gt(ashBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(ashBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(ashBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.totalAmount.value).times(v);
            let scaling = 5;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v).times(1000).div(dyes.boosts.orange2.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 5;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, dyes.boosts.orange2.value).div(1000).log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(ashUpgrade.bought.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(logBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(coalBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(ashBoxesBuyable.amount.value, 2)
                    .sub(ashBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(ashBoxesBuyable.amount.value, ashBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const coalBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more coal",
            description: jsx(() => (
                <>
                    Use boxes to carry even more coal, boosting its gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(coalBoxesBuyable.amount.value)}
                        {Decimal.gt(coalBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(coalBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(coalBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.totalAmount.value).times(v);
            let scaling = 7;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v).times(1000).div(dyes.boosts.orange2.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 7;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, dyes.boosts.orange2.value).div(1000).log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(coalUpgrade.bought.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(logBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(ashBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(coalBoxesBuyable.amount.value, 2)
                    .sub(coalBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(coalBoxesBuyable.amount.value, coalBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const buyables = { logBoxesBuyable, ashBoxesBuyable, coalBoxesBuyable };
    const oreBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more ore",
            description: jsx(() => (
                <>
                    Use boxes to carry even more ore, boosting their gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(oreBoxesBuyable.amount.value)}
                        {Decimal.gt(oreBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(oreBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(oreBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            let scaling = 10;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v)
                .times(1e25)
                .div(dyes.boosts.orange2.value)
                .div(wrappingPaper.boosts.ocean1.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 10;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, wrappingPaper.boosts.ocean1.value)
                .mul(dyes.boosts.orange2.value)
                .div(1e25)
                .log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[3].earned.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(metalBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(plasticBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(oreBoxesBuyable.amount.value, 2)
                    .sub(oreBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(oreBoxesBuyable.amount.value, oreBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const metalBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more metal",
            description: jsx(() => (
                <>
                    Use boxes to carry even more metal, boosting its gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(metalBoxesBuyable.amount.value)}
                        {Decimal.gt(metalBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(metalBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(metalBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            let scaling = 15;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v).times(1e28).div(dyes.boosts.orange2.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 15;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, dyes.boosts.orange2.value).div(1e28).log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[3].earned.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(oreBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(plasticBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(metalBoxesBuyable.amount.value, 2)
                    .sub(metalBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(metalBoxesBuyable.amount.value, metalBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const plasticBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more plastic",
            description: jsx(() => (
                <>
                    Use boxes to carry even more plastic, boosting its gain
                    <br />
                    <br />
                    <div>
                        Amount: {formatWhole(plasticBoxesBuyable.amount.value)}
                        {Decimal.gt(plasticBoxesBuyable.freeLevels.value, 0) ? (
                            <> (+{formatWhole(plasticBoxesBuyable.freeLevels.value)})</>
                        ) : null}
                    </div>
                </>
            )),
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(plasticBoxesBuyable.totalAmount.value, 2).add(1))}x</>
            )),
            showAmount: false
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            let scaling = 20;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }
            return Decimal.pow(scaling, v).times(1e31).div(dyes.boosts.orange2.value);
        },
        inverseCost(x: DecimalSource) {
            let scaling = 20;
            if (management.elfTraining.boxElfTraining.milestones[2].earned.value) {
                scaling--;
            }

            let v = Decimal.mul(x, dyes.boosts.orange2.value).div(1e31).log(scaling);

            v = v.div(Decimal.pow(0.95, paper.books.boxBook.totalAmount.value));
            return Decimal.isNaN(v) ? Decimal.dZero : v.floor().max(0);
        },
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[3].earned.value),
        freeLevels: computed(() => {
            let levels: DecimalSource = 0;
            if (management.elfTraining.boxElfTraining.milestones[0].earned.value) {
                levels = Decimal.max(oreBoxesBuyable.amount.value, 1)
                    .sqrt()
                    .floor()
                    .add(Decimal.max(metalBoxesBuyable.amount.value, 1).sqrt().floor());
            }
            if (masteryEffectActive.value) {
                levels = Decimal.pow(plasticBoxesBuyable.amount.value, 2)
                    .sub(plasticBoxesBuyable.amount.value)
                    .add(levels);
            }
            return levels;
        }),
        totalAmount: computed(() =>
            Decimal.add(plasticBoxesBuyable.amount.value, plasticBoxesBuyable.freeLevels.value)
        )
    })) as BoxesBuyable;
    const buyables2 = { oreBoxesBuyable, metalBoxesBuyable, plasticBoxesBuyable };
    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        boxes.value = Decimal.times(diff, plastic.buyables.passiveBoxes.amount.value)
            .times(boxesConversion.currentGain.value)
            .div(100)
            .add(boxes.value);
    });

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Boxes Gain",
            modifier: boxGain,
            base: () => boxesConversion.scaling.currentGain(boxesConversion)
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

    const { total: totalBoxes, trackerDisplay } = setUpDailyProgressTracker({
        resource: boxes,
        goal: 5e4,
        masteryGoal: 5e5,
        name,
        day,
        background: color,
        modal: {
            display: modifiersModal,
            show: showModifiersModal
        }
    });

    const mastery = {
        boxes: persistent<DecimalSource>(0),
        totalBoxes: persistent<DecimalSource>(0),
        upgrades: {
            logsUpgrade: { bought: persistent<boolean>(false) },
            ashUpgrade: { bought: persistent<boolean>(false) },
            coalUpgrade: { bought: persistent<boolean>(false) }
        },
        row2Upgrades: {
            oreUpgrade: { bought: persistent<boolean>(false) },
            metalUpgrade: { bought: persistent<boolean>(false) },
            plasticUpgrade: { bought: persistent<boolean>(false) }
        },
        row3Upgrades: {
            clothUpgrade: { bought: persistent<boolean>(false) },
            dyeUpgrade: { bought: persistent<boolean>(false) },
            xpUpgrade: { bought: persistent<boolean>(false) }
        },
        buyables: {
            logBoxesBuyable: { amount: persistent<DecimalSource>(0) },
            ashBoxesBuyable: { amount: persistent<DecimalSource>(0) },
            coalBoxesBuyable: { amount: persistent<DecimalSource>(0) }
        },
        buyables2: {
            oreBoxesBuyable: { amount: persistent<DecimalSource>(0) },
            metalBoxesBuyable: { amount: persistent<DecimalSource>(0) },
            plasticBoxesBuyable: { amount: persistent<DecimalSource>(0) }
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
        boxes,
        totalBoxes,
        boxesConversion,
        upgrades,
        row2Upgrades,
        row3Upgrades,
        buyables,
        buyables2,
        minWidth: 700,
        generalTabCollapsed,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                {masteryEffectActive.value ? (
                    <>
                        Decoration effect: Effective boxes buyables' levels are squared
                        <Spacer />
                    </>
                ) : null}
                <MainDisplay resource={boxes} color={color} style="margin-bottom: 0" />
                <Spacer />
                {render(makeBoxes)}
                <Spacer />
                {renderGrid(
                    Object.values(upgrades),
                    Object.values(row2Upgrades),
                    Object.values(row3Upgrades)
                )}
                <Spacer />
                {renderGrid(Object.values(buyables), Object.values(buyables2))}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name}{" "}
                <span class="desc">
                    {format(boxes.value)} {boxes.displayName}
                </span>
            </div>
        )),
        mastery,
        mastered
    };
});

export default layer;
