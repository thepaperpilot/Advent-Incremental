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
    addHardcap,
    addSoftcap,
    createIndependentConversion,
    createPolynomialScaling
} from "features/conversion";
import { jsx, showIf } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createMilestone } from "features/milestones/milestone";
import { createResource, displayResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import {
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { noPersist } from "game/persistence";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { render } from "util/vue";
import { computed, unref, watchEffect } from "vue";
import elves from "./elves";
import management from "./management";
import trees from "./trees";
import wrappingPaper from "./wrapping-paper";

const id = "workshop";
const day = 2;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Workshop";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const foundationProgress = createResource<DecimalSource>(0, "foundation progress");

    const foundationConversion = createIndependentConversion(() => ({
        // note: 5423 is a magic number. Don't touch this or it'll self-destruct.
        scaling: addHardcap(
            addSoftcap(addSoftcap(createPolynomialScaling(250, 1.5), 5423, 1 / 1e10), 1e20, 3e8),
            computed(() =>
                management.elfTraining.expandersElfTraining.milestones[2].earned.value ? 1000 : 100
            )
        ),
        baseResource: trees.logs,
        gainResource: noPersist(foundationProgress),
        roundUpCost: true,
        // buyMax: management.elfTraining.expandersElfTraining.milestones[2].earned,
        spend(gain, spent) {
            trees.logs.value = Decimal.sub(trees.logs.value, spent);
        },
        costModifier: createSequentialModifier(() => [
            createMultiplicativeModifier(() => ({
                multiplier: computed(() => wrappingPaper.boosts.beach1.value),
                description: "Beach Wrapping Paper",
                enabled: computed(() => Decimal.gt(wrappingPaper.boosts.beach1.value, 1))
            })),
            createExponentialModifier(() => ({
                exponent: 1 / 0.99,
                description: "Hope Level 5",
                enabled: management.elfTraining.expandersElfTraining.milestones[4].earned
            }))
        ])
    }));

    const buildFoundation = createClickable(() => ({
        display: jsx(() => (
            <>
                <b style="font-size: x-large">
                    Build {formatWhole(foundationConversion.actualGain.value)}% of the foundation
                </b>
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
        visibility: () =>
            showIf(
                Decimal.lt(foundationProgress.value, 100) ||
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
        canClick: () =>
            Decimal.gte(trees.logs.value, foundationConversion.nextAt.value) &&
            (Decimal.lt(foundationProgress.value, 100) ||
                management.elfTraining.expandersElfTraining.milestones[2].earned.value),
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
    const extraExpansionMilestone1 = createMilestone(() => ({
        display: {
            requirement: "200% Foundation Completed",
            effectDisplay: "The 1% milestone is now +2% and multiplicative"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 200),
        visibility: () =>
            showIf(
                logGainMilestone3.earned.value &&
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
        showPopups: shouldShowPopups
    }));
    const extraExpansionMilestone2 = createMilestone(() => ({
        display: {
            requirement: "400% Foundation Completed",
            effectDisplay: "Gain +10% metal for every 10% foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 400),
        visibility: () =>
            showIf(
                extraExpansionMilestone1.earned.value &&
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
        showPopups: shouldShowPopups
    }));
    const extraExpansionMilestone3 = createMilestone(() => ({
        display: {
            requirement: "600% Foundation Completed",
            effectDisplay: "Gain +10% oil for every 10% foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 600),
        visibility: () =>
            showIf(
                extraExpansionMilestone2.earned.value &&
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
        showPopups: shouldShowPopups
    }));
    const extraExpansionMilestone4 = createMilestone(() => ({
        display: {
            requirement: "800% Foundation Completed",
            effectDisplay: "Gain +10% plastic for every 10% foundation completed"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 800),
        visibility: () =>
            showIf(
                extraExpansionMilestone3.earned.value &&
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
        showPopups: shouldShowPopups
    }));
    const extraExpansionMilestone5 = createMilestone(() => ({
        display: {
            requirement: "1000% Foundation Completed",
            effectDisplay: "Double paper, boxes, and all cloth actions"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1000),
        visibility: () =>
            showIf(
                extraExpansionMilestone4.earned.value &&
                    management.elfTraining.expandersElfTraining.milestones[2].earned.value
            ),
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
        logGainMilestone3,
        extraExpansionMilestone1,
        extraExpansionMilestone2,
        extraExpansionMilestone3,
        extraExpansionMilestone4,
        extraExpansionMilestone5
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
                        {formatWhole(foundationProgress.value)}
                    </h2>
                    % completed
                </div>
                {Decimal.lt(foundationProgress.value, 100) ||
                management.elfTraining.expandersElfTraining.milestones[2].earned.value ? (
                    <Spacer />
                ) : null}
                {render(buildFoundation)}
                <Spacer />
                {milestonesDisplay()}
            </>
        )),
        minimizedDisplay: jsx(() => (
            <div>
                {name} - {format(foundationProgress.value)} {foundationProgress.displayName}
            </div>
        ))
    };
});

export default layer;
