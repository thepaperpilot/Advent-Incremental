/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { Conversion, ConversionOptions, createIndependentConversion, createPolynomialScaling, ScalingFunction } from "features/conversion";
import { jsx, showIf } from "features/feature";
import { createMilestone } from "features/milestones/milestone";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import player from "game/player";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render, renderCol } from "util/vue";
import { unref, watchEffect } from "vue";
import trees from "./trees";

interface FoundationConversionOptions {
    scaling: ScalingFunction,
    baseResource: Resource,
    gainResource: Resource,
    roundUpCost: boolean,
    buyMax: boolean,
    spend: (gain: DecimalSource, spent: DecimalSource) => void
}

const id = "workshop";
const day = 2;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Workshop";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const foundationProgress = createResource<DecimalSource>(0, "foundation progress");

    const foundationConversion: Conversion<FoundationConversionOptions> = createIndependentConversion(() => ({
        scaling: createPolynomialScaling(250, 1.5),
        baseResource: trees.logs,
        gainResource: foundationProgress,
        roundUpCost: true,
        buyMax: false,
        spend(gain, spent) {
            trees.logs.value = Decimal.sub(trees.logs.value, spent);
        }
    }));

    const buildFoundation = createClickable(() => ({
        display: jsx(() => (
            <>
                <b style="font-size: x-large">Build part of the foundation</b>
                <br />
                <br />
                <span style="font-size: large">
                    Cost:{" "}
                    {displayResource(
                        trees.logs,
                        Decimal.gte(foundationConversion.actualGain.value, 1)
                            ? foundationConversion.currentAt.value
                            : foundationConversion.nextAt.value
                    )}{" "}
                    {trees.logs.displayName}
                </span>
            </>
        )),
        visibility: () => showIf(Decimal.lt(foundationProgress.value, 100)),
        canClick: () =>
            Decimal.gte(foundationConversion.actualGain.value, 1) &&
            Decimal.lt(foundationProgress.value, 100),
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            foundationConversion.convert();
        },
        style: "width: 600px; min-height: unset"
    }));

    const logGainMilestone1 = createMilestone(() => ({
        display: {
            requirement: "1% Foundation Completed",
            effectDisplay: "Trees give 5% more logs for each % of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1)
    }));
    const autoCutMilestone1 = createMilestone(() => ({
        display: {
            requirement: "10% Foundation Completed",
            effectDisplay: "Cut an additional tree per second for each 5% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 10),
        visibility: () => showIf(logGainMilestone1.earned.value)
    }));
    const autoPlantMilestone1 = createMilestone(() => ({
        display: {
            requirement: "20% Foundation Completed",
            effectDisplay:
                "Plant an additional tree per second for each 10% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 20),
        visibility: () => showIf(autoCutMilestone1.earned.value)
    }));
    const autoCutMilestone2 = createMilestone(() => ({
        display: {
            requirement: "30% Foundation Completed",
            effectDisplay: "All automatic tree cutting is doubled"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 30),
        visibility: () => showIf(autoPlantMilestone1.earned.value)
    }));
    const autoPlantMilestone2 = createMilestone(() => ({
        display: {
            requirement: "40% Foundation Completed",
            effectDisplay: "All automatic tree planting is doubled"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 40),
        visibility: () => showIf(autoCutMilestone2.earned.value)
    }));
    const logGainMilestone2 = createMilestone(() => ({
        display: {
            requirement: "50% Foundation Completed",
            effectDisplay: "Trees give twice as many logs"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 50),
        visibility: () => showIf(autoPlantMilestone2.earned.value)
    }));
    const morePlantsMilestone1 = createMilestone(() => ({
        display: {
            requirement: "75% Foundation Completed",
            effectDisplay: "The forest gains an extra tree for every 2% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 75),
        visibility: () => showIf(logGainMilestone2.earned.value)
    }));
    const logGainMilestone3 = createMilestone(() => ({
        display: {
            requirement: "100% Foundation Completed",
            effectDisplay: "Trees' log gain is now raised to the 1.1th power"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 100),
        visibility: () => showIf(morePlantsMilestone1.earned.value)
    }));
    const milestones = {
        logGainMilestone1,
        autoCutMilestone1,
        autoPlantMilestone1,
        autoCutMilestone2,
        autoPlantMilestone2,
        logGainMilestone2,
        morePlantsMilestone1,
        logGainMilestone3
    };

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () => (main.day.value === day ? Decimal.div(foundationProgress.value, 100) : 1),
        display: jsx(() =>
            main.day.value === day ? <>{formatWhole(foundationProgress.value)}%</> : ""
        )
    }));

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(foundationProgress.value, 100)) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        color,
        foundationProgress,
        foundationConversion,
        milestones,
        minWidth: 700,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Complete the foundation to complete the day`
                        : `${name} Complete!`}
                </div>
                {render(dayProgress)}
                <Spacer />
                {render(buildFoundation)}
                {Decimal.lt(foundationProgress.value, 100) ? (
                    <div>You have {formatWhole(foundationProgress.value)}% completed</div>
                ) : null}
                <Spacer />
                {renderCol(...Object.values(milestones))}
            </>
        ))
    };
});

export default layer;
