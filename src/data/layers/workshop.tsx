/**
 * @module
 * @hidden
 */
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleMilestones, createCollapsibleModifierSections } from "data/common";
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
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { render } from "util/vue";
import { computed, ref, unref, watchEffect } from "vue";
import elves from "./elves";
import factory from "./factory";
import management from "./management";
import toys from "./toys";
import trees from "./trees";
import wrappingPaper from "./wrapping-paper";

const id = "workshop";
const day = 2;
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Workshop";
    const color = "#D66B02";
    const colorDark = "#D66B02";

    const foundationProgress = createResource<DecimalSource>(0, "foundation progress");

    const maxFoundation = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 900,
            description: "Hope Level 3",
            enabled: management.elfTraining.expandersElfTraining.milestones[2].earned
        })),
        createAdditiveModifier(() => ({
            addend: 200,
            description: "Build wooden towers",
            enabled: toys.row1Upgrades[2].bought
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(factory.factoryBuyables.expandFactory.amount.value, 100),
            description: "Expand Factory",
            enabled: () => Decimal.gt(factory.factoryBuyables.expandFactory.amount.value, 0)
        }))
    ]) as WithRequired<Modifier, "revert" | "description">;
    const computedMaxFoundation = computed(() => maxFoundation.apply(100));

    const foundationConversion = createIndependentConversion(() => ({
        // note: 5423 is a magic number. Don't touch this or it'll self-destruct.
        scaling: addHardcap(
            addSoftcap(addSoftcap(createPolynomialScaling(250, 1.5), 5423, 1 / 1e10), 1e20, 3e8),
            computedMaxFoundation
        ),
        baseResource: trees.logs,
        gainResource: noPersist(foundationProgress),
        roundUpCost: true,
        // buyMax: management.elfTraining.expandersElfTraining.milestones[2].earned,
        spend(gain, spent) {
            if (masteryEffectActive.value) return;
            trees.logs.value = Decimal.sub(trees.logs.value, spent);
        },
        costModifier: createSequentialModifier(() => [
            createMultiplicativeModifier(() => ({
                multiplier: wrappingPaper.boosts.beach1,
                description: "Beach Wrapping Paper",
                enabled: computed(() => Decimal.gt(wrappingPaper.boosts.beach1.value, 1))
            })),
            createExponentialModifier(() => ({
                exponent: 1 / 0.99,
                description: "Holly Level 5",
                enabled: management.elfTraining.cutterElfTraining.milestones[4].earned
            })),
            createExponentialModifier(() => ({
                exponent: 0.1,
                description: "Scaling Jump at 1000%",
                enabled: computed(() => Decimal.gte(foundationProgress.value, 1000))
            })),
            createMultiplicativeModifier(() => ({
                multiplier: 6969, // note: 6969 is a magic number. Don't touch this or it'll self-destruct.
                description: "Scaling Jump at 1000%",
                enabled: computed(() => Decimal.gte(foundationProgress.value, 1000))
            }))
        ])
    }));

    const buildFoundation = createClickable(() => ({
        display: jsx(() => (
            <>
                <b style="font-size: x-large">
                    Build {formatWhole(foundationConversion.actualGain.value)}% of the foundation{" "}
                    <HotkeyVue hotkey={buildFoundationHK} />
                </b>
                <br />
                <br />
                <span style="font-size: large">
                    {masteryEffectActive.value ? "Requirement" : "Cost"}:{" "}
                    {displayResource(trees.logs, foundationConversion.nextAt.value)}{" "}
                    {trees.logs.displayName}
                </span>
            </>
        )),
        visibility: () => showIf(Decimal.lt(foundationProgress.value, computedMaxFoundation.value)),
        canClick: () => {
            if (Decimal.lt(trees.logs.value, foundationConversion.nextAt.value)) {
                return false;
            }
            if (main.isMastery.value && main.currentlyMastering.value?.name === "Trees") {
                return false;
            }
            if (Decimal.gte(foundationProgress.value, computedMaxFoundation.value)) {
                return false;
            }
            return true;
        },
        onClick() {
            if (!unref(this.canClick)) {
                return;
            }
            foundationConversion.convert();
        },
        style: "width: 600px; min-height: unset"
    }));

    watchEffect(() => {
        if (Decimal.lt(computedMaxFoundation.value, foundationProgress.value)) {
            foundationProgress.value = Decimal.min(0, computedMaxFoundation.value);
        }
    });

    const buildFoundationHK = createHotkey(() => ({
        key: "w",
        description: "Build foundation",
        onPress: () => {
            if (buildFoundation.canClick.value) buildFoundation.onClick();
        },
        enabled: noPersist(main.days[day - 1].opened)
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
    const extraExpansionMilestone6 = createMilestone(() => ({
        display: {
            requirement: "1200% Foundation Completed",
            effectDisplay: "Quadruple drill power"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1200),
        visibility: () =>
            showIf(extraExpansionMilestone5.earned.value && toys.row1Upgrades[2].bought.value),
        showPopups: shouldShowPopups
    }));
    const extraExpansionMilestone7 = createMilestone(() => ({
        display: {
            requirement: "1400% Foundation Completed",
            effectDisplay: "Coal has a greater effect on energy gain"
        },
        shouldEarn: () => Decimal.gte(foundationProgress.value, 1400),
        visibility: () =>
            showIf(extraExpansionMilestone6.earned.value && toys.row1Upgrades[2].bought.value),
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
        extraExpansionMilestone5,
        extraExpansionMilestone6,
        extraExpansionMilestone7
    };
    const { collapseMilestones, display: milestonesDisplay } =
        createCollapsibleMilestones(milestones);

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `backgroundColor: ${colorDark}`,
        progress: () =>
            main.day.value === day || main.currentlyMastering.value?.name === name
                ? Decimal.div(foundationProgress.value, 100)
                : 1,
        display: jsx(() =>
            main.day.value === day || main.currentlyMastering.value?.name === name ? (
                <>{formatWhole(foundationProgress.value)}%</>
            ) : (
                ""
            )
        )
    }));

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Max Foundation",
            modifier: maxFoundation,
            base: 100
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

    watchEffect(() => {
        if (main.day.value === day && Decimal.gte(foundationProgress.value, 100)) {
            main.completeDay();
        } else if (
            main.currentlyMastering.value?.name === name &&
            Decimal.gte(foundationProgress.value, 100)
        ) {
            main.completeMastery();
        }
    });

    const mastery = {
        foundationProgress: persistent<DecimalSource>(0),
        milestones: {
            logGainMilestone1: { earned: persistent<boolean>(false) },
            autoCutMilestone1: { earned: persistent<boolean>(false) },
            autoPlantMilestone1: { earned: persistent<boolean>(false) },
            autoCutMilestone2: { earned: persistent<boolean>(false) },
            autoPlantMilestone2: { earned: persistent<boolean>(false) },
            logGainMilestone2: { earned: persistent<boolean>(false) },
            morePlantsMilestone1: { earned: persistent<boolean>(false) },
            logGainMilestone3: { earned: persistent<boolean>(false) },
            extraExpansionMilestone1: { earned: persistent<boolean>(false) },
            extraExpansionMilestone2: { earned: persistent<boolean>(false) },
            extraExpansionMilestone3: { earned: persistent<boolean>(false) },
            extraExpansionMilestone4: { earned: persistent<boolean>(false) },
            extraExpansionMilestone5: { earned: persistent<boolean>(false) }
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
        foundationProgress,
        foundationConversion,
        milestones,
        collapseMilestones,
        minWidth: 700,
        buildFoundationHK,
        generalTabCollapsed,
        display: jsx(() => (
            <>
                <div>
                    {main.day.value === day
                        ? `Complete the foundation to complete the day`
                        : main.currentlyMastering.value?.name === name
                        ? `Complete the foundation to decorate the day`
                        : `${name} Complete!`}
                    {Decimal.gt(computedMaxFoundation.value, 100) ? (
                        <>
                            {" - "}
                            <button
                                class="button"
                                style="display: inline-block;"
                                onClick={() => (showModifiersModal.value = true)}
                            >
                                Check Modifiers
                            </button>
                        </>
                    ) : null}
                </div>
                {render(dayProgress)}
                {render(modifiersModal)}
                <Spacer />
                {masteryEffectActive.value ? (
                    <>
                        <div class="decoration-effect">
                            Decoration effect:
                            <br />
                            Logs are just a requirement instead of a cost
                        </div>
                        <Spacer />
                    </>
                ) : null}
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
                {name}{" "}
                <span class="desc">
                    {formatWhole(foundationProgress.value)}% {foundationProgress.displayName}
                </span>
            </div>
        )),
        mastery,
        mastered
    };
});

export default layer;
