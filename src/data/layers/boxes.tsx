/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { BaseLayer, createLayer } from "game/layers";
import { noPersist } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { render, renderGrid, renderRow } from "util/vue";
import { unref } from "vue";
import paper from "./paper";
import plastic from "./plastic";
import trees from "./trees";
import dyes from "./dyes";
import management from "./management";
const id = "boxes";
const day = 6;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Boxes";
    const color = "#964B00";

    const boxes = createResource<DecimalSource>(0, "boxes");

    const boxesConversion = createCumulativeConversion(() => ({
        scaling: createPolynomialScaling(1e10, 1),
        baseResource: trees.logs,
        gainResource: noPersist(boxes),
        roundUpCost: true
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
        style: "width: 600px; min-height: unset"
    }));

    const logsUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry logs in boxes",
            description: "Double log gain and unlock a new elf for training"
        },
        onPurchase() {
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
        cost: 1e16,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry cloth in boxes",
            description: "Double all cloth actions"
        }
    }));
    const dyeUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e17,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry dye in boxes",
            description: "Double all dye gain"
        }
    }));
    const xpUpgrade = createUpgrade(() => ({
        resource: noPersist(boxes),
        cost: 1e18,
        visibility: () => showIf(management.elfTraining.boxElfTraining.milestones[4].earned.value),
        display: {
            title: "Carry experience in boxes???",
            description: "Double xp gain"
        }
    }));
    const row3Upgrades = { clothUpgrade, dyeUpgrade, xpUpgrade };
    const logBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more logs",
            description: "Use boxes to carry even more logs, boosting their gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(logBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            return Decimal.pow(3, v).times(100).div(dyes.boosts.orange2.value);
        },
        visibility: () => showIf(logsUpgrade.bought.value)
    })) as GenericBuyable & { resource: Resource };
    const ashBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more ash",
            description: "Use boxes to carry even more ash, boosting its gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(ashBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            return Decimal.pow(5, v).times(1000).div(dyes.boosts.orange2.value);
        },
        visibility: () => showIf(ashUpgrade.bought.value)
    })) as GenericBuyable & { resource: Resource };
    const coalBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more coal",
            description: "Use boxes to carry even more coal, boosting its gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(coalBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: noPersist(boxes),
        cost() {
            let v = this.amount.value;
            v = Decimal.pow(0.95, paper.books.boxBook.amount.value).times(v);
            return Decimal.pow(7, v).times(1000).div(dyes.boosts.orange2.value);
        },
        visibility: () => showIf(coalUpgrade.bought.value)
    })) as GenericBuyable & { resource: Resource };
    const buyables = { logBoxesBuyable, ashBoxesBuyable, coalBoxesBuyable };

    globalBus.on("update", diff => {
        if (Decimal.lt(main.day.value, day)) {
            return;
        }

        boxes.value = Decimal.times(diff, plastic.buyables.passiveBoxes.amount.value)
            .times(boxesConversion.currentGain.value)
            .div(100)
            .add(boxes.value);
    });

    const { total: totalBoxes, trackerDisplay } = setUpDailyProgressTracker({
        resource: boxes,
        goal: 5e4,
        name,
        day,
        color
    });

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
        minWidth: 700,
        display: jsx(() => (
            <>
                {render(trackerDisplay)}
                <Spacer />
                <MainDisplay resource={boxes} color={color} style="margin-bottom: 0" />
                <Spacer />
                {render(makeBoxes)}
                <Spacer />
                {renderGrid(Object.values(upgrades), Object.values(row2Upgrades), Object.values(row3Upgrades))}
                <Spacer />
                {renderRow(...Object.values(buyables))}
            </>
        ))
    };
});

export default layer;
