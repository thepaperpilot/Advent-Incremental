/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleMilestones } from "data/common";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import {
    Conversion,
    createIndependentConversion,
    createPolynomialScaling,
    ScalingFunction
} from "features/conversion";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createMilestone } from "features/milestones/milestone";
import { createResource, displayResource, Resource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { computed, unref, watchEffect } from "vue";
import elves from "./elves";
import trees from "./trees";

interface FoundationConversionOptions {
    scaling: ScalingFunction;
    baseResource: Resource;
    gainResource: Resource;
    roundUpCost: boolean;
    buyMax: boolean;
    spend: (gain: DecimalSource, spent: DecimalSource) => void;
}

const id = "workshop";
const day = 2;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Workshop";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const foundationProgress = createResource<DecimalSource>(0, "foundation progress");

    const foundationConversion: Conversion<FoundationConversionOptions> =
        createIndependentConversion(() => ({
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

    const buildFoundationHK = createHotkey(() => ({
        key: "w",
        description: "Build part of the foundation.",
        onPress: () => {
            if (buildFoundation.canClick.value) buildFoundation.onClick();
        }
    }));

    const shouldShowPopups = computed(() => !elves.milestones[6].earned.value);
    const logGainMilestone1 = createMilestone(() => ({
        display: {
            requirement: "1% Foundation Completed",
            effectDisplay: "Trees give 5% more logs for each % of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1),
        showPopups: shouldShowPopups
    }));
    const autoCutMilestone1 = createMilestone(() => ({
        display: {
            requirement: "10% Foundation Completed",
            effectDisplay: "Cut an additional tree per second for each 5% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 10),
        visibility: () => showIf(logGainMilestone1.earned.value),
        showPopups: shouldShowPopups
    }));
    const autoPlantMilestone1 = createMilestone(() => ({
        display: {
            requirement: "20% Foundation Completed",
            effectDisplay:
                "Plant an additional tree per second for each 10% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 20),
        visibility: () => showIf(autoCutMilestone1.earned.value),
        showPopups: shouldShowPopups
    }));
    const autoCutMilestone2 = createMilestone(() => ({
        display: {
            requirement: "30% Foundation Completed",
            effectDisplay: "All automatic tree cutting is doubled"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 30),
        visibility: () => showIf(autoPlantMilestone1.earned.value),
        showPopups: shouldShowPopups
    }));
    const autoPlantMilestone2 = createMilestone(() => ({
        display: {
            requirement: "40% Foundation Completed",
            effectDisplay: "All automatic tree planting is doubled"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 40),
        visibility: () => showIf(autoCutMilestone2.earned.value),
        showPopups: shouldShowPopups
    }));
    const logGainMilestone2 = createMilestone(() => ({
        display: {
            requirement: "50% Foundation Completed",
            effectDisplay: "Trees give twice as many logs"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 50),
        visibility: () => showIf(autoPlantMilestone2.earned.value),
        showPopups: shouldShowPopups
    }));
    const morePlantsMilestone1 = createMilestone(() => ({
        display: {
            requirement: "75% Foundation Completed",
            effectDisplay: "The forest gains an extra tree for every 2% of foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 75),
        visibility: () => showIf(logGainMilestone2.earned.value),
        showPopups: shouldShowPopups
    }));
    const logGainMilestone3 = createMilestone(() => ({
        display: {
            requirement: "100% Foundation Completed",
            effectDisplay: "Log per tree is raised to the 1.2th power"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 100),
        visibility: () => showIf(morePlantsMilestone1.earned.value),
        showPopups: shouldShowPopups
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
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

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
        collapseMilestones,
        minWidth: 700,
        buildFoundationHK,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Complete the foundation to complete the day`
                        : `${name} Complete!`}
                </div>
                {render(dayProgress)}
                <Spacer />
                <div>
                    <span>The foundation is </span>
                    <h2 style={`color: ${color}; text-shadow: 0 0 10px ${color}`}>
                        { formatWhole( foundationProgress.value ) }
                    </h2>
                    % completed
                </div>
                {Decimal.lt(foundationProgress.value, 100) ? (
                    <Spacer />
                ) : null}
                {render(buildFoundation)}
                <Spacer />
                {milestonesDisplay()}
            </>
        ))
    };
});

export default layer;
