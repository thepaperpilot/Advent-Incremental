/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { setUpDailyProgressTracker } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { createClickable } from "features/clickables/clickable";
import { createCumulativeConversion, createPolynomialScaling } from "features/conversion";
import { jsx, showIf } from "features/feature";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, trackTotal } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { unref, watchEffect } from "vue";
import trees from "./trees";

const id = "boxes";
const day = 6;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Boxes";
    const color = "#964B00";

    const boxes = createResource<DecimalSource>(0, "boxes");

    const boxesConversion = createCumulativeConversion(() => ({
        scaling: createPolynomialScaling(1e10, 1),
        baseResource: trees.logs,
        gainResource: boxes,
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
        onPurchase () {
            main.days[3].recentlyUpdated.value = true;
        },
        resource: boxes,
        cost: 100
    }));
    const ashUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry ash in boxes",
            description: "Double ash gain and unlock a new elf for training"
        },
        onPurchase () {
            main.days[3].recentlyUpdated.value = true;
        },
        resource: boxes,
        cost: 1000
    }));
    const coalUpgrade = createUpgrade(() => ({
        display: {
            title: "Carry coal in boxes",
            description: "Double coal gain and unlock a new elf for training"
        },
        onPurchase () {
            main.days[3].recentlyUpdated.value = true;
        },
        resource: boxes,
        cost: 4000
    }));
    const upgrades = { logsUpgrade, ashUpgrade, coalUpgrade };

    const logBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more logs",
            description: "Use boxes to carry even more logs, boosting their gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(logBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: boxes,
        cost() {
            return Decimal.pow(3, logBoxesBuyable.amount.value).times(100);
        },
        visibility: () => showIf(logsUpgrade.bought.value)
    })) as GenericBuyable;
    const ashBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more ash",
            description: "Use boxes to carry even more ash, boosting its gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(ashBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: boxes,
        cost() {
            return Decimal.pow(5, ashBoxesBuyable.amount.value).times(1000);
        },
        visibility: () => showIf(ashUpgrade.bought.value)
    })) as GenericBuyable;
    const coalBoxesBuyable = createBuyable(() => ({
        display: {
            title: "Carry more coal",
            description: "Use boxes to carry even more coal, boosting its gain",
            effectDisplay: jsx(() => (
                <>{format(Decimal.div(coalBoxesBuyable.amount.value, 2).add(1))}x</>
            ))
        },
        resource: boxes,
        cost() {
            return Decimal.pow(7, coalBoxesBuyable.amount.value).times(1000);
        },
        visibility: () => showIf(coalUpgrade.bought.value)
    })) as GenericBuyable;
    const buyables = { logBoxesBuyable, ashBoxesBuyable, coalBoxesBuyable };

    const { total: totalBoxes, trackerDisplay } = setUpDailyProgressTracker({
        resource: boxes,
        goal: 5e4,
        name,
        day,
        color
    })

    return {
        name,
        day,
        color,
        boxes,
        totalBoxes,
        boxesConversion,
        upgrades,
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
                {renderRow(...Object.values(upgrades))}
                {renderRow(...Object.values(buyables))}
            </>
        ))
    };
});

export default layer;
